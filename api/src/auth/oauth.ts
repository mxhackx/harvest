import { createHash, randomBytes } from "node:crypto";
import { config } from "../config.js";

export type Provider = "google" | "github";
export type OAuthProfile = {
  providerAccountId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
};

export const PROVIDERS: Provider[] = ["google", "github"];

export const isConfigured = (p: Provider) => !!config[p].clientId && !!config[p].clientSecret;
export const redirectUri = (p: Provider) => `${config.apiUrl}/auth/${p}/callback`;

export const randomToken = () => randomBytes(32).toString("base64url");
const challenge = (verifier: string) => createHash("sha256").update(verifier).digest("base64url");

export function authorizationUrl(p: Provider, state: string, verifier: string): string {
  const { clientId } = config[p];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri(p),
    state,
  });
  if (p === "google") {
    params.set("response_type", "code");
    params.set("scope", "openid email profile");
    params.set("code_challenge", challenge(verifier));
    params.set("code_challenge_method", "S256");
    params.set("prompt", "select_account");
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }
  params.set("scope", "read:user user:email");
  return `https://github.com/login/oauth/authorize?${params}`;
}

async function json(res: Response) {
  if (!res.ok) throw new Error(`OAuth HTTP ${res.status}`);
  return (await res.json()) as Record<string, any>;
}

export async function fetchProfile(p: Provider, code: string, verifier: string): Promise<OAuthProfile> {
  const { clientId, clientSecret } = config[p];
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri(p),
  });

  if (p === "google") {
    body.set("grant_type", "authorization_code");
    body.set("code_verifier", verifier);
    const tok = await json(
      await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body,
      }),
    );
    const u = await json(
      await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
        headers: { authorization: `Bearer ${tok.access_token}` },
      }),
    );
    return {
      providerAccountId: String(u.sub),
      email: String(u.email).toLowerCase(),
      emailVerified: u.email_verified === true,
      name: String(u.name ?? u.email),
      image: typeof u.picture === "string" ? u.picture : null,
    };
  }

  const tok = await json(
    await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
  );
  if (!tok.access_token) throw new Error("GitHub: no access token");
  const headers = {
    authorization: `Bearer ${tok.access_token}`,
    accept: "application/vnd.github+json",
    "user-agent": "harvest-api",
  };
  const u = await json(await fetch("https://api.github.com/user", { headers }));
  const emails = (await (await fetch("https://api.github.com/user/emails", { headers })).json()) as {
    email: string;
    primary: boolean;
    verified: boolean;
  }[];
  const best = Array.isArray(emails)
    ? (emails.find((e) => e.primary && e.verified) ?? emails.find((e) => e.verified))
    : undefined;
  if (!best) throw new Error("GitHub: no verified email");
  return {
    providerAccountId: String(u.id),
    email: best.email.toLowerCase(),
    emailVerified: true,
    name: String(u.name ?? u.login),
    image: typeof u.avatar_url === "string" ? u.avatar_url : null,
  };
}
