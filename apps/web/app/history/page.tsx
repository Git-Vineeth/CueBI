"use client";
import { useState, useEffect } from "react";
import { History, Clock, BarChart3 } from "lucide-react";
import Sidebar from "@/components/Sidebar";
import { listQueries } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export default function HistoryPage() {
  const [queries, setQueries] = useState<any[]>([]);
  const { sidebarOpen } = useAppStore();
  const ml = sidebarOpen ? "ml-[200px]" : "ml-14";

  useEffect(() => { listQueries(50).then((r) => setQueries(r.data)).catch(() => {}); }, []);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className={`flex-1 ${ml} overflow-y-auto transition-all duration-150`}>
        <div className="max-w-2xl mx-auto px-5 py-8">
          <h1 className="text-[18px] font-semibold mb-6" style={{ color: "var(--fg-0)" }}>Query History</h1>

          {queries.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon"><History size={20} /></div>
              <h3>No queries yet</h3>
              <p>Ask something in Chat — it'll show up here.</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {queries.map((q: any) => (
                <div key={q.id} className="card card-interactive p-3.5">
                  <div className="flex items-start justify-between">
                    <p className="text-[13px] font-medium flex-1" style={{ color: "var(--fg-0)" }}>{q.question}</p>
                    <span className="text-[11px] shrink-0 ml-3 font-mono" style={{ color: "var(--fg-3)" }}>{q.duration_ms}ms</span>
                  </div>
                  {q.summary && <p className="text-[12px] mt-1 line-clamp-1" style={{ color: "var(--fg-3)" }}>{q.summary}</p>}
                  <div className="flex items-center gap-2 mt-2">
                    <span className="badge badge-accent">{q.llm_provider}</span>
                    {q.chart_type && <BarChart3 size={11} style={{ color: "var(--fg-4)" }} />}
                    <span className="text-[10px]" style={{ color: "var(--fg-4)" }}>{q.result_row_count} rows</span>
                    <span className="text-[10px] flex items-center gap-1" style={{ color: "var(--fg-4)" }}>
                      <Clock size={9} /> {new Date(q.created_at).toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
