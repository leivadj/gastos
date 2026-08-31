"use client";

import { FormEvent, ReactNode, useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { NavBar } from "@/components/NavBar";

export function AuthGate({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setEnviando(false);
    if (error) setError("Correo o contraseña incorrectos.");
  }

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-gray-400">Cargando…</div>;
  }

  if (!session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-gradient px-4">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl"
        >
          <h1 className="mb-1 text-xl font-bold text-gray-800">Gastos del Hogar</h1>
          <p className="mb-5 text-sm text-gray-400">Inicia sesión para continuar</p>
          <input
            type="email"
            required
            placeholder="Correo"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-from"
          />
          <input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-brand-from"
          />
          {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={enviando}
            className="w-full rounded-lg bg-brand-gradient py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
          <p className="mt-4 text-xs text-gray-400">
            Tu usuario se crea desde el panel de Supabase (Authentication → Users → Add user),
            no hay registro público.
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <NavBar />
      <main className="mx-auto max-w-3xl px-4 py-5">{children}</main>
    </div>
  );
}
