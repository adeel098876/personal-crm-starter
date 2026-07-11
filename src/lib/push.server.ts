// Web Push helpers for Cloudflare Workers / Web Crypto.
// Implements payload-less VAPID (RFC 8292) push.

function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(s: string): Uint8Array {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = (s + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export interface VapidKeys {
  publicKey: string; // base64url of uncompressed P-256 point (65 bytes: 0x04||x||y)
  privateKey: string; // base64url of raw 32-byte scalar
  subject: string;
}

export async function generateVapidKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const pubJwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const privJwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  // Compose uncompressed point 0x04 || X || Y
  const x = base64UrlDecode(pubJwk.x as string);
  const y = base64UrlDecode(pubJwk.y as string);
  const point = new Uint8Array(65);
  point[0] = 0x04;
  point.set(x, 1);
  point.set(y, 33);
  return {
    publicKey: base64UrlEncode(point),
    privateKey: privJwk.d as string,
    subject: "mailto:notifications@kinetic.app",
  };
}

async function importVapidPrivate(privateKeyB64u: string, publicKeyB64u: string): Promise<CryptoKey> {
  const pubBytes = base64UrlDecode(publicKeyB64u);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) throw new Error("Invalid VAPID public key");
  const x = base64UrlEncode(pubBytes.slice(1, 33));
  const y = base64UrlEncode(pubBytes.slice(33, 65));
  const jwk = {
    kty: "EC",
    crv: "P-256",
    d: privateKeyB64u,
    x,
    y,
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

export async function signVapidJwt(
  audience: string,
  keys: VapidKeys,
  expiresInSeconds = 12 * 60 * 60,
): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
    sub: keys.subject,
  };
  const enc = (obj: unknown) =>
    base64UrlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const privateKey = await importVapidPrivate(keys.privateKey, keys.publicKey);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${base64UrlEncode(sig)}`;
}

export interface PushSubscriptionRow {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/**
 * Sends a payload-less push. Returns HTTP status.
 * 404/410 means the subscription is dead and should be deactivated.
 */
export async function sendWebPush(
  sub: PushSubscriptionRow,
  keys: VapidKeys,
  ttl = 60,
): Promise<{ status: number; body?: string }> {
  const url = new URL(sub.endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signVapidJwt(audience, keys);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      TTL: String(ttl),
      Authorization: `vapid t=${jwt}, k=${keys.publicKey}`,
      "Content-Length": "0",
      Urgency: "normal",
    },
  });

  if (res.ok || res.status === 201 || res.status === 204) {
    return { status: res.status };
  }
  const body = await res.text().catch(() => undefined);
  return { status: res.status, body };
}

/** Fetch or lazily create the single VAPID key row. */
export async function getOrCreateVapidKeys(): Promise<VapidKeys> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: existing } = await supabaseAdmin
    .from("vapid_keys")
    .select("public_key, private_key, subject")
    .eq("id", 1)
    .maybeSingle();
  if (existing) {
    return {
      publicKey: existing.public_key,
      privateKey: existing.private_key,
      subject: existing.subject,
    };
  }
  const keys = await generateVapidKeys();
  const { error } = await supabaseAdmin.from("vapid_keys").insert({
    id: 1,
    public_key: keys.publicKey,
    private_key: keys.privateKey,
    subject: keys.subject,
  });
  if (error && !error.message.includes("duplicate")) throw new Error(error.message);
  return keys;
}