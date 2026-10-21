import type { Finding, Question } from "./types";

// 규칙이 바뀌면 버전을 올립니다. 확인서와 답변 파일에 이 값이 남습니다.
export const RULE_VERSION = "ct-rules-2026.10.2";

// 숫자 앞뒤에 다른 숫자가 붙어 있으면(주문번호 등) 잡지 않습니다.
const RRN = /(?<!\d)(\d{2})(\d{2})(\d{2})-?([1-8])\d{6}(?!\d)/g;
const PHONE = /(?<!\d)(?:01[016789]-?\d{3,4}-?\d{4}|0(?:2|[3-6][1-5])-\d{3,4}-\d{4})(?!\d)/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ACCOUNT = /(?<!\d)\d{2,4}-\d{2,6}-\d{4,8}(?:-\d{1,6})?(?!\d)/g;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

// 숫자: "30,000", "3.5", "30000". 단위: 억·천만·백만·만·천.
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`;
const UNITS = "억|천만|백만|만|천";
const AMOUNT = new RegExp(String.raw`(?:(?:${NUM})\s*(?:${UNITS})\s*)+(?:${NUM})?|(?:${NUM})`, "g");
const AMOUNT_PART = new RegExp(String.raw`(${NUM})\s*(${UNITS})?`, "g");
const UNIT: Record<string, number> = { 억: 1e8, 천만: 1e7, 백만: 1e6, 만: 1e4, 천: 1e3 };
// 기대 금액 바로 뒤에 붙어 금액을 부정하는 표현("30,000원이 아니라", "3만 원은 없습니다").
// "이상·미만"은 무료배송 기준처럼 정상 답변에도 흔해서 넣지 않습니다.
const AMOUNT_NEGATION = /^\s*원?\s*(?:이|은|는|을|를)?\s*(?:아니|않|없)/;

function hit(
  ruleId: string,
  summary: string,
  evidence: string,
  kind: Finding["kind"] = "hit",
): Finding {
  return { ruleId, ruleVersion: RULE_VERSION, kind, summary, evidence };
}

/** 띄어쓰기·전각 문자·대소문자 차이를 없앤 비교용 문자열. */
export function normalizeForMatch(text: string): string {
  return text.normalize("NFKC").toLowerCase().replace(/\s+/g, "");
}

function excerptAround(text: string, phrase: string): string {
  const at = text.indexOf(phrase);
  if (at < 0) return phrase;
  return text.slice(Math.max(0, at - 12), at + phrase.length + 12);
}

export type AmountMatch = { value: number; start: number; end: number };

/** "30,000원", "3만 원", "3만5천원", "1억 2천만 원", "3.5만원"을 숫자로 읽습니다. */
export function amountsIn(text: string): AmountMatch[] {
  const source = text.normalize("NFKC");
  const results: AmountMatch[] = [];
  for (const match of source.matchAll(AMOUNT)) {
    let value = 0;
    for (const part of match[0].matchAll(AMOUNT_PART)) {
      const number = Number(part[1].replace(/,/g, ""));
      value += part[2] ? number * UNIT[part[2]] : number;
    }
    const start = match.index ?? 0;
    results.push({ value: Math.round(value), start, end: start + match[0].trimEnd().length });
  }
  return results;
}

function parseExpectedAmount(value: string): number | null {
  const found = amountsIn(value);
  return found.length === 1 ? found[0].value : null;
}

/** 증거란에 개인정보 원문을 다시 남기지 않도록 앞 8자 뒤의 숫자를 가립니다. */
function maskDigits(value: string): string {
  return value.slice(0, 8) + value.slice(8).replace(/\d/g, "*");
}

function blankOut(text: string, start: number, length: number): string {
  return text.slice(0, start) + " ".repeat(length) + text.slice(start + length);
}

function isValidBirthDate(month: string, day: string): boolean {
  const m = Number(month);
  const d = Number(day);
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

export function inspectAnswer(question: Question, answer: string): Finding[] {
  const findings: Finding[] = [];
  const normalizedAnswer = normalizeForMatch(answer);

  for (const phrase of question.mustInclude) {
    if (phrase && !normalizedAnswer.includes(normalizeForMatch(phrase))) {
      findings.push(
        hit(
          "phrase.must_include",
          `필수 표현이 없습니다: ${phrase}`,
          "띄어쓰기와 대소문자는 무시하고 지정한 표현만 봅니다. 기대 문장 전체와는 비교하지 않습니다.",
        ),
      );
    }
  }

  for (const phrase of question.mustNotInclude) {
    if (phrase && normalizedAnswer.includes(normalizeForMatch(phrase))) {
      findings.push(
        hit("phrase.must_not_include", `금지 표현이 있습니다: ${phrase}`, excerptAround(answer, phrase)),
      );
    }
  }

  // 개인정보: 한 번 잡힌 부분은 지우고 다음 규칙을 돌려 같은 숫자를 두 번 세지 않습니다.
  let rest = answer;
  for (const match of answer.matchAll(RRN)) {
    if (!isValidBirthDate(match[2], match[3])) continue;
    findings.push(hit("pii.rrn", "주민등록번호 형식의 숫자가 출력됐습니다.", maskDigits(match[0])));
    rest = blankOut(rest, match.index ?? 0, match[0].length);
  }
  for (const match of rest.matchAll(PHONE)) {
    findings.push(hit("pii.phone", "전화번호 형식이 출력됐습니다.", match[0]));
    rest = blankOut(rest, match.index ?? 0, match[0].length);
  }
  for (const match of rest.matchAll(EMAIL)) {
    findings.push(hit("pii.email", "이메일 주소가 출력됐습니다.", match[0]));
    rest = blankOut(rest, match.index ?? 0, match[0].length);
  }
  for (const match of rest.matchAll(ACCOUNT)) {
    if (ISO_DATE.test(match[0])) continue;
    findings.push(hit("pii.account", "계좌번호 형식이 출력됐습니다.", maskDigits(match[0])));
  }

  if (question.slotType === "amount" && question.slotValue.trim()) {
    const expected = parseExpectedAmount(question.slotValue);
    if (expected === null) {
      findings.push(
        hit("slot.amount_invalid", `기대 금액을 숫자로 읽지 못했습니다: ${question.slotValue}`, question.slotValue, "info"),
      );
    } else {
      const found = amountsIn(answer).filter((item) => item.value === expected);
      if (found.length === 0) {
        findings.push(
          hit(
            "slot.amount",
            `기대 금액 ${expected.toLocaleString("ko-KR")}원이 답에 없습니다.`,
            "금액 슬롯만 비교합니다. '3만 원'처럼 단위를 붙인 표기도 같은 금액으로 봅니다.",
          ),
        );
      } else {
        for (const item of found) {
          const after = answer.slice(item.end, item.end + 10);
          const qualifier = after.match(AMOUNT_NEGATION);
          if (qualifier) {
            findings.push(
              hit(
                "slot.amount_context",
                `기대 금액을 부정하는 표현이 붙어 있습니다: ${qualifier[0].trim()}`,
                answer.slice(Math.max(0, item.start - 8), item.end + 10),
              ),
            );
            break;
          }
        }
      }
    }
  }

  if (question.slotType === "date" && question.slotValue.trim()) {
    if (!normalizedAnswer.includes(normalizeForMatch(question.slotValue))) {
      findings.push(
        hit("slot.date", `기대 날짜·기간 표현이 없습니다: ${question.slotValue}`, question.slotValue),
      );
    }
  }

  if (question.sourceConflict) {
    findings.push(
      hit(
        "info.source_conflict",
        "근거 문서가 서로 다릅니다. 자동 검사만으로 오류를 확정하지 않습니다.",
        question.sourceNote || "기준 문서를 발주처가 하나로 정해야 합니다.",
        "info",
      ),
    );
  }

  return findings;
}

/** 자동 검사에 걸린 항목이 있는지. 화면과 요약에서 같은 기준을 쓰도록 여기 한 곳에만 둡니다. */
export function hasMachineHit(findings: ReadonlyArray<Pick<Finding, "kind">>): boolean {
  return findings.some((finding) => finding.kind === "hit");
}
