"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { asSlot, parseAnswersCsv, parseQuestionsCsv, splitList } from "./csv";
import { LIMITS, UserError, assertCsvSize, cleanId, cleanText, isUserError } from "./errors";
import { logError } from "./error-log";
import {
  addQuestion,
  appendEvent,
  createProject,
  importAnswers,
  importSupplementAnswers,
  issueReport,
  replaceQuestions,
} from "./project";
import { DEMO_QUESTIONS, buildDemo } from "./seed";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  configuredToken,
  createSession,
  safeNextPath,
  tokenMatches,
} from "./session";
import { findProject, readStore, removeProject, saveProject, writeStore } from "./store";
import type {
  CollectionParty,
  DocKind,
  HumanVerdict,
  Project,
  Question,
  Severity,
} from "./types";

export type ActionResult =
  | { ok: true; warnings?: string[] }
  | { ok: false; message: string };

type Context = Record<string, string | number | boolean | null>;

/**
 * 모든 서버 액션의 공통 오류 처리.
 * - UserError: 메시지를 그대로 보여 주고 warn으로 기록합니다.
 * - 그 밖의 예외: 스택까지 data/logs/errors.log에 남기고, 화면에는 로그 번호만 보여 줍니다.
 *   (예전에는 파일 경로 같은 내부 메시지가 그대로 화면에 나갈 수 있었고, 어디에도 기록되지 않았습니다.)
 */
async function runAction(
  source: string,
  context: Context,
  work: () => Promise<ActionResult> | ActionResult,
): Promise<ActionResult> {
  try {
    return await work();
  } catch (error) {
    const logId = logError(source, error, context);
    if (isUserError(error)) return { ok: false, message: error.message };
    return { ok: false, message: `예상하지 못한 오류가 났습니다. 에러 로그 번호: ${logId}` };
  }
}

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

function errorUrl(path: string, message: string) {
  const glue = path.includes("?") ? "&" : "?";
  return `${path}${glue}error=${encodeURIComponent(message.slice(0, 200))}`;
}

function requireProject(projectId: unknown): Project {
  const id = cleanId(projectId, "검수 id");
  const project = findProject(readStore(), id);
  if (!project) throw new UserError("검수를 찾지 못했습니다.");
  return project;
}

function asDocKind(value: string): DocKind {
  return value === "vendor_self" ? "vendor_self" : "buyer";
}

function asParty(value: string): CollectionParty {
  if (value === "buyer_present" || value === "direct_call") return value;
  return "vendor_submitted";
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

function readCsvArg(csv: unknown): string {
  // 크기를 먼저 확인한 뒤 파싱합니다. 예전에는 답변 CSV를 다 파싱한 다음에 크기를 봤습니다.
  const text = String(csv ?? "");
  assertCsvSize(text);
  return text;
}

// ─── 검수 만들기·삭제 ─────────────────────────────────────────────

export async function createProjectAction(formData: FormData) {
  const name = cleanText(formData.get("name"), LIMITS.shortText);
  const client = cleanText(formData.get("client"), LIMITS.shortText);
  if (!name || !client) {
    redirect(errorUrl("/projects/new", "검수 이름과 발주처를 입력하세요"));
  }
  const id = nowId("ct");
  try {
    const project = createProject(
      {
        name,
        client,
        chatbotName: cleanText(formData.get("chatbotName"), LIMITS.shortText),
        chatbotVersion: cleanText(formData.get("chatbotVersion"), 50),
        docKind: asDocKind(String(formData.get("docKind") ?? "")),
        collectionParty: asParty(String(formData.get("collectionParty") ?? "")),
        reviewer: cleanText(formData.get("reviewer"), 50),
        failOnCritical: formData.get("failOnCritical") === "on",
      },
      id,
      new Date().toISOString(),
    );
    saveProject(project);
  } catch (error) {
    const logId = logError("createProject", error, { projectId: id });
    redirect(errorUrl("/projects/new", `검수를 만들지 못했습니다. 에러 로그 번호: ${logId}`));
  }
  refresh(id);
  // redirect는 내부적으로 예외를 던지므로 try 밖에서 부릅니다.
  redirect(`/projects/${id}?tab=questions`);
}

export async function restoreDemoAction() {
  const demo = buildDemo();
  try {
    const store = readStore();
    writeStore({ ...store, projects: [demo, ...store.projects.filter((project) => project.id !== demo.id)] });
  } catch (error) {
    const logId = logError("restoreDemo", error);
    redirect(errorUrl("/", `예시를 열지 못했습니다. 에러 로그 번호: ${logId}`));
  }
  refresh(demo.id);
  redirect(`/projects/${demo.id}?tab=review`);
}

export async function deleteProjectAction(formData: FormData) {
  const rawId = String(formData.get("projectId") ?? "");
  let back = "/";
  let failure: string | null = null;
  try {
    const project = requireProject(rawId);
    back = `/projects/${project.id}?tab=questions`;
    // 실수로 지우지 않도록 검수 이름을 똑같이 입력해야 지웁니다.
    if (cleanText(formData.get("confirmName"), LIMITS.shortText) !== project.name) {
      throw new UserError("삭제하려면 검수 이름을 똑같이 입력하세요.");
    }
    removeProject(project.id);
  } catch (error) {
    const logId = logError("deleteProject", error, { projectId: rawId.slice(0, 64) });
    failure = isUserError(error) ? error.message : `삭제하지 못했습니다. 에러 로그 번호: ${logId}`;
  }
  if (failure) redirect(errorUrl(back, failure));
  refresh(rawId);
  redirect("/");
}

// ─── 질문셋 ─────────────────────────────────────────────────────

export async function loadSampleQuestionsAction(formData: FormData) {
  const rawId = String(formData.get("projectId") ?? "");
  let failure: string | null = null;
  try {
    const project = requireProject(rawId);
    saveProject(replaceQuestions(project, structuredClone(DEMO_QUESTIONS)));
  } catch (error) {
    const logId = logError("loadSampleQuestions", error, { projectId: rawId.slice(0, 64) });
    failure = isUserError(error) ? error.message : `문항을 넣지 못했습니다. 에러 로그 번호: ${logId}`;
  }
  if (failure) redirect(errorUrl(`/projects/${encodeURIComponent(rawId)}?tab=questions`, failure));
  refresh(rawId);
  redirect(`/projects/${encodeURIComponent(rawId)}?tab=questions`);
}

export type QuestionInput = {
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
};

export async function addQuestionAction(projectId: string, input: QuestionInput): Promise<ActionResult> {
  return runAction("addQuestion", { projectId: String(projectId).slice(0, 64) }, () => {
    const project = requireProject(projectId);
    const text = cleanText(input?.text, LIMITS.longText);
    if (!text) throw new UserError("질문을 입력하세요.");
    const question: Question = {
      id: cleanId(input?.id, "문항 id"),
      text,
      referenceAnswer: cleanText(input.referenceAnswer, LIMITS.longText),
      sourceNote: cleanText(input.sourceNote, LIMITS.shortText * 2),
      sourceConflict: Boolean(input.sourceConflict),
      mustInclude: splitList(String(input.mustInclude ?? "")),
      mustNotInclude: splitList(String(input.mustNotInclude ?? "")),
      slotType: asSlot(String(input.slotType ?? "")),
      slotValue: cleanText(input.slotValue, LIMITS.shortText),
      domain: cleanText(input.domain, LIMITS.shortText) || "기타",
      holdout: Boolean(input.holdout),
      criticalDomain: Boolean(input.criticalDomain),
    };
    saveProject(addQuestion(project, question));
    refresh(project.id);
    return {
      ok: true,
      warnings: project.batch
        ? [`${question.id}는 답변 파일을 가져온 뒤 추가했습니다. 답변 탭의 '빠진 문항 답변 추가'로 답을 붙이세요.`]
        : [],
    };
  });
}

export async function importQuestionsAction(projectId: string, csv: string): Promise<ActionResult> {
  return runAction("importQuestions", { projectId: String(projectId).slice(0, 64) }, () => {
    const project = requireProject(projectId);
    const parsed = parseQuestionsCsv(readCsvArg(csv));
    if (parsed.questions.length === 0) {
      throw new UserError(parsed.errors[0] ?? "가져올 문항이 없습니다.");
    }
    saveProject(replaceQuestions(project, parsed.questions));
    refresh(project.id);
    return { ok: true, warnings: parsed.errors };
  });
}

// ─── 답변 ───────────────────────────────────────────────────────

export async function importAnswersAction(
  projectId: string,
  filename: string,
  csv: string,
  confirmReset: boolean,
): Promise<ActionResult> {
  return runAction("importAnswers", { projectId: String(projectId).slice(0, 64) }, () => {
    const project = requireProject(projectId);
    if ((project.events.length > 0 || project.reports.length > 0) && !confirmReset) {
      throw new UserError("답변 파일을 바꾸면 판정 이력과 확정 해시가 새로 시작됩니다. 확인을 체크하세요.");
    }
    const raw = readCsvArg(csv);
    const parsed = parseAnswersCsv(raw);
    if (parsed.rows.length === 0) {
      throw new UserError(parsed.errors[0] ?? "가져올 답변이 없습니다.");
    }
    const imported = importAnswers(
      project,
      String(filename ?? ""),
      raw,
      parsed.rows,
      new Date().toISOString(),
      nowId("batch"),
    );
    saveProject(imported.project);
    refresh(project.id);
    return { ok: true, warnings: [...parsed.errors, ...imported.warnings] };
  });
}

export async function importSupplementAction(
  projectId: string,
  filename: string,
  csv: string,
): Promise<ActionResult> {
  return runAction("importSupplement", { projectId: String(projectId).slice(0, 64) }, () => {
    const project = requireProject(projectId);
    const raw = readCsvArg(csv);
    const parsed = parseAnswersCsv(raw);
    if (parsed.rows.length === 0) {
      throw new UserError(parsed.errors[0] ?? "가져올 답변이 없습니다.");
    }
    const imported = importSupplementAnswers(
      project,
      String(filename ?? ""),
      raw,
      parsed.rows,
      new Date().toISOString(),
      nowId("batch"),
      nowId("evt"),
      project.reviewer,
    );
    saveProject(imported.project);
    refresh(project.id);
    return { ok: true, warnings: [...parsed.errors, ...imported.warnings] };
  });
}

// ─── 판정·확정 ──────────────────────────────────────────────────

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
  const context = { projectId: String(projectId).slice(0, 64), caseId: String(caseId).slice(0, 80) };
  return runAction("saveVerdict", context, () => {
    const project = requireProject(projectId);
    const next = appendEvent(
      project,
      String(caseId),
      {
        humanVerdict: asVerdict(String(input?.humanVerdict ?? "")),
        severity: asSeverity(String(input?.severity ?? "")),
        note: String(input?.note ?? ""),
        recommendation: String(input?.recommendation ?? ""),
      },
      new Date().toISOString(),
      project.reviewer,
      nowId("evt"),
    );
    saveProject(next);
    refresh(project.id);
    return { ok: true };
  });
}

export async function issueCertificateAction(projectId: string): Promise<ActionResult> {
  return runAction("issueCertificate", { projectId: String(projectId).slice(0, 64) }, () => {
    const project = requireProject(projectId);
    saveProject(issueReport(project, new Date().toISOString(), nowId("rpt")));
    refresh(project.id);
    return { ok: true };
  });
}

// ─── 로그인 ─────────────────────────────────────────────────────

/**
 * 로그인 실패 횟수. 키마다 10분 창에서 5번까지 허용합니다.
 * 항목 수 상한(1,000)과 만료 정리를 두어, 요청이 계속 와도 Map이 끝없이 커지지 않게 합니다.
 */
const FAIL_WINDOW_MS = 10 * 60 * 1000;
const FAIL_LIMIT = 5;
const FAIL_MAX_KEYS = 1_000;
const failures = new Map<string, { count: number; first: number }>();

function pruneFailures(now: number) {
  for (const [key, value] of failures) {
    if (now - value.first > FAIL_WINDOW_MS) failures.delete(key);
  }
  while (failures.size > FAIL_MAX_KEYS) {
    const oldest = failures.keys().next().value;
    if (oldest === undefined) break;
    failures.delete(oldest);
  }
}

export async function loginAction(formData: FormData) {
  const next = safeNextPath(formData.get("next"));
  const token = configuredToken();
  if (!token) redirect(next);

  const headerList = await headers();
  const key = (headerList.get("x-forwarded-for")?.split(",")[0] ?? "local").trim().slice(0, 64) || "local";
  const now = Date.now();
  pruneFailures(now);
  const record = failures.get(key);
  if (record && record.count >= FAIL_LIMIT) {
    redirect(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent("시도가 많습니다. 10분 뒤에 다시 하세요.")}`);
  }

  const input = String(formData.get("token") ?? "").slice(0, 500);
  if (!(await tokenMatches(input, token))) {
    failures.set(key, { count: (record?.count ?? 0) + 1, first: record?.first ?? now });
    logError("login", new UserError("접근 토큰이 틀렸습니다."), { attempts: (record?.count ?? 0) + 1 });
    redirect(`/login?next=${encodeURIComponent(next)}&error=${encodeURIComponent("접근 토큰이 맞지 않습니다.")}`);
  }

  failures.delete(key);
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSession(token), {
    httpOnly: true,
    sameSite: "lax",
    // HTTPS(리버스 프록시 뒤)에서는 Secure 쿠키로 보냅니다. 평문 HTTP에서 Secure를 켜면 로그인이 안 됩니다.
    secure: headerList.get("x-forwarded-proto") === "https" || process.env.AICT_SECURE_COOKIE === "1",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  redirect(next);
}

export async function logoutAction() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
