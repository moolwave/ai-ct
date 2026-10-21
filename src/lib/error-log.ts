import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync } from "fs";
import path from "path";
import { isUserError } from "./errors";

/**
 * 에러 로그 파일: data/logs/errors.log (JSON Lines, 한 줄에 한 건)
 *
 * - 1MB를 넘으면 errors.1.log로 돌리고 새 파일을 씁니다. 디스크가 끝없이 커지지 않습니다.
 * - 답변 본문, 질문 본문 같은 내용은 남기지 않습니다(개인정보가 들어 있을 수 있음).
 *   context에는 id와 개수만 넣으세요.
 * - 로그 쓰기가 실패해도 원래 요청은 계속 진행합니다.
 */

const LOG_DIR = path.join(process.cwd(), "data", "logs");
const LOG_FILE = path.join(LOG_DIR, "errors.log");
const ROTATED_FILE = path.join(LOG_DIR, "errors.1.log");
const MAX_BYTES = 1_000_000;
const MAX_FIELD = 4_000;

export type LogLevel = "error" | "warn";

export type ErrorLogEntry = {
  id: string;
  at: string;
  level: LogLevel;
  source: string;
  name: string;
  message: string;
  stack?: string;
  digest?: string;
  context?: Record<string, string | number | boolean | null>;
};

function clip(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  return value.length > MAX_FIELD ? `${value.slice(0, MAX_FIELD)}…(잘림)` : value;
}

function rotateIfNeeded() {
  try {
    if (existsSync(LOG_FILE) && statSync(LOG_FILE).size > MAX_BYTES) {
      renameSync(LOG_FILE, ROTATED_FILE);
    }
  } catch {
    // 회전 실패는 무시합니다. 다음 쓰기에서 다시 시도합니다.
  }
}

/** 에러를 파일에 남기고 로그 번호를 돌려줍니다. 화면에는 이 번호만 보여 주세요. */
export function logError(
  source: string,
  error: unknown,
  context?: ErrorLogEntry["context"],
): string {
  const id = `err_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 6)}`;
  const err = error instanceof Error ? error : new Error(String(error));
  const entry: ErrorLogEntry = {
    id,
    at: new Date().toISOString(),
    level: isUserError(error) ? "warn" : "error",
    source,
    name: err.name,
    message: clip(err.message) ?? "",
    // 사용자 입력 오류는 스택이 의미가 없어 생략합니다.
    stack: isUserError(error) ? undefined : clip(err.stack),
    digest: (err as Error & { digest?: string }).digest,
    context,
  };
  try {
    mkdirSync(LOG_DIR, { recursive: true });
    rotateIfNeeded();
    appendFileSync(LOG_FILE, `${JSON.stringify(entry)}\n`, "utf8");
  } catch (writeError) {
    console.error("[ai-ct] 에러 로그를 쓰지 못했습니다", writeError);
  }
  if (entry.level === "error") console.error(`[ai-ct] ${source} ${id}`, err);
  return id;
}

function readLines(file: string): ErrorLogEntry[] {
  if (!existsSync(file)) return [];
  const entries: ErrorLogEntry[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as ErrorLogEntry);
    } catch {
      // 반쯤 쓰인 줄은 건너뜁니다.
    }
  }
  return entries;
}

/** 최신 순으로 최대 limit건. 두 파일 합쳐 2MB 이하라 한 번에 읽어도 됩니다. */
export function readErrorLog(limit = 200): ErrorLogEntry[] {
  return [...readLines(ROTATED_FILE), ...readLines(LOG_FILE)].reverse().slice(0, limit);
}

export const ERROR_LOG_PATH = "data/logs/errors.log";
