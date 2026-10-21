/**
 * 사용자가 고칠 수 있는 오류(입력 누락, 순서 위반 등).
 * 메시지를 화면에 그대로 보여 줘도 되는 경우에만 씁니다.
 * 그 밖의 예외는 "예상하지 못한 오류"로 보고 로그 번호만 화면에 보여 줍니다.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export function isUserError(error: unknown): error is UserError {
  return error instanceof UserError;
}

/** 입력 길이 상한. 서버 액션은 누구나 호출할 수 있으므로 서버에서 다시 자릅니다. */
export const LIMITS = {
  shortText: 200,
  longText: 4_000,
  csvChars: 500_000,
  questions: 2_000,
  id: 64,
} as const;

const ID_PATTERN = /^[\p{L}\p{N}_.\-]+$/u;

export function cleanText(value: unknown, max: number): string {
  return String(value ?? "")
    .normalize("NFC")
    .trim()
    .slice(0, max);
}

/** 문항 id, 검수 id처럼 URL·키로 쓰는 값. 글자, 숫자, _ . - 만 허용합니다. */
export function cleanId(value: unknown, label = "id"): string {
  const id = String(value ?? "").trim();
  if (!id) throw new UserError(`${label}를 입력하세요.`);
  if (id.length > LIMITS.id) throw new UserError(`${label}는 ${LIMITS.id}자 이하로 적습니다.`);
  if (!ID_PATTERN.test(id)) {
    throw new UserError(`${label}에는 글자, 숫자, _ . - 만 씁니다: ${id.slice(0, 20)}`);
  }
  return id;
}

export function assertCsvSize(text: string) {
  if (text.length > LIMITS.csvChars) {
    throw new UserError("파일이 큽니다. 500KB 이하의 CSV만 가져옵니다.");
  }
}
