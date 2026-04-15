"use client";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { setAuthToken } from "@/lib/api";

/**
 * Invisible component that syncs the NextAuth session token
 * into the axios instance on every session change.
 * Mount this once inside <SessionProvider>.
 */
export function SessionSync() {
  const { data: session } = useSession();
  const token = (session as any)?.access_token as string | undefined;

  useEffect(() => {
    setAuthToken(token ?? null);
  }, [token]);

  return null;
}
