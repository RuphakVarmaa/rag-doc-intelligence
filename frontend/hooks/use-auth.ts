"use client";

import { useSession, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function useRequireAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/auth/signin");
    }
  }, [status, router]);

  return { session, status, isLoading: status === "loading" };
}

export function useAuth() {
  const { data: session, status } = useSession();
  return {
    session,
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    signOut: () => signOut({ callbackUrl: "/" }),
  };
}
