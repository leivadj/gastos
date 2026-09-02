export const ADMIN_EMAILS = ["leivadj@gmail.com", "marianps.260290@gmail.com"];

export function esAdmin(email?: string | null): boolean {
  return !!email && ADMIN_EMAILS.includes(email);
}

// "Presupuesto" apunta por ahora a /gastos-fijos como mapeo interino: la
// pantalla de Calendario de pagos / promedio móvil del rediseño todavía no
// existe, así que esta pestaña sigue mostrando la vista de gastos fijos
// actual hasta que se construya esa fase.
export const navItems = [
  {
    href: "/",
    label: "Inicio",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <path d="M3 11.5 12 4l9 7.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5.5 10v9a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1v-9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/tarjetas",
    label: "Cuentas",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <rect x="3" y="6" width="18" height="13" rx="2.5" />
        <path d="M3 10h18" strokeLinecap="round" />
        <path d="M7 15h4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/compras",
    label: "Cuotas",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <rect x="4" y="3.5" width="16" height="17" rx="2" />
        <path d="M8 8h8M8 12h8M8 16h5" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: "/gastos-fijos",
    label: "Presupuesto",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <path d="M12 3v9l7.5 4.3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  {
    href: "/grupos",
    label: "Grupos",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <rect x="3.5" y="4" width="17" height="6" rx="1.5" />
        <rect x="3.5" y="14" width="7.5" height="6" rx="1.5" />
        <rect x="13" y="14" width="7.5" height="6" rx="1.5" />
      </svg>
    ),
  },
  {
    href: "/ingresos",
    label: "Ingresos",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <path d="M4 16 9.5 10.5 13.5 14.5 20 8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M14.5 8H20v5.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    href: "/personas",
    label: "Personas",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
        <circle cx="17" cy="8.5" r="2.3" />
        <path d="M15.5 5.3A2.3 2.3 0 1 1 17 9.6" opacity="0" />
        <path d="M20.5 18.3c0-2.3-1.7-4.1-4-4.6" strokeLinecap="round" />
      </svg>
    ),
  },
];

// "Más" agrupa Fijos, Grupos, Personas y Admin en el celular — las guías de
// iOS recomiendan un máximo de ~5 destinos en la barra inferior, y con 6-7
// items sueltos quedaba muy apretado. En escritorio (DesktopNav) hay
// espacio de sobra, así que ahí se siguen mostrando todos sueltos.
export const masNavItem = {
  href: "/mas",
  label: "Más",
  icon: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <rect x="4" y="4" width="7" height="7" rx="1.8" />
      <rect x="13" y="4" width="7" height="7" rx="1.8" />
      <rect x="4" y="13" width="7" height="7" rx="1.8" />
      <rect x="13" y="13" width="7" height="7" rx="1.8" />
    </svg>
  ),
};

export const adminNavItem = {
  href: "/admin",
  label: "Admin",
  icon: (active: boolean) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
      <path d="M12 3.5 5 6.5v5c0 4.5 3 7.5 7 8.5 4-1 7-4 7-8.5v-5L12 3.5Z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M9.5 12 11 13.5 14.5 10" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};
