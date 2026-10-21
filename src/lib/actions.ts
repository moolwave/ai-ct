"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseAnswersCsv, parseQuestionsCsv } from "./csv";
import {
  addQuestion,
  appendEvent,
  createProject,
  importAnswers,
  issueReport,
  replaceQuestions,
} from "./project";
import { DEMO_QUESTIONS, buildDemo } from "./seed";
import { findProject, readStore, saveProject, writeStore } from "./store";
import type {
  CollectionParty,
  DocKind,
  HumanVerdict,
  Question,
  Severity,
  SlotType,
} from "./types";

export type ActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; message: string };

function refresh(id?: string) {
  revalidatePath("/");
  revalidatePath("/verify");
  if (id) {
    revalidatePath(`/projects/${id}`);
    revalidatePath(`/projects/${id}/certificate`);
  }
}

function nowId(prefix: string) {
  return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

function asDocKind(value: string): DocKind {
  return value === "vendor_self" ? "vendor_self" : "buyer";
}

function asParty(value: string): CollectionParty {
  if (value === "buyer_present" || value === "direct_call") return value;
  return "vendor_submitted";
}

function asSlot(value: string): SlotType {
  if (value === "amount" || value === "date") return value;
  return "none";
}

function asVerdict(value: string): HumanVerdict | null {
  if (value === "pass" || value === "error" || value === "hold" || value === "unsettled") {
    return value;
  }
  return null;
}

function asSeverity(value: string): Severity | null {
  if (value === "critical" || value === "major" || value === "minor") return value;
  return null;
}

export async function createProjectAction(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  const client = String(formData.get("client") ?? "").trim();
  if (!name || !client) {
    redirect(
      `/projects/new?error=${encodeURIComponent("검수 이름과 발주처를 입력하세요")}`,
    );
  }
  const id = nowId("ct");
  const project = createProject(
    {
      name,
      client,
      chatbotName: String(formData.get("chatbotName") ?? ""),
      chatbotVersion: String(formData.get("chatbotVersion") ?? ""),
      docKind: asDocKind(String(formData.get("docKind") ?? "")),
      collectionParty: asParty(String(formData.get("collectionParty") ?? "")),
      reviewer: String(formData.get("reviewer") ?? ""),
      failOnCritical: formData.get("failOnCritical") === "on",
    },
    id,
    new Date().toISOString(),
  );
  saveProject(project);
  refresh(id);
  redirect(`/projects/${id}?tab=questions`);
}

export async function restoreDemoAction() {
  const store = readStore();
  const demo = buildDemo();
  store.projects = [demo, ...store.projects.filter((project) => project.id !== demo.id)];
  writeStore(store);
  refresh(demo.id);
  redirect(`/projects/${demo.id}?tab=review`);
}

export async function deleteProjectAction(formData: FormData) {
  const id = String(formData.get("projectId") ?? "");
  const store = readStore();
  store.projects = store.projects.filter((project) => project.id !== id);
  writeStore(store);
  refresh(id);
  redirect("/");
}

export async function loadSampleQuestionsAction(formData: FormData) {
  const id = String(formData.get("projectId") ?? "");
  const store = readStore();
  const project = findProject(store, id);
  if (!project) redirect("/");
  try {
    saveProject(replaceQuestions(project, structuredClone(DEMO_QUESTIONS)));
  } catch (error) {
    const message = error instanceof Error ? error.message : "문항을 넣지 못했습니다.";
    redirect(`/projects/${id}?tab=questions&error=${encodeURIComponent(message)}`);
  }
  refresh(id);
  redirect(`/projects/${id}?tab=questions`);
}

export async function addQuestionAction(
  projectId: string,
  input: {
    id: string;
    text: string;
    referenceAnswer: string;
    sourceNote: string;
    sourceConflict: boolean;
    mustInclude: string;
    mustNotInclude: string;
    slotType: string;
    slotValue: string;
    domain: string;
    holdout: boolean;
    criticalDomain: boolean;
  },
): Promise<ActionResult> {
  const project = findProject(readStore(), projectId);
  if (!project) return { ok: false, message: "검수를 찾지 못했습니다." };
  const id = input.id.trim();
  const text = input.text.trim();
  if (!id || !text) {
    return { ok: false, message: "문항 id와 질문을 입력하세요." };
  }
  const question: Question = {
    id,
    text,
    referenceAnswer: input.referenceAnswer.trim(),
    sourceNote: input.sourceNote.trim(),
    sourceConflict: input.sourceConflict,
    mustInclude: input.mustInclude.split("|").map((item) => item.trim()).filter(Boolean),
    mustNotInclude: input.mustNotInclude.split("|").map((item) => item.trim()).filter(Boolean),
    slotType: asSlot(input.slotType),
    slotValue: input.slotValue.trim(),
    domain: input.domain.trim() || "기타",
    holdout: input.holdout,
    criticalDomain: input.criticalDomain,
  };
  try {
    saveProject(addQuestion(project, question));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "문항을 추가하지 못했습니다." };
  }
  refresh(projectId);
  return { ok: true };
}

export async function importQuestionsAction(
  projectId: string,
  csv: string,
): Promise<ActionResult> {
  const project = findProject(readStore(), projectId);
  if (!project) return { ok: false, message: "검수를 찾지 못했습니다." };
  const parsed = parseQuestionsCsv(csv);
  if (parsed.errors.length > 0 && parsed.questions.length === 0) {
    return { ok: false, message: parsed.errors[0] };
  }
  if (parsed.questions.length === 0) {
    return { ok: false, message: "가져올 문항이 없습니다." };
  }
  try {
    saveProject(replaceQuestions(project, parsed.questions));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "질문셋을 바꾸지 못했습니다." };
  }
  refresh(projectId);
  return { ok: true, warnings: parsed.errors };
}

export async function importAnswersAction(
  projectId: string,
  filename: string,
  csv: string,
  confirmReset: boolean,
): Promise<ActionResult> {
  const project = findProject(readStore(), projectId);
  if (!project) return { ok: false, message: "검수를 찾지 못했습니다." };
  if ((project.events.length > 0 || project.reports.length > 0) && !confirmReset) {
    return {
      ok: false,
      message: "답변 파일을 바꾸면 판정 이력과 확정 해시가 새로 시작됩니다. 확인을 체크하세요.",
    };
  }
  const parsed = parseAnswersCsv(csv);
  if (parsed.rows.length === 0) {
    return { ok: false, message: parsed.errors[0] ?? "가져올 답변이 없습니다." };
  }
  try {
    const imported = importAnswers(
      project,
      filename,
      csv,
      parsed.rows,
      new Date().toISOString(),
      nowId("batch"),
    );
    saveProject(imported.project);
    refresh(projectId);
    return { ok: true, warnings: [...parsed.errors, ...imported.warnings] };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "답변을 가져오지 못했습니다." };
  }
}

export async function saveVerdictAction(
  projectId: string,
  caseId: string,
  input: {
    humanVerdict: string;
    severity: string;
    note: string;
    recommendation: string;
  },
): Promise<ActionResult> {
  const project = findProject(readStore(), projectId);
  if (!project) return { ok: false, message: "검수를 찾지 못했습니다." };
  try {
    const next = appendEvent(
      project,
      caseId,
      {
        humanVerdict: asVerdict(input.humanVerdict),
        severity: asSeverity(input.severity),
        note: input.note,
        recommendation: input.recommendation,
      },
      new Date().toISOString(),
      project.reviewer,
      nowId("evt"),
    );
    saveProject(next);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "판정을 저장하지 못했습니다." };
  }
  refresh(projectId);
  return { ok: true };
}

export async function issueCertificateAction(projectId: string): Promise<ActionResult> {
  const project = findProject(readStore(), projectId);
  if (!project) return { ok: false, message: "검수를 찾지 못했습니다." };
  try {
    saveProject(issueReport(project, new Date().toISOString(), nowId("rpt")));
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "확인서를 확정하지 못했습니다." };
  }
  refresh(projectId);
  return { ok: true };
}
