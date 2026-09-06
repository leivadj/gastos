import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Endpoint privado para la automatización de "Sugerencias" (ver Novedades del
// resumen del proyecto): una tarea programada, fuera de esta app, lee el
// correo del banco, interpreta cada aviso, y le pega ACÁ con un movimiento ya
// resuelto (tipo/monto/descripción/fecha). Esto lo deja pendiente de revisión
// en `sugerencias_correo` — nunca se guarda como gasto real por sí solo, eso
// lo hace el usuario a mano desde /sugerencias (así se resolvió con
// AskUserQuestion antes de construir: "proponer todo al principio").
//
// Por qué existe esta ruta en vez de que la tarea programada le pegue
// directo a Supabase: una tarea programada corre sola, sin la sesión del
// usuario logueado, así que no puede usar la anon key con RLS normal. Le
// tendríamos que dar la SERVICE ROLE KEY (que se salta todas las reglas de
// seguridad) directamente a esa tarea — mucho más riesgoso que tener esa
// key UNA sola vez acá, en el servidor, en una ruta que solo sabe hacer una
// cosa: insertar una sugerencia con el owner_id fijo de esta cuenta.
//
// Seguridad:
//   - Exige el header "x-bot-secret" == la variable de entorno
//     BOT_SHARED_SECRET (elegida al armar la tarea programada) — sin eso,
//     401. Nunca loguear ni devolver este valor.
//   - `owner_id` sale SIEMPRE de la variable de entorno BOT_OWNER_ID (el uuid
//     de la cuenta dueña — ver el SQL para obtenerlo en el resumen del
//     proyecto), nunca del cuerpo del pedido, así nadie puede insertarle
//     sugerencias a otra cuenta ni aunque adivine el secreto.
//   - La SERVICE ROLE KEY (SUPABASE_SERVICE_ROLE_KEY) vive solo acá, como
//     variable de entorno de servidor en Vercel — nunca con el prefijo
//     NEXT_PUBLIC_, nunca llega al navegador.
export async function POST(req: NextRequest) {
  const secretEsperado = process.env.BOT_SHARED_SECRET;
  const secretRecibido = req.headers.get("x-bot-secret");
  if (!secretEsperado || secretRecibido !== secretEsperado) {
    return NextResponse.json({ error: "No autorizado." }, { status: 401 });
  }

  const ownerId = process.env.BOT_OWNER_ID;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!ownerId || !supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Falta configurar BOT_OWNER_ID, NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en el servidor." },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido, se esperaba JSON." }, { status: 400 });
  }

  const { tipo, monto, descripcion, fecha, datos_originales } = (body ?? {}) as Record<string, unknown>;

  if (tipo !== "gasto" && tipo !== "transferencia_propia" && tipo !== "transferencia_tercero") {
    return NextResponse.json(
      { error: "tipo debe ser 'gasto', 'transferencia_propia' o 'transferencia_tercero'." },
      { status: 400 }
    );
  }
  const montoNum = Number(monto);
  if (!Number.isFinite(montoNum) || montoNum <= 0) {
    return NextResponse.json({ error: "monto debe ser un número mayor a 0." }, { status: 400 });
  }
  if (typeof descripcion !== "string" || !descripcion.trim()) {
    return NextResponse.json({ error: "descripcion es obligatoria." }, { status: 400 });
  }
  if (typeof fecha !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return NextResponse.json({ error: "fecha debe venir como 'YYYY-MM-DD'." }, { status: 400 });
  }

  // Cliente propio con la service role key — nunca el `supabase` de
  // lib/supabaseClient.ts (ese usa la anon key, pensado para el navegador
  // con sesión de usuario).
  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data, error } = await admin
    .from("sugerencias_correo")
    .insert({
      owner_id: ownerId,
      tipo,
      monto: montoNum,
      descripcion: descripcion.trim(),
      fecha,
      datos_originales: datos_originales ?? null,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}
