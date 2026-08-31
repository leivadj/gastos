import type { Config } from "tailwindcss";

const config: Config = {
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
    },
  },
  plugins: [],
};

export default config;
