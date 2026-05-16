'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface WeekPreview {
  semanas: string[];
  semanaActiva: string;
  totalFilas: number;
  conteos: Record<string, number>;
}

interface UploadResult {
  ok: boolean;
  semana: string;
  totalSalas: number;
  generado: string;
  error?: string;
}

type LogEntry = { msg: string; type: 'info' | 'success' | 'error' | 'step' };

export default function AdminPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [preview, setPreview] = useState<WeekPreview | null>(null);
  const [semana, setSemana] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = (msg: string, type: LogEntry['type'] = 'info') =>
    setLogs((prev) => [...prev, { msg, type }]);

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
      addLog(`🎯 Semana más activa detectada: ${data.semanaActiva} (${data.conteos[data.semanaActiva]} registros)`, 'info');
    } else {
      addLog(`⚠️ ${data.error}`, 'error');
    }
  }, []);

  const handleFile = useCallback((f: File) => {
    setFile(f);
    setResult(null);
    setLogs([]);
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
    addLog('🚀 Iniciando proceso de publicación...', 'step');
    addLog(`📋 Semana seleccionada: ${semana === 'auto' ? 'Detección automática' : semana}`, 'info');

    const fd = new FormData();
    fd.append('file', file);
    fd.append('semana', semana);

    const t0 = Date.now();
    addLog('⚙️ Procesando Excel...', 'step');

    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    const data: UploadResult = await res.json();

    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    setLoading(false);

    if (data.ok) {
      addLog(`✅ ¡Publicado exitosamente en ${elapsed}s!`, 'success');
      addLog(`🏫 ${data.totalSalas} salas procesadas`, 'success');
      addLog(`📅 Semana activa: ${data.semana}`, 'info');
      setResult(data);
    } else {
      addLog(`❌ Error: ${data.error}`, 'error');
      setResult(data);
    }
  };

  async function handleLogout() {
    await fetch('/api/login', { method: 'DELETE' });
    router.push('/login');
  }

  const logColor = (type: LogEntry['type']) => ({
    info: 'var(--text-muted)',
    success: '#86efac',
    error: '#fca5a5',
    step: '#a5b4fc',
  }[type]);

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1 }}>
      {/* BG orb */}
      <div style={{
        position: 'fixed', top: '-5%', left: '-10%', width: 600, height: 600,
        background: 'radial-gradient(circle, rgba(99,102,241,0.08) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(80px)'
      }} />

      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px 60px' }}>
        {/* Header */}
        <header className="anim-fade-up" style={{
          padding: '32px 0 24px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)', marginBottom: 40
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
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                Gestión de horarios semanales
              </p>
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

        {/* Upload section */}
        <div className="anim-fade-up delay-1">
          <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 20 }}>
            📤 Subir Nuevo Horario
          </h2>

          {/* Drop Zone */}
          <div
            className={`drop-zone${dragOver ? ' dragover' : ''}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              style={{ display: 'none' }}
              onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); }}
            />
            {file ? (
              <div>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <p style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
                  {file.name}
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {(file.size / 1024).toFixed(0)} KB — Haz clic para cambiar el archivo
                </p>
              </div>
            ) : (
              <div>
                <div style={{ fontSize: 56, marginBottom: 16 }}>📁</div>
                <p style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  Arrastra tu <code style={{ color: '#a5b4fc' }}>horarios.xlsx</code> aquí
                </p>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  o haz clic para seleccionar el archivo
                </p>
                <div style={{ marginTop: 20 }}>
                  <span className="badge badge-accent">Formatos: .xlsx, .xls</span>
                </div>
              </div>
            )}
          </div>

          {/* Semana selector */}
          {preview && (
            <div className="glass anim-fade-in" style={{ marginTop: 20, padding: 24 }}>
              <label style={{
                display: 'block', fontSize: '0.8rem', fontWeight: 600,
                color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.06em', textTransform: 'uppercase'
              }}>
                Seleccionar Semana
              </label>
              <select
                className="input"
                value={semana}
                onChange={(e) => setSemana(e.target.value)}
                style={{ cursor: 'pointer' }}
              >
                <option value="auto">
                  🎯 Detección automática — {preview.semanaActiva} ({preview.conteos[preview.semanaActiva] ?? 0} registros)
                </option>
                {preview.semanas.map((s) => (
                  <option key={s} value={s}>
                    {s} — {preview.conteos[s] ?? 0} registros activos
                  </option>
                ))}
              </select>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: 8 }}>
                Total de filas en el archivo: <strong style={{ color: 'var(--text)' }}>{preview.totalFilas}</strong>
              </p>
            </div>
          )}

          {/* Publish button */}
          {file && (
            <div className="anim-fade-in" style={{ marginTop: 20 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '16px', fontSize: '1rem' }}
                onClick={handleUpload}
                disabled={loading || !preview}
              >
                {loading ? (
                  <><span className="spinner" /> Procesando y publicando...</>
                ) : (
                  <>🚀 Publicar Horarios</>
                )}
              </button>
            </div>
          )}

          {/* Logs */}
          {logs.length > 0 && (
            <div className="glass anim-fade-in" style={{ marginTop: 20, padding: 20 }}>
              <p style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
                📋 Log de proceso
              </p>
              <div style={{ fontFamily: 'monospace', fontSize: '0.83rem' }}>
                {logs.map((l, i) => (
                  <div key={i} style={{ color: logColor(l.type), padding: '3px 0' }}>
                    {l.msg}
                  </div>
                ))}
                {loading && (
                  <div style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span className="spinner" style={{ width: 14, height: 14 }} /> procesando...
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Success result */}
          {result?.ok && (
            <div className="glass anim-fade-up" style={{
              marginTop: 24, padding: 28,
              border: '1px solid rgba(34,197,94,0.3)',
              background: 'rgba(34,197,94,0.04)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <span style={{ fontSize: 32 }}>✅</span>
                <div>
                  <p style={{ fontWeight: 700, fontSize: '1.1rem' }}>¡Horarios publicados!</p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    Los cambios ya están disponibles para todos
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                <span className="badge badge-success">🏫 {result.totalSalas} salas</span>
                <span className="badge badge-accent">📅 Semana {result.semana}</span>
              </div>
              <a href="/" className="btn btn-ghost" style={{ marginTop: 16, display: 'inline-flex' }}>
                📋 Ver todas las salas →
              </a>
            </div>
          )}
        </div>

        {/* Info cards */}
        <div className="anim-fade-up delay-3" style={{ marginTop: 48, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
          {[
            { icon: '📊', title: 'Columnas requeridas', desc: 'SALA, DIA, HORA INICIO, HORA FIN, ASIGNATURA, NOMBRE + columnas S1, S2... para las semanas.' },
            { icon: '🎯', title: 'Semana automática', desc: 'El sistema detecta qué semana tiene más registros activos (valor 1 en la columna Sx).' },
            { icon: '🔒', title: 'URLs privadas', desc: 'Cada sala tiene una URL con hash único. Los QRs se pueden imprimir y pegar en las puertas.' },
          ].map((card) => (
            <div key={card.title} className="glass" style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{card.icon}</div>
              <h3 style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 6 }}>{card.title}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', lineHeight: 1.5 }}>{card.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
