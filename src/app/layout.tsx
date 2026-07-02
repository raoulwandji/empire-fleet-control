import type { Metadata } from 'next';
import { Orbitron, Rajdhani } from 'next/font/google';
import './globals.css';
import SessionProvider from '@/components/SessionProvider';

const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-display', weight: ['400','700','900'] });
const rajdhani = Rajdhani({ subsets: ['latin'], variable: '--font-body', weight: ['400','500','600','700'] });

export const metadata: Metadata = {
  title: 'EMPIRE-FLEET CONTROL',
  description: 'Gestion de flotte de véhicules — Condition-Vente & Location',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${orbitron.variable} ${rajdhani.variable} bg-hud-bg text-gray-800 min-h-screen font-body`}>
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
