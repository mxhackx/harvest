"use client";

import { currentPath } from "./legacy-routes";
import { useCallback, useMemo, useSyncExternalStore } from "react";

const KEY = "harvest.pins";
const listeners = new Set<() => void>();

/** Ajoute l'adresse en tête si absente, la retire sinon. Pure : testable sans navigateur. */
export function togglePin(pins: string[], href: string): string[] {
  return pins.includes(href) ? pins.filter((p) => p !== href) : [...pins, href];
}

/** Lecture tolérante : un stockage corrompu ou modifié à la main donne une liste vide, jamais une erreur. */
export function parsePins(raw: string): string[] {
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && x.startsWith("/")).map(currentPath).slice(0, 20) : [];
  } catch {
    return [];
  }
}

const read = () => {
  try {
    return localStorage.getItem(KEY) ?? "[]";
  } catch {
    return "[]";
  }
};
const subscribe = (cb: () => void) => {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
};

/** Pages épinglées dans le menu, retenues sur cet appareil. */
export function usePins(): { pins: string[]; toggle: (href: string) => void } {
  const raw = useSyncExternalStore(subscribe, read, () => "[]");
  const pins = useMemo(() => parsePins(raw), [raw]);
  const toggle = useCallback(
    (href: string) => {
      try {
        localStorage.setItem(KEY, JSON.stringify(togglePin(parsePins(read()), href)));
      } catch {
        /* navigation privée : l'épingle ne sera simplement pas retenue */
      }
      listeners.forEach((l) => l());
    },
    [],
  );
  return { pins, toggle };
}
