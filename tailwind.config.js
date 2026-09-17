/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/app/**/*.{js,jsx,ts,tsx}', './src/components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        mangere: {
          DEFAULT: '#6366F1',
          light: '#EEF2FF',
          dark: '#4338CA',
        },
        highbrook: {
          DEFAULT: '#06B6D4',
          light: '#ECFEFF',
          dark: '#0E7490',
        },
      },
    },
  },
  plugins: [],
};
