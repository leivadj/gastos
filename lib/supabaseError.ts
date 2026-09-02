// Saca un mensaje legible de cualquier error que pueda llegar a un catch.
//
// Por qué existe: los errores de Supabase (PostgrestError, de
// `.from(...).insert/update/delete`) NO son instancias de `Error` — son un
// objeto plano `{ message, details, hint, code }`. Todo el código que hacía
// `err instanceof Error ? err.message : "..."` (patrón usado en toda la
// app) fallaba silenciosamente esa comprobación para ESE tipo de error en
// particular, y siempre mostraba el mensaje genérico de respaldo aunque
// Supabase sí traía el motivo real (ej. una columna que no existe todavía
// porque falta correr una migración, una restricción única, etc.). Los
// errores de Supabase Storage sí son instancias de `Error`, por eso ese
// caso (ej. "Bucket not found") se venía mostrando bien.
export function mensajeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m) return m;
  }
  return "";
}
