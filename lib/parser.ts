import * as XLSX from 'xlsx';
import { obtenerBloquesOcupados, BLOQUES_HORARIOS } from './bloques';
import { hashSala } from './hash';

// ─── Tipos de datos ──────────────────────────────────────────────────────────

export interface ClaseDia {
  codigo: string;
  nombre: string;
  horaInicio: string;
  horaFin: string;
  multibloque: boolean;
}

export interface BloqueData {
  label: string;
  orden: number;
  clases: Partial<Record<string, ClaseDia>>;
}

export type HorarioSala = Record<string, BloqueData>;

export interface SalaData {
  nombre: string;
  hash: string;
  horario: HorarioSala; // Fallback / Horario de la semana activa por defecto
  horariosPorSemana: Record<string, HorarioSala>; // Horario por cada semana disponible
}

export interface HorariosData {
  salas: SalaData[];
  semanaActivaDefault: string; // Semana predeterminada (ej: S10)
  semanaInicioFecha?: string; // Fecha de inicio de clases (ej: "2026-03-09")
  generado: string;
  totalSalas: number;
  semanasDisponibles: string[];
}

// ─── Constantes ───────────────────────────────────────────────────────────────

const DIAS_ORDEN = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

// Posibles nombres de columna en el Excel (normalizado a minúsculas)
const COL_SALA = ['sala'];
const COL_DIA = ['dia', 'día'];
const COL_INICIO = ['hora inicio', 'hora_inicio', 'inicio', 'h. inicio'];
const COL_FIN = ['hora fin', 'hora_fin', 'fin', 'h. fin'];
const COL_ASIGNATURA = ['asignatura', 'codigo', 'código', 'cod'];
const COL_NOMBRE = ['nombre', 'asignatura nombre', 'descripcion', 'descripción'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function findCol(headers: string[], candidates: string[]): string | null {
  const lower = headers.map((h) => h.toLowerCase().trim());
  for (const c of candidates) {
    const idx = lower.indexOf(c);
    if (idx !== -1) return headers[idx];
  }
  return null;
}

function excelTimeToHHMM(val: unknown): string {
  if (typeof val === 'number') {
    // Excel guarda hora como fracción del día
    const totalMin = Math.round(val * 24 * 60);
    const h = Math.floor(totalMin / 60);
    const m = totalMin % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    return val.substring(0, 5); // "08:10:00" → "08:10"
  }
  return '00:00';
}

function excelTimeToHHMMSS(val: unknown): string {
  if (typeof val === 'number') {
    const totalSec = Math.round(val * 24 * 3600);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  if (typeof val === 'string') {
    return val.length >= 8 ? val.substring(0, 8) : `${val}:00`;
  }
  return '00:00:00';
}

/** Detecta la semana con más registros activos (columna Sx con más 1s) */
export function detectarSemanaActiva(
  rows: Record<string, unknown>[]
): string {
  const semanaPattern = /^S\d+$/i;
  const headers = Object.keys(rows[0] || {});
  const semanas = headers.filter((h) => semanaPattern.test(h.trim()));

  if (semanas.length === 0) return 'TODAS';

  let maxCount = 0;
  let semanaActiva = semanas[semanas.length - 1];

  for (const s of semanas) {
    const count = rows.filter((r) => r[s] === 1).length;
    if (count > maxCount) {
      maxCount = count;
      semanaActiva = s;
    }
  }

  return semanaActiva;
}

/** Retorna todas las semanas disponibles en el Excel */
export function getSemanas(rows: Record<string, unknown>[]): string[] {
  const semanaPattern = /^S\d+$/i;
  const headers = Object.keys(rows[0] || {});
  return headers.filter((h) => semanaPattern.test(h.trim()));
}

// ─── Función principal de parseo ─────────────────────────────────────────────

export function parsearExcel(
  buffer: Buffer,
  semanaElegida: string = 'auto'
): HorariosData {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: false });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

  if (rows.length === 0) throw new Error('El Excel está vacío');

  const headers = Object.keys(rows[0]);

  // Detectar columnas
  const colSala = findCol(headers, COL_SALA);
  const colDia = findCol(headers, COL_DIA);
  const colInicio = findCol(headers, COL_INICIO);
  const colFin = findCol(headers, COL_FIN);
  const colAsignatura = findCol(headers, COL_ASIGNATURA);
  const colNombre = findCol(headers, COL_NOMBRE);

  if (!colSala || !colDia || !colInicio || !colFin || !colAsignatura || !colNombre) {
    const missing = [
      !colSala && 'SALA',
      !colDia && 'DIA',
      !colInicio && 'HORA INICIO',
      !colFin && 'HORA FIN',
      !colAsignatura && 'ASIGNATURA',
      !colNombre && 'NOMBRE',
    ]
      .filter(Boolean)
      .join(', ');
    throw new Error(`Columnas no encontradas en el Excel: ${missing}`);
  }

  // Determinar semanas disponibles
  let semanasDisponibles = getSemanas(rows);
  if (semanasDisponibles.length === 0) {
    semanasDisponibles = ['TODAS'];
  }

  // Determinar semana activa por defecto
  const semanaActivaDefault =
    semanaElegida === 'auto' || semanaElegida === ''
      ? (semanasDisponibles.includes('TODAS') ? 'TODAS' : detectarSemanaActiva(rows))
      : semanaElegida;

  // Obtener todos los nombres únicos de sala
  const nombresSalasUnicos = Array.from(
    new Set(
      rows
        .map((r) => String(r[colSala] || '').trim())
        .filter(Boolean)
    )
  );

  // Inicializar mapa de salas a sus horarios de semanas
  const salasResultMap = new Map<string, {
    hash: string;
    horariosPorSemana: Record<string, HorarioSala>;
  }>();

  for (const nombreSala of nombresSalasUnicos) {
    salasResultMap.set(nombreSala, {
      hash: hashSala(nombreSala),
      horariosPorSemana: {},
    });
  }

  // Helper para inicializar un horario vacío
  const crearHorarioVacio = (): HorarioSala => {
    const horario: HorarioSala = {};
    for (let i = 0; i < BLOQUES_HORARIOS.length; i++) {
      const [inicio, fin, label] = BLOQUES_HORARIOS[i];
      const clave = `${inicio}_${fin}`;
      horario[clave] = { label, orden: i, clases: {} };
    }
    return horario;
  };

  // Procesar cada semana de forma independiente
  for (const sem of semanasDisponibles) {
    // Filtrar filas activas para esta semana
    const rowsSemana = sem === 'TODAS'
      ? rows
      : rows.filter((r) => r[sem] === 1);

    // Agrupar por sala para esta semana
    const salasMapSemana = new Map<string, HorarioSala>();

    for (const row of rowsSemana) {
      const nombreSala = String(row[colSala] || '').trim();
      if (!nombreSala) continue;

      const dia = String(row[colDia] || '').trim();
      if (!DIAS_ORDEN.includes(dia)) continue;

      const horaInicioRaw = row[colInicio];
      const horaFinRaw = row[colFin];
      const asignatura = String(row[colAsignatura] || '').trim();
      const nombre = String(row[colNombre] || '').trim();

      const horaInicioHHMM = excelTimeToHHMM(horaInicioRaw);
      const horaFinHHMM = excelTimeToHHMM(horaFinRaw);
      const horaInicioHHMMSS = excelTimeToHHMMSS(horaInicioRaw);
      const horaFinHHMMSS = excelTimeToHHMMSS(horaFinRaw);

      if (!salasMapSemana.has(nombreSala)) {
        salasMapSemana.set(nombreSala, crearHorarioVacio());
      }

      const horario = salasMapSemana.get(nombreSala)!;
      const bloquesOcupados = obtenerBloquesOcupados(horaInicioHHMMSS, horaFinHHMMSS);

      for (const bloque of bloquesOcupados) {
        const clave = `${bloque.inicio}_${bloque.fin}`;
        if (!horario[clave]) continue;
        if (horario[clave].clases[dia]) continue; // ya hay clase en ese bloque y día

        horario[clave].clases[dia] = {
          codigo: asignatura,
          nombre,
          horaInicio: horaInicioHHMM,
          horaFin: horaFinHHMM,
          multibloque: bloquesOcupados.length > 1,
        };
      }
    }

    // Guardar los horarios procesados para esta semana en cada sala
    for (const nombreSala of nombresSalasUnicos) {
      const salaData = salasResultMap.get(nombreSala)!;
      salaData.horariosPorSemana[sem] = salasMapSemana.get(nombreSala) || crearHorarioVacio();
    }
  }

  // Construir resultado final estructurado
  const salas: SalaData[] = Array.from(salasResultMap.entries()).map(
    ([nombre, data]) => {
      const horario = data.horariosPorSemana[semanaActivaDefault] || crearHorarioVacio();
      return {
        nombre,
        hash: data.hash,
        horario,
        horariosPorSemana: data.horariosPorSemana,
      };
    }
  );

  return {
    salas,
    semanaActivaDefault,
    generado: new Date().toISOString(),
    totalSalas: salas.length,
    semanasDisponibles,
  };
}

