import { supabase } from "@/lib/supabaseClient";

// Sube un archivo a un bucket de Storage bajo una carpeta con el id del
// usuario autenticado (requisito de las políticas tipo "solo el dueño
// escribe", que exigen (storage.foldername(name))[1] = auth.uid()), y
// devuelve la URL pública para guardarla en la fila correspondiente.
// Usado tanto por fotos de perfil (bucket "personas-fotos") como por fondos
// de tarjetas (bucket "tarjetas-fondos").
export async function subirImagenPropia(bucket: string, archivo: File): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sesión expirada, vuelve a iniciar sesión.");
  const ext = archivo.name.split(".").pop() || "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(bucket).upload(path, archivo, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
