"use client";

import { DocumentosVencimiento } from "@/components/auto/DocumentosVencimiento";
import { DiariosLista } from "@/components/gastos/DiariosLista";

// Dos secciones separadas en la misma pantalla: documentos con vencimiento
// anual (permiso de circulación, revisión técnica, seguro — son fechas, no
// gastos mensuales) arriba, y gastos sueltos del auto (bencina, mecánico,
// mantención — carga rápida de monto + descripción, mismo patrón que la
// pestaña "Diarios" de /gastos) abajo.
export default function AutoPage() {
  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800">Auto</h1>
        <p className="text-xs text-gray-400">Documentos, bencina, mecánico, mantención y otros gastos del auto.</p>
      </div>

      <DocumentosVencimiento />

      <div className="border-t border-gray-100 pt-5">
        <DiariosLista
          categoriaNombre="Auto"
          placeholderDescripcion="Ej: Bencina"
          textoAyuda='Gastos sueltos del auto (bencina, mecánico, mantención…). Caen bajo la categoría "Auto".'
          tituloTotal="Total auto este mes"
          textoVacio="Aún no cargaste gastos del auto este mes."
        />
      </div>
    </div>
  );
}
