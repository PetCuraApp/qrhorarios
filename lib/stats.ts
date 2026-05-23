import { supabase } from './supabase';

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

// ─── Fechas helpers ───────────────────────────────────────────────────────────

export function getFechaHoy(): string {
  const now = new Date();
  return now.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
}

export function getMesActual(): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' });
  return dateStr.substring(0, 7); // YYYY-MM
}

// ─── API pública: Registrar un escaneo ────────────────────────────────────────

export async function registrarEscaneo(hash: string, nombre: string): Promise<void> {
  try {
    const { error } = await supabase
      .from('scans')
      .insert({
        sala_hash: hash,
        sala_nombre: nombre,
      });

    if (error) {
      console.error('[stats] Error al registrar escaneo en Supabase:', error);
    }
  } catch (error) {
    console.error('[stats] Excepción registrando escaneo:', error);
  }
}

// ─── API pública: Leer estadísticas globales (para el panel admin) ────────────

export async function leerStats(): Promise<StatsData> {
  const resultado: StatsData = {
    global: { total: 0, diario: {}, mensual: {} },
    salas: {},
  };

  try {
    // Consultar la vista de agregación en la base de datos
    const { data: summaryData, error } = await supabase
      .from('daily_scans_summary')
      .select('*');

    if (error) {
      console.warn('[stats] La vista "daily_scans_summary" no está disponible. Usando fallback en memoria:', error.message);
      return await leerStatsFallback();
    }

    if (!summaryData) return resultado;

    for (const row of summaryData) {
      const hash = row.sala_hash;
      const nombre = row.sala_nombre;
      const dia = row.dia; // Formato YYYY-MM-DD proveído por to_char
      const count = Number(row.count);
      const mes = dia.substring(0, 7); // YYYY-MM

      if (!resultado.salas[hash]) {
        resultado.salas[hash] = {
          nombre,
          hash,
          total: 0,
          diario: {},
          mensual: {},
        };
      }

      const sala = resultado.salas[hash];
      sala.total += count;
      sala.diario[dia] = (sala.diario[dia] ?? 0) + count;
      sala.mensual[mes] = (sala.mensual[mes] ?? 0) + count;

      // Acumular globales
      resultado.global.total += count;
      resultado.global.diario[dia] = (resultado.global.diario[dia] ?? 0) + count;
      resultado.global.mensual[mes] = (resultado.global.mensual[mes] ?? 0) + count;
    }

  } catch (e) {
    console.error('[stats] Excepción procesando estadísticas en leerStats:', e);
  }

  return resultado;
}

/** Fallback en memoria si la vista agregada de base de datos no existe (limita a 1000 registros para evitar sobrecarga) */
async function leerStatsFallback(): Promise<StatsData> {
  const resultado: StatsData = {
    global: { total: 0, diario: {}, mensual: {} },
    salas: {},
  };

  try {
    const { data: rawScans, error } = await supabase
      .from('scans')
      .select('sala_hash, sala_nombre, created_at')
      .order('created_at', { ascending: false })
      .limit(1000);

    if (error || !rawScans) {
      console.error('[stats] Fallback de estadísticas falló:', error);
      return resultado;
    }

    for (const scan of rawScans) {
      const hash = scan.sala_hash;
      const nombre = scan.sala_nombre;
      
      const date = new Date(scan.created_at);
      const dia = date.toLocaleDateString('sv-SE', { timeZone: 'America/Santiago' }); // YYYY-MM-DD
      const mes = dia.substring(0, 7);

      if (!resultado.salas[hash]) {
        resultado.salas[hash] = {
          nombre,
          hash,
          total: 0,
          diario: {},
          mensual: {},
        };
      }

      const sala = resultado.salas[hash];
      sala.total += 1;
      sala.diario[dia] = (sala.diario[dia] ?? 0) + 1;
      sala.mensual[mes] = (sala.mensual[mes] ?? 0) + 1;

      resultado.global.total += 1;
      resultado.global.diario[dia] = (resultado.global.diario[dia] ?? 0) + 1;
      resultado.global.mensual[mes] = (resultado.global.mensual[mes] ?? 0) + 1;
    }
  } catch (e) {
    console.error('[stats] Excepción en fallback de estadísticas:', e);
  }

  return resultado;
}
