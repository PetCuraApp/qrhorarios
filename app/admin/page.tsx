'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface WeekPreview {
  semanas: string[];
  semanaActiva: string;
  totalFilas: number;
  conteos: Record<string, number>;
}

interface SystemConfig {
  semanasDisponibles: string[];
  semanaActivaDefault: string;
  semanaInicioFecha?: string;
  totalSalas: number;
  generado: string;
}

interface UploadResult {
  ok: boolean;
  semana: string;
  totalSalas: number;
  generado: string;
  error?: string;
}

interface SalaStatsEntry {
  nombre: string;
  hash: string;
  total: number;
  diario: Record<string, number>;
  mensual: Record<string, number>;
}

interface StatsData {
  global: {
    total: number;
    diario: Record<string, number>;
    mensual: Record<string, number>;
  };
  salas: Record<string, SalaStatsEntry>;
}

type LogEntry = { msg: string; type: 'info' | 'success' | 'error' | 'step' };
type TabId = 'config' | 'upload' | 'stats';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFechaHoy(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function getMesActual(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ─── Componente Stats ─────────────────────────────────────────────────────────

function StatsPanel() {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [searchSala, setSearchSala] = useState('');
  const [ordenar, setOrdenar] = useState<'total' | 'hoy' | 'mes'>('mes');

  useEffect(() => {
    fetch('/api/horarios/stats')
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { setStats(d); setLoadingStats(false); })
      .catch(() => setLoadingStats(false));
  }, []);

  if (loadingStats) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)' }}>
        <span className="spinner" style={{ width: 32, height: 32, marginBottom: 16 }} />
        <p>Cargando estadísticas...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>📊</div>
        <p style={{ color: 'var(--text-muted)' }}>No hay datos de estadísticas todavía.</p>
        <p style={{ color: 'var(--text-subtle)', fontSize: '0.82rem', marginTop: 8 }}>
          Los escaneos se registrarán automáticamente cuando los alumnos vean los horarios.
        </p>
      </div>
    );
  }

  const hoy = getFechaHoy();
  const mes = getMesActual();

  const globalHoy = stats.global.diario[hoy] ?? 0;
  const globalMes = stats.global.mensual[mes] ?? 0;
  const globalTotal = stats.global.total ?? 0;

  // Ordenar salas
  const salasArray = Object.values(stats.salas ?? {});
  const salasOrdenadas = [...salasArray]
    .filter((s) => s.nombre.toLowerCase().includes(searchSala.toLowerCase()))
    .sort((a, b) => {
      if (ordenar === 'hoy') return (b.diario[hoy] ?? 0) - (a.diario[hoy] ?? 0);
      if (ordenar === 'mes') return (b.mensual[mes] ?? 0) - (a.mensual[mes] ?? 0);
      return (b.total ?? 0) - (a.total ?? 0);
    });

  // Top 8 por mes para el ranking
  const topSalas = [...salasArray]
    .sort((a, b) => (b.mensual[mes] ?? 0) - (a.mensual[mes] ?? 0))
    .slice(0, 8);
  const maxMes = topSalas[0]?.mensual[mes] ?? 1;

  return (
    <div>
      {/* Tarjetas Globales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { icon: '📅', label: 'Escaneos Hoy', value: globalHoy, color: '#86efac', bg: 'rgba(34,197,94,0.08)', border: 'rgba(34,197,94,0.2)' },
          { icon: '📆', label: 'Escaneos este Mes', value: globalMes, color: '#a5b4fc', bg: 'rgba(99,102,241,0.08)', border: 'rgba(99,102,241,0.2)' },
          { icon: '🔢', label: 'Total Histórico', value: globalTotal, color: '#fde68a', bg: 'rgba(251,191,36,0.08)', border: 'rgba(251,191,36,0.2)' },
          { icon: '🏫', label: 'Salas Rastreadas', value: salasArray.length, color: '#f9a8d4', bg: 'rgba(236,72,153,0.08)', border: 'rgba(236,72,153,0.2)' },
        ].map((card) => (
          <div key={card.label} style={{
            background: card.bg, border: `1px solid ${card.border}`,
            borderRadius: 14, padding: '20px 24px',
          }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>{card.icon}</div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: card.color, lineHeight: 1 }}>{card.value.toLocaleString('es-ES')}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 6 }}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Ranking Top Salas del Mes */}
      {topSalas.length > 0 && (
        <div className="glass" style={{ padding: 24, marginBottom: 28 }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
            🏆 Ranking de Salas — Mes Actual
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {topSalas.map((sala, i) => {
              const count = sala.mensual[mes] ?? 0;
              const pct = maxMes > 0 ? (count / maxMes) * 100 : 0;
              const medals = ['🥇', '🥈', '🥉'];
              return (
                <div key={sala.hash} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: '1rem', minWidth: 28, textAlign: 'center' }}>
                    {medals[i] ?? `${i + 1}.`}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '70%' }}>
                        {sala.nombre}
                      </span>
                      <span style={{ fontSize: '0.82rem', color: '#a5b4fc', fontWeight: 700 }}>{count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                      <div style={{
                        height: '100%', width: `${pct}%`,
                        background: i === 0 ? 'linear-gradient(90deg, #fbbf24, #f59e0b)' :
                          i === 1 ? 'linear-gradient(90deg, #94a3b8, #cbd5e1)' :
                          i === 2 ? 'linear-gradient(90deg, #d97706, #b45309)' :
                          'linear-gradient(90deg, #6366f1, #8b5cf6)',
                        borderRadius: 4,
                        transition: 'width 0.6s ease',
                      }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabla detallada */}
      <div className="glass" style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', flex: 1 }}>
            📋 Detalle por Sala
          </h3>
          {/* Ordenar */}
          <div style={{ display: 'flex', gap: 6 }}>
            {(['hoy', 'mes', 'total'] as const).map((ord) => (
              <button
                key={ord}
                onClick={() => setOrdenar(ord)}
                style={{
                  padding: '4px 12px', borderRadius: 8, fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer',
                  border: 'none',
                  background: ordenar === ord ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.05)',
                  color: ordenar === ord ? '#a5b4fc' : 'var(--text-muted)',
                  transition: 'all 0.2s',
                }}
              >
                {ord === 'hoy' ? 'Hoy' : ord === 'mes' ? 'Este Mes' : 'Total'}
              </button>
            ))}
          </div>
          {/* Buscador */}
          <input
            className="input"
            placeholder="Buscar sala..."
            value={searchSala}
            onChange={(e) => setSearchSala(e.target.value)}
            style={{ maxWidth: 200, fontSize: '0.82rem', padding: '6px 12px' }}
          />
        </div>

        {salasOrdenadas.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Sin resultados.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Sala', 'Escaneos Hoy', 'Escaneos Mes', 'Total'].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.75rem', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {salasOrdenadas.map((sala, i) => (
                  <tr key={sala.hash} style={{
                    borderBottom: '1px solid rgba(255,255,255,0.04)',
                    background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                  }}>
                    <td style={{ padding: '10px 12px', color: 'var(--text)', fontWeight: 500 }}>{sala.nombre}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 10px', borderRadius: 20,
                        background: (sala.diario[hoy] ?? 0) > 0 ? 'rgba(34,197,94,0.15)' : 'transparent',
                        color: (sala.diario[hoy] ?? 0) > 0 ? '#86efac' : 'var(--text-muted)',
                        fontWeight: 700,
                      }}>
                        {sala.diario[hoy] ?? 0}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', color: '#a5b4fc', fontWeight: 600 }}>{sala.mensual[mes] ?? 0}</td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-muted)' }}>{sala.total ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Página Principal Admin ───────────────────────────────────────────────────

export default function AdminPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('config');
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<WeekPreview | null>(null);
  const [semana, setSemana] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [configSemana, setConfigSemana] = useState('');
  const [configFecha, setConfigFecha] = useState('');
  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [configLog, setConfigLog] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const addLog = (msg: string, type: LogEntry['type'] = 'info') =>
    setLogs((prev) => [...prev, { msg, type }]);

  const cargarConfiguracion = useCallback(async () => {
    try {
      const res = await fetch('/api/horarios');
      if (res.ok) {
        const data = await res.json();
        const conf: SystemConfig = {
          semanasDisponibles: data.semanasDisponibles || [],
          semanaActivaDefault: data.semanaActivaDefault || data.semana || '',
          semanaInicioFecha: data.semanaInicioFecha || '',
          totalSalas: data.totalSalas || 0,
          generado: data.generado || '',
        };
        setSystemConfig(conf);
        setConfigSemana(conf.semanaActivaDefault);
        setConfigFecha(conf.semanaInicioFecha || '');
      }
    } catch (err) {
      console.error('Error cargando configuración:', err);
    }
  }, []);

  useEffect(() => {
    cargarConfiguracion();
  }, [cargarConfiguracion]);

  const fetchPreview = useCallback(async (f: File) => {
    addLog(`📂 Analizando ${f.name}...`, 'step');
    const fd = new FormData();
    fd.append('file', f);
    const res = await fetch('/api/upload', { method: 'PUT', body: fd });
    const data = await res.json();
    if (data.semanas) {
      setPreview(data);
      setSemana('auto');
      addLog(`✅ ${data.totalFilas} filas detectadas — ${data.semanas.length} semanas encontradas`, 'success');
    } else {
      addLog(`⚠️ ${data.error}`, 'error');
    }
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    addLog(`📝 Archivo cargado: ${f.name}`, 'info');
    fetchPreview(f);
  }, [fetchPreview]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setResult(null);
    addLog('🚀 Iniciando proceso de publicación (Sobrescribiendo datos)...', 'step');
    addLog(`📋 Semana seleccionada: ${semana === 'auto' ? 'Detección automática' : semana}`, 'info');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('semana', semana);
    const t0 = Date.now();
    addLog('⚙️ Procesando Excel (multi-semana)...', 'step');
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data: UploadResult = await res.json();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    setLoading(false);
    if (data.ok) {
      addLog(`✅ ¡Publicado en ${elapsed}s!`, 'success');
      addLog(`🏫 ${data.totalSalas} salas procesadas con todas las semanas`, 'success');
      addLog(`📅 Semana activa: ${data.semana}`, 'info');
      setResult(data);
      await cargarConfiguracion();
    } else {
      addLog(`❌ Error: ${data.error}`, 'error');
      setResult(data);
    }
  };

  const handleGuardarConfig = async () => {
    setGuardandoConfig(true);
    setConfigLog(null);
    try {
      const res = await fetch('/api/horarios/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ semanaActivaDefault: configSemana, semanaInicioFecha: configFecha }),
      });
      if (res.ok) {
        setConfigLog({ msg: '¡Configuración guardada e invalidada al instante!', type: 'success' });
        await cargarConfiguracion();
      } else {
        let errorMsg = 'No se pudo guardar';
        try { const err = await res.json(); errorMsg = err.error || errorMsg; } catch { errorMsg = `Error ${res.status}`; }
        setConfigLog({ msg: errorMsg, type: 'error' });
      }
    } catch (e: any) {
      setConfigLog({ msg: `Error de red: ${e.message || 'Desconocido'}`, type: 'error' });
    } finally {
      setGuardandoConfig(false);
    }
  };

  async function handleLogout() {
    await fetch('/api/login', { method: 'DELETE' });
    router.push('/login');
  }

  const logColor = (type: LogEntry['type']) => ({
    info: 'var(--text-muted)', success: '#86efac', error: '#fca5a5', step: '#a5b4fc',
  }[type]);

  const fechaGen = systemConfig?.generado
    ? new Date(systemConfig.generado).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  const TABS: { id: TabId; label: string; icon: string }[] = [
    { id: 'config', label: 'Configuración', icon: '⚡' },
    { id: 'upload', label: 'Subir Excel', icon: '📤' },
    { id: 'stats', label: 'Estadísticas', icon: '📊' },
  ];

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* BG orb */}
      <div style={{
        position: 'fixed', top: '-5%', left: '-10%', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(80px)'
      }} />

      <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px 80px' }}>
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
            }}>⚙️</div>
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: 800 }}>
                <span className="gradient-text">Panel Admin</span>
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Gestión de horarios semanales</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <a href="/" className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              📋 Ver salas
            </a>
            <button onClick={handleLogout} className="btn btn-ghost" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              Salir →
            </button>
          </div>
        </header>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '10px 20px', background: 'none', border: 'none',
                fontSize: '0.88rem', fontWeight: 600, cursor: 'pointer',
                color: activeTab === tab.id ? '#a5b4fc' : 'var(--text-muted)',
                borderBottom: activeTab === tab.id ? '2px solid #6366f1' : '2px solid transparent',
                transition: 'all 0.2s', marginBottom: '-1px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* TAB: CONFIGURACIÓN */}
        {activeTab === 'config' && (
          <div className="anim-fade-up">
            {systemConfig ? (
              <div className="glass" style={{ padding: 28, border: '1px solid rgba(99,102,241,0.2)' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#a5b4fc', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
                  ⚡ Estado del Sistema & Configuración Rápida
                </h2>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20, marginBottom: 24 }}>
                  <div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Salas Cargadas:</p>
                    <p style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text)' }}>🏫 {systemConfig.totalSalas}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Última Actualización:</p>
                    <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text)' }}>🕐 {fechaGen}</p>
                  </div>
                  <div>
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 6 }}>Semanas Almacenadas:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {systemConfig.semanasDisponibles.map((s) => (
                        <span key={s} className="badge" style={{
                          fontSize: '0.68rem', padding: '2px 6px',
                          background: s === systemConfig.semanaActivaDefault ? '#6366f1' : 'rgba(255,255,255,0.06)'
                        }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 24 }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                    ⚙️ Ajustes Dinámicos (Sin volver a subir el Excel)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16, marginBottom: 20 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Semana Activa Predeterminada:
                      </label>
                      <select className="input" value={configSemana} onChange={(e) => setConfigSemana(e.target.value)} style={{ cursor: 'pointer' }}>
                        {systemConfig.semanasDisponibles.map((s) => (
                          <option key={s} value={s}>Semana {s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Fecha de Inicio de Clases (Lunes S1):
                      </label>
                      <input
                        type="date" className="input"
                        value={configFecha} onChange={(e) => setConfigFecha(e.target.value)}
                        style={{ cursor: 'pointer' }}
                      />
                      <p style={{ color: 'var(--text-subtle)', fontSize: '0.7rem', marginTop: 4 }}>
                        Habilita el cálculo automático por fecha. Déjalo vacío para usar la semana fija.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn btn-primary" onClick={handleGuardarConfig} disabled={guardandoConfig} style={{ padding: '10px 24px', fontSize: '0.85rem' }}>
                      {guardandoConfig ? 'Guardando...' : '💾 Guardar Configuración'}
                    </button>
                    {configLog && (
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: configLog.type === 'success' ? '#86efac' : '#fca5a5' }}>
                        {configLog.type === 'success' ? '✅' : '❌'} {configLog.msg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="glass" style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📂</div>
                <p style={{ color: 'var(--text-muted)' }}>No hay datos cargados aún. Sube un Excel primero.</p>
                <button onClick={() => setActiveTab('upload')} className="btn btn-primary" style={{ marginTop: 20 }}>
                  📤 Subir Excel
                </button>
              </div>
            )}

            {/* Info cards */}
            <div style={{ marginTop: 32, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
              {[
                { icon: '📊', title: 'Columnas requeridas', desc: 'SALA, DIA, HORA INICIO, HORA FIN, ASIGNATURA, NOMBRE + columnas de semanas S1, S2... para el mapeo.' },
                { icon: '📅', title: 'Cálculo por Fecha', desc: 'Si especificas el Lunes inicial del semestre, el sistema cambia la semana activa automáticamente cada semana.' },
                { icon: '🔒', title: 'Seguridad Optimizada', desc: 'Los alumnos solo visualizan la semana activa. Los datos estadísticos son exclusivos del admin.' },
              ].map((card) => (
                <div key={card.title} className="glass" style={{ padding: '20px 24px' }}>
                  <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
                  <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{card.title}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: SUBIR EXCEL */}
        {activeTab === 'upload' && (
          <div className="anim-fade-up">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
              📤 Subir Nuevo Excel de Horarios
            </h2>

            {/* Drop Zone */}
            <div
              className={`drop-zone${dragOver ? ' dragover' : ''}`}
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }} />
              {file ? (
                <div>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{file.name}</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{(file.size / 1024).toFixed(0)} KB — Haz clic para cambiar</p>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: 56, marginBottom: 16 }}>📁</div>
                  <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    Arrastra tu <code style={{ color: '#a5b4fc' }}>horarios.xlsx</code> aquí
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>o haz clic para seleccionar</p>
                  <div style={{ marginTop: 20 }}>
                    <span className="badge badge-warning" style={{ fontSize: '0.72rem' }}>⚠️ Esta acción sobrescribirá todas las semanas</span>
                  </div>
                </div>
              )}
            </div>

            {/* Selector semana */}
            {preview && (
              <div className="glass anim-fade-in" style={{ marginTop: 20, padding: 24 }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Semana Inicial por Defecto
                </label>
                <select className="input" value={semana} onChange={(e) => setSemana(e.target.value)} style={{ cursor: 'pointer' }}>
                  <option value="auto">🎯 Autodetectar — {preview.semanaActiva}</option>
                  {preview.semanas.map((s) => (
                    <option key={s} value={s}>Semana {s} — {preview.conteos[s] ?? 0} clases activas</option>
                  ))}
                </select>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8 }}>
                  Total de filas: <strong style={{ color: 'var(--text)' }}>{preview.totalFilas}</strong>. El sistema guardará todas las semanas automáticamente.
                </p>
              </div>
            )}

            {/* Botón publicar */}
            {file && (
              <div className="anim-fade-in" style={{ marginTop: 20 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', padding: '16px', fontSize: '1rem', background: 'linear-gradient(135deg, #e11d48 0%, #be123c 100%)', border: 'none' }}
                  onClick={handleUpload}
                  disabled={loading || !preview}
                >
                  {loading ? <><span className="spinner" /> Procesando...</> : <>🚀 Publicar y Sobrescribir Base de Datos</>}
                </button>
              </div>
            )}

            {/* Logs */}
            {logs.length > 0 && (
              <div className="glass anim-fade-in" style={{ marginTop: 20, padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    📋 Log de proceso
                  </p>
                  <button onClick={() => setLogs([])} style={{ background: 'none', border: 'none', color: 'var(--text-subtle)', fontSize: '0.75rem', cursor: 'pointer', textDecoration: 'underline' }}>
                    Limpiar
                  </button>
                </div>
                <div style={{ fontFamily: 'monospace', fontSize: '0.83rem', maxHeight: '250px', overflowY: 'auto' }}>
                  {logs.map((l, i) => (
                    <div key={i} style={{ color: logColor(l.type), padding: '3px 0' }}>{l.msg}</div>
                  ))}
                  {loading && (
                    <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <span className="spinner" style={{ width: 14, height: 14 }} /> procesando...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Resultado */}
            {result?.ok && (
              <div className="glass anim-fade-up" style={{ marginTop: 24, padding: 28, border: '1px solid rgba(34,197,94,0.3)', background: 'rgba(34,197,94,0.04)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 32 }}>✅</span>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>¡Horarios publicados exitosamente!</p>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Todas las semanas han sido importadas y sobrescritas.</p>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <span className="badge badge-success">🏫 {result.totalSalas} salas</span>
                  <span className="badge badge-accent">📅 Semana Activa: {result.semana}</span>
                </div>
                <a href="/" className="btn btn-ghost" style={{ marginTop: 16, display: 'inline-flex' }}>📋 Ver todas las salas →</a>
              </div>
            )}
          </div>
        )}

        {/* TAB: ESTADÍSTICAS */}
        {activeTab === 'stats' && (
          <div className="anim-fade-up">
            <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 24 }}>
              📊 Estadísticas de Uso y Afluencia
            </h2>
            <StatsPanel />
          </div>
        )}
      </div>
    </div>
  );
}
