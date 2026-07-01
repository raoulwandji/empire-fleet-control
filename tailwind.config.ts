import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        yango: {
          yellow:  '#FFD200',
          yellowDark: '#E6BC00',
          black:   '#0A0A0A',
          dark:    '#111111',
          card:    '#1A1A1A',
          card2:   '#222222',
          line:    '#2E2E2E',
          muted:   '#555555',
          text:    '#F0F0F0',
          red:     '#FF3B30',
          green:   '#34C759',
          blue:    '#0A84FF',
        },
        empire: {
          rouge:    '#b3122a',
          rougeVif: '#ff2845',
        },
        // keep hud aliases mapped to yango so old classes still compile
        hud: {
          bg:      '#0A0A0A',
          panel:   '#1A1A1A',
          panel2:  '#222222',
          line:    '#2E2E2E',
          cyan:    '#FFD200',
          magenta: '#FF3B30',
          green:   '#34C759',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'sans-serif'],
        body:    ['var(--font-body)', 'sans-serif'],
      },
      boxShadow: {
        neon:      '0 0 8px rgba(255,210,0,0.5), 0 0 24px rgba(255,210,0,0.15)',
        'neon-red':'0 0 6px rgba(255,59,48,0.6), 0 0 20px rgba(255,59,48,0.2)',
        glass:     '0 8px 32px rgba(0,0,0,0.6)',
        card:      '0 2px 12px rgba(0,0,0,0.5)',
      },
    },
  },
  plugins: [],
};

export default config;
