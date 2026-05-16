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
  horario: HorarioSala;
}

export interface HorariosData {
  salas: SalaData[];
  semana: string;
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

  // Determinar semana activa
  const semanasDisponibles = getSemanas(rows);
  const semana =
    semanaElegida === 'auto' || semanaElegida === ''
      ? detectarSemanaActiva(rows)
      : semanaElegida;

  // Filtrar filas activas
  let rowsActivos = rows;
  if (semana !== 'TODAS' && semanasDisponibles.includes(semana)) {
    rowsActivos = rows.filter((r) => r[semana] === 1);
  }

  // Agrupar por sala
  const salasMap = new Map<string, HorarioSala>();

  for (const row of rowsActivos) {
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

    // Inicializar sala si no existe
    if (!salasMap.has(nombreSala)) {
      const horario: HorarioSala = {};
      for (let i = 0; i < BLOQUES_HORARIOS.length; i++) {
        const [inicio, fin, label] = BLOQUES_HORARIOS[i];
        const clave = `${inicio}_${fin}`;
        horario[clave] = { label, orden: i, clases: {} };
      }
      salasMap.set(nombreSala, horario);
    }

    const horario = salasMap.get(nombreSala)!;
    const bloquesOcupados = obtenerBloquesOcupados(horaInicioHHMMSS, horaFinHHMMSS);

    for (const bloque of bloquesOcupados) {
      const clave = `${bloque.inicio}_${bloque.fin}`;
      if (!horario[clave]) continue;
      if (horario[clave].clases[dia]) continue; // ya hay una clase en ese bloque/día

      horario[clave].clases[dia] = {
        codigo: asignatura,
        nombre,
        horaInicio: horaInicioHHMM,
        horaFin: horaFinHHMM,
        multibloque: bloquesOcupados.length > 1,
      };
    }
  }

  // Construir resultado final
  const salas: SalaData[] = Array.from(salasMap.entries()).map(
    ([nombre, horario]) => ({
      nombre,
      hash: hashSala(nombre),
      horario,
    })
  );

  return {
    salas,
    semana,
    generado: new Date().toISOString(),
    totalSalas: salas.length,
    semanasDisponibles,
  };
}
