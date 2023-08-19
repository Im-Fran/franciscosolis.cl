import type {Config} from 'tailwindcss';

const config: Config = {
    content: [
        './index.html',
        './src/**/*.{js,ts,jsx,tsx,css,md,mdx,html,json,scss}',
    ],
    darkMode: 'class',
    theme: {
        extend: {
            keyframes: {
                blink: {
                    '0%, 100%': {opacity: 1},
                    '50%': {opacity: 0},
                },
                scroll: {
                    '0%': { opacity: '0' },
                    '10%': { transform: 'translateY(0)', opacity: '1' },
                    '100%': { transform: 'translateY(15px)', opacity: '0'}
                },
            },
            animation: {
                blink: 'blink 1s ease-in-out infinite',
                scroll: 'scroll 1.6s cubic-bezier(.15,.41,.69,.94) infinite',
            },
        },
    },
    plugins: [],
};

export default config;
