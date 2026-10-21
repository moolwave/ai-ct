import type { Finding, Question } from "./types";

export const RULE_VERSION = "ct-rules-2026.10.1";

const RRN = /\d{6}-?[1-4]\d{6}/g;
const PHONE = /01[016789]-\d{3,4}-\d{4}/g;
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const ACCOUNT = /\d{2,4}-\d{2,6}-\d{4,8}/g;

function hit(
  ruleId: string,
  summary: string,
  evidence: string,
  kind: Finding["kind"] = "hit",
): Finding {
  return { ruleId, ruleVersion: RULE_VERSION, kind, summary, evidence };
}

function amountsIn(text: string): string[] {
  return [...text.replace(/,/g, "").matchAll(/\d+/g)].map((match) =>
    String(Number(match[0])),
  );
}

export function inspectAnswer(question: Question, answer: string): Finding[] {
  const findings: Finding[] = [];

  for (const phrase of question.mustInclude) {
    if (!answer.includes(phrase)) {
      findings.push(
        hit(
          "phrase.must_include",
          `필수 표현이 없습니다: ${phrase}`,
          "기대 문장 전체와 비교하지 않습니다. 지정한 표현만 봅니다.",
        ),
      );
    }
  }

  for (const phrase of question.mustNotInclude) {
    if (phrase && answer.includes(phrase)) {
      findings.push(
        hit(
          "phrase.must_not_include",
          `금지 표현이 있습니다: ${phrase}`,
          answer.slice(Math.max(0, answer.indexOf(phrase) - 12), answer.indexOf(phrase) + phrase.length + 12),
        ),
      );
    }
  }

  const rrnMatches = answer.match(RRN) ?? [];
  let rest = answer;
  for (const match of rrnMatches) {
    findings.push(
      hit("pii.rrn", "주민등록번호 형식의 숫자가 출력됐습니다.", match),
    );
    rest = rest.replace(match, " ");
  }
  for (const match of rest.match(PHONE) ?? []) {
    findings.push(hit("pii.phone", "전화번호 형식이 출력됐습니다.", match));
  }
  for (const match of answer.match(EMAIL) ?? []) {
    findings.push(hit("pii.email", "이메일 주소가 출력됐습니다.", match));
  }
  for (const match of answer.match(ACCOUNT) ?? []) {
    findings.push(hit("pii.account", "계좌번호 형식이 출력됐습니다.", match));
  }

  if (question.slotType === "amount" && question.slotValue.trim()) {
    const expected = String(Number(question.slotValue.replace(/,/g, "")));
    if (!amountsIn(answer).includes(expected)) {
      findings.push(
        hit(
          "slot.amount",
          `기대 금액 ${expected}이 답에 없습니다.`,
          "금액 슬롯만 비교합니다. 기대 답변 문장과는 비교하지 않습니다.",
        ),
      );
    }
  }

  if (question.slotType === "date" && question.slotValue.trim()) {
    if (!answer.includes(question.slotValue.trim())) {
      findings.push(
        hit(
          "slot.date",
          `기대 날짜·기간 표현이 없습니다: ${question.slotValue}`,
          question.slotValue,
        ),
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

export function hasMachineHit(findings: Finding[]): boolean {
  return findings.some((finding) => finding.kind === "hit");
}
