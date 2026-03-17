/**
 * NewClaw Auth Routes
 * Simple token auth with claude-leader role and cowork sessions.
 */
import { Hono } from "hono";

interface AuthEnv {
  AI: any;
  NEWCLAW_MASTER_TOKEN?: string;
  NEWCLAW_COWORK_CODE?: string;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const COOKIE_NAME = "nclaw_session";

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function hmacVerify(payload: string, signature: string, secret: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
  return crypto.subtle.verify("HMAC", key, sigBytes, enc.encode(payload));
}

async function createToken(role: string, secret: string): Promise<string> {
  const payload = btoa(JSON.stringify({ role, iat: Date.now(), exp: Date.now() + SESSION_TTL_MS }));
  const sig = await hmacSign(payload, secret);
  return payload + "." + sig;
}

async function verifyToken(token: string, secret: string): Promise<{ role: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  try {
    const valid = await hmacVerify(parts[0], parts[1], secret);
    if (!valid) return null;
    const data = JSON.parse(atob(parts[0]));
    if (data.exp && Date.now() > data.exp) return null;
    return { role: data.role };
  } catch { return null; }
}

function getCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp("(?:^|;\\s*)" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

const ncauth = new Hono<{ Bindings: AuthEnv }>();

ncauth.post("/login", async (c) => {
  const master = c.env.NEWCLAW_MASTER_TOKEN;
  if (!master) return c.json({ error: "NEWCLAW_MASTER_TOKEN not set" }, 503);

  const body = await c.req.json<{ token?: string }>().catch(() => ({}));
  if (!body.token) return c.json({ error: "token required" }, 400);

  // Constant-time compare via HMAC
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode("cmp"), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const s1 = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(master)));
  const s2 = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(body.token)));
  const match = s1.length === s2.length && s1.every((b, i) => b === s2[i]);
  if (!match) return c.json({ error: "Invalid token" }, 401);

  const sessionToken = await createToken("claude-leader", master);
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`;

  return new Response(JSON.stringify({ ok: true, role: "claude-leader", expiresIn: SESSION_TTL_MS }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
});

ncauth.post("/cowork", async (c) => {
  const coworkCode = c.env.NEWCLAW_COWORK_CODE;
  if (!coworkCode) return c.json({ error: "Cowork not configured" }, 503);

  const body = await c.req.json<{ code?: string }>().catch(() => ({}));
  if (!body.code) return c.json({ error: "code required" }, 400);

  if (body.code !== coworkCode) return c.json({ error: "Invalid cowork code" }, 401);

  const master = c.env.NEWCLAW_MASTER_TOKEN || "default-secret";
  const sessionToken = await createToken("coworker", master);
  const cookie = `${COOKIE_NAME}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_TTL_MS / 1000}`;

  return new Response(JSON.stringify({ ok: true, role: "coworker" }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
});

ncauth.get("/session", async (c) => {
  const master = c.env.NEWCLAW_MASTER_TOKEN;
  if (!master) return c.json({ authenticated: false, reason: "not_configured" });

  const cookieHeader = c.req.header("Cookie") || null;
  const token = getCookieValue(cookieHeader, COOKIE_NAME);
  if (!token) return c.json({ authenticated: false, reason: "no_session" });

  const payload = await verifyToken(token, master);
  if (!payload) return c.json({ authenticated: false, reason: "invalid_or_expired" });

  return c.json({ authenticated: true, role: payload.role });
});

ncauth.post("/logout", (c) => {
  const cookie = `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`;
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
  });
});

export { ncauth };
