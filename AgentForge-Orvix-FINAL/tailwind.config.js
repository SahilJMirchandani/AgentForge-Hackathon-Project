/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#6366F1',
          hover: '#4F46E5',
          light: '#EEF2FF',
        },
        secondary: {
          DEFAULT: '#9B5CF6',
          light: '#F3E8FF',
        },
        accent: {
          DEFAULT: '#06B6D4',
          light: '#ECFEFF',
        },
        surface: '#FFFFFF',
        canvas: '#F8FAFC',
        border: '#E5E9F0',
        ink: {
          DEFAULT: '#1F2937',
          soft: '#6B7280',
          faint: '#9CA3AF',
        },
        success: {
          DEFAULT: '#10B981',
          light: '#ECFDF5',
        },
        warning: {
          DEFAULT: '#F59E0B',
          light: '#FFFBEB',
        },
        danger: {
          DEFAULT: '#EF4444',
          light: '#FEF2F2',
        },
        running: {
          DEFAULT: '#3B82F6',
          light: '#EFF6FF',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '16px',
        control: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)',
        panel: '0 4px 12px rgba(16, 24, 40, 0.08)',
      },
    },
  },
  plugins: [],
}
