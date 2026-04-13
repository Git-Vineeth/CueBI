"use client";
import { Zap, Database, BarChart3, MessageSquare, Shield, ArrowRight, Terminal, Check, Clock, Bell, Users, Sparkles, Cloud } from "lucide-react";

const ACCENT = "#635bff";
const COMPANY = "Cuemath";

export default function LandingPage() {
  return (
    <div style={{ background: "#0a1628", color: "#c1cdd9", fontFamily: "'Outfit', system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap');
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { scroll-behavior: smooth; }
        .glow { box-shadow: 0 0 40px rgba(99,91,255,0.15), 0 0 80px rgba(99,91,255,0.05); }
        .gradient-text { background: linear-gradient(135deg, #f0f3f7 0%, #635bff 50%, #3ecf8e 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }
        .grid-bg { background-image: linear-gradient(rgba(99,91,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(99,91,255,0.03) 1px, transparent 1px); background-size: 64px 64px; }
        .fade-up { opacity: 0; transform: translateY(20px); animation: fadeUp 0.6s ease forwards; }
        .fade-up-d1 { animation-delay: 0.1s; }
        .fade-up-d2 { animation-delay: 0.2s; }
        .fade-up-d3 { animation-delay: 0.3s; }
        @keyframes fadeUp { to { opacity: 1; transform: translateY(0); } }
        .feature-card { background: rgba(20,39,68,0.6); border: 1px solid #1c3352; border-radius: 14px; padding: 28px; transition: all 0.2s; backdrop-filter: blur(10px); }
        .feature-card:hover { border-color: #635bff; transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.2); }
        .step-line { width: 2px; height: 40px; background: linear-gradient(to bottom, #635bff, transparent); margin: 0 auto; }
        a { color: inherit; text-decoration: none; }
        .cta-btn { display: inline-flex; align-items: center; gap: 8px; padding: 12px 24px; border-radius: 10px; font-weight: 600; font-size: 14px; transition: all 0.15s; cursor: pointer; border: none; }
        .cta-primary { background: #635bff; color: white; }
        .cta-primary:hover { background: #7a73ff; box-shadow: 0 0 20px rgba(99,91,255,0.3); }
        .cta-secondary { background: transparent; color: #c1cdd9; border: 1px solid #1c3352; }
        .cta-secondary:hover { border-color: #635bff; background: rgba(99,91,255,0.05); }
        .nav-link { font-size: 13px; color: #7e90a5; font-weight: 500; transition: color 0.15s; }
        .nav-link:hover { color: #f0f3f7; }
      `}</style>

      {/* ═══ Nav ═══ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 50, padding: "14px 0", borderBottom: "1px solid rgba(28,51,82,0.5)", background: "rgba(10,22,40,0.85)", backdropFilter: "blur(12px)" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 8, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={15} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: 16, color: "#f0f3f7", letterSpacing: "-0.02em" }}>CueBI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <a href="#features" className="nav-link">Features</a>
            <a href="#how-it-works" className="nav-link">How it Works</a>
            <a href="#connectors" className="nav-link">Connectors</a>
            <a href="/chat" className="cta-btn cta-primary" style={{ padding: "8px 18px", fontSize: 13 }}>Open App <ArrowRight size={13} /></a>
          </div>
        </div>
      </nav>

      {/* ═══ Hero ═══ */}
      <section className="grid-bg" style={{ paddingTop: 140, paddingBottom: 80, textAlign: "center" }}>
        <div style={{ maxWidth: 800, margin: "0 auto", padding: "0 24px" }}>
          <div className="fade-up" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", borderRadius: 20, background: "rgba(99,91,255,0.08)", border: "1px solid rgba(99,91,255,0.15)", fontSize: 12, fontWeight: 500, color: ACCENT, marginBottom: 24 }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#3ecf8e" }} /> {COMPANY} Internal · Data Intelligence Platform
          </div>

          <h1 className="fade-up fade-up-d1" style={{ fontSize: "clamp(36px, 5vw, 56px)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-0.03em", color: "#f0f3f7", marginBottom: 20 }}>
            Your data, answered<br /><span className="gradient-text">instantly</span>
          </h1>

          <p className="fade-up fade-up-d2" style={{ fontSize: 17, lineHeight: 1.6, maxWidth: 560, margin: "0 auto 36px", color: "#7e90a5" }}>
            CueBI connects to your databases and lets you ask questions like "top cohorts by retention" or "revenue by product line" — no SQL required.
          </p>

          <div className="fade-up fade-up-d3" style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <a href="/chat" className="cta-btn cta-primary"><Sparkles size={15} /> Open CueBI</a>
            <a href="/connections" className="cta-btn cta-secondary"><Database size={15} /> Connect a Database</a>
          </div>

          {/* Terminal preview */}
          <div className="fade-up glow" style={{ marginTop: 56, background: "#0f1f38", border: "1px solid #1c3352", borderRadius: 14, overflow: "hidden", maxWidth: 640, margin: "56px auto 0", textAlign: "left" }}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #1c3352", display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#ef4444" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#f5a623" }} />
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#3ecf8e" }} />
              <span style={{ marginLeft: 8, fontSize: 11, color: "#4d6178" }}>CueBI Chat</span>
            </div>
            <div style={{ padding: "20px 20px 16px", fontFamily: "'Geist Mono', monospace", fontSize: 13, lineHeight: 1.8 }}>
              <div style={{ color: "#7e90a5" }}>You:</div>
              <div style={{ color: "#f0f3f7", marginBottom: 12 }}>Top 5 student cohorts by 30-day retention this quarter</div>
              <div style={{ color: "#7e90a5" }}>CueBI:</div>
              <div style={{ color: "#3ecf8e", marginBottom: 4 }}>✓ Generated SQL · Executed in 612ms · 5 rows</div>
              <div style={{ color: "#c1cdd9" }}>Grade 6 leads with 78.4% retention, followed by Grade 8 at 71.2%...</div>
              <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 12, background: "rgba(99,91,255,0.1)", color: ACCENT, border: "1px solid rgba(99,91,255,0.2)" }}>📊 Bar Chart</span>
                <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 12, background: "rgba(62,207,142,0.1)", color: "#3ecf8e", border: "1px solid rgba(62,207,142,0.2)" }}>📋 Data Table</span>
                <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 12, background: "rgba(245,166,35,0.1)", color: "#f5a623", border: "1px solid rgba(245,166,35,0.2)" }}>💡 AI Summary</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ Features ═══ */}
      <section id="features" style={{ padding: "80px 24px", maxWidth: 1120, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 56 }}>
          <h2 style={{ fontSize: 32, fontWeight: 700, color: "#f0f3f7", letterSpacing: "-0.02em", marginBottom: 12 }}>Everything you need to talk to your data</h2>
          <p style={{ fontSize: 15, color: "#7e90a5", maxWidth: 480, margin: "0 auto" }}>Built for {COMPANY}'s data team. Works with PostgreSQL, MySQL, Amazon Redshift, and AWS RDS.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
          {[
            { icon: MessageSquare, title: "Natural Language → SQL", desc: "Ask in plain English. SQL is generated, validated, and executed automatically." },
            { icon: BarChart3, title: "Auto Charts", desc: "Line, bar, pie — auto-detected from your data shape. Download as PNG or CSV." },
            { icon: Cloud, title: "AWS Native", desc: "Connect Redshift clusters, RDS PostgreSQL, and RDS MySQL with one-click setup." },
            { icon: Shield, title: "Your Data Stays Yours", desc: "Only schema metadata goes to the LLM. Raw data never leaves your database." },
            { icon: Clock, title: "Scheduled Reports", desc: "Run queries on a schedule. Email results as CSV or PDF to your team." },
            { icon: Bell, title: "Smart Alerts", desc: "Set thresholds. Get notified when a key metric drops below target." },
            { icon: Users, title: "Multi-User Teams", desc: "Invite your team. Admin, Analyst, Viewer roles. Everyone works from the same source of truth." },
            { icon: Terminal, title: "SQL Explainer", desc: "\"Explain this SQL\" — breaks down complex queries for non-technical stakeholders." },
            { icon: Database, title: "Schema Explorer", desc: "Browse tables and columns with search. Understand your data model instantly." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="feature-card">
              <Icon size={20} color={ACCENT} style={{ marginBottom: 14 }} />
              <h3 style={{ fontSize: 15, fontWeight: 600, color: "#f0f3f7", marginBottom: 8 }}>{title}</h3>
              <p style={{ fontSize: 13, lineHeight: 1.6, color: "#7e90a5" }}>{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ How It Works ═══ */}
      <section id="how-it-works" style={{ padding: "80px 24px", maxWidth: 800, margin: "0 auto", textAlign: "center" }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, color: "#f0f3f7", letterSpacing: "-0.02em", marginBottom: 48 }}>How it works</h2>
        {[
          { step: "1", title: "Connect your database", desc: "PostgreSQL, MySQL, Amazon Redshift, or AWS RDS. One-click setup with instant schema sync." },
          { step: "2", title: "Ask a question", desc: "Type in plain English: \"Monthly active students\" or \"Revenue by product tier this quarter.\"" },
          { step: "3", title: "Get instant insights", desc: "SQL + chart + table + AI summary — all in under 5 seconds." },
        ].map(({ step, title, desc }, i) => (
          <div key={step}>
            <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 12, background: "rgba(99,91,255,0.1)", border: "1px solid rgba(99,91,255,0.2)", color: ACCENT, fontWeight: 700, fontSize: 16, marginBottom: 14 }}>{step}</div>
            <h3 style={{ fontSize: 18, fontWeight: 600, color: "#f0f3f7", marginBottom: 8 }}>{title}</h3>
            <p style={{ fontSize: 14, color: "#7e90a5", maxWidth: 400, margin: "0 auto" }}>{desc}</p>
            {i < 2 && <div className="step-line" style={{ margin: "20px auto" }} />}
          </div>
        ))}
      </section>

      {/* ═══ Connectors ═══ */}
      <section id="connectors" style={{ padding: "80px 24px", background: "rgba(15,31,56,0.5)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
          <h2 style={{ fontSize: 28, fontWeight: 700, color: "#f0f3f7", marginBottom: 12 }}>Supported Data Sources</h2>
          <p style={{ fontSize: 14, color: "#7e90a5", marginBottom: 40 }}>Connect any of these databases in under a minute</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: 14, textAlign: "left" }}>
            {[
              ["🐘 PostgreSQL", "Direct connection to any PostgreSQL instance."],
              ["🐬 MySQL", "Direct connection to any MySQL or MariaDB instance."],
              ["🔴 Amazon Redshift", "Provisioned clusters and Redshift Serverless. SSL by default."],
              ["🟠 AWS RDS (PostgreSQL)", "Fully managed RDS instances running PostgreSQL."],
              ["🟠 AWS RDS (MySQL)", "Fully managed RDS instances running MySQL."],
              ["🔌 More coming", "Athena, BigQuery, Snowflake — on the roadmap."],
            ].map(([title, desc]) => (
              <div key={String(title)} style={{ display: "flex", gap: 12, padding: 16, background: "rgba(20,39,68,0.5)", border: "1px solid #1c3352", borderRadius: 10 }}>
                <Check size={16} color="#3ecf8e" style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#f0f3f7", marginBottom: 4 }}>{title}</div>
                  <div style={{ fontSize: 12, color: "#7e90a5", lineHeight: 1.5 }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ Footer ═══ */}
      <footer style={{ borderTop: "1px solid #1c3352", padding: "32px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Zap size={12} color="#fff" />
            </div>
            <span style={{ fontWeight: 600, fontSize: 13, color: "#7e90a5" }}>CueBI</span>
          </div>
          <div style={{ fontSize: 12, color: "#4d6178" }}>
            © 2026 {COMPANY}. Internal use only.
          </div>
          <div style={{ display: "flex", gap: 20 }}>
            <a href="/chat" className="nav-link" style={{ fontSize: 12 }}>App</a>
            <a href="/connections" className="nav-link" style={{ fontSize: 12 }}>Connect</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
