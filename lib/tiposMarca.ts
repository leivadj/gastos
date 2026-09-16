import { TipoMarca } from "./types";

// Catálogo BASE de tipos de marca ("de fábrica") — ver
// migration_39_tipos_marca_libres.sql: hasta esa migración esta lista era un
// `check` cerrado en la base de datos; ahora es solo el catálogo con el que
// arranca el selector (más "+ Nuevo tipo…" para agregar uno propio, ver
// components/SelectorTipoMarca.tsx). Antes vivía duplicada dentro de
// app/admin/page.tsx — se centraliza acá porque Ronda 10 (unificación de
// categorías, ver claude/propuesta-modulo-compromisos.md) la vuelve a
// necesitar también en app/categorias/page.tsx.
export const TIPOS_MARCA_BASE: { value: TipoMarca; label: string }[] = [
  { value: "banco", label: "Banco" },
  { value: "casa_comercial", label: "Casa comercial" },
  { value: "caja_compensacion", label: "Caja de compensación" },
  { value: "autopista", label: "Autopista / TAG" },
  { value: "telecom", label: "Internet / Móvil" },
  { value: "servicio_basico", label: "Servicio básico (luz, agua, gas...)" },
  { value: "supermercado", label: "Supermercado" },
  { value: "transporte", label: "Pasajes (bus, avión)" },
  { value: "compras_online", label: "Compras online" },
  { value: "delivery", label: "Delivery (comida, encargos)" },
  { value: "suscripcion", label: "Suscripción (streaming, apps...)" },
  { value: "bencina", label: "Bencina" },
  { value: "mecanico", label: "Mecánico" },
  { value: "repuestos", label: "Repuestos" },
  { value: "centro_medico", label: "Centro médico" },
  { value: "farmacia", label: "Farmacia (medicamentos)" },
  { value: "otro", label: "Otro" },
];

// Convierte texto libre en un slug estable para guardar en la base de datos
// (minúsculas, sin acentos, espacios/símbolos → "_"). Nunca vacío: si no
// queda nada usable, cae a "otro".
export function slugTipo(texto: string): string {
  const slug = texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || "otro";
}

// Para mostrar un tipo "custom" (guardado como slug) con una etiqueta
// legible cuando no está en TIPOS_MARCA_BASE ni corresponde a ninguna
// categoría — ej. "casa_rodante" → "Casa rodante".
export function tituloDesdeSlug(slug: string): string {
  return slug
    .split("_")
    .filter(Boolean)
    .map((palabra, i) => (i === 0 ? palabra.charAt(0).toUpperCase() + palabra.slice(1) : palabra))
    .join(" ");
}

// Genera un slug de tipo para una categoría nueva, evitando choques con
// tipos ya usados por otras categorías (ej. dos categorías parecidas como
// "Mascotas" y "Mascotas veterinaria" no deberían terminar compartiendo el
// mismo tipo por accidente). Ver app/categorias/page.tsx.
export function generarSlugUnico(nombre: string, usados: Set<string>): string {
  const base = slugTipo(nombre);
  if (!usados.has(base)) return base;
  let i = 2;
  while (usados.has(`${base}_${i}`)) i++;
  return `${base}_${i}`;
}
