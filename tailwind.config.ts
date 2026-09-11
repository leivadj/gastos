import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          from: "#7C3AED", // violeta
          to: "#EC4899",   // rosa
        },
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)",
      },
      // Rediseño "estilo Haulo" (Fase 1, ver conversación con Felipe del
      // 11/09/2026): tipografía redondeada/bold en toda la app en vez de la
      // fuente del sistema — se carga con @fontsource/nunito en
      // app/layout.tsx (ver el comentario ahí sobre por qué no next/font)
      // y acá se declara como el sans-serif por defecto, así ningún
      // componente tiene que pedirla a mano.
      fontFamily: {
        sans: ["Nunito", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Radios más grandes que el "3xl" (1.5rem) que ya trae Tailwind, para
      // las hojas modales y tarjetas grandes del nuevo sistema — Haulo usa
      // curvas bastante más pronunciadas que las que tenía la app.
      borderRadius: {
        "4xl": "1.75rem", // 28px — tarjetas grandes, hoja modal
        "5xl": "2.25rem", // 36px — la hoja modal completa (esquinas superiores)
      },
    },
  },
  plugins: [],
};

export default config;
