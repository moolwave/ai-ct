import { chainHash, sha256 } from "./hash";
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
  VerdictSnapshot,
} from "./types";

const MAX_CSV_CHARS = 500_000;

export function blankVerdict(): VerdictSnapshot {
  return {
    humanVerdict: null,
    severity: null,
    note: "",
    recommendation: "",
  };
}

export function snapshotOf(item: Case): VerdictSnapshot {
  return {
    humanVerdict: item.humanVerdict,
    severity: item.severity,
    note: item.note,
    recommendation: item.recommendation,
  };
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
    cases: [],
    events: [],
    reports: [],
  };
}

export function assertCsvSize(text: string) {
  if (text.length > MAX_CSV_CHARS) {
    throw new Error("파일이 큽니다. 500KB 이하의 CSV만 가져옵니다.");
  }
}

export function replaceQuestions(project: Project, questions: Question[]): Project {
  if (project.batch) {
    throw new Error(
      "답변 파일을 가져온 뒤에는 질문셋을 통째로 바꾸지 않습니다. 문항은 하나씩 추가하세요.",
    );
  }
  const next = structuredClone(project);
  const ids = new Set<string>();
  for (const question of questions) {
    if (ids.has(question.id)) {
      throw new Error(`문항 id가 중복입니다: ${question.id}`);
    }
    ids.add(question.id);
  }
  next.questions = questions;
  return next;
}

export function addQuestion(project: Project, question: Question): Project {
  if (project.questions.some((item) => item.id === question.id)) {
    throw new Error(`이미 있는 문항 id입니다: ${question.id}`);
  }
  const next = structuredClone(project);
  next.questions.push(question);
  return next;
}

export function importAnswers(
  project: Project,
  filename: string,
  raw: string,
  rows: Array<{ questionId: string; answer: string }>,
  importedAt: string,
  batchId: string,
): { project: Project; warnings: string[] } {
  assertCsvSize(raw);
  if (project.questions.length === 0) {
    throw new Error("질문셋을 먼저 넣으세요.");
  }
  const known = new Set(project.questions.map((question) => question.id));
  const warnings: string[] = [];
  const matched = rows.filter((row) => {
    if (!known.has(row.questionId)) {
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

  const batch: ImportBatch = {
    id: batchId,
    filename: filename.trim() || "answers.csv",
    sha256: sha256(raw),
    rowCount: matched.length,
    ruleVersion: RULE_VERSION,
    importedAt,
    raw,
  };

  const cases: Case[] = matched.map((row) => {
    const question = project.questions.find((item) => item.id === row.questionId)!;
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
    };
  });

  const next = structuredClone(project);
  next.batch = batch;
  next.cases = cases;
  next.events = [];
  next.reports = [];
  return { project: next, warnings };
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
    throw new Error("답변 파일을 가져온 뒤에 판정할 수 있습니다.");
  }
  const anchorHash = project.batch.sha256;
  const next = structuredClone(project);
  const item = next.cases.find((entry) => entry.id === caseId);
  if (!item) throw new Error("판정할 문항을 찾지 못했습니다.");

  const normalized: VerdictSnapshot = {
    humanVerdict: nextVerdict.humanVerdict,
    severity: nextVerdict.humanVerdict === "error" ? nextVerdict.severity : null,
    note: nextVerdict.note.trim(),
    recommendation: nextVerdict.recommendation.trim(),
  };
  if (!normalized.humanVerdict) {
    throw new Error("판정을 고르세요.");
  }
  if (normalized.humanVerdict === "error" && !normalized.severity) {
    throw new Error("오류 판정에는 심각도가 필요합니다.");
  }

  const payload = {
    caseId,
    at,
    reviewer,
    reason: [verdictLabel(normalized.humanVerdict), normalized.severity ? severityLabel(normalized.severity) : ""]
      .filter(Boolean)
      .join(" · "),
    prev: snapshotOf(item),
    next: normalized,
  };
  const prevHash = next.events.at(-1)?.eventHash ?? anchorHash;
  const event: ReviewEvent = {
    id: eventId,
    prevHash,
    eventHash: chainHash(prevHash, payload),
    payload,
  };
  next.events.push(event);
  item.humanVerdict = normalized.humanVerdict;
  item.severity = normalized.severity;
  item.note = normalized.note;
  item.recommendation = normalized.recommendation;
  item.reviewedAt = at;
  item.reviewer = reviewer;
  return next;
}

export function issueReport(project: Project, at: string, reportId: string): Project {
  if (!project.batch) {
    throw new Error("답변 파일을 가져온 뒤에 확인서를 확정할 수 있습니다.");
  }
  if (project.cases.length === 0) {
    throw new Error("확정할 답변이 없습니다.");
  }
  const summary = summarize(project);
  const liveHash = auditChain(project).liveHash;
  const next = structuredClone(project);
  next.reports.push({
    id: reportId,
    issuedAt: at,
    batchSha256: project.batch.sha256,
    finalHash: liveHash,
    decision: summary.decision,
    critical: summary.critical,
    reviewed: summary.reviewed,
    unreviewed: summary.unreviewed,
  });
  return next;
}

export function auditChain(project: Project): ChainAudit {
  if (!project.batch) {
    return { ok: true, brokenAt: null, liveHash: "" };
  }
  const rawHash = sha256(project.batch.raw);
  if (rawHash !== project.batch.sha256) {
    return { ok: false, brokenAt: project.batch.id, liveHash: rawHash };
  }
  let prev = project.batch.sha256;
  for (const event of project.events) {
    if (event.prevHash !== prev) {
      return { ok: false, brokenAt: event.id, liveHash: prev };
    }
    const expected = chainHash(prev, event.payload);
    if (expected !== event.eventHash) {
      return { ok: false, brokenAt: event.id, liveHash: expected };
    }
    prev = event.eventHash;
  }
  return { ok: true, brokenAt: null, liveHash: prev };
}
