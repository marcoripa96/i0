"use client";

import { createContext, useContext, useState, useCallback, useRef } from "react";
import { setTheme as setThemeCookie } from "@/app/actions";

type Theme = "dark" | "light";

const ThemeContext = createContext<{
  theme: Theme;
  toggleTheme: () => void;
}>({
  theme: "dark",
  toggleTheme: () => {},
});

export function ThemeProvider({
  initialTheme,
  children,
}: {
  initialTheme: Theme;
  children: React.ReactNode;
}) {
  const [theme, setTheme] = useState<Theme>(initialTheme);
  const initialized = useRef(false);

  // Sync the <html> class with the server-resolved theme on first render
  if (!initialized.current) {
    initialized.current = true;
    if (typeof document !== "undefined") {
      document.documentElement.classList.toggle("dark", initialTheme === "dark");
    }
  }

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === "dark" ? "light" : "dark";

      // Disable all transitions during the theme switch to avoid lag
      const style = document.createElement("style");
      style.textContent = "*, *::before, *::after { transition: none !important; }";
      document.head.appendChild(style);

      document.documentElement.classList.toggle("dark", next === "dark");

      // Force a reflow so the browser applies colors without transitions
      document.body.offsetHeight; // eslint-disable-line @typescript-eslint/no-unused-expressions

      // Re-enable transitions on the next frame
      requestAnimationFrame(() => style.remove());

      setThemeCookie(next);
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
