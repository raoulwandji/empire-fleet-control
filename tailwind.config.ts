import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        empire: {
          rouge: '#b3122a',
          rougeVif: '#dc2626',
          noir: '#181210',
          or: '#caa15a',
        },
        hud: {
          bg: '#ffffff',
          panel: '#ffffff',
          panel2: '#fef2f2',
          line: '#fecaca',
          cyan: '#b3122a',   // rouge comme couleur d'accent principale
          magenta: '#ff2da3',
          green: '#16a34a',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 2px 8px rgba(179,18,42,0.25)',
        'neon-red': '0 2px 8px rgba(179,18,42,0.35)',
        glass: '0 4px 16px rgba(0,0,0,0.08)',
      },
      backgroundImage: {
        grid: 'none',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};

export default config;
