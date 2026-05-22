/**
 * Stats — Tracking de escaneos de QR por sala.
 *
 * Estrategia: un archivo independiente por sala (stats/{hash}.json).
 * - Elimina las race conditions entre salas distintas.
 * - Los conteos globales se calculan sumando todos los archivos por sala.
 * - Usa escritura atómica (write-to-temp + rename) para evitar corrupción.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface ConteoFechas {
  [fecha: string]: number; // ej: "2026-05-21": 45  |  "2026-05": 340
}

export interface SalaStatsEntry {
  nombre: string;
  hash: string;
  total: number;
  diario: ConteoFechas;  // clave: "YYYY-MM-DD"
  mensual: ConteoFechas; // clave: "YYYY-MM"
}

export interface StatsData {
  global: {
    total: number;
    diario: ConteoFechas;
    mensual: ConteoFechas;
  };
  salas: Record<string, SalaStatsEntry>;
}

// ─── Rutas ────────────────────────────────────────────────────────────────────

const LOCAL_STATS_DIR = path.join(process.cwd(), 'data', 'stats');

function localSalaPath(hash: string): string {
  return path.join(LOCAL_STATS_DIR, `${hash}.json`);
}

function blobSalaPath(hash: string): string {
  return `stats/${hash}.json`;
}

// ─── Fechas helpers ───────────────────────────────────────────────────────────

export function getFechaHoy(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function getMesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Lectura de stats de una sala ─────────────────────────────────────────────

async function leerSalaStats(hash: string, nombre: string): Promise<SalaStatsEntry> {
  const empty: SalaStatsEntry = { nombre, hash, total: 0, diario: {}, mensual: {} };
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

  if (hasToken) {
    try {
      const { list } = await import('@vercel/blob');
      const prefix = blobSalaPath(hash);
      const { blobs } = await list({ prefix });
      if (blobs.length === 0) return empty;
      const res = await fetch(blobs[0].url, { cache: 'no-store' });
      if (!res.ok) return empty;
      return (await res.json()) as SalaStatsEntry;
    } catch {
      return empty;
    }
  } else {
    const filePath = localSalaPath(hash);
    if (!fs.existsSync(filePath)) return empty;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as SalaStatsEntry;
    } catch {
      return empty;
    }
  }
}

// ─── Escritura atómica de stats de una sala ───────────────────────────────────

async function escribirSalaStats(entry: SalaStatsEntry): Promise<void> {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const json = JSON.stringify(entry);

  if (hasToken) {
    const { put } = await import('@vercel/blob');
    await put(blobSalaPath(entry.hash), json, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: false,
      allowOverwrite: true, // Enable overwriting an existing blob with the same pathname
    });
  } else {
    // Escritura atómica: escribir en temporal y renombrar (operación atómica del SO)
    if (!fs.existsSync(LOCAL_STATS_DIR)) {
      fs.mkdirSync(LOCAL_STATS_DIR, { recursive: true });
    }
    const dest = localSalaPath(entry.hash);
    const tmp = path.join(os.tmpdir(), `qrh-stats-${entry.hash}-${Date.now()}.json`);
    fs.writeFileSync(tmp, json, 'utf-8');
    fs.renameSync(tmp, dest); // Atómico en el mismo volumen
  }
}

// ─── Mutex por sala (en memoria, funciona dentro del mismo proceso) ────────────

const mutexMap = new Map<string, Promise<void>>();

function enqueueForSala(hash: string, fn: () => Promise<void>): Promise<void> {
  const prev = mutexMap.get(hash) ?? Promise.resolve();
  const next = prev.then(fn).catch((err) => {
    console.error(`[stats] Error procesando sala ${hash}:`, err);
  });
  mutexMap.set(hash, next);
  // Limpiar el mapa cuando termine para no crecer indefinidamente
  next.finally(() => {
    if (mutexMap.get(hash) === next) mutexMap.delete(hash);
  });
  return next;
}

// ─── API pública: Registrar un escaneo ────────────────────────────────────────

export function registrarEscaneo(hash: string, nombre: string): Promise<void> {
  return enqueueForSala(hash, async () => {
    const entry = await leerSalaStats(hash, nombre);
    const hoy = getFechaHoy();
    const mes = getMesActual();

    entry.nombre = nombre; // Actualizar nombre por si cambió
    entry.total = (entry.total ?? 0) + 1;
    entry.diario[hoy] = (entry.diario[hoy] ?? 0) + 1;
    entry.mensual[mes] = (entry.mensual[mes] ?? 0) + 1;

    await escribirSalaStats(entry);
  });
}

// ─── API pública: Leer estadísticas globales (para el panel admin) ────────────

export async function leerStats(): Promise<StatsData> {
  const hasToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  const hoy = getFechaHoy();
  const mes = getMesActual();

  const resultado: StatsData = {
    global: { total: 0, diario: {}, mensual: {} },
    salas: {},
  };

  let salasEntries: SalaStatsEntry[] = [];

  if (hasToken) {
    try {
      const { list } = await import('@vercel/blob');
      const { blobs } = await list({ prefix: 'stats/' });
      const fetches = blobs.map(async (blob) => {
        try {
          const res = await fetch(blob.url, { cache: 'no-store' });
          if (!res.ok) return null;
          return (await res.json()) as SalaStatsEntry;
        } catch {
          return null;
        }
      });
      const results = await Promise.all(fetches);
      salasEntries = results.filter(Boolean) as SalaStatsEntry[];
    } catch (err) {
      console.error('[stats] Error leyendo blobs de stats:', err);
    }
  } else {
    if (fs.existsSync(LOCAL_STATS_DIR)) {
      const files = fs.readdirSync(LOCAL_STATS_DIR).filter((f) => f.endsWith('.json'));
      for (const file of files) {
        try {
          const content = fs.readFileSync(path.join(LOCAL_STATS_DIR, file), 'utf-8');
          salasEntries.push(JSON.parse(content) as SalaStatsEntry);
        } catch { /* ignorar archivos corruptos */ }
      }
    }
  }

  // Agregar cada sala y acumular globales
  for (const entry of salasEntries) {
    resultado.salas[entry.hash] = entry;

    // Acumular globales
    resultado.global.total += entry.total ?? 0;

    for (const [fecha, count] of Object.entries(entry.diario ?? {})) {
      resultado.global.diario[fecha] = (resultado.global.diario[fecha] ?? 0) + count;
    }
    for (const [fecha, count] of Object.entries(entry.mensual ?? {})) {
      resultado.global.mensual[fecha] = (resultado.global.mensual[fecha] ?? 0) + count;
    }
  }

  return resultado;
}
