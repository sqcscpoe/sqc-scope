import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'SQC Scope — Solar Quality Control',
  description: 'Agente de control de calidad para instalaciones solares bajo el programa Palmetto LightReach. Evalúa fotos y genera reportes QC para el hito M1.',
  keywords: ['solar', 'quality control', 'QC', 'Palmetto LightReach', 'Puerto Rico', 'instalación solar'],
  authors: [{ name: 'SQC Scope' }],
  robots: 'noindex, nofollow',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#B7960C',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-cream">
        {children}
      </body>
    </html>
  );
}
