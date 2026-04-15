"use client";
import { useState, useEffect, useRef } from "react";
import {
  Database, Plus, RefreshCw, CheckCircle, XCircle, Loader2, X,
  Wifi, Cloud, Upload, GitBranch, ChevronDown, ChevronUp, AlertCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import {
  listConnections, createConnection, testConnection, syncConnection,
  getDbtStatus, uploadDbtManifest, configureDbtCloud, syncDbtCloud,
  type Connection, type DbtStatus,
} from "@/lib/api";
import { useAppStore } from "@/lib/store";

const CONNECTOR_TYPES = [
  { value: "postgresql",     label: "PostgreSQL",           defaultPort: 5432, group: "Direct" },
  { value: "mysql",          label: "MySQL",                defaultPort: 3306, group: "Direct" },
  { value: "redshift",       label: "Amazon Redshift",      defaultPort: 5439, group: "AWS" },
  { value: "rds_postgresql", label: "AWS RDS (PostgreSQL)", defaultPort: 5432, group: "AWS" },
  { value: "rds_mysql",      label: "AWS RDS (MySQL)",      defaultPort: 3306, group: "AWS" },
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
              <p className="text-[13px] mt-0.5" style={{ color: "var(--fg-3)" }}>
                Connect databases, then attach dbt models for semantic accuracy
              </p>
            </div>
            <button onClick={() => setShowForm(!showForm)} className="btn btn-primary text-[13px]">
              {showForm ? <X size={14} /> : <Plus size={14} />}
              {showForm ? "Cancel" : "Add Source"}
            </button>
          </div>

          {showForm && (
            <div className="card p-5 mb-6 fade-in">
              <SQLForm onDone={() => { setShowForm(false); refresh(); }} />
            </div>
          )}

          <div className="space-y-3">
            {connections.map((c) => (
              <ConnCard
                key={c.id} conn={c} onSync={refresh}
                onSelect={() => { setActiveConnection(c.id); toast.success(`Switched to ${c.name}`); }}
              />
            ))}
            {connections.length === 0 && !showForm && (
              <div className="card empty-state">
                <div className="empty-state-icon"><Database size={20} /></div>
                <h3>No data sources</h3>
                <p>Connect a database, then upload your dbt manifest.json for best results.</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Connection Card ───────────────────────────────────────────────────────────

function ConnCard({ conn, onSync, onSelect }: { conn: Connection; onSync: () => void; onSelect: () => void }) {
  const [syncing, setSyncing] = useState(false);
  const [dbtOpen, setDbtOpen] = useState(false);
  const [dbtStatus, setDbtStatus] = useState<DbtStatus | null>(null);

  const loadDbtStatus = () => {
    getDbtStatus(conn.id).then((r) => setDbtStatus(r.data)).catch(() => {});
  };

  const handleSync = async () => {
    setSyncing(true);
    try { await syncConnection(conn.id); toast.success("Schema sync complete!"); onSync(); }
    catch (err: any) { toast.error(err?.response?.data?.detail || "Sync failed"); }
    setSyncing(false);
  };

  const toggleDbt = () => {
    if (!dbtOpen) loadDbtStatus();
    setDbtOpen((v) => !v);
  };

  const statusColor =
    conn.status === "ready" ? "var(--success)" :
    conn.status === "error" ? "var(--danger)" : "var(--warning)";
  const connectorMeta = CONNECTOR_TYPES.find((t) => t.value === conn.conn_type);

  return (
    <div className="card overflow-hidden">
      {/* Main row */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "var(--bg-3)" }}>
            {connectorMeta?.group === "AWS"
              ? <Cloud size={15} style={{ color: "var(--fg-3)" }} />
              : <Database size={15} style={{ color: "var(--fg-3)" }} />}
          </div>
          <div>
            <div className="text-[13px] font-medium" style={{ color: "var(--fg-0)" }}>{conn.name}</div>
            <div className="text-[11px] flex items-center gap-1.5 mt-0.5" style={{ color: "var(--fg-3)" }}>
              {connectorMeta?.label ?? conn.conn_type}
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
              {conn.status}
              {dbtStatus?.configured && (
                <>
                  <span className="w-1 h-1 rounded-full" style={{ background: "var(--fg-4)" }} />
                  <span style={{ color: "var(--accent)" }} className="flex items-center gap-0.5">
                    <GitBranch size={9} /> dbt{" "}
                    {dbtStatus.sync_status === "ready" ? `· ${dbtStatus.model_count} models` : `· ${dbtStatus.sync_status}`}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {conn.status === "ready" && (
            <button onClick={onSelect} className="btn btn-secondary text-[11px] py-1.5 px-3">Use</button>
          )}
          <button onClick={handleSync} disabled={syncing} className="btn btn-secondary text-[11px] py-1.5 px-3">
            {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />} Sync
          </button>
          <button
            onClick={toggleDbt}
            className="btn btn-secondary text-[11px] py-1.5 px-3"
            style={dbtStatus?.configured ? { color: "var(--accent)" } : {}}
          >
            <GitBranch size={12} /> dbt
            {dbtOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>

      {/* dbt panel */}
      {dbtOpen && (
        <div className="border-t px-4 py-4" style={{ borderColor: "var(--border)", background: "var(--bg-2)" }}>
          <DbtPanel connId={conn.id} status={dbtStatus} onRefresh={loadDbtStatus} />
        </div>
      )}
    </div>
  );
}

// ── dbt Panel ─────────────────────────────────────────────────────────────────

function DbtPanel({ connId, status, onRefresh }: {
  connId: string;
  status: DbtStatus | null;
  onRefresh: () => void;
}) {
  const [mode, setMode] = useState<"manifest" | "cloud">("manifest");
  const [uploading, setUploading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [cloudForm, setCloudForm] = useState({
    account_id: "", project_id: "", environment_id: "", api_token: "",
  });
  const [savingCloud, setSavingCloud] = useState(false);

  const handleManifestUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const res = await uploadDbtManifest(connId, file);
      const d = res.data;
      toast.success(
        `dbt manifest loaded · ${d.models} models · ${d.documented_columns}/${d.columns} cols documented`
      );
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Upload failed");
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleCloudSync = async () => {
    setSyncing(true);
    try {
      const res = await syncDbtCloud(connId);
      toast.success(`dbt Cloud synced · ${res.data.models} models`);
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Sync failed");
    }
    setSyncing(false);
  };

  const handleSaveCloud = async () => {
    if (!cloudForm.account_id || !cloudForm.api_token) {
      toast.error("Account ID and API token are required");
      return;
    }
    setSavingCloud(true);
    try {
      await configureDbtCloud(connId, cloudForm);
      toast.success("dbt Cloud configured and synced!");
      onRefresh();
    } catch (err: any) {
      toast.error(err?.response?.data?.detail || "Configuration failed");
    }
    setSavingCloud(false);
  };

  return (
    <div className="space-y-3">
      {/* Status */}
      {status?.configured && (
        <div className="flex items-center gap-2 text-[11px] px-3 py-2 rounded-lg" style={{ background: "var(--bg-3)" }}>
          {status.sync_status === "ready" ? (
            <CheckCircle size={12} style={{ color: "var(--success)" }} />
          ) : status.sync_status === "error" ? (
            <AlertCircle size={12} style={{ color: "var(--danger)" }} />
          ) : (
            <Loader2 size={12} className="animate-spin" style={{ color: "var(--warning)" }} />
          )}
          <span style={{ color: "var(--fg-1)" }}>
            {status.sync_status === "ready"
              ? `${status.model_count} models synced${status.last_synced_at ? ` · ${new Date(status.last_synced_at).toLocaleString()}` : ""}`
              : status.sync_status === "error"
              ? `Error: ${status.sync_error}`
              : "Syncing…"}
          </span>
          <span className="ml-auto" style={{ color: "var(--fg-4)" }}>
            via {status.dbt_type === "cloud" ? "dbt Cloud" : "manifest upload"}
          </span>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-1 text-[11px]">
        <button
          onClick={() => setMode("manifest")}
          className={`px-3 py-1.5 rounded-md font-medium transition-colors ${mode === "manifest" ? "text-[var(--accent)]" : ""}`}
          style={{
            background: mode === "manifest" ? "var(--accent-muted)" : "var(--bg-3)",
            color: mode === "manifest" ? "var(--accent)" : "var(--fg-3)",
          }}
        >
          <Upload size={10} className="inline mr-1" />
          Upload manifest.json
        </button>
        <button
          onClick={() => setMode("cloud")}
          className="px-3 py-1.5 rounded-md font-medium transition-colors"
          style={{
            background: mode === "cloud" ? "var(--accent-muted)" : "var(--bg-3)",
            color: mode === "cloud" ? "var(--accent)" : "var(--fg-3)",
          }}
        >
          <Cloud size={10} className="inline mr-1" />
          dbt Cloud
        </button>
      </div>

      {/* Manifest upload */}
      {mode === "manifest" && (
        <div className="space-y-2">
          <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
            Run <code className="font-mono px-1 py-0.5 rounded" style={{ background: "var(--bg-3)" }}>dbt compile</code> or{" "}
            <code className="font-mono px-1 py-0.5 rounded" style={{ background: "var(--bg-3)" }}>dbt run</code> then upload{" "}
            <code className="font-mono px-1 py-0.5 rounded" style={{ background: "var(--bg-3)" }}>target/manifest.json</code>.
          </p>
          <input ref={fileRef} type="file" accept=".json" className="hidden" onChange={handleManifestUpload} />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn btn-primary text-[12px]"
          >
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {uploading ? "Parsing…" : status?.configured ? "Re-upload manifest.json" : "Upload manifest.json"}
          </button>
        </div>
      )}

      {/* dbt Cloud */}
      {mode === "cloud" && (
        <div className="space-y-2">
          {status?.configured && status.dbt_type === "cloud" ? (
            <button onClick={handleCloudSync} disabled={syncing} className="btn btn-primary text-[12px]">
              {syncing ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {syncing ? "Syncing…" : "Sync Now"}
            </button>
          ) : (
            <div className="space-y-2">
              <p className="text-[11px]" style={{ color: "var(--fg-3)" }}>
                Connect to dbt Cloud to auto-sync whenever your pipeline runs.
              </p>
              {[
                { label: "Account ID", field: "account_id", placeholder: "12345" },
                { label: "Project ID", field: "project_id", placeholder: "67890" },
                { label: "Environment ID", field: "environment_id", placeholder: "Optional" },
              ].map(({ label, field, placeholder }) => (
                <div key={field}>
                  <label className="block text-[10px] font-medium mb-0.5" style={{ color: "var(--fg-3)" }}>{label}</label>
                  <input
                    type="text"
                    value={(cloudForm as any)[field]}
                    onChange={(e) => setCloudForm({ ...cloudForm, [field]: e.target.value })}
                    placeholder={placeholder}
                    className="input text-[12px] py-1.5"
                  />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-medium mb-0.5" style={{ color: "var(--fg-3)" }}>API Token</label>
                <input
                  type="password"
                  value={cloudForm.api_token}
                  onChange={(e) => setCloudForm({ ...cloudForm, api_token: e.target.value })}
                  placeholder="dbt Cloud service token"
                  className="input text-[12px] py-1.5"
                />
              </div>
              <button onClick={handleSaveCloud} disabled={savingCloud} className="btn btn-primary text-[12px]">
                {savingCloud ? <Loader2 size={12} className="animate-spin" /> : <Cloud size={12} />}
                {savingCloud ? "Connecting…" : "Connect & Sync"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Add Connection Form ───────────────────────────────────────────────────────

function SQLForm({ onDone }: { onDone: () => void }) {
  const [form, setForm] = useState({
    name: "", conn_type: "postgresql", host: "", port: "5432",
    database_name: "", username: "", password: "",
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
      <input type={type} value={(form as any)[field]}
        onChange={(e) => setForm({ ...form, [field]: e.target.value })}
        placeholder={placeholder} className="input text-[13px]" />
    </div>
  );

  const selectedMeta = CONNECTOR_TYPES.find((t) => t.value === form.conn_type);
  const isAWS = selectedMeta?.group === "AWS";
  const directTypes = CONNECTOR_TYPES.filter((t) => t.group === "Direct");
  const awsTypes = CONNECTOR_TYPES.filter((t) => t.group === "AWS");

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" field="name" placeholder="My Redshift" />
        <div>
          <label className="block text-[11px] font-medium mb-1" style={{ color: "var(--fg-3)" }}>Type</label>
          <select value={form.conn_type} onChange={(e) => handleTypeChange(e.target.value)} className="select w-full">
            <optgroup label="Direct">
              {directTypes.map((t) => <option key={t.value} value={t.value} style={{ background: "var(--bg-2)" }}>{t.label}</option>)}
            </optgroup>
            <optgroup label="AWS">
              {awsTypes.map((t) => <option key={t.value} value={t.value} style={{ background: "var(--bg-2)" }}>{t.label}</option>)}
            </optgroup>
          </select>
        </div>
      </div>

      {isAWS && (
        <div className="rounded-lg px-3 py-2 text-[11px]" style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
          {form.conn_type === "redshift"
            ? "Redshift endpoint: cluster-id.region.redshift.amazonaws.com"
            : "RDS endpoint: instance-id.region.rds.amazonaws.com"}
        </div>
      )}

      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-3">
          <Field label="Host" field="host" placeholder={isAWS ? "cluster.abc123.us-east-1.redshift.amazonaws.com" : "localhost"} />
        </div>
        <Field label="Port" field="port" />
      </div>
      <Field label="Database" field="database_name" placeholder={form.conn_type === "redshift" ? "dev" : "my_database"} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Username" field="username" placeholder={form.conn_type === "redshift" ? "awsuser" : "postgres"} />
        <Field label="Password" field="password" type="password" />
      </div>

      <div className="flex items-center gap-2 pt-2">
        <button onClick={handleTest} disabled={testing} className="btn btn-secondary text-[12px]">
          {testing ? <Loader2 size={12} className="animate-spin" />
            : testOk === true ? <CheckCircle size={12} style={{ color: "var(--success)" }} />
            : testOk === false ? <XCircle size={12} style={{ color: "var(--danger)" }} />
            : <Wifi size={12} />}
          Test
        </button>
        <button onClick={handleSave} disabled={saving} className="btn btn-primary text-[12px]">
          {saving && <Loader2 size={12} className="animate-spin" />} Save
        </button>
      </div>
    </div>
  );
}
