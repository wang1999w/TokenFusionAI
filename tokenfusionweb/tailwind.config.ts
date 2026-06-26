import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          gradient: 'linear-gradient(135deg, #3B82F6, #06B6D4)',
          primary: '#06B6D4',
          background: '#0B1120',
          card: '#111827',
          warning: '#F59E0B',
          success: '#10B981',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#94A3B8',
          tertiary: '#475569',
        },
      },
      borderRadius: {
        lg: '12px',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
