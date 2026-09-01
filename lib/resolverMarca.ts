import { Entidad, Marca } from "@/lib/types";

// Si la entidad ya tiene marca_id, usa esa marca. Si no (por ejemplo,
// entidades creadas antes de que esa marca tuviera logo en el catálogo),
// intenta encontrar una marca cuyo nombre coincida exactamente — mismo
// criterio que el auto-match al crear/editar en /tarjetas. Así, apenas se
// sube un logo nuevo en /admin, empieza a aparecer en todos lados sin tener
// que volver a editar cada entidad a mano.
export function resolverMarca(entidad: Entidad | null | undefined, marcas: Marca[]): Marca | null {
  if (!entidad) return null;
  if (entidad.marca_id) {
    const porId = marcas.find((m) => m.id === entidad.marca_id);
    if (porId) return porId;
  }
  const nombre = entidad.nombre.trim().toLowerCase();
  return marcas.find((m) => m.nombre.trim().toLowerCase() === nombre) ?? null;
}
