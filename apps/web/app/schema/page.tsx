"use client";
import { useState, useEffect } from "react";
import { Table2, ChevronRight, ChevronDown, Key, Link2, Search, GitBranch } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { listConnections, getSchema, type Connection, type SchemaTable } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function SchemaPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedConn, setSelectedConn] = useState("");
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { activeConnectionId, sidebarOpen } = useAppStore();
  const ml = sidebarOpen ? "ml-[200px]" : "ml-14";

  useEffect(() => {
    listConnections().then((r) => {
      const ready = r.data.filter((c: Connection) => c.status === "ready");
      setConnections(ready);
      const init = activeConnectionId || (ready[0]?.id ?? "");
      if (init) {
        setSelectedConn(init);
        getSchema(init).then((r) => setTables(r.data)).catch(() => setTables([]));
      }
    }).catch(() => {});
  }, []);

  const loadSchema = (id: string) => {
    setSelectedConn(id);
    getSchema(id).then((r) => setTables(r.data)).catch(() => setTables([]));
    setExpanded(null);
  };

  const filtered = tables.filter((t) =>
    t.table_name.toLowerCase().includes(search.toLowerCase()) ||
    t.columns.some((c) => c.column_name.toLowerCase().includes(search.toLowerCase()))
  );

  const dbtTables = tables.filter((t) => t.source === "dbt").length;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className={`flex-1 ${ml} overflow-y-auto transition-all duration-150`}>
        <div className="max-w-2xl mx-auto px-5 py-8">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h1 className="text-[18px] font-semibold" style={{ color: "var(--fg-0)" }}>Schema</h1>
              {dbtTables > 0 && (
                <p className="text-[11px] mt-0.5 flex items-center gap-1" style={{ color: "var(--accent)" }}>
                  <GitBranch size={10} /> {dbtTables} dbt models — descriptions &amp; relationships loaded
                </p>
              )}
            </div>
            <select value={selectedConn} onChange={(e) => loadSchema(e.target.value)} className="select text-[12px]">
              {connections.map((c) => (
                <option key={c.id} value={c.id} style={{ background: "var(--bg-2)" }}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="relative mb-4">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: "var(--fg-4)" }} />
            <input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tables or columns…" className="input text-[13px] pl-9"
            />
          </div>

          {filtered.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><Table2 size={20} /></div>
              <h3>{tables.length === 0 ? "No schema found" : "No matches"}</h3>
              <p>{tables.length === 0 ? "Sync a connection first." : "Try a different search."}</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {filtered.map((table) => {
                const open = expanded === table.table_name;
                const isDbt = table.source === "dbt";
                const docCount = table.columns.filter((c) => c.description).length;

                return (
                  <div key={table.table_name} className="card overflow-hidden">
                    <button
                      onClick={() => setExpanded(open ? null : table.table_name)}
                      className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.background = "var(--bg-3)"}
                      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                    >
                      {open
                        ? <ChevronDown size={13} style={{ color: "var(--fg-4)" }} />
                        : <ChevronRight size={13} style={{ color: "var(--fg-4)" }} />}
                      <Table2 size={14} style={{ color: "var(--accent)" }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-medium font-mono truncate" style={{ color: "var(--fg-0)" }}>
                            {isDbt && table.dbt_schema
                              ? <><span style={{ color: "var(--fg-4)" }}>{table.dbt_schema}.</span>{table.table_name}</>
                              : table.table_name}
                          </span>
                          {isDbt && (
                            <span
                              className="text-[9px] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                              style={{ background: "var(--accent-muted)", color: "var(--accent)" }}
                            >
                              dbt
                            </span>
                          )}
                        </div>
                        {isDbt && table.lineage.length > 0 && (
                          <div className="text-[10px] flex items-center gap-1 mt-0.5" style={{ color: "var(--fg-4)" }}>
                            <GitBranch size={9} />
                            {table.lineage.slice(0, 3).join(", ")}
                            {table.lineage.length > 3 && ` +${table.lineage.length - 3}`}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 text-[10px]" style={{ color: "var(--fg-4)" }}>
                        {isDbt && docCount > 0 && (
                          <span style={{ color: "var(--success)" }}>{docCount}/{table.columns.length} documented</span>
                        )}
                        <span>{table.columns.length} cols</span>
                      </div>
                    </button>

                    {open && (
                      <div className="border-t" style={{ borderColor: "var(--border)" }}>
                        {table.columns.map((col) => (
                          <div
                            key={col.column_name}
                            className="flex items-start gap-2.5 px-3.5 py-2 text-[12px] border-b last:border-b-0"
                            style={{ borderColor: "var(--border)" }}
                          >
                            <div className="w-4 flex justify-center mt-0.5 shrink-0">
                              {col.is_primary_key
                                ? <Key size={10} style={{ color: "var(--warning)" }} />
                                : col.foreign_key
                                ? <Link2 size={10} style={{ color: "var(--accent)" }} />
                                : null}
                            </div>
                            <span className="font-mono font-medium w-36 shrink-0 truncate" style={{ color: "var(--fg-0)" }}>
                              {col.column_name}
                            </span>
                            <span className="badge text-[10px] py-0 shrink-0" style={{ background: "var(--bg-3)", color: "var(--fg-3)" }}>
                              {col.data_type}
                            </span>
                            <div className="flex-1 min-w-0">
                              {col.description ? (
                                <span className="text-[11px]" style={{ color: "var(--fg-2)" }}>{col.description}</span>
                              ) : (
                                <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>—</span>
                              )}
                              {col.foreign_key && (
                                <div className="text-[10px] mt-0.5 font-mono" style={{ color: "var(--fg-4)" }}>
                                  → {col.foreign_key}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
