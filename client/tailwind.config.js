/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-18px) translateX(10px)' },
        },
        particle: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-12px) translateX(8px)' },
        },
        particleSlow: {
          '0%, 100%': { transform: 'translateY(0px) translateX(0px)' },
          '50%': { transform: 'translateY(-8px) translateX(12px)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.35' },
        },
      },
      animation: {
        float: 'float 12s ease-in-out infinite',
        particle: 'particle 10s ease-in-out infinite',
        particleSlow: 'particleSlow 16s ease-in-out infinite',
        pulseSoft: 'pulseSoft 1.6s ease-in-out infinite',
      },
      boxShadow: {
        glow: '0 18px 40px rgba(56, 189, 248, 0.25)',
        soft: '0 10px 30px rgba(2, 6, 23, 0.45)',
      },
    },
  },
  plugins: [],
};
