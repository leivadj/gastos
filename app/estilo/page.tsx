"use client";

// Vitrina del sistema de diseño — Fase 1 del rediseño "estilo Haulo" (ver
// conversación con Felipe del 11/09/2026). NO es una pantalla real de la
// app: es una página de referencia, sin link desde ningún menú, para poder
// revisar de un vistazo (y en el celular, en claro y oscuro) los
// componentes nuevos antes de empezar a usarlos en los formularios de
// verdad (Fase 2 en adelante). Se puede borrar cuando el rediseño esté
// terminado, o dejarla como guía de estilo viva — a definir con Felipe.

import { useState } from "react";
import { Card } from "@/components/Card";
import { ThemeToggle } from "@/components/ThemeToggle";
import { HojaModal } from "@/components/ui/HojaModal";
import { TecladoNumerico, formatearMontoTeclado } from "@/components/ui/TecladoNumerico";
import { GrillaCategorias } from "@/components/ui/GrillaCategorias";
import { AnilloProgreso } from "@/components/ui/AnilloProgreso";
import { FilaDeslizable } from "@/components/ui/FilaDeslizable";
import { Pildora, FilaPildoras } from "@/components/ui/Pildora";
import { BotonPrimario, BotonSecundario } from "@/components/ui/Boton";
import { Categoria } from "@/lib/types";

// Categorías de ejemplo — mismos campos que devuelve Supabase, para que la
// grilla se vea exactamente como se va a ver con datos reales.
const CATEGORIAS_DEMO: Categoria[] = [
  { id: "1", nombre: "Supermercado", tipo: "variable", icono: "🛒", tipo_marca_sugerido: null },
  { id: "2", nombre: "Farmacia", tipo: "variable", icono: "💊", tipo_marca_sugerido: null },
  { id: "3", nombre: "Bencina", tipo: "variable", icono: "⛽", tipo_marca_sugerido: null },
  { id: "4", nombre: "Delivery", tipo: "variable", icono: "🍔", tipo_marca_sugerido: null },
  { id: "5", nombre: "Ropa", tipo: "variable", icono: "👕", tipo_marca_sugerido: null },
  { id: "6", nombre: "Salidas", tipo: "variable", icono: "🎉", tipo_marca_sugerido: null },
  { id: "7", nombre: "Mascotas", tipo: "variable", icono: "🐾", tipo_marca_sugerido: null },
  { id: "8", nombre: "Otro", tipo: "variable", icono: "🏷️", tipo_marca_sugerido: null },
];

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xs font-black uppercase tracking-wide text-gray-400 dark:text-gray-500">{titulo}</h2>
      {children}
    </section>
  );
}

export default function EstiloPage() {
  const [categoriaDemo, setCategoriaDemo] = useState("1");
  const [montoDemo, setMontoDemo] = useState("15000");
  const [pildoraActiva, setPildoraActiva] = useState("todos");
  const [hojaAbierta, setHojaAbierta] = useState(false);

  return (
    <main className="mx-auto max-w-md space-y-8 px-4 pb-32 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-gray-800 dark:text-white">Sistema de diseño</h1>
        <ThemeToggle />
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Vitrina de los componentes nuevos (Fase 1) — probá el switch de arriba en claro/oscuro. Esta página no es
        parte de la navegación real.
      </p>

      <Seccion titulo="Tipografía">
        <Card className="space-y-2">
          <p className="text-3xl font-black text-gray-800 dark:text-white">$1.234.567</p>
          <p className="text-lg font-extrabold text-gray-800 dark:text-white">Título de sección</p>
          <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Texto en negrita media</p>
          <p className="text-sm text-gray-500 dark:text-gray-400">Texto secundario / ayuda</p>
        </Card>
      </Seccion>

      <Seccion titulo="Botones">
        <div className="space-y-2">
          <BotonPrimario>Guardar gasto</BotonPrimario>
          <BotonSecundario>Cancelar</BotonSecundario>
        </div>
      </Seccion>

      <Seccion titulo="Píldoras / filtros">
        <FilaPildoras>
          {["todos", "activos", "completados"].map((v) => (
            <Pildora key={v} activa={pildoraActiva === v} onClick={() => setPildoraActiva(v)}>
              {v === "todos" ? "Todos" : v === "activos" ? "Activos" : "Completados"}
            </Pildora>
          ))}
        </FilaPildoras>
      </Seccion>

      <Seccion titulo="Anillo de progreso">
        <Card className="flex flex-col items-center gap-3">
          <AnilloProgreso porcentaje={33} />
          <div className="flex w-full justify-between text-sm">
            <div>
              <p className="text-gray-400 dark:text-gray-500">Gastado</p>
              <p className="font-extrabold text-gray-800 dark:text-white">$933.512</p>
            </div>
            <div className="text-right">
              <p className="text-gray-400 dark:text-gray-500">Restante</p>
              <p className="font-extrabold text-gray-800 dark:text-white">$1.867.022</p>
            </div>
          </div>
        </Card>
      </Seccion>

      <Seccion titulo="Grilla de categorías">
        <Card>
          <GrillaCategorias categorias={CATEGORIAS_DEMO} value={categoriaDemo} onChange={setCategoriaDemo} />
        </Card>
      </Seccion>

      <Seccion titulo="Teclado numérico">
        <Card className="space-y-4">
          <p className="text-center text-4xl font-black text-gray-800 dark:text-white">
            {formatearMontoTeclado(montoDemo)}
          </p>
          <TecladoNumerico valor={montoDemo} onChange={setMontoDemo} />
        </Card>
      </Seccion>

      <Seccion titulo="Fila con swipe (deslizá hacia la izquierda)">
        <FilaDeslizable
          acciones={[
            {
              icono: <span className="text-lg">✎</span>,
              etiqueta: "Editar",
              color: "bg-gray-500",
              onClick: () => alert("Editar"),
            },
            {
              icono: <span className="text-lg">🗑</span>,
              etiqueta: "Borrar",
              color: "bg-red-500",
              onClick: () => alert("Borrar"),
            },
          ]}
        >
          <Card className="!rounded-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-bold text-gray-800 dark:text-white">Supermercado Jumbo</p>
                <p className="text-xs text-gray-400 dark:text-gray-500">Hoy · Débito</p>
              </div>
              <p className="font-extrabold text-gray-800 dark:text-white">$45.990</p>
            </div>
          </Card>
        </FilaDeslizable>
      </Seccion>

      <Seccion titulo="Hoja modal">
        <BotonSecundario onClick={() => setHojaAbierta(true)}>Abrir hoja de ejemplo</BotonSecundario>
      </Seccion>

      <HojaModal
        abierta={hojaAbierta}
        onClose={() => setHojaAbierta(false)}
        titulo="+ Gasto"
        pie={<BotonPrimario onClick={() => setHojaAbierta(false)}>Guardar gasto</BotonPrimario>}
      >
        <div className="space-y-5">
          <p className="text-center text-4xl font-black text-gray-800 dark:text-white">
            {formatearMontoTeclado(montoDemo)}
          </p>
          <TecladoNumerico valor={montoDemo} onChange={setMontoDemo} />
          <GrillaCategorias categorias={CATEGORIAS_DEMO} value={categoriaDemo} onChange={setCategoriaDemo} />
        </div>
      </HojaModal>
    </main>
  );
}
