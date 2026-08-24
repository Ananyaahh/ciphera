import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "rgb(var(--color-ink-950) / <alpha-value>)",
          950: "rgb(var(--color-ink-950) / <alpha-value>)",
          900: "rgb(var(--color-ink-900) / <alpha-value>)",
          800: "rgb(var(--color-ink-800) / <alpha-value>)",
          700: "rgb(var(--color-ink-700) / <alpha-value>)",
          600: "rgb(var(--color-ink-600) / <alpha-value>)",
        },
        paper: "rgb(var(--color-paper) / <alpha-value>)",
        muted: "rgb(var(--color-muted) / <alpha-value>)",
        thread: {
          teal: "rgb(var(--color-thread-teal) / <alpha-value>)",
          indigo: "rgb(var(--color-thread-indigo) / <alpha-value>)",
          violet: "rgb(var(--color-thread-violet) / <alpha-value>)",
        },
        signal: {
          verified: "#4ADE80",
          tamper: "#F87171",
          warn: "#F2A93B",
        },
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "serif"],
        mono: ["var(--font-plex-mono)", "monospace"],
        body: ["var(--font-inter)", "sans-serif"],
      },
      backgroundImage: {
        "thread-gradient":
          "linear-gradient(90deg, rgb(var(--color-thread-teal)) 0%, rgb(var(--color-thread-indigo)) 45%, rgb(var(--color-thread-violet)) 100%)",
      },
      keyframes: {
        weave: {
          "0%": { backgroundPosition: "0% 50%" },
          "100%": { backgroundPosition: "200% 50%" },
        },
        scan: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        pulseThin: {
          "0%, 100%": { opacity: "0.35" },
          "50%": { opacity: "1" },
        },
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-100% - var(--gap)))" },
        },
        "marquee-vertical": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(calc(-100% - var(--gap)))" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(4px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        weave: "weave 6s linear infinite",
        scan: "scan 1.8s ease-in-out infinite",
        pulseThin: "pulseThin 2.4s ease-in-out infinite",
        marquee: "marquee var(--duration) linear infinite",
        "marquee-vertical": "marquee-vertical var(--duration) linear infinite",
        fadeIn: "fadeIn 0.25s ease",
      },
    },
  },
  plugins: [],
};
export default config;
