"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquare, Database, LayoutDashboard, History, Table2, CalendarClock, Bell, Users, Zap, Moon, Sun } from "lucide-react";
import { useAppStore } from "@/lib/store";

const MAIN_NAV = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/connections", label: "Sources", icon: Database },
  { href: "/schema", label: "Schema", icon: Table2 },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
];

const AUTO_NAV = [
  { href: "/reports", label: "Reports", icon: CalendarClock },
  { href: "/alerts", label: "Alerts", icon: Bell },
];

const SETTINGS_NAV = [
  { href: "/teams", label: "Team", icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, theme, toggleTheme } = useAppStore();

  const NavItem = ({ href, label, icon: Icon }: { href: string; label: string; icon: any }) => {
    const active = pathname === href || pathname?.startsWith(href + "/");
    return (
      <Link
        href={href}
        className="flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[13px] font-medium transition-all duration-100"
        style={{
          background: active ? "var(--accent-muted)" : "transparent",
          color: active ? "var(--accent)" : "var(--fg-2)",
        }}
        onMouseEnter={(e) => { if (!active) { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.color = "var(--fg-1)"; } }}
        onMouseLeave={(e) => { if (!active) { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-2)"; } }}
      >
        <Icon size={15} strokeWidth={active ? 2 : 1.75} />
        {sidebarOpen && label}
      </Link>
    );
  };

  const Section = ({ label }: { label: string }) => (
    sidebarOpen ? (
      <div className="text-[10px] font-semibold uppercase tracking-[0.08em] px-3 pt-5 pb-1.5" style={{ color: "var(--fg-4)" }}>
        {label}
      </div>
    ) : <div className="mx-3 my-3" style={{ height: 1, background: "var(--border)" }} />
  );

  return (
    <aside
      className={`fixed top-0 left-0 h-screen flex flex-col border-r z-30 transition-all duration-150 ${sidebarOpen ? "w-[200px]" : "w-14"}`}
      style={{ background: "var(--bg-1)", borderColor: "var(--border)" }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 px-3 h-[52px] shrink-0">
        <div className="w-7 h-7 rounded-md flex items-center justify-center" style={{ background: "var(--accent)" }}>
          <Zap size={14} color="#fff" />
        </div>
        {sidebarOpen && (
          <span className="font-semibold text-[14px] tracking-[-0.01em]" style={{ color: "var(--fg-0)" }}>
            CueBI
          </span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-2 space-y-[2px] overflow-y-auto">
        {MAIN_NAV.map((item) => <NavItem key={item.href} {...item} />)}
        <Section label="Automate" />
        {AUTO_NAV.map((item) => <NavItem key={item.href} {...item} />)}
        <Section label="Settings" />
        {SETTINGS_NAV.map((item) => <NavItem key={item.href} {...item} />)}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t shrink-0" style={{ borderColor: "var(--border)" }}>
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[12px] transition-colors"
          style={{ color: "var(--fg-3)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.color = "var(--fg-1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}
        >
          {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
          {sidebarOpen && (theme === "dark" ? "Light mode" : "Dark mode")}
        </button>
        {sidebarOpen && (
          <div className="text-[10px] px-3 mt-2" style={{ color: "var(--fg-4)" }}>v0.2 · Cuemath</div>
        )}
      </div>
    </aside>
  );
}
