import "./globals.css";
import { Toaster } from "react-hot-toast";
import { Providers } from "@/components/Providers";
import { SessionSync } from "@/components/SessionSync";

export const metadata = {
  title: "CueBI — Cuemath's BI Platform",
  description: "Ask questions about your business data in plain English",
  icons: { icon: "/favicon.ico" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="dark" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>
          <SessionSync />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: "var(--bg-2)",
                color: "var(--fg-0)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                fontSize: "13px",
                padding: "10px 14px",
                boxShadow: "var(--shadow-md)",
              },
            }}
          />
          {children}
        </Providers>
      </body>
    </html>
  );
}
