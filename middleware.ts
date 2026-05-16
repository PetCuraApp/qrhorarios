import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const ADMIN_COOKIE = 'qrh_admin';
const VIEWER_COOKIE = 'qrh_viewer';

/** Rutas que NO requieren autenticación */
const PUBLIC_PATHS = [
  '/sala',       // /sala/[hash] — QRs públicos
  '/api/sala',   // API de sala pública
  '/api/qr',     // Imagen QR pública
  '/api/login',  // Login endpoint
  '/_next',
  '/favicon.ico',
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // /admin requiere cookie admin
  if (pathname.startsWith('/admin') || pathname.startsWith('/api/upload') || pathname.startsWith('/api/horarios')) {
    const adminCookie = request.cookies.get(ADMIN_COOKIE);
    if (!adminCookie || adminCookie.value !== process.env.ADMIN_PASSWORD) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
      }
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      url.searchParams.set('role', 'admin');
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // / (index) requiere cookie viewer o admin
  if (pathname === '/') {
    const viewerCookie = request.cookies.get(VIEWER_COOKIE);
    const adminCookie = request.cookies.get(ADMIN_COOKIE);
    const hasAccess =
      (viewerCookie && viewerCookie.value === process.env.VIEWER_PASSWORD) ||
      (adminCookie && adminCookie.value === process.env.ADMIN_PASSWORD);

    if (!hasAccess) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', '/');
      url.searchParams.set('role', 'viewer');
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
