"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter email and password");
      return;
    }
    setLoading(true);
    // TODO: Replace with real Supabase auth
    setTimeout(() => {
      router.push("/chat");
    }, 800);
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-main)" }}>
      <div className="w-full max-w-sm px-6">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
            Bharat<span className="text-saffron-500">BI</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--text-muted)" }}>
            Sign in to your account
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: "var(--text-secondary)" }}>
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border text-sm"
              style={{
                background: "var(--bg-card)",
                borderColor: "var(--border)",
                color: "var(--text-primary)",
              }}
              placeholder="Enter your password"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 rounded-lg bg-saffron-500 text-white text-sm font-medium hover:bg-saffron-600 transition-colors disabled:opacity-50"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: "var(--text-muted)" }}>
          <a
            href="https://github.com/anthropics/bharatbi"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:underline"
          >
            BharatBI is open source
          </a>
        </p>
      </div>
    </div>
  );
}
