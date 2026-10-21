import { LIMITS, cleanId, cleanText, isUserError } from "./errors";
import type { Question, SlotType } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, "");

  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    if (inQuotes) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (char !== "\r") {
      cell += char;
    }
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((value) => value.trim() !== ""));
}

export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/** "7일|주문번호" 같은 목록. 화면 입력과 CSV가 같은 함수를 씁니다. */
export function splitList(value: string): string[] {
  return value
    .split("|")
    .map((item) => cleanText(item, LIMITS.shortText))
    .filter(Boolean)
    .slice(0, 50);
}

export function asBool(value: string): boolean {
  return ["true", "1", "yes", "y", "예"].includes(value.trim().toLowerCase());
}

export function asSlot(value: string): SlotType {
  if (value === "amount" || value === "date") return value;
  return "none";
}

const QUESTION_HEADERS = [
  "id",
  "question",
  "reference_answer",
  "source_note",
  "source_conflict",
  "must_include",
  "must_not_include",
  "slot_type",
  "slot_value",
  "domain",
  "holdout",
  "critical_domain",
] as const;

export function questionsToCsv(questions: Question[]): string {
  const lines = [QUESTION_HEADERS.join(",")];
  for (const question of questions) {
    lines.push(
      [
        question.id,
        question.text,
        question.referenceAnswer,
        question.sourceNote,
        question.sourceConflict ? "true" : "false",
        question.mustInclude.join("|"),
        question.mustNotInclude.join("|"),
        question.slotType,
        question.slotValue,
        question.domain,
        question.holdout ? "true" : "false",
        question.criticalDomain ? "true" : "false",
      ]
        .map(csvEscape)
        .join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

export function parseQuestionsCsv(text: string): {
  questions: Question[];
  errors: string[];
} {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { questions: [], errors: ["CSV가 비어 있습니다."] };
  }
  const header = table[0].map((cell) => cell.trim());
  const missing = QUESTION_HEADERS.filter((name) => !header.includes(name));
  if (missing.length > 0) {
    return {
      questions: [],
      errors: [`질문셋 CSV에 열이 없습니다: ${missing.join(", ")}`],
    };
  }
  const index = new Map(header.map((name, position) => [name, position]));
  const questions: Question[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let overflowReported = false;

  table.slice(1).forEach((cells, rowIndex) => {
    const read = (name: (typeof QUESTION_HEADERS)[number]) =>
      (cells[index.get(name) ?? -1] ?? "").trim();
    const line = rowIndex + 2;
    if (questions.length >= LIMITS.questions) {
      if (!overflowReported) errors.push(`문항은 ${LIMITS.questions}개까지 읽습니다. ${line}행부터 건너뜁니다.`);
      overflowReported = true;
      return;
    }
    let id: string;
    try {
      id = cleanId(read("id"), `${line}행 문항 id`);
    } catch (error) {
      errors.push(isUserError(error) ? error.message : `${line}행 문항 id를 읽지 못했습니다.`);
      return;
    }
    if (seen.has(id)) {
      errors.push(`문항 id가 중복입니다: ${id}`);
      return;
    }
    seen.add(id);
    const textValue = cleanText(read("question"), LIMITS.longText);
    if (!textValue) {
      errors.push(`${id}: 질문 본문이 비어 있습니다.`);
      return;
    }
    questions.push({
      id,
      text: textValue,
      referenceAnswer: cleanText(read("reference_answer"), LIMITS.longText),
      sourceNote: cleanText(read("source_note"), LIMITS.shortText * 2),
      sourceConflict: asBool(read("source_conflict")),
      mustInclude: splitList(read("must_include")),
      mustNotInclude: splitList(read("must_not_include")),
      slotType: asSlot(read("slot_type")),
      slotValue: cleanText(read("slot_value"), LIMITS.shortText),
      domain: cleanText(read("domain"), LIMITS.shortText) || "기타",
      holdout: asBool(read("holdout")),
      criticalDomain: asBool(read("critical_domain")),
    });
  });

  return { questions, errors };
}

export function answersToCsv(
  rows: Array<{ questionId: string; answer: string }>,
): string {
  const lines = ["question_id,answer"];
  for (const row of rows) {
    lines.push([csvEscape(row.questionId), csvEscape(row.answer)].join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function parseAnswersCsv(text: string): {
  rows: Array<{ questionId: string; answer: string }>;
  errors: string[];
} {
  const table = parseCsv(text);
  if (table.length === 0) {
    return { rows: [], errors: ["답변 CSV가 비어 있습니다."] };
  }
  const header = table[0].map((cell) => cell.trim());
  const idIndex = header.findIndex((name) =>
    ["question_id", "id"].includes(name),
  );
  const answerIndex = header.findIndex((name) => name === "answer");
  if (idIndex < 0 || answerIndex < 0) {
    return {
      rows: [],
      errors: ["답변 CSV에는 question_id, answer 열이 필요합니다."],
    };
  }
  const rows: Array<{ questionId: string; answer: string }> = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  table.slice(1).forEach((cells, rowIndex) => {
    const questionId = (cells[idIndex] ?? "").trim();
    const answer = (cells[answerIndex] ?? "").normalize("NFC");
    if (!questionId) {
      errors.push(`${rowIndex + 2}행에 question_id가 없습니다.`);
      return;
    }
    if (seen.has(questionId)) {
      errors.push(`답변 id가 중복입니다: ${questionId}`);
      return;
    }
    seen.add(questionId);
    rows.push({ questionId, answer: answer.trim() });
  });
  return { rows, errors };
}
