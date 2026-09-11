"use client";

// Teclado numérico propio — Fase 1 del rediseño "estilo Haulo". Reemplaza al
// <input type="number"> con el teclado nativo del celular (que en iOS tapa
// media pantalla y no dice "$" en ningún lado) para el monto de un gasto:
// las teclas viven DENTRO de la hoja, así el usuario nunca pierde de vista
// el total mientras escribe.
//
// El monto se guarda siempre como pesos chilenos ENTEROS (sin decimales,
// igual que el resto de la app — ver lib/boletas/validarBoleta.ts para el
// mismo criterio aplicado del lado del OCR) — por eso no hay tecla de coma
// ni de punto: son solo dígitos + "00" (para cargar montos redondos rápido,
// ej. "15" + "00" = 15.000) + borrar.
export function TecladoNumerico({
  valor,
  onChange,
  maxDigitos = 10,
}: {
  // Dígitos crudos sin formatear, ej. "15000" (nunca con puntos ni "$").
  valor: string;
  onChange: (nuevoValor: string) => void;
  maxDigitos?: number;
}) {
  function tocarDigitos(digitos: string) {
    if (valor === "0") valor = ""; // el 0 inicial no se acumula ("0" + "5" -> "5", no "05")
    const nuevo = (valor + digitos).slice(0, maxDigitos);
    onChange(nuevo);
  }

  function borrar() {
    onChange(valor.slice(0, -1));
  }

  const TECLAS: { label: string; onTap: () => void; variante?: "num" | "accion" }[] = [
    { label: "1", onTap: () => tocarDigitos("1") },
    { label: "2", onTap: () => tocarDigitos("2") },
    { label: "3", onTap: () => tocarDigitos("3") },
    { label: "4", onTap: () => tocarDigitos("4") },
    { label: "5", onTap: () => tocarDigitos("5") },
    { label: "6", onTap: () => tocarDigitos("6") },
    { label: "7", onTap: () => tocarDigitos("7") },
    { label: "8", onTap: () => tocarDigitos("8") },
    { label: "9", onTap: () => tocarDigitos("9") },
    { label: "00", onTap: () => tocarDigitos("00"), variante: "accion" },
    { label: "0", onTap: () => tocarDigitos("0") },
    { label: "⌫", onTap: borrar, variante: "accion" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {TECLAS.map((t, i) => (
        <button
          key={i}
          type="button"
          onClick={t.onTap}
          className={`flex h-14 items-center justify-center rounded-2xl text-2xl font-bold transition active:scale-95 ${
            t.variante === "accion"
              ? "bg-gray-100 text-gray-500 dark:bg-white/5 dark:text-gray-400"
              : "bg-gray-50 text-gray-800 dark:bg-white/[0.07] dark:text-white"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// Formatea dígitos crudos ("15000") como pesos chilenos ("$15.000") para
// mostrar arriba del teclado — separado del componente para poder
// reutilizarlo en cualquier pantalla que muestre el mismo tipo de monto.
export function formatearMontoTeclado(digitos: string): string {
  const numero = Number(digitos || "0");
  return `$${numero.toLocaleString("es-CL")}`;
}
