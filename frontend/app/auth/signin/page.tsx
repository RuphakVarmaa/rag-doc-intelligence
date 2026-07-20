"use client";

import { signIn } from "next-auth/react";
import { Github } from "lucide-react";

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm border rounded-xl p-8 bg-card shadow-sm">
        <h1 className="text-2xl font-bold mb-2 text-center">Sign in</h1>
        <p className="text-sm text-muted-foreground text-center mb-8">
          to RAG Doc Intelligence
        </p>
        <button
          onClick={() => signIn("github", { callbackUrl: "/dashboard" })}
          className="w-full flex items-center justify-center gap-3 bg-foreground text-background px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Github className="h-4 w-4" />
          Continue with GitHub
        </button>
        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const email = (e.currentTarget.elements.namedItem("email") as HTMLInputElement).value;
            signIn("email", { email, callbackUrl: "/dashboard" });
          }}
          className="space-y-3"
        >
          <input
            name="email"
            type="email"
            placeholder="you@example.com"
            required
            className="w-full border rounded-lg px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="w-full bg-primary text-primary-foreground px-4 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Continue with email
          </button>
        </form>
      </div>
    </div>
  );
}
