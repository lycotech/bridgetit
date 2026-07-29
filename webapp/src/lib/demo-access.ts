import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";

/**
 * Client half of the private-demo gate.
 *
 * The demo environment was not deleted — it was closed. Reaching it needs a
 * server-issued session, obtained by entering the email address an invitation
 * was issued to together with that invitation's code. This module is the only
 * place the browser talks to that gate.
 *
 * WHY the browser check is not the security boundary: anyone can edit client
 * state. The real protection is that the demo session is an HttpOnly cookie the
 * server issues and verifies. The check here decides what to *render*; the
 * server decides what to *serve*.
 */

export interface DemoSession {
  access: "granted" | "none";
  portal: string | null;
  viewer: string | null;
}

export const DEMO_SESSION_KEY = ["demo", "session"] as const;

export function fetchDemoSession(): Promise<DemoSession> {
  return api.get<DemoSession>("/api/demo/session");
}

/**
 * `staleTime: 0` and a refetch on focus: an invitation can be revoked or expire
 * while a tab sits open, and the next navigation should notice.
 */
export function useDemoSession() {
  return useQuery({
    queryKey: DEMO_SESSION_KEY,
    queryFn: fetchDemoSession,
    staleTime: 0,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export interface DemoGrant {
  access: "granted";
  portal: string | null;
  demoType: string | null;
  expiresAt: string | null;
}

/**
 * Exchange the invited email address plus the invitation code for a session.
 *
 * Both halves are required, and both travel in the POST body — never in the
 * query string. A code in a URL ends up in browser history, referrer headers and
 * server logs, and is one careless paste away from working for anybody.
 */
export function redeemInvitationCode(input: { email: string; code: string }) {
  return api.post<DemoGrant>("/api/demo/redeem", input);
}

export function endDemoSession() {
  return api.post<{ access: "none" }>("/api/demo/logout");
}

/**
 * Record a page view inside the demo.
 *
 * Fire-and-forget: a failed beacon must never interrupt the demonstration a
 * prospect is being walked through. The record exists so "who accessed the
 * demo, when, and which screens" is answerable later.
 */
export function sendDemoBeacon(path: string): void {
  void api.post("/api/demo/beacon", { path }).catch(() => {});
}
