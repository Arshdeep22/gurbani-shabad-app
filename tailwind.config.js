/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        pastel: {
          pink: "#FCE4EC",
          lavender: "#EDE7F6",
          mint: "#E0F2F1",
          peach: "#FFF3E0",
          sky: "#E1F5FE",
          rose: "#F8BBD0",
          purple: "#B39DDB",
          teal: "#80CBC4",
        },
      },
      fontFamily: {
        gurmukhi: ["'Noto Sans Gurmukhi'", "sans-serif"],
        sans: ["'Poppins'", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 10px 30px -10px rgba(0,0,0,0.15)",
        "soft-lg": "0 20px 50px -12px rgba(0,0,0,0.2)",
        "inner-soft": "inset 0 2px 6px rgba(0,0,0,0.06)",
        glow: "0 0 20px rgba(179,157,219,0.5)",
      },
      backgroundImage: {
        "pastel-gradient":
          "linear-gradient(135deg, #FCE4EC 0%, #EDE7F6 35%, #E1F5FE 70%, #E0F2F1 100%)",
      },
      keyframes: {
        floaty: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-8px)" },
        },
        fadeInUp: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
      animation: {
        floaty: "floaty 6s ease-in-out infinite",
        fadeInUp: "fadeInUp 0.6s ease-out forwards",
      },
    },
  },
  plugins: [],
};