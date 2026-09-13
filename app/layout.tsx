import type { Metadata, Viewport } from "next";
// Rediseño v2 (negro/blanco, inspirado en Rimu para escritorio y en la
// distribución de Not Pato para el celular, ver conversación con Felipe de
// septiembre 2026): Plus Jakarta Sans en vez de la fuente del sistema —
// reemplaza el intento anterior "estilo Haulo" (Nunito), que quedó
// descartado antes de tocar ninguna pantalla real.
//
// Se sigue cargando con @fontsource (el archivo de la fuente queda
// empaquetado en el build) en vez de con next/font/google, que en cada
// build tiene que salir a bajar el CSS/los archivos desde
// fonts.googleapis.com — en el sandbox de desarrollo esa salida de red está
// bloqueada por política de la organización, y aunque en Vercel sí
// funciona, empaquetarla evita depender de que Google Fonts esté disponible
// en cada build y además evita una conexión más al cargar la app para quien
// la usa.
import "@fontsource/plus-jakarta-sans/400.css";
import "@fontsource/plus-jakarta-sans/500.css";
import "@fontsource/plus-jakarta-sans/600.css";
import "@fontsource/plus-jakarta-sans/700.css";
import "@fontsource/plus-jakarta-sans/800.css";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";
import { ThemeProvider } from "@/lib/theme";

// Se aplica ANTES de que React hidrate, leyendo directo de localStorage —
// si esperáramos al useEffect de ThemeProvider (lib/theme.tsx) se vería un
// flash del tema equivocado (ej. blanco por una fracción de segundo aunque
// el usuario haya elegido oscuro) apenas carga la página.
const SCRIPT_TEMA_SIN_FLASH = `
(function () {
  try {
    var pref = localStorage.getItem("gastos-hogar-tema");
    var oscuro = pref === "dark" || (pref !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (oscuro) document.documentElement.classList.add("dark");
  } catch (e) {}
})();
`;

export const metadata: Metadata = {
  title: "Gastos del Hogar",
  description: "Cuentas de la casa, con cuotas automáticas",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Gastos del Hogar",
  },
  icons: {
    apple: "/apple-touch-icon.png",
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Sigue el sistema por defecto (el selector propio de la app manda una
  // vez cargada, ver lib/theme.tsx) — así la barra del navegador/PWA
  // coincide con el fondo real de cada tema del rediseño v2 (blanco casi
  // puro en claro, negro puro en oscuro) en vez del morado de la marca
  // anterior.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAFAF8" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: el script de abajo puede agregar la clase
    // "dark" a este <html> antes de que React hidrate, lo cual React
    // marcaría como un mismatch de servidor/cliente si no se le avisa que
    // es intencional (ver SCRIPT_TEMA_SIN_FLASH).
    <html lang="es" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA_SIN_FLASH }} />
      </head>
      <body>
        <ThemeProvider>
          <AuthGate>{children}</AuthGate>
        </ThemeProvider>
      </body>
    </html>
  );
}
