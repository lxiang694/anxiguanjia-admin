import type { Config } from 'tailwindcss';

/**
 * 家庭安心管家 — 设计令牌
 *
 * 延续官网品牌色：米白（底）／深绿（主）／暖橙（点缀）。
 * 后台增加中性灰阶以承载较高信息密度，但不引入花哨色彩。
 */
const config: Config = {
  darkMode: ['class'],
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // 米白系 —— 页面底色，温暖不刺眼
        cream: {
          50: '#FDFCF8',
          100: '#FAF7F0',
          200: '#F4EFE4',
          300: '#EAE3D2',
          400: '#DDD3BC',
          500: '#C9BC9F',
        },
        // 深绿系 —— 品牌主色，代表专业与安定
        brand: {
          50: '#EEF5F1',
          100: '#D6E7DD',
          200: '#AECFBC',
          300: '#7FB397',
          400: '#4E9271',
          500: '#2D6A4F',
          600: '#245840',
          700: '#1F4D3A',
          800: '#173A2C',
          900: '#0F2720',
        },
        // 暖橙系 —— 点缀与提醒，用于需要注意但非危险的信息
        warm: {
          50: '#FDF3EA',
          100: '#FAE3CE',
          200: '#F5C79E',
          300: '#F0A96D',
          400: '#E8853A',
          500: '#D46F26',
          600: '#B0591C',
          700: '#8A4516',
        },
        // 语义色
        danger: {
          50: '#FDF0EF',
          100: '#FADCD9',
          300: '#EE9A93',
          500: '#C8453A',
          600: '#A8352C',
          700: '#87291F',
        },
        info: {
          50: '#EEF3FA',
          100: '#D8E5F5',
          300: '#96B7E0',
          500: '#3B6DB0',
          600: '#2F5891',
        },
        ink: {
          50: '#F7F7F6',
          100: '#EDEDEB',
          200: '#DBDBD7',
          300: '#B9B9B2',
          400: '#8C8C84',
          500: '#6B6B63',
          600: '#4F4F49',
          700: '#3A3A35',
          800: '#262623',
          900: '#171715',
        },
      },
      fontFamily: {
        sans: [
          'var(--font-sans)',
          'system-ui',
          '-apple-system',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Source Han Sans SC"',
          'sans-serif',
        ],
      },
      borderRadius: {
        card: '14px',
        pill: '999px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(23, 39, 32, 0.04), 0 4px 16px rgba(23, 39, 32, 0.06)',
        lift: '0 4px 8px rgba(23, 39, 32, 0.06), 0 12px 32px rgba(23, 39, 32, 0.10)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.6)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-soft': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.22s ease-out',
        'pulse-soft': 'pulse-soft 2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
