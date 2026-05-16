'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = params.get('redirect') || '/';
  const role = (params.get('role') || 'viewer') as 'admin' | 'viewer';

  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password, role }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.ok) {
      router.push(redirect);
      router.refresh();
    } else {
      setError('Contraseña incorrecta. Inténtalo de nuevo.');
      setPassword('');
    }
  }

  const isAdmin = role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-radial flex items-center justify-center p-4" style={{ position: 'relative', zIndex: 1 }}>
      {/* Orbs de fondo */}
      <div style={{
        position: 'fixed', top: '20%', left: '15%', width: 300, height: 300,
        background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(40px)'
      }} />
      <div style={{
        position: 'fixed', bottom: '15%', right: '10%', width: 250, height: 250,
        background: 'radial-gradient(circle, rgba(139,92,246,0.12) 0%, transparent 70%)',
        borderRadius: '50%', pointerEvents: 'none', filter: 'blur(40px)'
      }} />

      <div className="glass anim-fade-up" style={{
        width: '100%', maxWidth: 440, padding: '48px 40px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.08)',
        position: 'relative'
      }}>
        {/* Logo / icono */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, margin: '0 auto 16px',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            borderRadius: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 28, boxShadow: '0 8px 32px rgba(99,102,241,0.4)'
          }}>
            {isAdmin ? '⚙️' : '📋'}
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>
            <span className="gradient-text">
              {isAdmin ? 'Panel Admin' : 'QRHorarios'}
            </span>
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {isAdmin
              ? 'Accede para gestionar los horarios'
              : 'Ingresa para ver los horarios de salas'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{
              display: 'block', fontSize: '0.8rem', fontWeight: 600,
              color: 'var(--text-muted)', marginBottom: 8, letterSpacing: '0.05em',
              textTransform: 'uppercase'
            }}>
              Contraseña
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input"
              placeholder="••••••••••••"
              autoFocus
              required
            />
          </div>

          {error && (
            <div className="anim-fade-in" style={{
              background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16,
              color: '#fca5a5', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '14px', fontSize: '0.95rem', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? (
              <><span className="spinner" style={{ width: 18, height: 18 }} /> Verificando...</>
            ) : (
              <>{isAdmin ? '🔑' : '🚀'} {isAdmin ? 'Entrar al panel' : 'Ver horarios'}</>
            )}
          </button>
        </form>

        {!isAdmin && (
          <div style={{ marginTop: 20, textAlign: 'center' }}>
            <a
              href="/login?role=admin&redirect=/admin"
              style={{ color: 'var(--text-subtle)', fontSize: '0.8rem', textDecoration: 'none' }}
            >
              ¿Eres administrador? →
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
