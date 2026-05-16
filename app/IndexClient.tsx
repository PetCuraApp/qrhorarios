'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { SalaData } from '@/lib/parser';
import { BLOQUES_HORARIOS } from '@/lib/bloques';

interface Props {
  salas: SalaData[];
  semana: string;
  generado: string;
  totalSalas: number;
}

function RoomCard({ sala }: { sala: SalaData }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = `/api/qr/${sala.hash}`;
    link.download = `QR_${sala.nombre.replace(/\s+/g, '_')}.png`;
    link.click();
  };

  // Contar clases en esta sala
  const totalClases = Object.values(sala.horario).reduce(
    (acc, b) => acc + Object.keys(b.clases).length, 0
  );

  return (
    <div className="glass" style={{
      overflow: 'hidden', transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-4px)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '0 16px 48px rgba(0,0,0,0.5), 0 0 0 1px rgba(99,102,241,0.2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)';
        (e.currentTarget as HTMLDivElement).style.boxShadow = '';
      }}
    >
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)',
        padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e0e7ff', letterSpacing: '0.02em' }}>
          📍 {sala.nombre}
        </h3>
        <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge badge-accent" style={{ fontSize: '0.65rem' }}>
            {totalClases} clases
          </span>
        </div>
      </div>

      {/* QR */}
      <div style={{
        background: 'white', padding: 20, textAlign: 'center',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`/api/qr/${sala.hash}`}
          alt={`QR de ${sala.nombre}`}
          style={{ width: 160, height: 160, objectFit: 'contain' }}
          loading="lazy"
        />
      </div>

      {/* Buttons */}
      <div style={{ padding: '14px 16px', display: 'flex', gap: 10 }}>
        <a
          href={`/sala/${sala.hash}`}
          className="btn btn-primary"
          style={{ flex: 1, fontSize: '0.8rem', padding: '10px 8px' }}
        >
          📅 Ver Horario
        </a>
        <button
          onClick={handleDownload}
          className="btn btn-ghost"
          style={{ flex: 1, fontSize: '0.8rem', padding: '10px 8px' }}
        >
          📥 Descargar QR
        </button>
      </div>
    </div>
  );
}

function getSalasActivasAhora(salas: SalaData[]): number {
  const now = new Date();
  const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
  const bloqueActivo = BLOQUES_HORARIOS.find(([inicio, fin]) => hhmm >= inicio && hhmm < fin);
  if (!bloqueActivo) return 0;
  const clave = `${bloqueActivo[0]}_${bloqueActivo[1]}`;
  const diaIdx = now.getDay(); // 0 = Dom, 1 = Lun...
  const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const diaNombre = diasSemana[diaIdx];

  return salas.filter((s) => {
    const bloque = s.horario[clave];
    return bloque && bloque.clases[diaNombre];
  }).length;
}

export default function IndexClient({ salas, semana, generado, totalSalas }: Props) {
  const [search, setSearch] = useState('');
  const [activasAhora, setActivasAhora] = useState(0);
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => setActivasAhora(getSalasActivasAhora(salas));
    update();
    const timer = setInterval(update, 60000);
    return () => clearInterval(timer);
  }, [salas]);

  const filtered = salas.filter((s) =>
    s.nombre.toLowerCase().includes(search.toLowerCase())
  );

  async function handleLogout() {
    await fetch('/api/login', { method: 'DELETE' });
    router.push('/login');
  }

  const fechaGen = new Date(generado).toLocaleString('es-ES', {
    dateStyle: 'medium', timeStyle: 'short'
  });

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* Background orbs */}
      <div style={{
        position: 'fixed', top: '-10%', right: '5%', width: 500, height: 500,
        background: 'radial-gradient(circle, rgba(99,102,241,0.1) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(60px)'
      }} />

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 24px 60px' }}>
        {/* Header */}
        <header className="anim-fade-up" style={{
          padding: '32px 0 24px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)', marginBottom: 32
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{
              width: 48, height: 48,
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              borderRadius: 14, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: 22,
              boxShadow: '0 6px 24px rgba(99,102,241,0.4)'
            }}>📋</div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                <span className="gradient-text">QRHorarios</span>
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Sistema de Horarios por Sala
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="badge badge-accent">📅 Semana {semana}</span>
            <a href="/admin" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              ⚙️ Admin
            </a>
            <button onClick={handleLogout} className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              Salir →
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="anim-fade-up delay-1" style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 16, marginBottom: 32
        }}>
          {[
            { icon: '🏫', label: 'Total de salas', value: totalSalas, cls: 'badge-accent' },
            { icon: '🟢', label: 'Activas ahora', value: activasAhora, cls: 'badge-success' },
            { icon: '⚪', label: 'Disponibles', value: totalSalas - activasAhora, cls: 'badge-warning' },
          ].map((stat) => (
            <div key={stat.label} className="glass" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 24, marginBottom: 8 }}>{stat.icon}</div>
              <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--text)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>{stat.label}</div>
            </div>
          ))}
          <div className="glass" style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>🕐</div>
            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>
              {fechaGen}
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Última actualización</div>
          </div>
        </div>

        {/* Search */}
        <div className="anim-fade-up delay-2" style={{ marginBottom: 28, maxWidth: 500 }}>
          <div style={{ position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
              color: 'var(--text-muted)', fontSize: '1rem', pointerEvents: 'none'
            }}>🔍</span>
            <input
              ref={searchRef}
              className="input"
              style={{ paddingLeft: 42 }}
              placeholder="Buscar sala..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {search && (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 8 }}>
              {filtered.length} resultado{filtered.length !== 1 ? 's' : ''} para &quot;{search}&quot;
            </p>
          )}
        </div>

        {/* Grid */}
        <div className="anim-fade-up delay-3" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 24
        }}>
          {filtered.map((sala) => (
            <RoomCard key={sala.hash} sala={sala} />
          ))}
        </div>

        {filtered.length === 0 && search && (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <p>No se encontraron salas con &quot;{search}&quot;</p>
          </div>
        )}
      </div>
    </div>
  );
}
