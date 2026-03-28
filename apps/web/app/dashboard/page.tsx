"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LayoutDashboard, Trash2, RefreshCw, Loader2, BarChart3, TrendingUp, PieChart, Table2 } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { listPinned, unpinQuery, runQuery } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import dynamic from "next/dynamic";
const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const ICONS: Record<string, any> = { bar: BarChart3, line: TrendingUp, pie: PieChart, horizontal_bar: BarChart3, grouped_bar: BarChart3, table: Table2 };

export default function DashboardPage() {
  const [pins, setPins] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, any>>({});
  const router = useRouter();
  const { sidebarOpen } = useAppStore();
  const ml = sidebarOpen ? "ml-[200px]" : "ml-14";

  const load = () => listPinned().then((r) => setPins(r.data)).catch(() => {});
  useEffect(() => { load(); }, []);

  const handleRefresh = async (pin: any) => {
    setRefreshing(pin.query_id);
    try { const res = await runQuery({ question: pin.question, connection_id: pin.connection_id, llm_provider: pin.llm_provider || "openai" }); setData((p) => ({ ...p, [pin.query_id]: res.data })); toast.success("Refreshed"); }
    catch { toast.error("Refresh failed"); }
    setRefreshing(null);
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className={`flex-1 ${ml} overflow-y-auto transition-all duration-150`}>
        <div className="max-w-5xl mx-auto px-5 py-8">
          <div className="mb-6">
            <h1 className="text-[18px] font-semibold" style={{ color: "var(--fg-0)" }}>Dashboard</h1>
            <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>{pins.length > 0 ? `${pins.length} pinned queries` : "Pin queries from Chat to build your dashboard"}</p>
          </div>

          {pins.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><LayoutDashboard size={20} /></div>
              <h3>No pinned queries</h3>
              <p>Ask a question in Chat, then click "Pin" to add it here.</p>
              <button onClick={() => router.push("/chat")} className="btn btn-primary text-[12px] mt-4">Go to Chat</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {pins.map((pin) => {
                const d = data[pin.query_id];
                const Icon = ICONS[pin.chart_type] || Table2;
                return (
                  <div key={pin.pin_id} className="card p-4 fade-in">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Icon size={14} style={{ color: "var(--accent)" }} />
                        <span className="text-[13px] font-medium truncate" style={{ color: "var(--fg-0)" }}>{pin.name}</span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => handleRefresh(pin)} disabled={refreshing === pin.query_id} className="btn-ghost p-1.5">
                          {refreshing === pin.query_id ? <Loader2 size={12} className="animate-spin" style={{ color: "var(--fg-3)" }} /> : <RefreshCw size={12} style={{ color: "var(--fg-3)" }} />}
                        </button>
                        <button onClick={async () => { await unpinQuery(pin.query_id); toast.success("Unpinned"); load(); }} className="btn-ghost p-1.5">
                          <Trash2 size={12} style={{ color: "var(--fg-3)" }} />
                        </button>
                      </div>
                    </div>
                    {d?.chart?.echarts_option && d.chart.chart_type !== "table" && (
                      <div className="mb-3 -mx-1"><ReactECharts option={{ ...d.chart.echarts_option, backgroundColor: "transparent" }} style={{ height: 160 }} /></div>
                    )}
                    <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-2)" }}>{d?.summary || pin.summary || "Click refresh to load"}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="badge badge-accent">{pin.llm_provider}</span>
                      <span className="text-[10px]" style={{ color: "var(--fg-3)" }}>{pin.result_row_count} rows · {pin.duration_ms}ms</span>
                    </div>
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
