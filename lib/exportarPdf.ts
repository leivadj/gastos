import { formatCLP } from "@/lib/format";

export interface ItemDesglose {
  descripcion: string;
  categoria: string;
  detalle: string; // "Cuota 2 de 3" o "Gasto fijo"
  monto: number;
}

// jsPDF (~200kB) se carga solo cuando alguien realmente exporta un PDF, en
// vez de sumarse al bundle del dashboard que se descarga siempre.
export async function exportarDesglosePersonaPdf(opts: {
  personaNombre: string;
  mesLabel: string;
  total: number;
  items: ItemDesglose[];
}) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const { personaNombre, mesLabel, total, items } = opts;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.setTextColor(124, 58, 237); // brand-from
  doc.text("Gastos del Hogar", 14, 18);

  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  doc.text(`Desglose de ${personaNombre} — ${mesLabel}`, 14, 26);

  doc.setFontSize(10);
  doc.setTextColor(140, 140, 140);
  doc.text(`Generado ${new Date().toLocaleDateString("es-CL")}`, 14, 32);

  autoTable(doc, {
    startY: 38,
    head: [["Ítem", "Categoría", "Detalle", "Monto"]],
    body: items.map((it) => [it.descripcion, it.categoria, it.detalle, formatCLP(it.monto)]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [124, 58, 237], textColor: 255 },
    columnStyles: { 3: { halign: "right" } },
    foot: [["", "", "Total", formatCLP(total)]],
    footStyles: { fillColor: [245, 243, 251], textColor: [30, 30, 30], fontStyle: "bold" },
  });

  const nombreArchivo = `gastos-${personaNombre.toLowerCase().replace(/\s+/g, "-")}-${mesLabel
    .toLowerCase()
    .replace(/\s+/g, "-")}.pdf`;
  doc.save(nombreArchivo);
}
