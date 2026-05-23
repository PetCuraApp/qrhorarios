/**
 * Storage abstraction usando Supabase para base de datos y archivos.
 */

import type { HorariosData } from './parser';
import { supabase } from './supabase';

const DATA_BUCKET_NAME = 'excel-backups';

/** Guarda el JSON de horarios procesados en Supabase */
export async function guardarHorarios(data: HorariosData): Promise<void> {
  // 1. Guardar la configuración general
  const configValue = {
    semanaActivaDefault: data.semanaActivaDefault,
    semanaInicioFecha: data.semanaInicioFecha || null,
    semanasDisponibles: data.semanasDisponibles,
    generado: data.generado,
  };

  const { error: configError } = await supabase
    .from('config')
    .upsert(
      { key: 'horarios_config', value: configValue },
      { onConflict: 'key' }
    );

  if (configError) {
    console.error('Error guardando configuración en Supabase:', configError);
    throw new Error(`Error en configuración: ${configError.message}`);
  }

  // 2. Guardar las salas limpiando las anteriores (limpieza completa e inserción)
  const { error: deleteError } = await supabase
    .from('salas')
    .delete()
    .neq('hash', ''); // Elimina todas las salas existentes

  if (deleteError) {
    console.error('Error limpiando salas en Supabase:', deleteError);
    throw new Error(`Error al limpiar salas: ${deleteError.message}`);
  }

  if (data.salas.length > 0) {
    const rowsToInsert = data.salas.map((sala) => ({
      nombre: sala.nombre,
      hash: sala.hash,
      horario: sala.horario,
      horarios_por_semana: sala.horariosPorSemana,
    }));

    const { error: insertError } = await supabase
      .from('salas')
      .insert(rowsToInsert);

    if (insertError) {
      console.error('Error insertando salas en Supabase:', insertError);
      throw new Error(`Error al insertar salas: ${insertError.message}`);
    }
  }
}

/** Lee el JSON de horarios procesados desde Supabase */
export async function leerHorarios(): Promise<HorariosData | null> {
  try {
    // Consultas en paralelo para optimizar la velocidad
    const [configResult, salasResult] = await Promise.all([
      supabase.from('config').select('value').eq('key', 'horarios_config').maybeSingle(),
      supabase.from('salas').select('nombre, hash, horario, horarios_por_semana').order('nombre', { ascending: true }),
    ]);

    if (configResult.error) {
      console.error('Error consultando configuración:', configResult.error);
      return null;
    }

    // Si no hay configuración inicial, retornar null (sin horarios cargados)
    if (!configResult.data) {
      return null;
    }

    const config = configResult.data.value as any;
    const salasData = salasResult.data || [];

    const salasMapped = salasData.map((s: any) => ({
      nombre: s.nombre,
      hash: s.hash,
      horario: s.horario,
      horariosPorSemana: s.horarios_por_semana,
    }));

    return {
      salas: salasMapped,
      semanaActivaDefault: config.semanaActivaDefault,
      semanaInicioFecha: config.semanaInicioFecha || undefined,
      semanasDisponibles: config.semanasDisponibles || [],
      generado: config.generado,
      totalSalas: salasMapped.length,
    };
  } catch (e) {
    console.error('Error leyendo horarios de Supabase:', e);
    return null;
  }
}

/** Guarda el Excel original en el Storage de Supabase */
export async function guardarExcel(buffer: Buffer, filename: string): Promise<string | null> {
  try {
    const { error } = await supabase.storage
      .from(DATA_BUCKET_NAME)
      .upload(filename, buffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: true,
      });

    if (error) {
      console.error('Error subiendo Excel a Supabase Storage:', error);
      return null;
    }

    // Obtener la URL pública del archivo subido
    const { data } = supabase.storage
      .from(DATA_BUCKET_NAME)
      .getPublicUrl(filename);

    return data.publicUrl;
  } catch (e) {
    console.error('Excepción al subir Excel a Supabase:', e);
    return null;
  }
}

/** Actualiza los metadatos de configuración sin alterar los horarios (recalcula el fallback de horarios por sala) */
export async function actualizarConfig(semanaActivaDefault: string, semanaInicioFecha?: string): Promise<boolean> {
  try {
    // 1. Leer la configuración existente
    const { data: configData, error: readConfigError } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'horarios_config')
      .maybeSingle();

    if (readConfigError || !configData) {
      return false;
    }

    const config = configData.value as any;
    config.semanaActivaDefault = semanaActivaDefault;
    if (semanaInicioFecha !== undefined) {
      config.semanaInicioFecha = semanaInicioFecha || null;
    }
    config.generado = new Date().toISOString();

    // 2. Guardar la configuración actualizada
    const { error: updateConfigError } = await supabase
      .from('config')
      .update({ value: config })
      .eq('key', 'horarios_config');

    if (updateConfigError) {
      console.error('Error al actualizar config en Supabase:', updateConfigError);
      return false;
    }

    // 3. Actualizar el fallback de horarios por sala para la semana predeterminada
    const { data: salasData, error: salasError } = await supabase
      .from('salas')
      .select('id, nombre, hash, horarios_por_semana');

    if (salasError || !salasData) {
      console.error('Error consultando salas para actualizar config:', salasError);
      return false;
    }

    if (salasData.length > 0) {
      const updates = salasData.map((sala: any) => {
        const horariosPorSemana = sala.horarios_por_semana || {};
        const horario = horariosPorSemana[semanaActivaDefault] || {};
        return {
          id: sala.id,
          nombre: sala.nombre,
          hash: sala.hash,
          horarios_por_semana: horariosPorSemana,
          horario: horario,
        };
      });

      const { error: updateSalasError } = await supabase
        .from('salas')
        .upsert(updates);

      if (updateSalasError) {
        console.error('Error actualizando fallback de horarios de salas en bulk:', updateSalasError);
        return false;
      }
    }

    return true;
  } catch (e) {
    console.error('Excepción actualizando configuración en Supabase:', e);
    return false;
  }
}
