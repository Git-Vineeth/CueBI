"use client";
import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Mail, Shield, Eye, BarChart3, Loader2, X } from "lucide-react";
import toast from "react-hot-toast";
import Sidebar from "@/components/Sidebar";
import { listMembers, inviteMember, listInvites, updateMemberRole, removeMember, cancelInvite, type TeamMember, type TeamInvite } from "@/lib/api";

const ROLE_CONFIG: Record<string, { label: string; icon: any; color: string; desc: string }> = {
  admin: { label: "Admin", icon: Shield, color: "var(--accent)", desc: "Full access — manage connections, team, settings" },
  analyst: { label: "Analyst", icon: BarChart3, color: "var(--blue)", desc: "Can query data and create dashboards" },
  viewer: { label: "Viewer", icon: Eye, color: "var(--teal)", desc: "Can view dashboards and history only" },
};

export default function TeamsPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("analyst");
  const [sending, setSending] = useState(false);

  const refresh = () => {
    listMembers().then((r) => setMembers(r.data)).catch(() => {});
    listInvites().then((r) => setInvites(r.data.filter((i: TeamInvite) => i.status === "pending"))).catch(() => {});
  };
  useEffect(() => { refresh(); }, []);

  const handleInvite = async () => {
    if (!inviteEmail) { toast.error("Enter an email"); return; }
    setSending(true);
    try {
      await inviteMember(inviteEmail, inviteRole);
      toast.success(`Invite sent to ${inviteEmail}`);
      setShowInvite(false); setInviteEmail(""); setInviteRole("analyst");
      refresh();
    } catch (err: any) { toast.error(err?.response?.data?.detail || "Failed to invite"); }
    setSending(false);
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try { await updateMemberRole(userId, role); toast.success("Role updated"); refresh(); } catch { toast.error("Failed"); }
  };

  const handleRemove = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name} from the team?`)) return;
    try { await removeMember(userId); toast.success("Removed"); refresh(); } catch (err: any) { toast.error(err?.response?.data?.detail || "Failed"); }
  };

  const handleCancelInvite = async (inviteId: string) => {
    try { await cancelInvite(inviteId); toast.success("Invite cancelled"); refresh(); } catch { toast.error("Failed"); }
  };

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 ml-[200px] overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="font-sans text-xl font-semibold" style={{ color: "var(--text-primary)" }}>Team</h1>
              <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>{members.length} member{members.length !== 1 ? "s" : ""}</p>
            </div>
            <button onClick={() => setShowInvite(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" className="btn btn-primary" style={{}}>
              <Plus size={16} /> Invite Member
            </button>
          </div>

          {/* Invite Modal */}
          {showInvite && (
            <div className="card p-6 mb-6 fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Invite team member</h2>
                <button onClick={() => setShowInvite(false)} className="p-1 rounded hover:bg-[var(--bg-hover)]"><X size={16} style={{ color: "var(--text-muted)" }} /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-muted)" }}>Email address</label>
                  <input type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="colleague@company.com"
                    className="w-full text-sm px-3 py-2 rounded-lg border bg-transparent" style={{ borderColor: "var(--border)", color: "var(--text-primary)" }} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: "var(--text-muted)" }}>Role</label>
                  <div className="space-y-2">
                    {Object.entries(ROLE_CONFIG).map(([key, cfg]) => {
                      const Icon = cfg.icon;
                      return (
                        <button key={key} onClick={() => setInviteRole(key)}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-colors ${inviteRole === key ? "border-[var(--accent)]" : ""}`}
                          style={{ borderColor: inviteRole === key ? "var(--accent)" : "var(--border)", background: inviteRole === key ? "var(--accent-soft)" : "var(--bg-secondary)" }}>
                          <Icon size={16} style={{ color: cfg.color }} />
                          <div>
                            <div className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>{cfg.label}</div>
                            <div className="text-xs" style={{ color: "var(--text-muted)" }}>{cfg.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button onClick={handleInvite} disabled={sending} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-white" className="btn btn-primary" style={{}}>
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />} Send Invite
                </button>
              </div>
            </div>
          )}

          {/* Members */}
          <div className="space-y-2 mb-8">
            {members.map((m) => {
              const cfg = ROLE_CONFIG[m.role] || ROLE_CONFIG.viewer;
              const Icon = cfg.icon;
              return (
                <div key={m.id} className="card flex items-center justify-between p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: "var(--bg-elevated)", color: "var(--text-secondary)" }}>
                      {(m.name || m.email)[0].toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{m.name || m.email}</div>
                      <div className="text-xs" style={{ color: "var(--text-muted)" }}>{m.email}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded-md border bg-transparent" style={{ borderColor: "var(--border)", color: cfg.color }}>
                      <option value="admin" style={{ background: "var(--bg-card)" }}>Admin</option>
                      <option value="analyst" style={{ background: "var(--bg-card)" }}>Analyst</option>
                      <option value="viewer" style={{ background: "var(--bg-card)" }}>Viewer</option>
                    </select>
                    <button onClick={() => handleRemove(m.id, m.name || m.email)} className="p-1.5 rounded-md hover:bg-[var(--bg-hover)]">
                      <Trash2 size={14} style={{ color: "var(--text-muted)" }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pending Invites */}
          {invites.length > 0 && (
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-dim)" }}>Pending Invites</h2>
              <div className="space-y-2">
                {invites.map((inv) => (
                  <div key={inv.id} className="card flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <Mail size={14} style={{ color: "var(--text-muted)" }} />
                      <div>
                        <div className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>{inv.email}</div>
                        <div className="text-xs" style={{ color: "var(--text-dim)" }}>
                          {inv.role} · expires {new Date(inv.expires_at).toLocaleDateString("en-IN")}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleCancelInvite(inv.id)} className="text-xs px-2 py-1 rounded btn-ghost">Cancel</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
