"use client";
import { useState, useEffect } from "react";
import { Database, Plus, RefreshCw, CheckCircle, XCircle, Loader2, X, Wifi, Cloud } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { listConnections, createConnection, testConnection, syncConnection, type Connection } from "@/lib/api";
import { useAppStore } from "@/lib/store";

const CONNECTOR_TYPES = [
  { value: "postgresql",     label: "PostgreSQL",           defaultPort: 5432, icon: "🐘", group: "Direct" },
  { value: "mysql",          label: "MySQL",                defaultPort: 3306, icon: "🐬", group: "Direct" },
  { value: "redshift",       label: "Amazon Redshift",      defaultPort: 5439, icon: "🔴", group: "AWS" },
  { value: "rds_postgresql", label: "AWS RDS (PostgreSQL)", defaultPort: 5432, icon: "🟠", group: "AWS" },
  { value: "rds_mysql",      label: "AWS RDS (MySQL)",      defaultPort: 3306, icon: "🟠", group: "AWS" },
];

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [showForm, setShowForm] = useState(false);
  const { setActiveConnection, sidebarOpen } = useAppStore();
  const ml = sidebarOpen ? "ml-[200px]" : "ml-14";

  const refresh = () => listConnections().then((r) => setConnections(r.data)).catch(() => {});
  useEffect(() => { refresh(); }, []);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className={`flex-1 ${ml} overflow-y-auto transition-all duration-150`}>
        <div className="max-w-2xl mx-auto px-5 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-[18px] font-semibold" style={{ color: "var(--fg-0)" }}>Data Sources</h1>
              <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>Connect PostgreSQL, MySQL, or AWS databases</p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary text-[13px]">
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? "Cancel" : "Add Source"}
            </button>
          </div>

          {/* Add Form */}
          {showForm && (
            <div className="card p-5 mb-6 fade-in">
              <SQLForm onDone={() => { setShowForm(false); refresh(); }} />
            </div>
          )}

          {/* List */}
          <div className="space-y-2">
            {connections.map((c) => (
              <ConnCard key={c.id} conn={c} onSync={refresh} onSelect={() => { setActiveConnection(c.id); toast.success(`Switched to ${c.name}`); }} />
            ))}
            {connections.length === 0 && !showForm && (
              <div className="card empty-state">
                <div className="empty-state-icon"><Database size={20} /></div>
                <h3>No data sources</h3>
                <p>Connect a PostgreSQL, MySQL, or AWS database to start asking questions.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function ConnCard({ conn, onSync, onSelect }: { conn: Connection; onSync: () => void; onSelect: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const handleSync = async () => {
    setSyncing(true);
    try { await syncConnection(conn.id); toast.success("Sync complete!"); onSync(); }
    catch (err: any) { toast.error(err?.response?.data?.detail || "Sync failed"); }
    setSyncing(false);
  };
  const statusColor = conn.status === "ready" ? "var(--success)" : conn.status === "error" ? "var(--danger)" : "var(--warning)";
  const connectorMeta = CONNECTOR_TYPES.find((t) => t.value === conn.conn_type);

  return (
    <div className="card card-interactive flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[18px]" style={{ background: "var(--bg-3)" }}>
          {connectorMeta?.group === "AWS" ? <Cloud size={15} style={{ color: "var(--fg-3)" }} /> : <Database size={15} style={{ color: "var(--fg-3)" }} />}
        </div>
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--fg-0)" }}>{conn.name}</div>
          <div className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: "var(--fg-3)" }}>
            {connectorMeta?.label ?? conn.conn_type}
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
            {conn.status}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {conn.status === "ready" && (
          <button onClick={onSelect} className="btn btn-secondary text-[11px] py-1.5 px-3">Use</button>
        )}
        <button onClick={handleSync} disabled={syncing} className="btn btn-secondary text-[11px] py-1.5 px-3">
          {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync
        </button>
      </div>
    </div>
  );
}

function SQLForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: "",
    conn_type: "postgresql",
    host: "",
    port: "5432",
    database_name: "",
    username: "",
    password: "",
  });
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

  const handleTypeChange = (conn_type: string) => {
    const meta = CONNECTOR_TYPES.find((t) => t.value === conn_type);
    setForm((f) => ({ ...f, conn_type, port: String(meta?.defaultPort ?? 5432) }));
    setTestOk(null);
  };

  const handleTest = async () => {
    setTesting(true); setTestOk(null);
    try {
      const res = await testConnection({ ...form, port: parseInt(form.port) });
      const ok = res.data?.ok ?? res.data?.[0] ?? false;
      setTestOk(ok);
      ok ? toast.success("Connected!") : toast.error("Connection failed");
    } catch { setTestOk(false); toast.error("Connection failed"); }
    setTesting(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await createConnection({ ...form, port: parseInt(form.port) }); toast.success("Saved!"); onDone(); }
    catch (err: any) { toast.error(err?.response?.data?.detail || "Failed"); }
    setSaving(false);
  };

  const Field = ({ label, field, type = "text", placeholder = "" }: any) => (
    <div>
      <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>{label}</label>
      <input type={type} value={(form as any)[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        placeholder={placeholder} className="input text-[13px]" />
    </div>
  );

  const selectedMeta = CONNECTOR_TYPES.find((t) => t.value === form.conn_type);
  const isAWS = selectedMeta?.group === "AWS";

  // Group connectors for the select
  const directTypes = CONNECTOR_TYPES.filter((t) => t.group === "Direct");
  const awsTypes = CONNECTOR_TYPES.filter((t) => t.group === "AWS");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" field="name" placeholder="My Database" />
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>Type</label>
          <select value={form.conn_type} onChange={(e) => handleTypeChange(e.target.value)} className="select w-full">
            <optgroup label="Direct">
              {directTypes.map((t) => (
                <option key={t.value} value={t.value} style={{ background: "var(--bg-2)" }}>{t.label}</option>
              ))}
            </optgroup>
            <optgroup label="AWS">
              {awsTypes.map((t) => (
                <option key={t.value} value={t.value} style={{ background: "var(--bg-2)" }}>{t.label}</option>
              ))}
            </optgroup>
          </select>
        </div>
      </div>

      {isAWS && (
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
          {form.conn_type === "redshift"
            ? "Redshift endpoint format: cluster.id.region.redshift.amazonaws.com"
            : "RDS endpoint format: instance.id.region.rds.amazonaws.com"}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3"><Field label="Host" field="host" placeholder={isAWS ? "cluster.abc123.us-east-1.redshift.amazonaws.com" : "localhost"} /></div>
        <Field label="Port" field="port" placeholder={selectedMeta?.defaultPort?.toString()} />
      </div>
      <Field label="Database" field="database_name" placeholder={form.conn_type === "redshift" ? "dev" : "my_database"} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username" field="username" placeholder={form.conn_type === "redshift" ? "awsuser" : "postgres"} />
        <Field label="Password" field="password" type="password" />
      </div>
      <div className="flex items-center gap-2 pt-2">
        <button onClick={handleTest} disabled={testing} className="btn btn-secondary text-[12px]">
          {testing ? <Loader2 size={12} className="animate-spin" /> : testOk === true ? <CheckCircle size={12} className="text-success" /> : testOk === false ? <XCircle size={12} className="text-danger" /> : <Wifi size={12} />}
          Test
        </button>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary text-[12px]">
          {saving && <Loader2 size={12} className="animate-spin" />} Save & Sync
        </button>
      </div>
    </div>
  );
}
