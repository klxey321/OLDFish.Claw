import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AppConfig, AuthSession } from "../types";

const SESSION_COOKIE_NAME = "oldfish_session";

export function isAuthEnabled(config: AppConfig): boolean {
  return config.authRequired && Boolean(config.loginUsername) && Boolean(config.loginPassword);
}

export function verifyPassword(inputUsername: string, inputPassword: string, config: AppConfig): boolean {
  if (!config.loginUsername || !config.loginPassword) return false;
  return safeCompare(inputUsername, config.loginUsername) && safeCompare(inputPassword, config.loginPassword);
}

export function readSession(req: IncomingMessage, config: AppConfig): AuthSession | undefined {
  if (!isAuthEnabled(config)) return undefined;
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE_NAME];
  if (!token) return undefined;
  return verifySessionToken(token, config);
}

export function requirePageAuth(req: IncomingMessage, config: AppConfig): boolean {
  if (!isAuthEnabled(config)) return true;
  return Boolean(readSession(req, config));
}

export function requireApiAuth(req: IncomingMessage, config: AppConfig): boolean {
  if (readSession(req, config)) return true;
  if (!config.localTokenAuthRequired) return true;
  if (config.localApiToken === "") return true;

  const headerToken = req.headers["x-local-token"];
  if (typeof headerToken === "string" && safeCompare(headerToken.trim(), config.localApiToken)) return true;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return safeCompare(authHeader.slice("Bearer ".length).trim(), config.localApiToken);
  }

  return false;
}

export function setSessionCookie(res: ServerResponse, config: AppConfig, username: string, secure: boolean): void {
  const token = createSessionToken(
    {
      username,
      expiresAt: Date.now() + config.sessionTtlHours * 60 * 60 * 1000,
    },
    config,
  );
  res.setHeader("set-cookie", serializeCookie(SESSION_COOKIE_NAME, token, {
    maxAge: config.sessionTtlHours * 60 * 60,
    secure,
  }));
}

export function clearSessionCookie(res: ServerResponse, secure: boolean): void {
  res.setHeader("set-cookie", serializeCookie(SESSION_COOKIE_NAME, "", {
    maxAge: 0,
    secure,
  }));
}

export function isSecureRequest(req: IncomingMessage): boolean {
  const forwardedProto = req.headers["x-forwarded-proto"];
  return typeof forwardedProto === "string" && forwardedProto.toLowerCase() === "https";
}

export function buildCsrfToken(): string {
  return randomBytes(18).toString("hex");
}

function createSessionToken(session: AuthSession, config: AppConfig): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const signature = sign(payload, config.sessionSecret);
  return `${payload}.${signature}`;
}

function verifySessionToken(token: string, config: AppConfig): AuthSession | undefined {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return undefined;
  const expected = sign(payload, config.sessionSecret);
  if (!safeCompare(signature, expected)) return undefined;

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as Partial<AuthSession>;
    if (!parsed.username || typeof parsed.expiresAt !== "number") return undefined;
    if (Date.now() > parsed.expiresAt) return undefined;
    return {
      username: parsed.username,
      expiresAt: parsed.expiresAt,
    };
  } catch {
    return undefined;
  }
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function serializeCookie(
  name: string,
  value: string,
  options: {
    maxAge: number;
    secure: boolean;
  },
): string {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${Math.max(0, options.maxAge)}`,
  ];
  if (options.secure) parts.push("Secure");
  return parts.join("; ");
}

function parseCookies(input: string | undefined): Record<string, string> {
  if (!input) return {};
  return input.split(";").reduce<Record<string, string>>((acc, item) => {
    const [rawName, ...rawValue] = item.split("=");
    const name = rawName?.trim();
    if (!name) return acc;
    acc[name] = rawValue.join("=").trim();
    return acc;
  }, {});
}

function safeCompare(input: string, expected: string): boolean {
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
