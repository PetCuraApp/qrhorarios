import { leerHorarios } from '@/lib/storage';
import { BLOQUES_HORARIOS, calcularSemanaActual } from '@/lib/bloques';
import type { SalaData } from '@/lib/parser';
import IndexClient from './IndexClient';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const data = await leerHorarios();

  if (!data) {
    return (
      <div className="bg-gradient-radial" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
        <div className="glass anim-fade-up" style={{ maxWidth: 480, width: '90%', padding: '56px 40px', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 24 }}>📂</div>
          <h1 className="gradient-text" style={{ fontSize: '1.8rem', fontWeight: 800, marginBottom: 12 }}>
            Sin horarios cargados
          </h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32, lineHeight: 1.6 }}>
            Aún no se han publicado horarios. El administrador debe subir el archivo Excel para activar el sistema.
          </p>
          <a href="/admin" className="btn btn-primary" style={{ padding: '14px 32px' }}>
            ⚙️ Ir al panel admin
          </a>
        </div>
      </div>
    );
  }

  // Calcular la semana activa de forma dinámica en base a la fecha real
  const semanaActiva = calcularSemanaActual(
    data.semanaInicioFecha,
    data.semanasDisponibles || [],
    data.semanaActivaDefault
  );

  // Mapear cada sala para inyectar el horario correspondiente a la semana activa calculada
  const salasMapeadas: SalaData[] = data.salas.map((sala) => {
    const horarioSemana = sala.horariosPorSemana?.[semanaActiva];
    return {
      ...sala,
      horario: horarioSemana || sala.horario,
    };
  });

  return (
    <IndexClient
      salas={salasMapeadas}
      semana={semanaActiva}
      generado={data.generado}
      totalSalas={data.totalSalas}
    />
  );
}

