"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  MessageSquare, Database, LayoutDashboard, History,
  Table2, CalendarClock, Bell, Users, Zap, Moon, Sun,
  ShieldCheck, LogOut,
} from "lucide-react";
import { useAppStore } from "@/lib/store";

const MAIN_NAV = [
  { href: "/chat", label: "Chat", icon: MessageSquare },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/history", label: "History", icon: History },
];

const ADMIN_NAV = [
  { href: "/connections", label: "Sources", icon: Database },
  { href: "/schema", label: "Schema", icon: Table2 },
  { href: "/reports", label: "Reports", icon: CalendarClock },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/teams", label: "Team", icon: Users },
  { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen, theme, toggleTheme } = useAppStore();
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.cuebi_role === "admin";

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

        {/* Admin-only navigation */}
        {isAdmin && (
          <>
            <Section label="Admin" />
            {ADMIN_NAV.map((item) => <NavItem key={item.href} {...item} />)}
          </>
        )}
      </nav>

      {/* Footer — user info + theme toggle */}
      <div className="px-2 py-3 border-t shrink-0 space-y-[2px]" style={{ borderColor: "var(--border)" }}>
        {/* User avatar + name */}
        {session?.user && sidebarOpen && (
          <div className="flex items-center gap-2 px-3 py-[6px] mb-1">
            {session.user.image ? (
              <img src={session.user.image} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                {session.user.name?.[0]?.toUpperCase() ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium truncate" style={{ color: "var(--fg-1)" }}>
                {session.user.name}
              </div>
              <div className="text-[10px] truncate" style={{ color: "var(--fg-4)" }}>
                {(session.user as any)?.cuebi_role ?? "analyst"}
              </div>
            </div>
          </div>
        )}

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

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-2.5 px-3 py-[7px] rounded-md text-[12px] transition-colors"
          style={{ color: "var(--fg-3)" }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg-3)"; e.currentTarget.style.color = "var(--fg-1)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--fg-3)"; }}
        >
          <LogOut size={14} />
          {sidebarOpen && "Sign out"}
        </button>

        {sidebarOpen && (
          <div className="text-[10px] px-3 mt-1" style={{ color: "var(--fg-4)" }}>v0.3 · Cuemath</div>
        )}
      </div>
    </aside>
  );
}
