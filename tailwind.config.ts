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
          bg: '#04060d',
          panel: '#0b1020',
          panel2: '#0e1428',
          line: '#1c2440',
          cyan: '#22e8ff',
          magenta: '#ff2da3',
          green: '#39ffb0',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body: ['var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        neon: '0 0 6px rgba(34,232,255,0.6), 0 0 24px rgba(34,232,255,0.25)',
        'neon-red': '0 0 6px rgba(255,40,69,0.7), 0 0 24px rgba(255,40,69,0.3)',
        glass: '0 8px 32px rgba(0,0,0,0.45)',
      },
      backgroundImage: {
        grid: 'linear-gradient(rgba(34,232,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(34,232,255,0.06) 1px, transparent 1px)',
      },
      backgroundSize: {
        grid: '32px 32px',
      },
    },
  },
  plugins: [],
};

export default config;
