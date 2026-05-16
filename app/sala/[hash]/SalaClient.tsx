'use client';
import { useEffect, useState } from 'react';
import type { SalaData, BloqueData, ClaseDia } from '@/lib/parser';
import { BLOQUES_HORARIOS } from '@/lib/bloques';

interface Props {
  sala: SalaData;
  semana: string;
  generado: string;
}

const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
const DIA_SHORT: Record<string, string> = {
  Lunes: 'Lun', Martes: 'Mar', Miércoles: 'Mié', Jueves: 'Jue', Viernes: 'Vie'
};

function getBloqueActual(): number {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  return BLOQUES_HORARIOS.findIndex(([inicio, fin]) => hhmm >= inicio && hhmm < fin);
}

function ClassCell({ clase }: { clase: ClaseDia }) {
  const nombre = clase.nombre.length > 38 ? clase.nombre.slice(0, 38) + '…' : clase.nombre;
  return (
    <td className={`class-cell${clase.multibloque ? ' multibloque' : ''}`}>
      <div className="class-code">{clase.codigo}</div>
      <div className="class-name">{nombre}</div>
      {clase.multibloque && (
        <div className="class-time">⏱ {clase.horaInicio}–{clase.horaFin}</div>
      )}
    </td>
  );
}

export default function SalaClient({ sala, semana, generado }: Props) {
  const [bloqueActual, setBloqueActual] = useState(-1);
  const [hora, setHora] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const update = () => {
      setBloqueActual(getBloqueActual());
      const now = new Date();
      setHora(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 30000);
    setIsMobile(window.innerWidth < 640);
    return () => clearInterval(interval);
  }, []);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: `Horario — ${sala.nombre}`,
        url: window.location.href,
      });
    } else {
      await navigator.clipboard.writeText(window.location.href);
      alert('URL copiada al portapapeles');
    }
  };

  const handlePrint = () => window.print();

  const bloques = BLOQUES_HORARIOS.map(([inicio, fin, label], i) => {
    const clave = `${inicio}_${fin}`;
    const bloque: BloqueData = sala.horario[clave] || { label, orden: i, clases: {} };
    return { clave, label, orden: i, bloque };
  });

  const fechaGen = new Date(generado).toLocaleDateString('es-ES', { dateStyle: 'medium' });

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* Background orb */}
      <div style={{
        position: 'fixed', top: '-5%', right: '-5%', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(70px)'
      }} />

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 16px 60px' }}>
        {/* Header */}
        <header className="anim-fade-up" style={{
          padding: '28px 0 20px',
          borderBottom: '1px solid var(--border)',
          marginBottom: 28,
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: 16
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <a href="/" style={{
                color: 'var(--text-muted)', fontSize: '0.82rem', textDecoration: 'none',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                ← Todas las salas
              </a>
            </div>
            <h1 style={{ fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 }}>
              <span className="gradient-text">📍 {sala.nombre}</span>
            </h1>
            <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className="badge badge-accent">📅 Semana {semana}</span>
              {bloqueActual >= 0 && (
                <span className="badge badge-now">🟢 Activa ahora</span>
              )}
              <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                Actualizado: {fechaGen}
              </span>
              {hora && (
                <span style={{ color: 'var(--text-subtle)', fontSize: '0.78rem', fontFamily: 'monospace' }}>
                  🕐 {hora}
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
            <button onClick={handleShare} className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: '0.82rem' }}>
              🔗 Compartir
            </button>
            <button onClick={handlePrint} className="btn btn-ghost" style={{ padding: '10px 16px', fontSize: '0.82rem' }}>
              🖨️ Imprimir
            </button>
          </div>
        </header>

        {/* Leyenda móvil */}
        {bloqueActual >= 0 && (
          <div className="anim-fade-in" style={{
            marginBottom: 20,
            background: 'rgba(99,102,241,0.08)',
            border: '1px solid rgba(99,102,241,0.25)',
            borderRadius: 12, padding: '12px 20px',
            display: 'flex', alignItems: 'center', gap: 12
          }}>
            <span style={{ fontSize: 20 }}>▶</span>
            <div>
              <p style={{ fontWeight: 600, fontSize: '0.9rem', color: '#a5b4fc' }}>
                Bloque activo: {BLOQUES_HORARIOS[bloqueActual][2]}
              </p>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                La fila resaltada corresponde al horario actual
              </p>
            </div>
          </div>
        )}

        {/* Tabla */}
        <div className="glass anim-fade-up delay-1" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="schedule-table">
              <thead>
                <tr>
                  <th>Horario</th>
                  {DIAS.map((d) => (
                    <th key={d}>{isMobile ? DIA_SHORT[d] : d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bloques.map(({ clave, label, orden, bloque }, idx) => {
                  const esAhora = idx === bloqueActual;
                  return (
                    <tr key={clave} className={esAhora ? 'row-now' : ''}>
                      <td className="hour-cell">
                        {label.split(' - ').map((t, i) => (
                          <div key={i} style={{ lineHeight: 1.4 }}>{t}</div>
                        ))}
                      </td>
                      {DIAS.map((dia) => {
                        const clase = bloque.clases[dia];
                        if (!clase) {
                          return <td key={dia} className="empty-cell">—</td>;
                        }
                        if (clase.codigo === 'BLOQUEO' || clase.nombre === 'BLOQUEO') {
                          return (
                            <td key={dia} className="block-cell" style={{ textAlign: 'center', color: 'var(--warning)', fontWeight: 600 }}>
                              🔒 Bloqueada
                            </td>
                          );
                        }
                        return <ClassCell key={dia} clase={clase} />;
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Leyenda */}
        <div className="anim-fade-up delay-2" style={{
          marginTop: 24, display: 'flex', gap: 20, flexWrap: 'wrap',
          padding: '16px 20px', borderRadius: 12,
          background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)'
        }}>
          {[
            { color: 'var(--accent)', label: 'Clase simple' },
            { color: 'var(--accent-2)', label: 'Clase multibloque' },
            { color: 'var(--warning)', label: 'Sala bloqueada' },
          ].map((l) => (
            <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: l.color, flexShrink: 0 }} />
              {l.label}
            </div>
          ))}
          {bloqueActual >= 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#a5b4fc' }}>
              <div style={{ width: 12, height: 12, borderRadius: 3, background: 'rgba(99,102,241,0.4)', flexShrink: 0 }} />
              Bloque actual
            </div>
          )}
        </div>

        {/* Print QR info */}
        <div style={{
          marginTop: 20, textAlign: 'center', color: 'var(--text-subtle)',
          fontSize: '0.78rem', padding: '12px'
        }}>
          🔲 Escanea el código QR en la puerta para acceder siempre al horario actualizado de esta sala
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .glass { background: white !important; border: 1px solid #ddd !important; box-shadow: none !important; }
          header button, a[href="/"] { display: none !important; }
          .schedule-table th { background: #1e293b !important; -webkit-print-color-adjust: exact; }
          .row-now td { background: #eef2ff !important; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </div>
  );
}
