"use client";

import { useEffect, useState } from "react";

export type DeviceType = "mobile" | "desktop";

// Detecta el TIPO de dispositivo real (celular/tablet vs. computador), no
// solo el ancho de la ventana — así una ventana de Chrome angosta en un PC
// sigue mostrando el layout de escritorio, y un celular en horizontal sigue
// mostrando el layout mobile.
function detectar(): DeviceType {
  if (typeof navigator === "undefined") return "desktop";
  const ua = navigator.userAgent || "";
  const esMobilePorUA = /Android|iPhone|iPod|Mobi|BlackBerry|IEMobile|Windows Phone/i.test(ua);
  // iPadOS 13+ se reporta como "Macintosh" en el user agent, pero tiene
  // pantalla táctil — esa es la señal real de que es un iPad y no un Mac.
  const esIpad = /iPad/i.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return esMobilePorUA || esIpad ? "mobile" : "desktop";
}

export function useDeviceType(): DeviceType {
  const [tipo, setTipo] = useState<DeviceType>("desktop");
  useEffect(() => {
    setTipo(detectar());
  }, []);
  return tipo;
}
