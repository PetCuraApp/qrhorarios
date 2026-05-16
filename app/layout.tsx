import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'QRHorarios — Sistema de Horarios por Sala',
    template: '%s | QRHorarios',
  },
  description: 'Sistema de gestión y visualización de horarios académicos por sala con códigos QR.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="bg-gradient-radial">
        {children}
      </body>
    </html>
  );
}
