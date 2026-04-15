"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Users, Table2, MessageSquare, BarChart3, ChevronRight, X, Loader2, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { useAppStore } from "@/lib/store";
import {
  adminListTeams, adminCreateTeam, adminDeleteTeam,
  adminListTeamMembers, adminProvisionMember, adminRemoveFromTeam,
  adminListSchemas, adminAddSchema, adminRemoveSchema,
  adminListExamples, adminAddExample, adminDeleteExample,
  adminListUsers, adminUsageStats, adminListConnectionTables,
  listConnections, type Connection,
} from "@/lib/api";

type Tab = "teams" | "users" | "usage";
type TeamTab = "members" | "schemas" | "examples";

interface Team { id: string; name: string; description?: string; member_count: number; schema_count: number; created_at: string; }
interface Member { id: string; email: string; name: string; role: string; status: string; avatar_url?: string; }
interface SchemaAccess { id: string; table_name: string; }
interface Example { id: string; question: string; sort_order: number; }
interface OrgUser { id: string; email: string; name: string; role: string; status: string; team_id?: string; team_name?: string; }
interface UsageStat { team_name: string; total_queries: number; success_count: number; error_count: number; avg_duration_ms: number; last_query_at?: string; }

export default function AdminPage() {
  const { sidebarOpen } = useAppStore();
  const ml = sidebarOpen ? "ml-[200px]" : "ml-14";

  const [tab, setTab] = useState<Tab>("teams");
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamTab, setTeamTab] = useState<TeamTab>("members");
  const [members, setMembers] = useState<Member[]>([]);
  const [schemas, setSchemas] = useState<SchemaAccess[]>([]);
  const [examples, setExamples] = useState<Example[]>([]);
  const [users, setUsers] = useState<OrgUser[]>([]);
  const [usage, setUsage] = useState<UsageStat[]>([]);
  const [availTables, setAvailTables] = useState<{ table_name: string }[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(false);

  // Create team form
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  // Add member form
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState("analyst");
  // Add schema form
  const [newTable, setNewTable] = useState("");
  // Add example form
  const [newExample, setNewExample] = useState("");

  useEffect(() => { loadTeams(); listConnections().then(r => setConnections(r.data)).catch(() => {}); }, []);

  const loadTeams = () => adminListTeams().then(r => setTeams(r.data)).catch(() => toast.error("Failed to load teams"));

  const selectTeam = async (team: Team) => {
    setSelectedTeam(team);
    setTeamTab("members");
    loadTeamData(team.id);
    // Load available tables from first ready connection
    const conn = connections.find(c => c.status === "ready");
    if (conn) adminListConnectionTables(conn.id).then(r => setAvailTables(r.data)).catch(() => {});
  };

  const loadTeamData = (teamId: string) => {
    adminListTeamMembers(teamId).then(r => setMembers(r.data)).catch(() => {});
    adminListSchemas(teamId).then(r => setSchemas(r.data)).catch(() => {});
    adminListExamples(teamId).then(r => setExamples(r.data)).catch(() => {});
  };

  const createTeam = async () => {
    if (!newTeamName.trim()) return;
    setLoading(true);
    try {
      await adminCreateTeam(newTeamName.trim(), newTeamDesc.trim() || undefined);
      setNewTeamName(""); setNewTeamDesc("");
      await loadTeams();
      toast.success("Team created");
    } catch { toast.error("Failed to create team"); }
    setLoading(false);
  };

  const deleteTeam = async (id: string) => {
    if (!confirm("Delete this team? Members will be unassigned.")) return;
    try { await adminDeleteTeam(id); await loadTeams(); if (selectedTeam?.id === id) setSelectedTeam(null); toast.success("Team deleted"); }
    catch { toast.error("Failed to delete team"); }
  };

  const addMember = async () => {
    if (!selectedTeam || !newEmail.trim()) return;
    setLoading(true);
    try {
      await adminProvisionMember(selectedTeam.id, newEmail.trim(), undefined, newRole);
      setNewEmail(""); loadTeamData(selectedTeam.id); await loadTeams();
      toast.success("Member added — they can now log in with Google");
    } catch (e: any) { toast.error(e?.response?.data?.detail || "Failed to add member"); }
    setLoading(false);
  };

  const removeMember = async (userId: string) => {
    if (!selectedTeam) return;
    try { await adminRemoveFromTeam(selectedTeam.id, userId); loadTeamData(selectedTeam.id); await loadTeams(); toast.success("Removed from team"); }
    catch { toast.error("Failed to remove"); }
  };

  const addSchema = async () => {
    if (!selectedTeam || !newTable) return;
    setLoading(true);
    try { await adminAddSchema(selectedTeam.id, newTable); setNewTable(""); loadTeamData(selectedTeam.id); await loadTeams(); toast.success("Table access granted"); }
    catch { toast.error("Already granted or failed"); }
    setLoading(false);
  };

  const removeSchema = async (accessId: string) => {
    if (!selectedTeam) return;
    try { await adminRemoveSchema(selectedTeam.id, accessId); loadTeamData(selectedTeam.id); await loadTeams(); toast.success("Access removed"); }
    catch { toast.error("Failed to remove"); }
  };

  const addExample = async () => {
    if (!selectedTeam || !newExample.trim()) return;
    setLoading(true);
    try { await adminAddExample(selectedTeam.id, newExample.trim()); setNewExample(""); loadTeamData(selectedTeam.id); toast.success("Example added"); }
    catch { toast.error("Failed to add"); }
    setLoading(false);
  };

  const deleteExample = async (exId: string) => {
    if (!selectedTeam) return;
    try { await adminDeleteExample(selectedTeam.id, exId); loadTeamData(selectedTeam.id); toast.success("Removed"); }
    catch { toast.error("Failed"); }
  };

  useEffect(() => {
    if (tab === "users") adminListUsers().then(r => setUsers(r.data)).catch(() => {});
    if (tab === "usage") adminUsageStats().then(r => setUsage(r.data)).catch(() => {});
  }, [tab]);

  const TAB_STYLE = (active: boolean) => ({
    background: active ? "var(--accent)" : "transparent",
    color: active ? "#fff" : "var(--fg-3)",
  });

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className={`flex-1 ${ml} flex flex-col h-screen transition-all duration-150 overflow-hidden`}>
        {/* Header */}
        <header className="h-[52px] flex items-center gap-2 px-5 border-b shrink-0" style={{ background: "var(--bg-1)", borderColor: "var(--border)" }}>
          <ShieldCheck size={15} style={{ color: "var(--fg-3)" }} />
          <h1 className="text-[13px] font-semibold" style={{ color: "var(--fg-0)" }}>Admin</h1>
        </header>

        {/* Top tabs */}
        <div className="flex items-center gap-1 px-5 py-2 border-b" style={{ borderColor: "var(--border)", background: "var(--bg-1)" }}>
          {(["teams", "users", "usage"] as Tab[]).map(t => (
            <button key={t} onClick={() => setTab(t)} className="text-[12px] font-medium px-3 py-1.5 rounded-md capitalize transition-all" style={TAB_STYLE(tab === t)}>
              {t}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden flex">

          {/* ── TEAMS TAB ── */}
          {tab === "teams" && (
            <>
              {/* Left: team list */}
              <div className="w-[260px] border-r flex flex-col shrink-0" style={{ borderColor: "var(--border)" }}>
                <div className="p-3 border-b" style={{ borderColor: "var(--border)" }}>
                  <p className="text-[11px] font-semibold mb-2" style={{ color: "var(--fg-3)" }}>CREATE TEAM</p>
                  <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder="Team name (e.g. Finance)" className="input text-[12px] py-1.5 mb-1.5" />
                  <input value={newTeamDesc} onChange={e => setNewTeamDesc(e.target.value)} placeholder="Description (optional)" className="input text-[12px] py-1.5 mb-2" />
                  <button onClick={createTeam} disabled={!newTeamName.trim() || loading}
                    className="w-full flex items-center justify-center gap-1.5 text-[12px] font-medium py-1.5 rounded-md transition-all disabled:opacity-40"
                    style={{ background: "var(--accent)", color: "#fff" }}>
                    {loading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />} Create
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {teams.map(team => (
                    <button key={team.id} onClick={() => selectTeam(team)}
                      className="w-full text-left px-3 py-2.5 rounded-lg transition-all"
                      style={{ background: selectedTeam?.id === team.id ? "var(--accent-muted)" : "transparent", color: selectedTeam?.id === team.id ? "var(--accent)" : "var(--fg-1)" }}>
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-medium">{team.name}</span>
                        <ChevronRight size={12} style={{ color: "var(--fg-4)" }} />
                      </div>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>{team.member_count} members</span>
                        <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>{team.schema_count} tables</span>
                      </div>
                    </button>
                  ))}
                  {teams.length === 0 && <p className="text-[12px] px-2 py-4 text-center" style={{ color: "var(--fg-4)" }}>No teams yet</p>}
                </div>
              </div>

              {/* Right: team detail */}
              {selectedTeam ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Team header */}
                  <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: "var(--border)" }}>
                    <div>
                      <h2 className="text-[14px] font-semibold" style={{ color: "var(--fg-0)" }}>{selectedTeam.name}</h2>
                      {selectedTeam.description && <p className="text-[12px]" style={{ color: "var(--fg-3)" }}>{selectedTeam.description}</p>}
                    </div>
                    <button onClick={() => deleteTeam(selectedTeam.id)} className="btn-ghost text-[11px] px-2 py-1 text-red-400">
                      <Trash2 size={12} /> Delete team
                    </button>
                  </div>

                  {/* Sub-tabs */}
                  <div className="flex gap-1 px-5 py-2 border-b" style={{ borderColor: "var(--border)" }}>
                    {([
                      { id: "members", icon: Users, label: `Members (${members.length})` },
                      { id: "schemas", icon: Table2, label: `Tables (${schemas.length})` },
                      { id: "examples", icon: MessageSquare, label: `Examples (${examples.length})` },
                    ] as { id: TeamTab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
                      <button key={id} onClick={() => setTeamTab(id)}
                        className="flex items-center gap-1.5 text-[12px] font-medium px-3 py-1.5 rounded-md transition-all"
                        style={TAB_STYLE(teamTab === id)}>
                        <Icon size={11} /> {label}
                      </button>
                    ))}
                  </div>

                  <div className="flex-1 overflow-y-auto p-5">
                    {/* Members sub-tab */}
                    {teamTab === "members" && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="user@cuemath.com" className="input text-[12px] py-1.5 flex-1" />
                          <select value={newRole} onChange={e => setNewRole(e.target.value)} className="select text-[12px] py-1.5">
                            <option value="analyst">Analyst</option>
                            <option value="viewer">Viewer</option>
                            <option value="admin">Admin</option>
                          </select>
                          <button onClick={addMember} disabled={!newEmail.trim() || loading}
                            className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md transition-all disabled:opacity-40"
                            style={{ background: "var(--accent)", color: "#fff" }}>
                            <Plus size={11} /> Add
                          </button>
                        </div>
                        <div className="space-y-1">
                          {members.map(m => (
                            <div key={m.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "var(--bg-2)" }}>
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold"
                                  style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                                  {m.name?.[0]?.toUpperCase() ?? "?"}
                                </div>
                                <div>
                                  <div className="text-[13px] font-medium" style={{ color: "var(--fg-0)" }}>{m.name || m.email}</div>
                                  <div className="text-[11px]" style={{ color: "var(--fg-3)" }}>{m.email} · {m.role} · {m.status}</div>
                                </div>
                              </div>
                              <button onClick={() => removeMember(m.id)} className="btn-ghost p-1.5 text-red-400"><X size={13} /></button>
                            </div>
                          ))}
                          {members.length === 0 && <p className="text-[12px] py-4 text-center" style={{ color: "var(--fg-4)" }}>No members yet. Add their email above.</p>}
                        </div>
                      </div>
                    )}

                    {/* Schemas sub-tab */}
                    {teamTab === "schemas" && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <select value={newTable} onChange={e => setNewTable(e.target.value)} className="select text-[12px] py-1.5 flex-1">
                            <option value="">Select table to grant access...</option>
                            {availTables.filter(t => !schemas.find(s => s.table_name === t.table_name)).map(t => (
                              <option key={t.table_name} value={t.table_name}>{t.table_name}</option>
                            ))}
                          </select>
                          <button onClick={addSchema} disabled={!newTable || loading}
                            className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md disabled:opacity-40"
                            style={{ background: "var(--accent)", color: "#fff" }}>
                            <Plus size={11} /> Grant
                          </button>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
                          Only these tables will appear in the AI's context when this team asks questions.
                          Sync the Redshift connection first to populate the table list.
                        </p>
                        <div className="space-y-1">
                          {schemas.map(s => (
                            <div key={s.id} className="flex items-center justify-between px-3 py-2 rounded-lg" style={{ background: "var(--bg-2)" }}>
                              <span className="text-[13px] font-mono" style={{ color: "var(--fg-0)" }}>{s.table_name}</span>
                              <button onClick={() => removeSchema(s.id)} className="btn-ghost p-1.5 text-red-400"><X size={13} /></button>
                            </div>
                          ))}
                          {schemas.length === 0 && <p className="text-[12px] py-4 text-center" style={{ color: "var(--fg-4)" }}>No tables granted yet.</p>}
                        </div>
                      </div>
                    )}

                    {/* Examples sub-tab */}
                    {teamTab === "examples" && (
                      <div className="space-y-4">
                        <div className="flex gap-2">
                          <input value={newExample} onChange={e => setNewExample(e.target.value)}
                            placeholder="e.g. Total revenue this month by country"
                            className="input text-[12px] py-1.5 flex-1"
                            onKeyDown={e => { if (e.key === "Enter") addExample(); }}
                          />
                          <button onClick={addExample} disabled={!newExample.trim() || loading}
                            className="flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-md disabled:opacity-40"
                            style={{ background: "var(--accent)", color: "#fff" }}>
                            <Plus size={11} /> Add
                          </button>
                        </div>
                        <p className="text-[11px]" style={{ color: "var(--fg-4)" }}>
                          These appear as clickable suggestions on the chat screen for this team.
                        </p>
                        <div className="space-y-1">
                          {examples.map(ex => (
                            <div key={ex.id} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: "var(--bg-2)" }}>
                              <span className="text-[13px]" style={{ color: "var(--fg-0)" }}>{ex.question}</span>
                              <button onClick={() => deleteExample(ex.id)} className="btn-ghost p-1.5 text-red-400 shrink-0"><X size={13} /></button>
                            </div>
                          ))}
                          {examples.length === 0 && <p className="text-[12px] py-4 text-center" style={{ color: "var(--fg-4)" }}>No examples yet.</p>}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-[13px]" style={{ color: "var(--fg-4)" }}>Select a team to manage</p>
                </div>
              )}
            </>
          )}

          {/* ── USERS TAB ── */}
          {tab === "users" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-1">
                {users.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: "var(--bg-2)" }}>
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-bold"
                      style={{ background: "var(--accent-muted)", color: "var(--accent)" }}>
                      {u.name?.[0]?.toUpperCase() ?? "?"}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium" style={{ color: "var(--fg-0)" }}>{u.name || u.email}</div>
                      <div className="text-[11px]" style={{ color: "var(--fg-3)" }}>{u.email}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-[12px] font-medium" style={{ color: "var(--fg-1)" }}>{u.team_name ?? "No team"}</div>
                      <div className="text-[11px]" style={{ color: "var(--fg-4)" }}>{u.role} · {u.status}</div>
                    </div>
                  </div>
                ))}
                {users.length === 0 && <p className="text-[13px] text-center py-8" style={{ color: "var(--fg-4)" }}>No users yet</p>}
              </div>
            </div>
          )}

          {/* ── USAGE TAB ── */}
          {tab === "usage" && (
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-3">
                {usage.map(stat => (
                  <div key={stat.team_name} className="px-5 py-4 rounded-xl" style={{ background: "var(--bg-2)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-[14px] font-semibold" style={{ color: "var(--fg-0)" }}>{stat.team_name}</h3>
                      {stat.last_query_at && (
                        <span className="text-[11px]" style={{ color: "var(--fg-4)" }}>
                          Last: {new Date(stat.last_query_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-3">
                      {[
                        { label: "Total Queries", value: stat.total_queries ?? 0 },
                        { label: "Successful", value: stat.success_count ?? 0 },
                        { label: "Errors", value: stat.error_count ?? 0 },
                        { label: "Avg Duration", value: stat.avg_duration_ms ? `${stat.avg_duration_ms}ms` : "—" },
                      ].map(({ label, value }) => (
                        <div key={label} className="px-3 py-2.5 rounded-lg" style={{ background: "var(--bg-3)" }}>
                          <div className="text-[10px] uppercase tracking-wide mb-1" style={{ color: "var(--fg-4)" }}>{label}</div>
                          <div className="text-[18px] font-semibold" style={{ color: "var(--fg-0)" }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {usage.length === 0 && <p className="text-[13px] text-center py-8" style={{ color: "var(--fg-4)" }}>No usage data yet</p>}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
