/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        gold: {
          DEFAULT: '#B7960C',
          light: '#D4AF37',
          dark: '#8B7209',
          50: '#fdf9e7',
          100: '#f9f0c0',
          200: '#f0d968',
          300: '#D4AF37',
          400: '#B7960C',
          500: '#8B7209',
        },
        cream: {
          DEFAULT: '#f5f4f0',
          dark: '#ebe9e3',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
    },
  },
  plugins: [],
};
