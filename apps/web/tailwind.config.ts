/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        accent: { DEFAULT: "#635bff", hover: "#7a73ff", muted: "rgba(99,91,255,0.12)" },
        success: { DEFAULT: "#3ecf8e", muted: "rgba(62,207,142,0.10)" },
        warning: { DEFAULT: "#f5a623", muted: "rgba(245,166,35,0.10)" },
        danger: { DEFAULT: "#ef4444", muted: "rgba(239,68,68,0.08)" },
      },
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "JetBrains Mono", "SF Mono", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
