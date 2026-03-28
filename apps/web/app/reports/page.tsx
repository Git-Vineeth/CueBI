"use client";
import { useState, useEffect } from "react";
import { Clock, Plus, Trash2, ToggleLeft, ToggleRight, CalendarClock, Loader2, Mail } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { listSchedules, createSchedule, deleteSchedule, toggleSchedule, listQueries, type Schedule } from "@/lib/api";

const CRON_PRESETS = [
  { label: "Every Monday 9 AM", cron: "0 9 * * 1", desc: "Weekly on Monday" },
  { label: "Every day 9 AM", cron: "0 9 * * *", desc: "Daily" },
  { label: "1st of every month", cron: "0 9 1 * *", desc: "Monthly" },
  { label: "Every Friday 5 PM", cron: "0 17 * * 5", desc: "Weekly on Friday" },
];

export default function ReportsPage() {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [queries, setQueries] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", query_id: "", cron_expression: "0 9 * * 1", recipients: "", format: "csv" });
  const [saving, setSaving] = useState(false);

  const refresh = () => { listSchedules().then((r) => setSchedules(r.data)).catch(() => {}); };
  useEffect(() => { refresh(); listQueries(50).then((r) => setQueries(r.data)).catch(() => {}); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.query_id) { toast.error("Fill in name and select a query"); return; }
    setSaving(true);
    try {
      await createSchedule({
        name: form.name, query_id: form.query_id, cron_expression: form.cron_expression,
        recipients: form.recipients.split(",").map((e) => e.trim()).filter(Boolean),
        format: form.format,
      });
      toast.success("Schedule created!");
      setShowForm(false); setForm({ name: "", query_id: "", cron_expression: "0 9 * * 1", recipients: "", format: "csv" });
      refresh();
    } catch (err: any) { toast.error(err?.response?.data?.detail || "Failed"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try { await deleteSchedule(id); toast.success("Deleted"); refresh(); } catch { toast.error("Failed"); }
  };

  const handleToggle = async (id: string) => {
    try { await toggleSchedule(id); refresh(); } catch { toast.error("Failed"); }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 ml-[200px] overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-sans text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Scheduled Reports</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Run queries automatically and email results on a schedule</p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" className="btn btn-primary" style={{}}>
              <Plus size={16} /> New Schedule
            </button>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="card p-6 mb-6 fade-in">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Create Schedule</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Weekly Sales Report"
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Query to run</label>
                  <select value={form.query_id} onChange={(e) => setForm({ ...form, query_id: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    <option value="" style={{ background: "var(--bg-card)" }}>Select a past query...</option>
                    {queries.map((q: any) => (
                      <option key={q.id} value={q.id} style={{ background: "var(--bg-card)" }}>{q.question}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Frequency</label>
                  <div className="grid grid-cols-2 gap-2">
                    {CRON_PRESETS.map((p) => (
                      <button key={p.cron} onClick={() => setForm({ ...form, cron_expression: p.cron })}
                        className={`text-left text-xs px-3 py-2.5 rounded-lg border transition-colors ${form.cron_expression === p.cron ? "border-[var(--accent)]" : ""}`}
                        style={{ borderColor: form.cron_expression === p.cron ? "var(--accent)" : "var(--border)", background: form.cron_expression === p.cron ? "var(--accent-soft)" : "var(--bg-secondary)", color: "var(--text-secondary)" }}>
                        <div className="font-medium" style={{ color: "var(--text-primary)" }}>{p.desc}</div>
                        <div style={{ color: "var(--text-muted)" }}>{p.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Email recipients (comma separated)</label>
                  <input value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} placeholder="you@company.com, boss@company.com"
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div className="flex items-center gap-3">
                  <select value={form.format} onChange={(e) => setForm({ ...form, format: e.target.value })}
                    className="text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                    <option value="csv" style={{ background: "var(--bg-card)" }}>CSV</option>
                    <option value="pdf" style={{ background: "var(--bg-card)" }}>PDF</option>
                  </select>
                  <div className="flex-1" />
                  <button onClick={() => setShowForm(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                  <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" className="btn btn-primary" style={{}}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <CalendarClock size={14} />} Create
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Schedule List */}
          {schedules.length === 0 && !showForm ? (
            <div className="flex flex-col items-center py-16 card">
              <CalendarClock size={32} className="mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No scheduled reports yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>Ask a question in Chat first, then schedule it here</p>
            </div>
          ) : (
            <div className="space-y-2">
              {schedules.map((s) => (
                <div key={s.id} className="card flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: s.is_active ? "var(--teal-soft)" : "var(--bg-secondary)" }}>
                      <Clock size={16} style={{ color: s.is_active ? "var(--teal)" : "var(--text-dim)" }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{s.name}</div>
                      <div className="text-xs mt-0.5 flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
                        <span className="font-mono">{s.cron_expression}</span>
                        <span>·</span>
                        <span>{s.format?.toUpperCase()}</span>
                        {s.question && <><span>·</span><span className="truncate max-w-[200px]">{s.question}</span></>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => handleToggle(s.id)} className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]">
                      {s.is_active ? <ToggleRight size={18} style={{ color: "var(--teal)" }} /> : <ToggleLeft size={18} style={{ color: "var(--text-dim)" }} />}
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]">
                      <Trash2 size={14} style={{ color: "var(--text-muted)" }} />
                    </button>
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
