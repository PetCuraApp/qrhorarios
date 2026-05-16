import { createHash } from 'crypto';

/** Genera hash MD5 de 8 caracteres para ofuscar el nombre de la sala en la URL */
export function hashSala(nombre: string): string {
  return createHash('md5').update(nombre).digest('hex').slice(0, 8);
}

/** Construye la URL pública de una sala */
export function urlSala(hash: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${base}/sala/${hash}`;
}
