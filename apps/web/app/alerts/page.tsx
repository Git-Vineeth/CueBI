"use client";
import { useState, useEffect } from "react";
import { Bell, Plus, Trash2, Loader2, AlertTriangle, TrendingDown, TrendingUp, Equal } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { listAlerts, createAlert, deleteAlert, listQueries, type Alert } from "@/lib/api";

const CONDITIONS = [
  { value: "less_than", label: "drops below", icon: TrendingDown },
  { value: "greater_than", label: "exceeds", icon: TrendingUp },
  { value: "equals", label: "equals", icon: Equal },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [queries, setQueries] = useState<any[]>([]);
  const [form, setForm] = useState({ name: "", query_id: "", condition: "less_than", threshold: "", column_name: "", notify_emails: "", check_interval_minutes: "60" });
  const [saving, setSaving] = useState(false);

  const refresh = () => { listAlerts().then((r) => setAlerts(r.data)).catch(() => {}); };
  useEffect(() => { refresh(); listQueries(50).then((r) => setQueries(r.data)).catch(() => {}); }, []);

  const handleCreate = async () => {
    if (!form.name || !form.query_id || !form.threshold || !form.column_name) { toast.error("Fill all required fields"); return; }
    setSaving(true);
    try {
      await createAlert({
        name: form.name, query_id: form.query_id, condition: form.condition,
        threshold: parseFloat(form.threshold), column_name: form.column_name,
        check_interval_minutes: parseInt(form.check_interval_minutes) || 60,
        notify_emails: form.notify_emails.split(",").map((e) => e.trim()).filter(Boolean),
      });
      toast.success("Alert created!");
      setShowForm(false); setForm({ name: "", query_id: "", condition: "less_than", threshold: "", column_name: "", notify_emails: "", check_interval_minutes: "60" });
      refresh();
    } catch (err: any) { toast.error(err?.response?.data?.detail || "Failed"); }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    try { await deleteAlert(id); toast.success("Deleted"); refresh(); } catch { toast.error("Failed"); }
  };

  const conditionLabel = (c: string) => CONDITIONS.find((x) => x.value === c)?.label || c;

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 ml-[200px] overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-sans text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Alerts</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>Get notified when a metric crosses a threshold</p>
            </div>
            <button onClick={() => setShowForm(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" className="btn btn-primary" style={{}}>
              <Plus size={16} /> New Alert
            </button>
          </div>

          {/* Create Form */}
          {showForm && (
            <div className="card p-6 mb-6 fade-in">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>Create Alert</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Alert name</label>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Daily revenue below ₹1L"
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Query to monitor</label>
                  <select value={form.query_id} onChange={(e) => setForm({ ...form, query_id: e.target.value })}
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                    <option value="" style={{ background: "var(--bg-card)" }}>Select a past query...</option>
                    {queries.map((q: any) => (
                      <option key={q.id} value={q.id} style={{ background: "var(--bg-card)" }}>{q.question}</option>
                    ))}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Column to watch</label>
                    <input value={form.column_name} onChange={(e) => setForm({ ...form, column_name: e.target.value })} placeholder="total_revenue"
                      className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Condition</label>
                    <select value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value })}
                      className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}>
                      {CONDITIONS.map((c) => (
                        <option key={c.value} value={c.value} style={{ background: "var(--bg-card)" }}>{c.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Threshold (₹)</label>
                    <input type="number" value={form.threshold} onChange={(e) => setForm({ ...form, threshold: e.target.value })} placeholder="100000"
                      className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Check every (minutes)</label>
                  <input type="number" value={form.check_interval_minutes} onChange={(e) => setForm({ ...form, check_interval_minutes: e.target.value })} placeholder="60"
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Notify emails (comma separated)</label>
                  <input value={form.notify_emails} onChange={(e) => setForm({ ...form, notify_emails: e.target.value })} placeholder="you@company.com"
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <div className="flex-1" />
                  <button onClick={() => setShowForm(false)} className="btn-ghost px-4 py-2 text-sm">Cancel</button>
                  <button onClick={handleCreate} disabled={saving} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" className="btn btn-primary" style={{}}>
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Bell size={14} />} Create Alert
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Alert List */}
          {alerts.length === 0 && !showForm ? (
            <div className="flex flex-col items-center py-16 card">
              <Bell size={32} className="mb-3" style={{ color: "var(--text-muted)" }} />
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>No alerts yet</p>
              <p className="text-xs mt-1" style={{ color: "var(--text-dim)" }}>Example: "Notify me when daily revenue drops below ₹1,00,000"</p>
            </div>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <div key={a.id} className="card flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: a.is_active ? "var(--red-soft)" : "var(--bg-secondary)" }}>
                      <AlertTriangle size={16} style={{ color: a.is_active ? "var(--red)" : "var(--text-dim)" }} />
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{a.name}</div>
                      <div className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                        <span className="font-mono">{a.column_name}</span> {conditionLabel(a.condition)} <span className="font-semibold">₹{Number(a.threshold).toLocaleString("en-IN")}</span>
                        <span className="mx-1">·</span>every {a.check_interval_minutes}min
                        {a.last_triggered_at && <><span className="mx-1">·</span><span className="text-red-400">triggered {new Date(a.last_triggered_at).toLocaleDateString("en-IN")}</span></>}
                      </div>
                    </div>
                  </div>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]">
                    <Trash2 size={14} style={{ color: "var(--text-muted)" }} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
