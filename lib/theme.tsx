"use client";

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

export type PreferenciaTema = "light" | "dark" | "system";
export type TemaResuelto = "light" | "dark";

const STORAGE_KEY = "gastos-hogar-tema";

function leerPreferenciaGuardada(): PreferenciaTema {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

function sistemaPrefiereOscuro(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function resolverTema(pref: PreferenciaTema): TemaResuelto {
  return pref === "system" ? (sistemaPrefiereOscuro() ? "dark" : "light") : pref;
}

function aplicarClase(resuelto: TemaResuelto) {
  document.documentElement.classList.toggle("dark", resuelto === "dark");
}

type ThemeContextValue = {
  preferencia: PreferenciaTema;
  resuelto: TemaResuelto;
  setPreferencia: (p: PreferenciaTema) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

// Igual que el <script> sin-flash de app/layout.tsx, pero para cuando el
// usuario CAMBIA la preferencia desde la app (ver ThemeToggle.tsx) — ese
// script solo corre una vez, al cargar la página.
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preferencia, setPreferenciaState] = useState<PreferenciaTema>("system");
  const [resuelto, setResuelto] = useState<TemaResuelto>("light");

  useEffect(() => {
    const inicial = leerPreferenciaGuardada();
    setPreferenciaState(inicial);
    setResuelto(resolverTema(inicial));
    // No hace falta aplicarClase acá: el <script> inline de layout.tsx ya
    // dejó la clase correcta puesta antes de que React hidrate, para evitar
    // el flash de tema equivocado.
  }, []);

  // Mientras la preferencia sea "Automático", sigue los cambios del sistema
  // en vivo (ej. si el PC pasa a modo oscuro solo de noche).
  useEffect(() => {
    if (preferencia !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    function onChange() {
      const r: TemaResuelto = mq.matches ? "dark" : "light";
      setResuelto(r);
      aplicarClase(r);
    }
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preferencia]);

  const setPreferencia = useCallback((p: PreferenciaTema) => {
    setPreferenciaState(p);
    window.localStorage.setItem(STORAGE_KEY, p);
    const r = resolverTema(p);
    setResuelto(r);
    aplicarClase(r);
  }, []);

  return (
    <ThemeContext.Provider value={{ preferencia, resuelto, setPreferencia }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  return ctx;
}
