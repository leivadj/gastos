export const ADMIN_EMAIL = "leivadj@gmail.com";

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
    label: "Fijos",
    icon: (active: boolean) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2.4 : 2}>
        <path d="M4 7h11.5a3.5 3.5 0 0 1 0 7H8" strokeLinecap="round" />
        <path d="M11 11 8 14l3 3" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M20 17H8.5a3.5 3.5 0 0 1 0-7H16" strokeLinecap="round" />
        <path d="M13 13l3-3-3-3" strokeLinecap="round" strokeLinejoin="round" />
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
