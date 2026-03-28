"use client";
import { useState, useEffect } from "react";
import { Database, Plus, RefreshCw, CheckCircle, XCircle, Loader2, Upload, FileSpreadsheet, X, Wifi } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { listConnections, createConnection, testConnection, syncConnection, uploadTally, uploadCSV, type Connection } from "@/lib/api";
import { useAppStore } from "@/lib/store";

type Tab = "sql" | "tally" | "csv";

export default function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [tab, setTab] = useState<Tab>("sql");
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
              <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>Connect databases, Tally exports, or CSV files</p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary text-[13px]">
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? "Cancel" : "Add Source"}
            </button>
          </div>

          {/* Add Form */}
          {showForm && (
            <div className="card p-5 mb-6 fade-in">
              <div className="flex gap-1 p-1 rounded-lg mb-5" style={{ background: "var(--bg-0)" }}>
                {(["sql", "tally", "csv"] as Tab[]).map((t) => (
                  <button key={t} onClick={() => setTab(t)}
                    className="flex-1 text-[12px] font-medium py-2 rounded-md transition-all"
                    style={{ background: tab === t ? "var(--accent)" : "transparent", color: tab === t ? "#fff" : "var(--fg-2)" }}>
                    {t === "sql" ? "PostgreSQL / MySQL" : t === "tally" ? "Tally Import" : "CSV / Sheets"}
                  </button>
                ))}
              </div>
              {tab === "sql" && <SQLForm onDone={() => { setShowForm(false); refresh(); }} />}
              {tab === "tally" && <FileUploadForm type="tally" onDone={() => { setShowForm(false); refresh(); }} />}
              {tab === "csv" && <FileUploadForm type="csv" onDone={() => { setShowForm(false); refresh(); }} />}
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
                <p>Connect a database, upload Tally data, or import a CSV to start asking questions.</p>
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

  return (
    <div className="card card-interactive flex items-center justify-between p-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-3)" }}>
          <Database size={15} style={{ color: "var(--fg-3)" }} />
        </div>
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--fg-0)" }}>{conn.name}</div>
          <div className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: "var(--fg-3)" }}>
            {conn.conn_type}
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
  const [form, setForm] = useState({ name: "", conn_type: "postgresql", host: "", port: "5432", database_name: "", username: "", password: "" });
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);

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

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" field="name" placeholder="My Database" />
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>Type</label>
          <select value={form.conn_type} onChange={(e) => setForm({ ...form, conn_type: e.target.value })} className="select w-full">
            <option value="postgresql" style={{ background: "var(--bg-2)" }}>PostgreSQL</option>
            <option value="mysql" style={{ background: "var(--bg-2)" }}>MySQL</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3"><Field label="Host" field="host" placeholder="localhost" /></div>
        <Field label="Port" field="port" placeholder="5432" />
      </div>
      <Field label="Database" field="database_name" placeholder="my_database" />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username" field="username" placeholder="postgres" />
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

function FileUploadForm({ type, onDone }: { type: "tally" | "csv"; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    try {
      if (type === "tally") await uploadTally(file, name || file.name);
      else await uploadCSV(file, name || file.name);
      toast.success(`${type === "tally" ? "Tally" : "CSV"} data imported!`);
      onDone();
    } catch (err: any) { toast.error(err?.response?.data?.detail || "Upload failed"); }
    setUploading(false);
  };

  const accept = type === "tally" ? ".xml,.xlsx,.xls" : ".csv";
  const hint = type === "tally"
    ? "Export from TallyPrime: Alt+E → XML or Excel → upload here"
    : "Export from Google Sheets: File → Download → CSV → upload here";

  return (
    <div className="space-y-3">
      <p className="text-[12px] leading-relaxed" style={{ color: "var(--fg-3)" }}>{hint}</p>
      <div>
        <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder={type === "tally" ? "My Company Tally" : "Sales Data"} className="input text-[13px]" />
      </div>
      <div onClick={() => document.getElementById(`${type}-file`)?.click()}
        className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all"
        style={{ borderColor: file ? "var(--accent)" : "var(--border)", background: file ? "var(--accent-muted)" : "transparent" }}
        onMouseEnter={(e) => { if (!file) e.currentTarget.style.borderColor = "var(--border-hover)"; }}
        onMouseLeave={(e) => { if (!file) e.currentTarget.style.borderColor = "var(--border)"; }}>
        {type === "tally" ? <Upload size={20} className="mx-auto mb-2" style={{ color: "var(--fg-3)" }} /> : <FileSpreadsheet size={20} className="mx-auto mb-2" style={{ color: "var(--fg-3)" }} />}
        <p className="text-[12px]" style={{ color: file ? "var(--fg-0)" : "var(--fg-3)" }}>
          {file ? file.name : `Drop or click to upload ${accept}`}
        </p>
        <input id={`${type}-file`} type="file" accept={accept} className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      <button onClick={handleUpload} disabled={!file || uploading} className="btn btn-primary text-[12px] w-full">
        {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
        {uploading ? "Importing..." : `Import ${type === "tally" ? "Tally" : "CSV"} Data`}
      </button>
    </div>
  );
}
