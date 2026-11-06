"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";

/**
 * Appearance: System (the default), Dark or Light (redesign §2). The app is designed dark
 * first; "System" follows the phone. The choice is saved on this device and applied to
 * <html data-theme> before first paint by THEME_SCRIPT, so there's no flash.
 */
export type Appearance = "system" | "dark" | "light";

const KEY = "uosbuddy-theme";

/** Inline in <head>: applies a saved Dark or Light before the page paints. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}`;

function apply(appearance: Appearance) {
  const root = document.documentElement;
  if (appearance === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", appearance);
}

const ThemeContext = createContext<{
  appearance: Appearance;
  setAppearance: (a: Appearance) => void;
}>({ appearance: "system", setAppearance: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setState] = useState<Appearance>("system");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved === "dark" || saved === "light") setState(saved);
    } catch {
      // Storage unavailable (private mode): follow the system.
    }
  }, []);

  const setAppearance = useCallback((next: Appearance) => {
    setState(next);
    apply(next);
    try {
      if (next === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, next);
    } catch {
      // Applied for this visit only.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ appearance, setAppearance }}>{children}</ThemeContext.Provider>
  );
}

export const useAppearance = () => useContext(ThemeContext);
