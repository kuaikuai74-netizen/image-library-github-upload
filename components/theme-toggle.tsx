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

type ThemeToggleProps = { compact?: boolean };

export function ThemeToggle({ compact = false }: ThemeToggleProps) {
  const theme = useSyncExternalStore(subscribeToThemeChanges, getThemeSnapshot, () => "light");

  function selectTheme(nextTheme: ThemeMode) {
    applyTheme(nextTheme);
  }

  return (
    <div className={compact ? "theme-switcher compact" : "theme-switcher"} role="group" aria-label="页面主题">
      <button type="button" aria-pressed={theme === "light"} onClick={() => selectTheme("light")} title="日间" aria-label="日间模式">
        <Sun aria-hidden="true" />
        {!compact && <span>日间</span>}
      </button>
      <button type="button" aria-pressed={theme === "dark"} onClick={() => selectTheme("dark")} title="夜间" aria-label="夜间模式">
        <Moon aria-hidden="true" />
        {!compact && <span>夜间</span>}
      </button>
    </div>
  );
}
