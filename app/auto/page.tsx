"use client";

import { DiariosLista } from "@/components/gastos/DiariosLista";

// Gastos sueltos del auto: bencina, mecánico, mantención — carga rápida de
// monto + descripción, sin medio de pago ni reparto (mismo patrón que la
// pestaña "Diarios" de /gastos, ver DiariosLista.tsx). Los documentos con
// vencimiento anual (permiso de circulación, revisión técnica, seguro) no
// viven acá — son fechas, no gastos mensuales, y van en una pantalla aparte.
export default function AutoPage() {
  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Auto</h1>
        <p className="text-xs text-gray-400">Bencina, mecánico, mantención y otros gastos del auto.</p>
      </div>

      <DiariosLista
        categoriaNombre="Auto"
        placeholderDescripcion="Ej: Bencina"
        textoAyuda='Gastos sueltos del auto (bencina, mecánico, mantención…). Caen bajo la categoría "Auto".'
        tituloTotal="Total auto este mes"
        textoVacio="Aún no cargaste gastos del auto este mes."
      />
    </div>
  );
}
