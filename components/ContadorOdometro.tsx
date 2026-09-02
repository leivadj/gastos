"use client";

// Efecto "spinning-counter" (transitions.dev) adaptado a CSS: cada dígito
// del texto (ej. un monto formateado con formatCLP) vive en una tira
// vertical 0-9 dentro de una ventana de 1 línea de alto (overflow hidden),
// y al cambiar el dígito la tira se desliza con una transición CSS en vez
// de saltar de golpe — más simple que el "odómetro" original (que gira
// varias vueltas completas con JS y un blur direccional por SVG), pero
// conserva su duración, curva y stagger por columna. Los caracteres que no
// son dígitos ($, -, el separador de miles) no giran, se re-renderizan tal
// cual.
const DIGITOS = "0123456789".split("");

function Rodillo({ digito, delayMs }: { digito: string; delayMs: number }) {
  const indice = DIGITOS.indexOf(digito);
  return (
    <span className="odometro-rodillo">
      <span
        className="odometro-tira"
        style={{
          transform: `translateY(-${indice}em)`,
          transitionDelay: `${delayMs}ms`,
        }}
      >
        {DIGITOS.map((d) => (
          <span key={d} className="odometro-celda">
            {d}
          </span>
        ))}
      </span>
    </span>
  );
}

export function ContadorOdometro({ texto, className = "" }: { texto: string; className?: string }) {
  let columna = -1;
  return (
    <span className={`odometro ${className}`}>
      {texto.split("").map((ch, i) => {
        if (/\d/.test(ch)) {
          columna += 1;
          return <Rodillo key={i} digito={ch} delayMs={columna * 90} />;
        }
        return (
          <span key={i} className="odometro-estatico">
            {ch}
          </span>
        );
      })}
    </span>
  );
}
