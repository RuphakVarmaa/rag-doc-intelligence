import { getSession } from "next-auth/react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { encode } from "next-auth/jwt";

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

async function getAccessToken(): Promise<string | null> {
  const session = await getSession();
  if (!session) return null;
  // Re-encode the session as a HS256 JWT to send to the backend
  const token = await encode({
    token: {
      sub: session.user.id,
      email: session.user.email ?? "",
      name: session.user.name ?? undefined,
    },
    secret: process.env.NEXTAUTH_SECRET ?? "dev-secret-change-me",
    maxAge: 60 * 60, // 1 hour
  });
  return token;
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  if (!headers["Content-Type"] && !(init?.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${BACKEND}${path}`, { ...init, headers });
}

export async function apiGet<T>(path: string): Promise<T> {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await apiFetch(path, { method: "DELETE" });
  if (!res.ok) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

export function backendUrl(path: string): string {
  return `${BACKEND}${path}`;
}
