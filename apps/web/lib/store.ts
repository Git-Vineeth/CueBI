import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AppState {
  activeConnectionId: string | null;
  setActiveConnection: (id: string | null) => void;
  llmProvider: "openai" | "anthropic";
  setLLMProvider: (p: "openai" | "anthropic") => void;
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: "dark" | "light";
  toggleTheme: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      activeConnectionId: null,
      setActiveConnection: (id) => set({ activeConnectionId: id }),
      llmProvider: "openai",
      setLLMProvider: (p) => set({ llmProvider: p }),
      sidebarOpen: true,
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
      theme: "dark",
      toggleTheme: () => set((s) => {
        const next = s.theme === "dark" ? "light" : "dark";
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", next);
        }
        return { theme: next };
      }),
    }),
    {
      name: "bharatbi-settings",
      partialize: (state) => ({
        activeConnectionId: state.activeConnectionId,
        llmProvider: state.llmProvider,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
      }),
    }
  )
);

// Apply theme on load
if (typeof window !== "undefined") {
  const stored = localStorage.getItem("bharatbi-settings");
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      const theme = parsed?.state?.theme || "dark";
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }
}

// Indian number formatting
export function formatINR(n: number): string {
  if (n === null || n === undefined || isNaN(n)) return "₹0";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
  if (abs >= 1_000) return `${sign}₹${abs.toLocaleString("en-IN")}`;
  return `${sign}₹${abs}`;
}
