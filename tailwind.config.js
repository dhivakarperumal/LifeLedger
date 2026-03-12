/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all files that contain Nativewind classes.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#e11d1d",
        border: "#262626",
        border1: "#1c1c1c",
        background: "#F8FAFC",
        card: "#000000",
        textPrimary: "#111827",
        textSecondary: "#6B7280",
        success: "#22C55E",
        danger: "#EF4444",
        darkcard: "#1a1a1a",
        darkBg: "#0f0f0f",
      },
    },
  },
  plugins: [],
}
