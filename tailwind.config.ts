import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Rediseño v2 (negro/blanco, Rimu para escritorio + distribución de
      // Not Pato para el celular — ver conversación con Felipe de
      // septiembre 2026, y el mockup publicado en Claude Design). El
      // "brand" gradiente violeta/rosa de la marca anterior queda apagado
      // a un degradé casi negro: los componentes que ya usan
      // bg-brand-gradient/text-brand-from/text-brand-to (CTAs, estados
      // activos) heredan la nueva estética sin tener que tocar cada uno.
      colors: {
        brand: {
          from: "#17171A",
          to: "#000000",
        },
        // Reservados: verde SOLO para montos de ingreso/positivos, rojo
        // SOLO para montos de gasto/negativos y acciones destructivas —
        // nunca para estados genéricos (toggle activo, chip seleccionado,
        // etc., que usan blanco/negro). Mismos hex que el mockup.
        ingreso: "#5DCB86",
        gasto: "#E2584B",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #17171A 0%, #000000 100%)",
      },
      // Plus Jakarta Sans en toda la app — se carga con @fontsource en
      // app/layout.tsx (ver el comentario ahí sobre por qué no
      // next/font/google). Reemplaza a Nunito ("estilo Haulo", descartado).
      fontFamily: {
        sans: ["Plus Jakarta Sans", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      // Radios grandes para hojas modales y tarjetas del rediseño v2 (28px
      // el sheet que sube desde abajo, 36px sus esquinas superiores) —
      // mismos valores que traía el intento "estilo Haulo", que nunca
      // llegaron a usarse en ninguna pantalla real.
      borderRadius: {
        "4xl": "1.75rem", // 28px — tarjetas grandes, hoja modal
        "5xl": "2.25rem", // 36px — la hoja modal completa (esquinas superiores)
      },
    },
  },
  plugins: [],
};

export default config;
