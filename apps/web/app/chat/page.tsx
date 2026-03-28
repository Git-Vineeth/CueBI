"use client";
import { useState, useRef, useEffect } from "react";
import { Send, Loader2, ChevronDown, ChevronUp, Copy, Check, Download, Sparkles, Pin, FileQuestion, BarChart3 } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { runQuery, listConnections, pinQuery, explainSQL, type QueryResponse, type Connection } from "@/lib/api";
import { useAppStore } from "@/lib/store";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

const CHART_THEME = {
  color: ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"],
  backgroundColor: "transparent",
  textStyle: { fontFamily: "Inter, system-ui, sans-serif", color: "var(--fg-2)" },
  title: { textStyle: { color: "var(--fg-0)", fontSize: 13, fontWeight: 600 } },
  legend: { textStyle: { color: "var(--fg-2)", fontSize: 11 } },
  tooltip: { backgroundColor: "var(--bg-2)", borderColor: "var(--border)", textStyle: { color: "var(--fg-0)", fontSize: 12 } },
};

interface Message { id: string; type: "user" | "ai"; question?: string; response?: QueryResponse; error?: string; loading?: boolean; }

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [connections, setConnections] = useState<Connection[]>([]);
  const { activeConnectionId, setActiveConnection, llmProvider, sidebarOpen } = useAppStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    listConnections().then((r) => {
      const ready = r.data.filter((c: Connection) => c.status === "ready");
      setConnections(ready);
      if (ready.length > 0 && !activeConnectionId) setActiveConnection(ready[0].id);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = async () => {
    const q = input.trim();
    if (!q || loading) return;
    if (!activeConnectionId) { toast.error("Select a data source first"); return; }

    const userMsg: Message = { id: Date.now().toString(), type: "user", question: q };
    const aiMsg: Message = { id: (Date.now() + 1).toString(), type: "ai", loading: true };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await runQuery({ question: q, connection_id: activeConnectionId, llm_provider: llmProvider });
      setMessages((prev) => prev.map((m) => (m.id === aiMsg.id ? { ...m, loading: false, response: res.data } : m)));
    } catch (err: any) {
      setMessages((prev) => prev.map((m) => (m.id === aiMsg.id ? { ...m, loading: false, error: err?.response?.data?.detail || "Something went wrong" } : m)));
    }
    setLoading(false);
    inputRef.current?.focus();
  };

  const useSuggestion = (q: string) => { setInput(q); inputRef.current?.focus(); };
  const ml = sidebarOpen ? "ml-[200px]" : "ml-14";

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className={`flex-1 ${ml} flex flex-col h-screen transition-all duration-150`}>
        {/* Header */}
        <header className="h-[52px] flex items-center justify-between px-5 border-b shrink-0" style={{ background: "var(--bg-1)", borderColor: "var(--border)" }}>
          <div className="flex items-center gap-2">
            <BarChart3 size={15} style={{ color: "var(--fg-3)" }} />
            <h1 className="text-[13px] font-semibold" style={{ color: "var(--fg-0)" }}>Chat</h1>
          </div>
          <div className="flex items-center gap-2.5">
            {/* LLM Toggle */}
            <div className="flex items-center p-[3px] rounded-md" style={{ background: "var(--bg-0)" }}>
              {(["openai", "anthropic"] as const).map((p) => (
                <button key={p} onClick={() => useAppStore.getState().setLLMProvider(p)}
                  className="text-[11px] font-medium px-2.5 py-[3px] rounded transition-all"
                  style={{ background: llmProvider === p ? "var(--accent)" : "transparent", color: llmProvider === p ? "#fff" : "var(--fg-3)" }}>
                  {p === "openai" ? "GPT-4o" : "Claude"}
                </button>
              ))}
            </div>
            {/* Connection selector */}
            <select value={activeConnectionId || ""} onChange={(e) => setActiveConnection(e.target.value)} className="select text-[11px] py-1">
              {connections.length === 0 && <option value="">No sources</option>}
              {connections.map((c) => <option key={c.id} value={c.id} style={{ background: "var(--bg-2)" }}>{c.name}</option>)}
            </select>
          </div>
        </header>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="max-w-[720px] mx-auto px-5 py-6 space-y-5">
            {messages.length === 0 && <EmptyState onSuggestion={useSuggestion} />}
            {messages.map((m) => m.type === "user"
              ? <UserBubble key={m.id} text={m.question || ""} />
              : <AIResponse key={m.id} msg={m} onSuggestion={useSuggestion} />
            )}
          </div>
        </div>

        {/* Input */}
        <div className="shrink-0 border-t px-5 py-3" style={{ borderColor: "var(--border)", background: "var(--bg-1)" }}>
          <div className="max-w-[720px] mx-auto relative">
            <textarea ref={inputRef} value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
              placeholder="Ask a question about your data..."
              rows={1}
              className="input pr-12 resize-none text-[13px] py-2.5"
              style={{ minHeight: 42 }}
            />
            <button onClick={submit} disabled={loading || !input.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-md flex items-center justify-center transition-all"
              style={{ background: input.trim() ? "var(--accent)" : "var(--bg-3)", color: input.trim() ? "#fff" : "var(--fg-4)" }}>
              {loading ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ── Sub-components ── */

function EmptyState({ onSuggestion }: { onSuggestion: (q: string) => void }) {
  const suggestions = [
    "Top 5 customers by revenue",
    "Monthly revenue trend this FY",
    "Which payment mode is most popular?",
    "Total GST collected this year",
    "City-wise order distribution",
    "Average order value by customer type",
  ];
  return (
    <div className="flex flex-col items-center justify-center pt-16 pb-8 fade-in">
      <div className="empty-state-icon w-12 h-12 mb-4">
        <Sparkles size={20} />
      </div>
      <h3 className="text-[15px] font-semibold mb-1" style={{ color: "var(--fg-0)" }}>Ask BharatBI</h3>
      <p className="text-[13px] mb-6" style={{ color: "var(--fg-3)" }}>Type a question in plain English — no SQL needed</p>
      <div className="grid grid-cols-2 gap-2 w-full max-w-md">
        {suggestions.map((s) => (
          <button key={s} onClick={() => onSuggestion(s)}
            className="text-left text-[12px] px-3 py-2.5 rounded-lg border transition-all"
            style={{ borderColor: "var(--border)", color: "var(--fg-2)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; e.currentTarget.style.background = "var(--accent-muted)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "transparent"; }}>
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end fade-in">
      <div className="max-w-[480px] text-[13px] px-4 py-2.5 rounded-xl rounded-br-sm" style={{ background: "var(--accent-muted)", color: "var(--fg-0)" }}>
        {text}
      </div>
    </div>
  );
}

function AIResponse({ msg, onSuggestion }: { msg: Message; onSuggestion: (q: string) => void }) {
  const [sqlOpen, setSqlOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  if (msg.loading) return (
    <div className="fade-in flex items-center gap-2 py-2">
      <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
      <span className="text-[12px] ml-1" style={{ color: "var(--fg-3)" }}>Analyzing...</span>
    </div>
  );

  if (msg.error) return (
    <div className="fade-in text-[13px] px-4 py-3 rounded-lg border" style={{ background: "var(--danger-muted)", borderColor: "rgba(239,68,68,0.2)", color: "#fca5a5" }}>
      {msg.error}
    </div>
  );

  const r = msg.response!;
  const copySQL = () => { navigator.clipboard.writeText(r.sql); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const downloadCSV = () => {
    const csv = [r.columns.join(","), ...r.rows.map((row) => row.map((c: any) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" })); a.download = "bharatbi_export.csv"; a.click();
  };

  return (
    <div className="fade-in space-y-3">
      {/* Summary */}
      {r.summary && <p className="text-[13px] leading-relaxed" style={{ color: "var(--fg-1)" }}>{r.summary}</p>}

      {/* Chart */}
      {r.chart?.echarts_option && r.chart.chart_type !== "table" && (
        <div className="card p-4">
          <ReactECharts option={{ ...CHART_THEME, ...r.chart.echarts_option, backgroundColor: "transparent" }} style={{ height: 260 }} />
        </div>
      )}

      {/* Table */}
      {r.rows.length > 0 && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-3.5 py-2 border-b" style={{ borderColor: "var(--border)" }}>
            <span className="text-[11px] font-medium" style={{ color: "var(--fg-3)" }}>
              {r.row_count} row{r.row_count !== 1 ? "s" : ""} · {r.duration_ms}ms
            </span>
            <button onClick={downloadCSV} className="btn-ghost text-[11px] py-1 px-2">
              <Download size={11} /> CSV
            </button>
          </div>
          <div className="overflow-x-auto max-h-56">
            <table className="data-table">
              <thead><tr>{r.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
              <tbody>
                {r.rows.slice(0, 50).map((row, i) => (
                  <tr key={i}>{row.map((cell: any, j: number) => <td key={j}>{String(cell)}</td>)}</tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SQL */}
      <div className="card overflow-hidden">
        <button onClick={() => setSqlOpen(!sqlOpen)} className="w-full flex items-center justify-between px-3.5 py-2 text-[11px] font-medium" style={{ color: "var(--fg-3)" }}>
          <span>Generated SQL</span>
          <div className="flex items-center gap-1.5">
            <button onClick={(e) => { e.stopPropagation(); copySQL(); }} className="btn-ghost p-1">
              {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
            </button>
            {sqlOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </div>
        </button>
        {sqlOpen && (
          <div className="px-3.5 pb-3 space-y-2">
            <pre className="sql-block">{r.sql}</pre>
            <ExplainButton sql={r.sql} />
          </div>
        )}
      </div>

      {/* Actions row — Pin + Follow-ups */}
      <div className="flex items-center flex-wrap gap-2">
        {r.query_id && <PinButton queryId={r.query_id} question={r.question} />}
        {r.suggested_questions?.map((q) => (
          <button key={q} onClick={() => onSuggestion(q)}
            className="text-[11px] px-3 py-1.5 rounded-full border transition-all"
            style={{ borderColor: "var(--border)", color: "var(--fg-2)" }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--border-hover)"; e.currentTarget.style.background = "var(--bg-3)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "transparent"; }}>
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function PinButton({ queryId, question }: { queryId: string; question: string }) {
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);
  const handlePin = async () => {
    setBusy(true);
    try { await pinQuery(queryId, question); setPinned(true); toast.success("Pinned to Dashboard"); }
    catch (err: any) { if (err?.response?.data?.detail?.includes("Already")) { setPinned(true); } else toast.error("Failed to pin"); }
    setBusy(false);
  };
  return (
    <button onClick={handlePin} disabled={pinned || busy}
      className="btn-ghost text-[11px] rounded-full px-3 py-1.5 border"
      style={{ borderColor: pinned ? "var(--success)" : "var(--border)", color: pinned ? "var(--success)" : "var(--fg-2)" }}>
      <Pin size={11} /> {pinned ? "Pinned" : busy ? "..." : "Pin"}
    </button>
  );
}

function ExplainButton({ sql }: { sql: string }) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const handle = async () => {
    setLoading(true);
    try { const res = await explainSQL(sql); setExplanation(res.data.explanation); }
    catch { toast.error("Could not explain"); }
    setLoading(false);
  };
  if (explanation) return (
    <div className="text-[12px] leading-relaxed p-3 rounded-md" style={{ background: "var(--bg-0)", color: "var(--fg-2)" }}>
      <div className="text-[10px] font-semibold uppercase tracking-wider mb-1.5 flex items-center gap-1" style={{ color: "var(--fg-4)" }}>
        <FileQuestion size={10} /> Explanation
      </div>
      {explanation}
    </div>
  );
  return (
    <button onClick={handle} disabled={loading} className="btn-ghost text-[11px] px-2.5 py-1">
      {loading ? <Loader2 size={10} className="animate-spin" /> : <FileQuestion size={10} />}
      {loading ? "Explaining..." : "Explain this SQL"}
    </button>
  );
}
