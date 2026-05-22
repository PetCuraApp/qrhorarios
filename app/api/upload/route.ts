import { NextRequest, NextResponse } from 'next/server';
import { parsearExcel, getSemanas, detectarSemanaActiva } from '@/lib/parser';
import { guardarHorarios, guardarExcel } from '@/lib/storage';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const semanaParam = (formData.get('semana') as string) || 'auto';

    if (!file) {
      return NextResponse.json({ error: 'No se subió ningún archivo' }, { status: 400 });
    }

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      return NextResponse.json({ error: 'El archivo debe ser .xlsx o .xls' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parsear el Excel
    const data = parsearExcel(buffer, semanaParam);

    // Guardar datos procesados
    await guardarHorarios(data);

    // Guardar Excel original como respaldo (si hay Blob configurado)
    const excelUrl = await guardarExcel(buffer, `horarios-${data.semanaActivaDefault}-${Date.now()}.xlsx`);

    // Limpiar cache de la página principal y las salas
    revalidatePath('/');
    revalidatePath('/sala/[hash]');

    return NextResponse.json({
      ok: true,
      semana: data.semanaActivaDefault,
      totalSalas: data.totalSalas,
      semanasDisponibles: data.semanasDisponibles,
      generado: data.generado,
      excelUrl,
    });
  } catch (error: unknown) {
    console.error('[upload] Error:', error);
    const message = error instanceof Error ? error.message : 'Error al procesar el archivo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


/** GET /api/upload — retorna semanas disponibles sin procesar (preview) */
export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No se subió archivo' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    const semanas = getSemanas(rows);
    const semanaActiva = detectarSemanaActiva(rows);
    const totalFilas = rows.length;

    // Contar activos por semana
    const conteos: Record<string, number> = {};
    for (const s of semanas) {
      conteos[s] = rows.filter((r) => r[s] === 1).length;
    }

    return NextResponse.json({ semanas, semanaActiva, totalFilas, conteos });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al leer el archivo';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
