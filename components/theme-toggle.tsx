"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

type ThemeMode = "light" | "dark";

const themeStorageKey = "visual-asset-theme";

function isThemeMode(value: string | null): value is ThemeMode {
  return value === "light" || value === "dark";
}

function getThemeSnapshot(): ThemeMode {
  if (typeof document === "undefined") return "light";

  try {
    const currentTheme = document.documentElement.dataset.theme ?? localStorage.getItem(themeStorageKey);
    return isThemeMode(currentTheme) ? currentTheme : "light";
  } catch {
    const htmlTheme = document.documentElement.dataset.theme ?? null;
    return isThemeMode(htmlTheme) ? htmlTheme : "light";
  }
}

function subscribeToThemeChanges(onChange: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  window.addEventListener("themechange", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("themechange", onChange);
  };
}

function applyTheme(theme: ThemeMode) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem(themeStorageKey, theme);
  } catch {
    document.documentElement.dataset.theme = theme;
  }
  window.dispatchEvent(new Event("themechange"));
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeToThemeChanges, getThemeSnapshot, () => "light");

  function selectTheme(nextTheme: ThemeMode) {
    applyTheme(nextTheme);
  }

  return (
    <div className="theme-switcher" role="group" aria-label="页面主题">
      <button type="button" aria-pressed={theme === "light"} onClick={() => selectTheme("light")}>
        <Sun aria-hidden="true" />
        <span>日间</span>
      </button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => selectTheme("dark")}>
        <Moon aria-hidden="true" />
        <span>夜间</span>
      </button>
    </div>
  );
}
