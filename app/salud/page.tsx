"use client";

import { DiariosLista } from "@/components/gastos/DiariosLista";

// Gastos sueltos de salud: remedios, visita al doctor, etc. — carga rápida
// de monto + descripción, sin medio de pago ni reparto (mismo patrón que la
// pestaña "Diarios" de /gastos, ver DiariosLista.tsx).
export default function SaludPage() {
  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-800 dark:text-white">Salud</h1>
        <p className="text-xs text-gray-400 dark:text-gray-500">Remedios, visitas al doctor y otros gastos de salud.</p>
      </div>

      <DiariosLista
        categoriaNombre="Salud"
        placeholderDescripcion="Ej: Remedios"
        textoAyuda='Gastos sueltos de salud (remedios, visita al doctor…). Caen bajo la categoría "Salud".'
        tituloTotal="Total salud este mes"
        textoVacio="Aún no cargaste gastos de salud este mes."
        gruposMarca={[
          { tipo: "centro_medico", label: "Centro médico" },
          { tipo: "farmacia", label: "Medicamentos" },
        ]}
      />
    </div>
  );
}
