/**
 * 접근 토큰 기반 세션. 미들웨어(Edge)와 서버 액션(Node) 양쪽에서 쓰므로 Web Crypto만 씁니다.
 *
 * - AICT_ACCESS_TOKEN 환경 변수가 있으면 로그인해야 들어옵니다. 코드에 비밀번호를 적지 않습니다.
 * - 없으면 이 컴퓨터(127.0.0.1, localhost)에서 온 요청만 받습니다.
 * - 쿠키 값은 "발급시각.HMAC(토큰, 발급시각)"입니다. 토큰 원문은 쿠키에 들어가지 않고,
 *   12시간이 지나면 다시 로그인해야 합니다. 토큰을 바꾸면 모든 세션이 무효가 됩니다.
 */

export const SESSION_COOKIE = "aict_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
export const MIN_TOKEN_LENGTH = 12;

const encoder = new TextEncoder();

export function configuredToken(): string | null {
  const token = process.env.AICT_ACCESS_TOKEN?.trim();
  return token ? token : null;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(secret: string, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** 길이가 같을 때 모든 글자를 비교해, 몇 글자째 틀렸는지 시간으로 새지 않게 합니다. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** 입력한 토큰이 맞는지. 길이가 달라도 같은 시간이 걸리도록 해시끼리 비교합니다. */
export async function tokenMatches(input: string, token: string): Promise<boolean> {
  const [a, b] = await Promise.all([hmac("aict-login", input), hmac("aict-login", token)]);
  return safeEqual(a, b);
}

export async function createSession(token: string, nowMs = Date.now()): Promise<string> {
  const issued = String(Math.floor(nowMs / 1000));
  return `${issued}.${await hmac(token, issued)}`;
}

export async function verifySession(token: string, value: string | undefined, nowMs = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [issued, signature] = value.split(".");
  if (!issued || !signature || !/^\d{1,12}$/.test(issued)) return false;
  const age = Math.floor(nowMs / 1000) - Number(issued);
  if (age < 0 || age > SESSION_MAX_AGE_SECONDS) return false;
  return safeEqual(signature, await hmac(token, issued));
}

export function isLoopbackHost(hostHeader: string | null): boolean {
  if (!hostHeader) return false;
  const host = hostHeader.startsWith("[")
    ? hostHeader.slice(1, hostHeader.indexOf("]"))
    : hostHeader.split(":")[0];
  return host === "localhost" || host === "::1" || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host);
}

/** 로그인 뒤 돌아갈 주소. 바깥 사이트로 보내는 열린 리다이렉트를 막습니다. */
export function safeNextPath(value: unknown): string {
  const path = String(value ?? "");
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return "/";
  return path.slice(0, 500);
}
