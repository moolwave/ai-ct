import { parseAnswersCsv } from "./csv";
import { LIMITS, UserError, assertCsvSize } from "./errors";
import { canonicalJson, chainHash, sha256 } from "./hash";
import { severityLabel, verdictLabel } from "./labels";
import { RULE_VERSION, inspectAnswer } from "./rules";
import { summarize } from "./summary";
import type {
  ChainAudit,
  Case,
  ImportBatch,
  Project,
  ProjectDraft,
  Question,
  ReviewEvent,
  SupplementPayload,
  VerdictPayload,
  VerdictSnapshot,
} from "./types";

export { assertCsvSize };

type AnswerRow = { questionId: string; answer: string };

export function snapshotOf(item: Case): VerdictSnapshot {
  return {
    humanVerdict: item.humanVerdict,
    severity: item.severity,
    note: item.note,
    recommendation: item.recommendation,
  };
}

function sameSnapshot(a: VerdictSnapshot, b: VerdictSnapshot): boolean {
  return (
    a.humanVerdict === b.humanVerdict &&
    a.severity === b.severity &&
    a.note === b.note &&
    a.recommendation === b.recommendation
  );
}

export function isSupplementPayload(
  payload: ReviewEvent["payload"],
): payload is SupplementPayload {
  return "kind" in payload && payload.kind === "supplement";
}

/** 질문셋의 해시. 확인서를 확정한 뒤 질문셋이 바뀌었는지 비교할 때 씁니다. */
export function questionsHash(questions: Question[]): string {
  return sha256(canonicalJson(questions));
}

export function createProject(draft: ProjectDraft, id: string, now: string): Project {
  return {
    id,
    name: draft.name.trim(),
    client: draft.client.trim(),
    chatbotName: draft.chatbotName.trim(),
    chatbotVersion: draft.chatbotVersion.trim() || "미기재",
    docKind: draft.docKind,
    collectionParty: draft.collectionParty,
    reviewer: draft.reviewer.trim() || "검수자",
    failOnCritical: draft.failOnCritical,
    createdAt: now,
    questions: [],
    batch: null,
    supplements: [],
    cases: [],
    events: [],
    reports: [],
  };
}

export function replaceQuestions(project: Project, questions: Question[]): Project {
  if (project.batch) {
    throw new UserError(
      "답변 파일을 가져온 뒤에는 질문셋을 통째로 바꾸지 않습니다. 문항은 하나씩 추가하세요.",
    );
  }
  if (questions.length > LIMITS.questions) {
    throw new UserError(`문항은 ${LIMITS.questions}개까지 넣습니다.`);
  }
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) {
      throw new UserError(`문항 id가 중복입니다: ${question.id}`);
    }
    ids.add(question.id);
  }
  // 질문 배열만 바뀌므로 전체를 깊은 복사하지 않습니다(답변 원문 복사 비용 절약).
  return { ...project, questions };
}

export function addQuestion(project: Project, question: Question): Project {
  if (project.questions.some((item) => item.id === question.id)) {
    throw new UserError(`이미 있는 문항 id입니다: ${question.id}`);
  }
  if (project.questions.length >= LIMITS.questions) {
    throw new UserError(`문항은 ${LIMITS.questions}개까지 넣습니다.`);
  }
  return { ...project, questions: [...project.questions, question] };
}

function makeBatch(id: string, filename: string, raw: string, rowCount: number, importedAt: string): ImportBatch {
  return {
    id,
    filename: filename.trim().slice(0, LIMITS.shortText) || "answers.csv",
    sha256: sha256(raw),
    rowCount,
    ruleVersion: RULE_VERSION,
    importedAt,
    raw,
  };
}

function makeCase(question: Question, row: AnswerRow, batchId?: string): Case {
  return {
    id: `case_${row.questionId}`,
    questionId: row.questionId,
    answer: row.answer,
    findings: inspectAnswer(question, row.answer),
    humanVerdict: null,
    severity: null,
    note: "",
    recommendation: "",
    reviewedAt: null,
    reviewer: "",
    ...(batchId ? { batchId } : {}),
  };
}

export function importAnswers(
  project: Project,
  filename: string,
  raw: string,
  rows: AnswerRow[],
  importedAt: string,
  batchId: string,
): { project: Project; warnings: string[] } {
  assertCsvSize(raw);
  if (project.questions.length === 0) {
    throw new UserError("질문셋을 먼저 넣으세요.");
  }
  // 문항 찾기를 Map으로 해서 O(문항 수 × 답변 수)를 O(문항 수 + 답변 수)로 줄입니다.
  const byId = new Map(project.questions.map((question) => [question.id, question]));
  const warnings: string[] = [];
  const matched = rows.filter((row) => {
    if (!byId.has(row.questionId)) {
      warnings.push(`질문셋에 없는 id라 제외했습니다: ${row.questionId}`);
      return false;
    }
    return true;
  });
  const answered = new Set(matched.map((row) => row.questionId));
  for (const question of project.questions) {
    if (!answered.has(question.id)) {
      warnings.push(`답변이 없는 문항입니다: ${question.id}`);
    }
  }

  const batch = makeBatch(batchId, filename, raw, matched.length, importedAt);
  const cases = matched.map((row) => makeCase(byId.get(row.questionId)!, row));

  return {
    project: {
      ...project,
      batch,
      supplements: [],
      cases,
      events: [],
      reports: [],
    },
    warnings,
  };
}

function appendToChain(project: Project, event: Omit<ReviewEvent, "prevHash" | "eventHash">): ReviewEvent {
  const prevHash = project.events.at(-1)?.eventHash ?? project.batch!.sha256;
  return {
    ...event,
    prevHash,
    eventHash: chainHash(prevHash, event.payload),
  };
}

/**
 * 첫 답변 파일 뒤에 추가한 문항의 답변만 붙입니다.
 * 이미 답변이 있는 문항은 건드리지 않으므로 기존 판정 이력이 그대로 남습니다.
 * 이 파일의 해시는 판정 체인에 이벤트로 들어갑니다.
 */
export function importSupplementAnswers(
  project: Project,
  filename: string,
  raw: string,
  rows: AnswerRow[],
  at: string,
  batchId: string,
  eventId: string,
  reviewer: string,
): { project: Project; warnings: string[] } {
  assertCsvSize(raw);
  if (!project.batch) {
    throw new UserError("첫 답변 파일을 먼저 가져오세요.");
  }
  const answeredIds = new Set(project.cases.map((item) => item.questionId));
  const targets = new Map(
    project.questions.filter((question) => !answeredIds.has(question.id)).map((question) => [question.id, question]),
  );
  if (targets.size === 0) {
    throw new UserError("답변이 빠진 문항이 없습니다.");
  }
  const warnings: string[] = [];
  const matched = rows.filter((row) => {
    if (targets.has(row.questionId)) return true;
    warnings.push(
      answeredIds.has(row.questionId)
        ? `이미 답변이 있는 문항이라 제외했습니다: ${row.questionId}`
        : `질문셋에 없는 id라 제외했습니다: ${row.questionId}`,
    );
    return false;
  });
  if (matched.length === 0) {
    throw new UserError("이 파일에는 답변이 빠진 문항의 답이 없습니다.");
  }
  const matchedIds = new Set(matched.map((row) => row.questionId));
  for (const id of targets.keys()) {
    if (!matchedIds.has(id)) warnings.push(`여전히 답변이 없는 문항입니다: ${id}`);
  }

  const batch = makeBatch(batchId, filename, raw, matched.length, at);
  const cases = matched.map((row) => makeCase(targets.get(row.questionId)!, row, batch.id));
  const payload: SupplementPayload = {
    kind: "supplement",
    at,
    reviewer,
    reason: `추가 답변 ${cases.length}건`,
    batch: { id: batch.id, filename: batch.filename, sha256: batch.sha256, rowCount: batch.rowCount },
    caseIds: cases.map((item) => item.id),
  };
  const event = appendToChain(project, { id: eventId, payload });
  return {
    project: {
      ...project,
      supplements: [...(project.supplements ?? []), batch],
      cases: [...project.cases, ...cases],
      events: [...project.events, event],
    },
    warnings,
  };
}

export function appendEvent(
  project: Project,
  caseId: string,
  nextVerdict: VerdictSnapshot,
  at: string,
  reviewer: string,
  eventId: string,
): Project {
  if (!project.batch) {
    throw new UserError("답변 파일을 가져온 뒤에 판정할 수 있습니다.");
  }
  const index = project.cases.findIndex((entry) => entry.id === caseId);
  if (index < 0) throw new UserError("판정할 문항을 찾지 못했습니다.");
  const item = project.cases[index];

  const normalized: VerdictSnapshot = {
    humanVerdict: nextVerdict.humanVerdict,
    severity: nextVerdict.humanVerdict === "error" ? nextVerdict.severity : null,
    note: nextVerdict.note.trim().slice(0, LIMITS.longText),
    recommendation: nextVerdict.recommendation.trim().slice(0, LIMITS.longText),
  };
  if (!normalized.humanVerdict) {
    throw new UserError("판정을 고르세요.");
  }
  if (normalized.humanVerdict === "error" && !normalized.severity) {
    throw new UserError("오류 판정에는 심각도가 필요합니다.");
  }
  const prev = snapshotOf(item);
  if (sameSnapshot(prev, normalized)) {
    throw new UserError("바뀐 내용이 없어 이력을 남기지 않았습니다.");
  }

  const payload: VerdictPayload = {
    caseId,
    at,
    reviewer,
    reason: [verdictLabel(normalized.humanVerdict), normalized.severity ? severityLabel(normalized.severity) : ""]
      .filter(Boolean)
      .join(" · "),
    prev,
    next: normalized,
  };
  const event = appendToChain(project, { id: eventId, payload });

  // 바뀐 문항 하나만 새 객체로 만들고 나머지는 그대로 둡니다.
  // 예전에는 판정 한 번마다 프로젝트 전체(답변 원문 포함)를 structuredClone 했습니다.
  const cases = project.cases.slice();
  cases[index] = {
    ...item,
    humanVerdict: normalized.humanVerdict,
    severity: normalized.severity,
    note: normalized.note,
    recommendation: normalized.recommendation,
    reviewedAt: at,
    reviewer,
  };
  return { ...project, cases, events: [...project.events, event] };
}

export function issueReport(project: Project, at: string, reportId: string): Project {
  if (!project.batch) {
    throw new UserError("답변 파일을 가져온 뒤에 확인서를 확정할 수 있습니다.");
  }
  if (project.cases.length === 0) {
    throw new UserError("확정할 답변이 없습니다.");
  }
  const audit = auditChain(project);
  if (!audit.ok) {
    // 깨진 체인의 해시를 확인서에 남기면, 고쳐진 기록을 확정본처럼 보이게 만듭니다.
    throw new UserError(`판정 체인이 깨져 있어 확정하지 않습니다. 깨진 지점: ${audit.brokenAt ?? "알 수 없음"}`);
  }
  const summary = summarize(project);
  return {
    ...project,
    reports: [
      ...project.reports,
      {
        id: reportId,
        issuedAt: at,
        batchSha256: project.batch.sha256,
        finalHash: audit.liveHash,
        decision: summary.decision,
        critical: summary.critical,
        reviewed: summary.reviewed,
        unreviewed: summary.unreviewed,
        questionsSha256: questionsHash(project.questions),
      },
    ],
  };
}

function answersOf(raw: string): Map<string, string> {
  return new Map(parseAnswersCsv(raw).rows.map((row) => [row.questionId, row.answer]));
}

/**
 * 답변 파일 해시 → 판정 이벤트 순서로 다시 계산합니다.
 * 저장된 답변 본문이 해시를 낸 파일의 내용과 같은지도 봅니다.
 * (예전에는 파일 해시만 보고 cases[].answer를 고쳐도 체인이 '일치'로 나왔습니다.)
 */
export function auditChain(project: Project): ChainAudit {
  if (!project.batch) {
    return { ok: true, brokenAt: null, liveHash: "" };
  }
  const batches = new Map<string, ImportBatch>([[project.batch.id, project.batch]]);
  for (const supplement of project.supplements ?? []) batches.set(supplement.id, supplement);

  for (const batch of batches.values()) {
    const rawHash = sha256(batch.raw);
    if (rawHash !== batch.sha256) {
      return { ok: false, brokenAt: batch.id, liveHash: rawHash };
    }
  }

  const answerCache = new Map<string, Map<string, string>>();
  for (const item of project.cases) {
    const batch = batches.get(item.batchId ?? project.batch.id);
    if (!batch) return { ok: false, brokenAt: item.id, liveHash: "" };
    let answers = answerCache.get(batch.id);
    if (!answers) {
      answers = answersOf(batch.raw);
      answerCache.set(batch.id, answers);
    }
    if (answers.get(item.questionId) !== item.answer) {
      return { ok: false, brokenAt: item.id, liveHash: "" };
    }
  }

  const chained = new Set<string>([project.batch.id]);
  let prev = project.batch.sha256;
  for (const event of project.events) {
    if (event.prevHash !== prev) {
      return { ok: false, brokenAt: event.id, liveHash: prev };
    }
    const expected = chainHash(prev, event.payload);
    if (expected !== event.eventHash) {
      return { ok: false, brokenAt: event.id, liveHash: expected };
    }
    if (isSupplementPayload(event.payload)) {
      const batch = batches.get(event.payload.batch.id);
      if (!batch || batch.sha256 !== event.payload.batch.sha256) {
        return { ok: false, brokenAt: event.id, liveHash: expected };
      }
      chained.add(batch.id);
    }
    prev = event.eventHash;
  }
  // 체인에 이벤트로 남지 않은 추가 답변 파일은 끼워 넣은 것입니다.
  for (const id of batches.keys()) {
    if (!chained.has(id)) return { ok: false, brokenAt: id, liveHash: prev };
  }
  return { ok: true, brokenAt: null, liveHash: prev };
}

/**
 * 같은 Project 객체에 대한 감사 결과를 기억합니다.
 * WeakMap이라 저장소가 새로 읽혀 옛 객체가 버려지면 캐시도 함께 사라집니다(메모리 누수 없음).
 * 객체를 직접 고친 뒤에는 이 함수 말고 auditChain을 쓰세요.
 */
const auditMemo = new WeakMap<Project, ChainAudit>();
export function auditChainCached(project: Project): ChainAudit {
  let audit = auditMemo.get(project);
  if (!audit) {
    audit = auditChain(project);
    auditMemo.set(project, audit);
  }
  return audit;
}
