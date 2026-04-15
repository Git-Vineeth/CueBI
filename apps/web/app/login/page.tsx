"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Zap } from "lucide-react";

const ERROR_MESSAGES: Record<string, string> = {
  not_provisioned: "Your account hasn't been set up yet. Contact the data team to get access.",
  account_disabled: "Your account has been disabled. Contact the data team.",
  access_denied: "Only @cuemath.com accounts are allowed.",
  server_error: "Something went wrong. Please try again.",
  OAuthCallback: "Sign-in was cancelled or failed. Please try again.",
};

function LoginContent() {
  const params = useSearchParams();
  const error = params.get("error") ?? "";
  const errorMessage = ERROR_MESSAGES[error] ?? (error ? "Sign-in failed. Please try again." : null);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg-main)" }}>
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4" style={{ background: "var(--accent)" }}>
            <Zap size={22} color="#fff" />
          </div>
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--text-primary, var(--fg-0))" }}>
            Cue<span style={{ color: "var(--accent)" }}>BI</span>
          </h1>
          <p className="text-sm mt-2" style={{ color: "var(--fg-3)" }}>
            Cuemath's internal analytics platform
          </p>
        </div>

        {/* Error message */}
        {errorMessage && (
          <div className="mb-5 px-4 py-3 rounded-lg text-sm border" style={{
            background: "var(--danger-muted, rgba(239,68,68,0.08))",
            borderColor: "rgba(239,68,68,0.25)",
            color: "#fca5a5",
          }}>
            {errorMessage}
          </div>
        )}

        {/* Google Sign-In button */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/chat" })}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-lg border text-sm font-medium transition-all"
          style={{
            background: "var(--bg-card, var(--bg-2))",
            borderColor: "var(--border)",
            color: "var(--fg-0)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent)";
            e.currentTarget.style.background = "var(--accent-muted)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border)";
            e.currentTarget.style.background = "var(--bg-card, var(--bg-2))";
          }}
        >
          {/* Google icon */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.962L3.964 7.294C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
          </svg>
          Sign in with Google
        </button>

        <p className="text-center text-xs mt-6" style={{ color: "var(--fg-4)" }}>
          Access restricted to @cuemath.com accounts
        </p>
        <p className="text-center text-xs mt-1" style={{ color: "var(--fg-4)" }}>
          © 2026 Cuemath · Internal use only
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
