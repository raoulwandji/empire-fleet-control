import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        empire: {
          rouge: '#b3122a',
          rougeVif: '#ff2845',
          noir: '#181210',
          or: '#caa15a',
        },
        hud: {
          bg: '#f5f2e9',
          panel: '#fdfcf8',
          panel2: '#f0ecdf',
          line: '#ddd5c2',
          cyan: '#2f7d4f',
          magenta: '#b3122a',
          green: '#3a9d5d',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 2px 8px rgba(47,125,79,0.18), 0 0 20px rgba(47,125,79,0.08)',
        'neon-red': '0 2px 8px rgba(179,18,42,0.25), 0 0 20px rgba(179,18,42,0.1)',
        glass: '0 4px 24px rgba(80,65,40,0.1)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(47,125,79,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(47,125,79,0.05) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};

export default config;
