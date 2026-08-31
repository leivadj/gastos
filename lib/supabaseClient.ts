"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // No lanzamos error en build time (Next.js prerenderiza estas páginas
  // también durante `next build`, incluso siendo "use client"); usamos un
  // valor de relleno para que el build no se caiga. En producción, Vercel
  // ya tiene las variables reales configuradas antes de construir.
  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(
      "Faltan NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY. Revisa tu .env.local"
    );
  }
}

export const supabase = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseAnonKey || "placeholder-anon-key"
);
