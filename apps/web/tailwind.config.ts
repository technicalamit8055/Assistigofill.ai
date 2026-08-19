import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    '../../packages/ui/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef5ff',
          100: '#d9e8ff',
          200: '#bcd7ff',
          300: '#8ebeff',
          400: '#5999ff',
          500: '#3374fb',
          600: '#1d54f0',
          700: '#1841dc',
          800: '#1a37b2',
          900: '#1b338c',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-inter)',
          'var(--font-jakarta)',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Noto Sans',
          'Noto Sans Devanagari',
          'Arial',
          'sans-serif',
        ],
        inter: ['var(--font-inter)', 'sans-serif'],
        jakarta: ['var(--font-jakarta)', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
