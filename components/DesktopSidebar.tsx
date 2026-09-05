"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode, useEffect, useMemo, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { esAdmin as checkEsAdmin } from "@/components/navItems";
import { EntidadAvatar } from "@/components/EntidadAvatar";
import { MovimientoFab } from "@/components/MovimientoRapido";
import { PersonalizarMenu } from "@/components/PersonalizarMenu";
import { ThemeToggle } from "@/components/ThemeToggle";
import { resolverMarca } from "@/lib/resolverMarca";
import { Entidad, Grupo, Marca, PreferenciasMenu } from "@/lib/types";

// Sidebar fijo de escritorio — reemplaza al antiguo header horizontal
// (DesktopNav.tsx, eliminado). El celular no se toca: sigue usando
// BottomNav + /mas tal cual (ver navItems.tsx), esta lista es una IA
// pensada para escritorio, con más espacio disponible.
//
// Difiere de navItems.tsx a propósito en 2 lugares:
//  - "Fijos" y "Compras en cuotas" son ítems propios acá (apuntan a
//    /gastos?tab=fijos y /gastos?tab=cuotas) en vez de un único "Gastos",
//    para que la barra lateral se lea como el resto de apps de este tipo —
//    la pantalla de destino sigue siendo la misma (/gastos con pestañas),
//    así que no hace falta ninguna pantalla nueva.
//  - Calendario/Movimientos/Auto/Salud/Ingresos no vienen en el menú por
//    defecto (ver ITEMS_OPCIONALES más abajo) — están ahí para no saturar
//    la barra de entrada, pero desde "Personalizar menú" se pueden prender
//    y sumar al lado de los demás. Admin sigue aparte (bloque propio más
//    abajo, gateado por esAdmin): no es personalizable a propósito, la
//    visibilidad ya la decide si la cuenta es admin o no.
// `key` es la identidad ESTABLE de cada ítem para personalizar el menú (ver
// PersonalizarMenu.tsx y migration_24_preferencias_menu.sql) — no se usa el
// href porque dos ítems ("fijos"/"cuotas") comparten el mismo href base
// (/gastos) con distinto query string. "mas" es el único ítem NO
// personalizable (ni se oculta ni se reordena): es la puerta de salida a
// todo lo demás, tiene que quedar siempre en el mismo lugar.
//
// Tipado explícito (en vez de dejar que TS infiera el tipo del array
// literal): así ITEMS e ITEM_MAS comparten exactamente el mismo tipo con
// `activo` opcional, y se pueden combinar con spread (`[...itemsFiltrados,
// ITEM_MAS]`) sin que TypeScript se queje de que "activo" no existe en
// alguno de los dos — cosa que si pasaba dejando que se infiriera solo.
//
// `ocultoPorDefecto` marca los ítems "opcionales" (ver ITEMS_OPCIONALES):
// no vienen activados de fábrica, el usuario los suma a mano desde
// "Personalizar menú" prendiendo su interruptor — ver aplicarPreferencias.
type ItemMenu = {
  key: string;
  href: string;
  label: string;
  icon: (activo: boolean) => ReactNode;
  activo?: (pathname: string) => boolean;
  ocultoPorDefecto?: boolean;
};

const ITEMS: ItemMenu[] = [
  {
    key: "inicio",
    href: "/",
    label: "Inicio",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "cuentas",
    href: "/tarjetas",
    label: "Cuentas",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" strokeLinecap="round" />
        <path d="M7 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "presupuestos",
    href: "/presupuesto",
    label: "Presupuestos",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path d="M12 3v9l7.5 4.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    key: "fijos",
    href: "/gastos?tab=fijos",
    label: "Fijos",
    activo: (p: string) => p === "/gastos",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "metas",
    href: "/metas-ahorro",
    label: "Metas",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <circle cx="12" cy="12" r="8.5" />
        <circle cx="12" cy="12" r="4" />
      </svg>
    ),
  },
  {
    key: "cuotas",
    href: "/gastos?tab=cuotas",
    label: "Compras en cuotas",
    activo: () => false, // "Fijos" ya marca /gastos como activo; evita que ambos se iluminen a la vez
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="3.5" y="5" width="17" height="14" rx="2" />
        <path d="M3.5 9.5h17" strokeLinecap="round" />
        <path d="M7 14h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "reportes",
    href: "/reportes",
    label: "Reportes",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="4" y="12" width="4.5" height="8" rx="1.2" />
        <rect x="10.2" y="7" width="4.5" height="13" rx="1.2" />
        <rect x="16.4" y="3.5" width="4.5" height="16.5" rx="1.2" />
      </svg>
    ),
  },
  {
    key: "personas",
    href: "/personas",
    label: "Personas",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
        <circle cx="17" cy="8.5" r="2.3" />
        <path d="M20.5 18.3c0-2.3-1.7-4.1-4-4.6" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "grupos",
    href: "/grupos",
    label: "Grupos",
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="3.5" y="4" width="17" height="6" rx="1.5" />
        <rect x="3.5" y="14" width="7.5" height="6" rx="1.5" />
        <rect x="13" y="14" width="7.5" height="6" rx="1.5" />
      </svg>
    ),
  },
];

// Ítems que hoy solo se ven en "Más" (celular y el propio "Más" de esta
// barra) pero se pueden sumar al menú lateral desde "Personalizar menú" —
// mismos íconos que navItems.tsx, para que se vean igual que en el celular.
// `ocultoPorDefecto: true` es lo que los mantiene afuera hasta que el
// usuario los prenda a mano (ver aplicarPreferencias).
const ITEMS_OPCIONALES: ItemMenu[] = [
  {
    key: "calendario",
    href: "/calendario-pagos",
    label: "Calendario",
    ocultoPorDefecto: true,
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <rect x="3.5" y="4.5" width="17" height="16" rx="2.5" />
        <path d="M3.5 9.5h17" strokeLinecap="round" />
        <path d="M8 3v3M16 3v3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    key: "movimientos",
    href: "/movimientos",
    label: "Movimientos",
    ocultoPorDefecto: true,
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path d="M4 8h13.5M14 4.5 17.5 8 14 11.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 16H6.5M10 12.5 6.5 16 10 19.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "auto",
    href: "/auto",
    label: "Auto",
    ocultoPorDefecto: true,
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path
          d="M4 16v-3.5a2 2 0 0 1 1.2-1.8l1.3-3.4A2 2 0 0 1 8.4 6h7.2a2 2 0 0 1 1.9 1.3l1.3 3.4a2 2 0 0 1 1.2 1.8V16"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M4 16h16" strokeLinecap="round" />
        <circle cx="7.5" cy="16.5" r="1.5" />
        <circle cx="16.5" cy="16.5" r="1.5" />
      </svg>
    ),
  },
  {
    key: "salud",
    href: "/salud",
    label: "Salud",
    ocultoPorDefecto: true,
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path
          d="M12 20s-7-4.35-9.5-8.5C.8 8.2 2.4 5 5.6 5c1.8 0 3.1 1 4.4 2.6C11.3 6 12.6 5 14.4 5c3.2 0 4.8 3.2 3.1 6.5C15 15.65 12 20 12 20Z"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    key: "ingresos",
    href: "/ingresos",
    label: "Ingresos",
    ocultoPorDefecto: true,
    icon: (a: boolean) => (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
        <path d="M4 16 9.5 10.5 13.5 14.5 20 8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 8H20v5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
];

// Pool completo de ítems personalizables: los de fábrica + los opcionales.
// "Más" no entra acá — no es personalizable, se agrega aparte al final. Ver
// también itemsDinamicos más abajo (dentro de DesktopSidebar): agrega a este
// mismo pool, en tiempo de ejecución, una entrada por cada cuenta/tarjeta
// (entidades) y por cada grupo de reparto (grupos) que ya tenga cargados el
// usuario — así "Falabella", "Paris", "Banco Estado" o "Hogar" se pueden
// anclar al menú lateral desde "Personalizar menú" igual que Calendario o
// Auto, sin que haya que codear cada una a mano (ver Novedades 2026-09-05).
const ITEMS_TODOS: ItemMenu[] = [...ITEMS, ...ITEMS_OPCIONALES];

const ITEM_MAS: ItemMenu = {
  key: "mas",
  href: "/mas",
  label: "Más",
  icon: (a: boolean) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={a ? 2.4 : 2}>
      <rect x="4" y="4" width="7" height="7" rx="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.8" />
    </svg>
  ),
};

// Aplica la personalización guardada (orden + ocultos) sobre la lista base:
// primero los ítems que están en `orden` (en ese orden), después cualquier
// ítem nuevo que no estuviera guardado todavía (agregado al código después
// de que la cuenta personalizó por última vez, o un opcional que todavía
// nunca se guardó), y al final se sacan los ocultos. Un ítem "nuevo" con
// `ocultoPorDefecto` (ver ITEMS_OPCIONALES) arranca oculto hasta que el
// usuario lo prenda a mano y guarde — así sumar Calendario/Auto/etc. al
// catálogo personalizable no hace que aparezcan solos en el menú de nadie.
// "Más" no pasa por acá: se agrega siempre al final, aparte.
function aplicarPreferencias(base: ItemMenu[], prefs: PreferenciasMenu | null): ItemMenu[] {
  const orden = prefs?.orden ?? [];
  const porKey = new Map(base.map((item) => [item.key, item]));
  const ordenados = orden.map((k) => porKey.get(k)).filter((i): i is ItemMenu => !!i);
  const yaIncluidos = new Set(orden);
  const nuevos = base.filter((item) => !yaIncluidos.has(item.key));
  const ocultos = new Set(prefs?.ocultos ?? []);
  nuevos.forEach((item) => {
    if (item.ocultoPorDefecto) ocultos.add(item.key);
  });
  return [...ordenados, ...nuevos].filter((item) => !ocultos.has(item.key));
}

export function DesktopSidebar() {
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [prefs, setPrefs] = useState<PreferenciasMenu | null>(null);
  const [mostrarPersonalizar, setMostrarPersonalizar] = useState(false);
  // Para las entradas dinámicas del menú (una por cuenta/tarjeta y una por
  // grupo de reparto) — ver itemsDinamicos más abajo y Novedades 2026-09-05.
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function cargarPreferencias() {
    const { data } = await supabase.from("preferencias_menu").select("orden, ocultos").maybeSingle();
    setPrefs(data ? { orden: data.orden ?? [], ocultos: data.ocultos ?? [] } : { orden: [], ocultos: [] });
  }

  async function cargarCatalogosDinamicos() {
    const [{ data: e }, { data: g }, { data: m }] = await Promise.all([
      supabase.from("entidades").select("*").order("nombre"),
      supabase.from("grupos").select("*").order("nombre"),
      supabase.from("marcas").select("*"),
    ]);
    setEntidades((e as Entidad[]) ?? []);
    setGrupos((g as Grupo[]) ?? []);
    setMarcas((m as Marca[]) ?? []);
  }

  useEffect(() => {
    if (session) {
      cargarPreferencias();
      cargarCatalogosDinamicos();
    }
  }, [session]);

  // Una entrada de menú por cada cuenta/tarjeta (ej. "Falabella", "Paris",
  // "Banco Estado", "Caja de Compensación") y por cada grupo de reparto (ej.
  // "Hogar") — apuntan a /entidad/[id] y /grupo/[id] (ver esas pantallas),
  // que listan todo lo activo de esa cuenta o grupo con sus cuotas
  // restantes y quién debe pagar cada ítem. Igual que Calendario/Auto, nacen
  // ocultas (ocultoPorDefecto) hasta que el usuario las prenda a mano desde
  // "Personalizar menú" — así tener 6 tarjetas cargadas no llena el menú de
  // nadie solo. El logo/ícono sale del catálogo de marcas cuando la cuenta
  // tiene una asociada (mismo criterio que EntidadAvatar en /tarjetas).
  const itemsDinamicos = useMemo<ItemMenu[]>(() => {
    const deEntidades: ItemMenu[] = entidades.map((e) => ({
      key: `entidad:${e.id}`,
      href: `/entidad/${e.id}`,
      label: e.nombre,
      ocultoPorDefecto: true,
      icon: () => <EntidadAvatar entidad={e} marca={resolverMarca(e, marcas)} className="h-5 w-5 rounded-md" />,
    }));
    const deGrupos: ItemMenu[] = grupos.map((g) => ({
      key: `grupo:${g.id}`,
      href: `/grupo/${g.id}`,
      label: g.nombre,
      ocultoPorDefecto: true,
      icon: () => <EntidadAvatar icono={g.icono} nombreFallback={g.nombre} className="h-5 w-5 rounded-md" />,
    }));
    // Además de las cuentas/tarjetas propias (entidades) de arriba, se puede
    // anclar cualquier marca del catálogo compartido de tipo "casa comercial"
    // o "banco" (ej. Ripley, Falabella, Santander) aunque la cuenta nunca la
    // haya convertido en una entidad propia — apunta a /marca/[id], que lista
    // los ítems cuyo marca_id (la marca del producto/servicio, no el medio de
    // pago) coincide, sin importar con qué tarjeta se pagó cada uno. Ver
    // distinción entidad_id vs. marca_id en schema.sql y Novedades 2026-09-05.
    const deMarcas: ItemMenu[] = marcas
      .filter((m) => m.tipo === "casa_comercial" || m.tipo === "banco")
      .map((m) => ({
        key: `marca:${m.id}`,
        href: `/marca/${m.id}`,
        label: m.nombre,
        ocultoPorDefecto: true,
        icon: () => <EntidadAvatar marca={m} className="h-5 w-5 rounded-md" />,
      }));
    return [...deEntidades, ...deGrupos, ...deMarcas];
  }, [entidades, grupos, marcas]);

  const todosLosItems = useMemo(() => [...ITEMS_TODOS, ...itemsDinamicos], [itemsDinamicos]);

  const esAdmin = checkEsAdmin(session?.user?.email);
  const itemsOrdenados = [...aplicarPreferencias(todosLosItems, prefs), ITEM_MAS];

  async function cerrarSesion() {
    await supabase.auth.signOut();
  }

  return (
    <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col border-r border-gray-100 bg-white px-4 py-5 dark:border-white/10 dark:bg-black">
      <div className="mb-5 flex items-center gap-2.5 px-1">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4}>
            <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
        <p className="text-sm font-bold leading-tight text-gray-800 dark:text-white">Gastos del Hogar</p>
      </div>

      <div className="mb-4">
        <MovimientoFab variante="boton-lateral" />
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        {itemsOrdenados.map((item) => {
          const [hrefBase] = item.href.split("?");
          const active = item.activo ? item.activo(pathname) : pathname === hrefBase;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                active
                  ? "bg-purple-50 font-semibold text-brand-from dark:bg-white/10 dark:text-white"
                  : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
              }`}
            >
              <span className={active ? "text-brand-from dark:text-white" : "text-gray-400 dark:text-gray-500"}>{item.icon(active)}</span>
              {item.label}
            </Link>
          );
        })}
        {esAdmin && (
          <Link
            href="/admin"
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
              pathname === "/admin"
                ? "bg-purple-50 font-semibold text-brand-from dark:bg-white/10 dark:text-white"
                : "text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-white/5"
            }`}
          >
            <span className={pathname === "/admin" ? "text-brand-from dark:text-white" : "text-gray-400 dark:text-gray-500"}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={pathname === "/admin" ? 2.4 : 2}>
                <path d="M12 3.5 5 6.5v5c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5v-5L12 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M9.5 12 11 13.5 14.5 10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            Admin
          </Link>
        )}
      </nav>

      <button
        onClick={() => setMostrarPersonalizar(true)}
        className="mt-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-white/5 dark:hover:text-gray-300"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
          <circle cx="16" cy="7" r="2.3" />
          <circle cx="7" cy="17" r="2.3" />
        </svg>
        Personalizar menú
      </button>

      {/* Cuadro de perfil: mismo lugar que en /mas del celular (PerfilPropioCard),
          pero acá vive siempre visible al fondo del Sidebar en vez de en su
          propia pantalla, ya que en escritorio no hace falta un destino "Más"
          separado para llegar al perfil. */}
      <div className="mt-3 rounded-2xl border border-gray-100 p-3 dark:border-white/10">
        <p className="truncate text-xs font-semibold text-gray-700 dark:text-gray-200">{session?.user?.email ?? "Cuenta"}</p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-gray-400 dark:text-gray-500">Tema</span>
          <ThemeToggle />
        </div>
        <button
          onClick={cerrarSesion}
          className="mt-2 w-full rounded-lg border border-gray-200 py-1.5 text-[11px] font-medium text-gray-500 hover:border-red-200 hover:text-red-400 dark:border-white/10 dark:text-gray-400 dark:hover:border-red-400/40 dark:hover:text-red-400"
        >
          Cerrar sesión
        </button>
      </div>

      {mostrarPersonalizar && (
        <PersonalizarMenu
          items={todosLosItems}
          prefs={prefs}
          onClose={() => setMostrarPersonalizar(false)}
          onGuardado={(nuevo) => {
            setPrefs(nuevo);
            setMostrarPersonalizar(false);
          }}
        />
      )}
    </aside>
  );
}
