import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { password, role } = body as { password: string; role: 'admin' | 'viewer' };

  const adminPass = process.env.ADMIN_PASSWORD || 'admin2026..';
  const viewerPass = process.env.VIEWER_PASSWORD || 'Horariosu2026..';

  if (role === 'admin' && password === adminPass) {
    const response = NextResponse.json({ ok: true, role: 'admin' });
    response.cookies.set('qrh_admin', adminPass, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 días
      path: '/',
    });
    return response;
  }

  if (role === 'viewer' && (password === viewerPass || password === adminPass)) {
    const cookieVal = password === adminPass ? adminPass : viewerPass;
    const response = NextResponse.json({ ok: true, role: 'viewer' });
    if (password === adminPass) {
      response.cookies.set('qrh_admin', adminPass, {
        httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
      });
    } else {
      response.cookies.set('qrh_viewer', viewerPass, {
        httpOnly: true, sameSite: 'lax', maxAge: 60 * 60 * 24 * 7, path: '/',
      });
    }
    return response;
  }

  return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('qrh_admin');
  response.cookies.delete('qrh_viewer');
  return response;
}
