"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Zap, Database, RefreshCw, MessageSquare, Check, Loader2, ArrowRight, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { createConnection, testConnection, syncConnection } from "@/lib/api";
import { useAppStore } from "@/lib/store";

type Step = 1 | 2 | 3 | 4;

export default function OnboardingPage() {
  const router = useRouter();
  const { setActiveConnection } = useAppStore();
  const [step, setStep] = useState<Step>(1);
  const [form, setForm] = useState({ name: "", conn_type: "postgresql", host: "", port: "5432", database_name: "", username: "", password: "" });
  const [testing, setTesting] = useState(false);
  const [testOk, setTestOk] = useState(false);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<any>(null);

  const handleTest = async () => {
    setTesting(true); setTestOk(false);
    try {
      const res = await testConnection({ ...form, port: parseInt(form.port) });
      const ok = res.data?.ok ?? res.data?.[0] ?? false;
      setTestOk(ok);
      if (ok) toast.success("Connected!"); else toast.error("Connection failed — check credentials");
    } catch { toast.error("Connection failed"); }
    setTesting(false);
  };

  const handleSave = async () => {
    try {
      const res = await createConnection({ ...form, port: parseInt(form.port) });
      setConnectionId(res.data.id);
      setActiveConnection(res.data.id);
      setStep(3);
      toast.success("Connection saved!");
    } catch (err: any) { toast.error(err?.response?.data?.detail || "Failed to save"); }
  };

  const handleSync = async () => {
    if (!connectionId) return;
    setSyncing(true);
    try {
      const res = await syncConnection(connectionId);
      setSyncResult(res.data);
      setStep(4);
      toast.success("Schema synced and ready!");
    } catch (err: any) { toast.error(err?.response?.data?.detail || "Sync failed"); }
    setSyncing(false);
  };

  const goToChat = () => router.push("/chat");

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "var(--bg-primary)" }}>
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent)" }}>
            <Zap size={24} className="text-white" />
          </div>
          <h1 className="font-sans text-2xl font-bold" style={{ color: "var(--text-primary)" }}>Welcome to CueBI</h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Let's connect your first data source — takes under 2 minutes
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className="flex-1 h-1.5 rounded-full transition-colors" style={{ background: s <= step ? "var(--accent)" : "var(--border)" }} />
          ))}
        </div>

        {/* Steps */}
        <div className="rounded-2xl border p-8" style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}>

          {/* Step 1: Choose type */}
          {step === 1 && (
            <div className="fade-in space-y-6">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold">1</div>
                <h2 className="font-sans text-base font-semibold" style={{ color: "var(--text-primary)" }}>What's your data source?</h2>
              </div>

              <div className="space-y-2">
                {[
                  { type: "postgresql", label: "PostgreSQL", desc: "Direct PostgreSQL or AWS RDS (PostgreSQL)" },
                  { type: "mysql", label: "MySQL", desc: "Direct MySQL or AWS RDS (MySQL)" },
                  { type: "redshift", label: "Amazon Redshift", desc: "Redshift cluster or Serverless endpoint" },
                ].map(({ type, label, desc }) => (
                  <button
                    key={type}
                    onClick={() => { setForm({ ...form, conn_type: type }); setStep(2); }}
                    className="w-full flex items-center justify-between p-4 rounded-xl border transition-all hover:border-accent/40"
                    style={{ borderColor: "var(--border)", background: "var(--bg-secondary)" }}
                  >
                    <div className="flex items-center gap-3">
                      <Database size={20} style={{ color: "var(--text-muted)" }} />
                      <div className="text-left">
                        <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</div>
                        <div className="text-xs" style={{ color: "var(--text-muted)" }}>{desc}</div>
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
                  </button>
                ))}
              </div>

              <p className="text-xs text-center" style={{ color: "var(--text-muted)" }}>
                More connector types? <button onClick={() => router.push("/connections")} className="text-accent hover:underline">Go to Connections</button>
              </p>
            </div>
          )}

          {/* Step 2: Enter credentials */}
          {step === 2 && (
            <div className="fade-in space-y-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold">2</div>
                <h2 className="font-sans text-base font-semibold" style={{ color: "var(--text-primary)" }}>Enter connection details</h2>
              </div>

              {[
                { label: "Name", field: "name", placeholder: "My Company DB", type: "text" },
                { label: "Host", field: "host", placeholder: "localhost or 192.168.x.x", type: "text" },
                { label: "Port", field: "port", placeholder: form.conn_type === "mysql" ? "3306" : "5432", type: "text" },
                { label: "Database", field: "database_name", placeholder: "my_database", type: "text" },
                { label: "Username", field: "username", placeholder: "postgres", type: "text" },
                { label: "Password", field: "password", placeholder: "••••••••", type: "password" },
              ].map(({ label, field, placeholder, type }) => (
                <div key={field}>
                  <label className="block text-xs font-medium mb-1" style={{ color: "var(--text-muted)" }}>{label}</label>
                  <input
                    type={type} value={(form as any)[field]}
                    onChange={(e) => setForm({ ...form, [field]: e.target.value })} placeholder={placeholder}
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent focus:outline-none focus:ring-1 focus:ring-accent/40"
                    style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
                  />
                </div>
              ))}

              <div className="flex gap-3 pt-2">
                <button onClick={handleTest} disabled={testing} className="flex items-center gap-2 px-4 py-2 rounded-lg border text-sm" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
                  {testing ? <Loader2 size={14} className="animate-spin" /> : testOk ? <Check size={14} className="text-teal-400" /> : null}
                  Test
                </button>
                <button onClick={handleSave} disabled={!testOk} className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-40">
                  Save & Continue <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Sync */}
          {step === 3 && (
            <div className="fade-in text-center space-y-6 py-4">
              <div className="flex items-center gap-3 justify-center mb-2">
                <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-white text-sm font-bold">3</div>
                <h2 className="font-sans text-base font-semibold" style={{ color: "var(--text-primary)" }}>Sync your schema</h2>
              </div>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                CueBI will read your table and column names to build a semantic index. Your actual data never leaves your database.
              </p>
              <button onClick={handleSync} disabled={syncing} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90">
                {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                {syncing ? "Syncing schema..." : "Start Sync"}
              </button>
              {syncing && (
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>This may take 10-20 seconds for large databases...</p>
              )}
            </div>
          )}

          {/* Step 4: Done! */}
          {step === 4 && (
            <div className="fade-in text-center space-y-6 py-4">
              <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto">
                <Check size={32} className="text-teal-400" />
              </div>
              <div>
                <h2 className="font-sans text-lg font-semibold" style={{ color: "var(--text-primary)" }}>You're all set! 🎉</h2>
                <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
                  {syncResult?.tables} tables and {syncResult?.columns} columns indexed.
                  {syncResult?.vectors_stored} vectors stored.
                </p>
              </div>
              <button onClick={goToChat} className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-accent text-white text-sm font-medium hover:opacity-90">
                <MessageSquare size={16} /> Start Asking Questions
              </button>
            </div>
          )}
        </div>

        {/* Skip */}
        {step < 4 && (
          <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
            <button onClick={() => router.push("/chat")} className="hover:underline">Skip for now → go to Chat</button>
          </p>
        )}
      </div>
    </div>
  );
}
