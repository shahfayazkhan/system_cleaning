import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      colors: {
        ink: {
          950: "#07090f",
          900: "#0b0f19",
          850: "#0f1422",
          800: "#141a2b",
          700: "#1d2438",
          600: "#2a3350",
          500: "#3b4566",
        },
        brand: {
          50: "#eefbf6",
          100: "#d5f5e8",
          300: "#6ee0b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(52,211,153,.25), 0 8px 40px -12px rgba(16,185,129,.45)",
        card: "0 1px 0 0 rgba(255,255,255,.04) inset, 0 10px 30px -15px rgba(0,0,0,.6)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        shimmer: { "100%": { transform: "translateX(100%)" } },
        "spin-slow": { to: { transform: "rotate(360deg)" } },
      },
      animation: {
        "fade-in": "fade-in .25s ease-out both",
        shimmer: "shimmer 1.6s infinite",
        "spin-slow": "spin-slow 3s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;
