/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"Share Tech Mono"', '"Fira Code"', 'monospace'],
        body: ['"Inter"', 'sans-serif'],
      },
      colors: {
        term: {
          green: '#39FF14',
          greenDim: '#1a7a0a',
          amber: '#FFB300',
          red: '#FF3B30',
          cyan: '#00E5FF',
          bg: '#0a0a0a',
          surface: '#111111',
          card: '#161616',
          border: '#222222',
          muted: '#666666',
          text: '#CCCCCC',
          white: '#E8E8E8',
        },
        // Phase 2 modern dark
        dark: {
          bg: '#0f1117',
          surface: '#161922',
          card: '#1c1f2e',
          border: '#2a2d3e',
          accent: '#6366F1',    // indigo
          accentLight: '#818CF8',
          success: '#10B981',
          successLight: '#34D399',
          warn: '#F59E0B',
          text: '#E2E8F0',
          muted: '#64748B',
          subtle: '#475569',
        }
      },
      animation: {
        'blink': 'blink 1s step-end infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'slide-up': 'slideUp 0.6s ease-out forwards',
        'pulse-slow': 'pulseSlow 2s ease-in-out infinite',
        'scan': 'scan 4s linear infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'progress-pulse': 'progressPulse 1.5s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
      },
      keyframes: {
        blink: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSlow: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
        scan: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        glow: {
          '0%, 100%': { boxShadow: '0 0 5px currentColor' },
          '50%': { boxShadow: '0 0 20px currentColor, 0 0 30px currentColor' },
        },
        progressPulse: {
          '0%, 100%': { opacity: '0.8' },
          '50%': { opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
