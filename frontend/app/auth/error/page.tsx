"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  Configuration: "Server configuration error. Contact support.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The verification link has expired or has already been used.",
  Default: "An unexpected error occurred during sign in.",
};

export default function AuthErrorPage() {
  const params = useSearchParams();
  const error = params.get("error") ?? "Default";
  const message = MESSAGES[error] ?? MESSAGES.Default;

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm border rounded-xl p-8 bg-card shadow-sm text-center space-y-4">
        <h1 className="text-xl font-bold text-destructive">Sign in failed</h1>
        <p className="text-sm text-muted-foreground">{message}</p>
        <Link
          href="/auth/signin"
          className="inline-block text-sm text-primary hover:underline"
        >
          Try again
        </Link>
      </div>
    </div>
  );
}
