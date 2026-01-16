import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--background)',
        foreground: 'var(--foreground)',
        lilac: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        },
        pink: {
          baby: '#fce7f3',
          soft: '#fdf2f8',
        },
        beige: {
          light: '#f5f5dc',
          cream: '#faf8f3',
        },
        orange: {
          500: '#ff6b35',
          600: '#e55a2b',
        },
      },
    },
  },
  plugins: [],
}
export default config
