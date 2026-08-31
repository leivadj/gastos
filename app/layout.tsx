import type { Metadata } from "next";
import "./globals.css";
import { AuthGate } from "@/components/AuthGate";

export const metadata: Metadata = {
  title: "Gastos del Hogar",
  description: "Cuentas de la casa, con cuotas automáticas",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <AuthGate>{children}</AuthGate>
      </body>
    </html>
  );
}
