import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gastos del Hogar",
    short_name: "Gastos",
    description: "Cuentas de la casa, con cuotas automáticas",
    start_url: "/",
    display: "standalone",
    background_color: "#F9FAFB",
    theme_color: "#7C3AED",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
