/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        neon: { DEFAULT: '#00e5ff', blue: '#2f7bff', pink: '#ff3df2', lime: '#7dff6b' },
        ink: { 900: '#04060d', 800: '#070b16', 700: '#0b1222' },
      },
      keyframes: {
        fadeIn: { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-8px)' } },
        pulseGlow: { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
        blink: { '0%,100%': { opacity: '1' }, '50%': { opacity: '0.25' } },
        pop: { from: { opacity: '0', transform: 'scale(1.8)' }, to: { opacity: '1', transform: 'scale(1)' } },
      },
      animation: {
        fadeIn: 'fadeIn 0.45s ease both',
        float: 'float 5s ease-in-out infinite',
        pulseGlow: 'pulseGlow 2.4s ease-in-out infinite',
        blink: 'blink 0.8s steps(2) infinite',
        pop: 'pop 0.5s cubic-bezier(0.2,0.9,0.3,1) both',
      },
    },
  },
  plugins: [],
}
