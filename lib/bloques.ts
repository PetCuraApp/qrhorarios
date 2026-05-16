// Definición de los 7 bloques horarios estándar
// Orden: [inicio, fin, etiqueta]
export const BLOQUES_HORARIOS: [string, string, string][] = [
  ['08:10:00', '09:40:00', '08:10 - 09:40'],
  ['09:50:00', '11:20:00', '09:50 - 11:20'],
  ['11:30:00', '13:00:00', '11:30 - 13:00'],
  ['14:10:00', '15:40:00', '14:10 - 15:40'],
  ['15:50:00', '17:20:00', '15:50 - 17:20'],
  ['17:30:00', '19:00:00', '17:30 - 19:00'],
  ['19:10:00', '20:40:00', '19:10 - 20:40'],
];

export interface BloqueHorario {
  inicio: string;
  fin: string;
  label: string;
  orden: number;
}

export function getBloques(): BloqueHorario[] {
  return BLOQUES_HORARIOS.map(([inicio, fin, label], i) => ({
    inicio,
    fin,
    label,
    orden: i,
  }));
}

/** Convierte "08:10:00" a minutos desde medianoche */
export function timeToMinutes(t: string): number {
  const parts = t.split(':').map(Number);
  return parts[0] * 60 + parts[1];
}

/** Dado un rango horario, retorna los bloques de 90 min que ocupa */
export function obtenerBloquesOcupados(
  horaInicio: string,
  horaFin: string
): BloqueHorario[] {
  // Normaliza a HH:MM:SS
  const norm = (t: string) => {
    const clean = t.substring(0, 8).padEnd(8, ':00');
    return clean.length >= 8 ? clean.substring(0, 8) : `${t}:00`;
  };

  const inicio = norm(horaInicio);
  const fin = norm(horaFin);

  return getBloques().filter(
    (b) => inicio < b.fin && fin > b.inicio
  );
}

/** Retorna el índice del bloque activo para la hora actual (o -1) */
export function getBloqueActual(): number {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(
    now.getMinutes()
  ).padStart(2, '0')}:00`;

  return BLOQUES_HORARIOS.findIndex(
    ([inicio, fin]) => hhmm >= inicio && hhmm < fin
  );
}
