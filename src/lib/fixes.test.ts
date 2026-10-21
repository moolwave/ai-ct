import assert from "node:assert/strict";
import test from "node:test";
import { parseQuestionsCsv } from "./csv";
import { UserError, cleanId } from "./errors";
import {
  addQuestion,
  appendEvent,
  auditChain,
  auditChainCached,
  importSupplementAnswers,
  issueReport,
  questionsHash,
} from "./project";
import { amountsIn, inspectAnswer } from "./rules";
import { DEMO_QUESTIONS, buildDemo } from "./seed";
import { isLoopbackHost, safeNextPath, createSession, verifySession, tokenMatches } from "./session";
import { summarize, summarizeCached } from "./summary";
import type { Project, Question } from "./types";

function question(overrides: Partial<Question> = {}): Question {
  return {
    id: "T-1",
    text: "질문",
    referenceAnswer: "",
    sourceNote: "",
    sourceConflict: false,
    mustInclude: [],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "테스트",
    holdout: false,
    criticalDomain: false,
    ...overrides,
  };
}

function finishAll(project: Project): Project {
  let next = project;
  for (const item of project.cases) {
    if (item.humanVerdict) continue;
    next = appendEvent(
      next,
      item.id,
      { humanVerdict: "pass", severity: null, note: "", recommendation: "" },
      "2026-10-21T00:00:00.000Z",
      "검수자",
      `evt-${item.id}`,
    );
  }
  return next;
}

const ids = (findings: { ruleId: string }[]) => findings.map((finding) => finding.ruleId);

test("수정1: '납품 보류' 설정을 꺼도 중대 오류가 있으면 '중대 오류 없음'이 되지 않는다", () => {
  const project = finishAll({ ...buildDemo(), failOnCritical: false });
  const summary = summarize(project);
  assert.equal(summary.critical > 0, true);
  assert.equal(summary.decision, "pending");
});

test("수정2: 답변 파일 뒤에 추가한 문항은 추가 답변으로 채우고 판정 이력은 유지된다", () => {
  let project = addQuestion(buildDemo(), question({ id: "Q-13" }));
  const eventsBefore = project.events.length;
  assert.equal(summarize(project).decision, "incomplete");
  const raw = "question_id,answer\nQ-13,새 답변입니다.\nQ-01,덮어쓰기 시도\n";
  const result = importSupplementAnswers(
    project,
    "extra.csv",
    raw,
    [
      { questionId: "Q-13", answer: "새 답변입니다." },
      { questionId: "Q-01", answer: "덮어쓰기 시도" },
    ],
    "2026-10-21T00:00:00.000Z",
    "batch-extra",
    "evt-extra",
    "검수자",
  );
  project = result.project;
  assert.equal(project.events.length, eventsBefore + 1);
  assert.ok(result.warnings.some((warning) => warning.includes("Q-01")));
  assert.equal(project.cases.find((item) => item.questionId === "Q-01")?.answer.includes("덮어쓰기"), false);
  assert.equal(auditChain(project).ok, true);
  assert.equal(summarize(finishAll(project)).missingAnswerIds.length, 0);
});

test("수정2: 추가 답변 파일을 체인 밖에서 끼워 넣으면 체인이 깨진다", () => {
  const base = addQuestion(buildDemo(), question({ id: "Q-13" }));
  const raw = "question_id,answer\nQ-13,답\n";
  const { project } = importSupplementAnswers(
    base, "x.csv", raw, [{ questionId: "Q-13", answer: "답" }], "2026-10-21T00:00:00.000Z", "b2", "e2", "검수자",
  );
  const forged: Project = { ...project, events: project.events.slice(0, -1) };
  assert.equal(auditChain(forged).ok, false);
});

test("수정3: 중대 도메인 문항의 오류·미결 건수를 따로 센다", () => {
  const summary = summarize(buildDemo());
  assert.ok(summary.criticalDomainTotal > 0);
  assert.equal(
    summary.criticalDomainTotal >= summary.criticalDomainErrors + summary.criticalDomainOpen,
    true,
  );
});

test("수정4: 전화번호는 계좌번호로 중복으로 잡히지 않는다", () => {
  const found = ids(inspectAnswer(question(), "문의 010-1234-5678 로 주세요"));
  assert.deepEqual(found, ["pii.phone"]);
});

test("수정4: 13자리 주문번호는 주민번호로 잡히지 않고, 실제 형식은 잡힌다", () => {
  assert.deepEqual(ids(inspectAnswer(question(), "주문번호 2026101912345 확인")), []);
  const real = inspectAnswer(question(), "901010-1234567");
  assert.deepEqual(ids(real), ["pii.rrn"]);
  assert.equal(real[0].evidence.includes("234567"), false, "증거란에 원문 전체를 다시 남기지 않는다");
});

test("수정4: 날짜(2026-10-21)는 계좌번호가 아니다", () => {
  assert.deepEqual(ids(inspectAnswer(question(), "2026-10-21까지 신청")), []);
});

test("수정5: '3만 원', '3만5천원', '1억 2천만 원'을 금액으로 읽는다", () => {
  assert.deepEqual(amountsIn("3만 원").map((item) => item.value), [30000]);
  assert.deepEqual(amountsIn("3만5천원").map((item) => item.value), [35000]);
  assert.deepEqual(amountsIn("1억 2천만 원").map((item) => item.value), [120000000]);
  assert.deepEqual(amountsIn("36,000원과 3.5만원").map((item) => item.value), [36000, 35000]);
  const q = question({ slotType: "amount", slotValue: "30000" });
  assert.deepEqual(ids(inspectAnswer(q, "3만 원을 환불합니다")), []);
});

test("수정5: 기대 금액을 부정하는 문장은 신호로 남긴다", () => {
  const q = question({ slotType: "amount", slotValue: "30,000" });
  assert.ok(ids(inspectAnswer(q, "30,000원이 아니라 27,000원입니다")).includes("slot.amount_context"));
  assert.deepEqual(ids(inspectAnswer(q, "3만 원 이상 구매하면 무료입니다")), []);
});

test("수정5: 필수·금지 표현은 띄어쓰기를 무시한다", () => {
  const q = question({ mustInclude: ["환불 가능"], mustNotInclude: ["왕복 배송비"] });
  assert.deepEqual(ids(inspectAnswer(q, "환불가능합니다. 왕복배송비는 없습니다.")), ["phrase.must_not_include"]);
});

test("체인이 깨졌으면 확인서를 확정하지 않는다", () => {
  const project = buildDemo();
  project.events[0].payload.reason = "고침";
  assert.throws(() => issueReport(project, "2026-10-21T00:00:00.000Z", "r"), UserError);
});

test("저장된 답변 본문을 고치면 파일 해시가 그대로여도 체인이 깨진다", () => {
  const project = buildDemo();
  const cases = project.cases.map((item, index) => (index === 0 ? { ...item, answer: "고친 답변" } : item));
  const audit = auditChain({ ...project, cases });
  assert.equal(audit.ok, false);
  assert.equal(audit.brokenAt, project.cases[0].id);
});

test("확인서에 질문셋 해시를 남긴다", () => {
  const project = issueReport(buildDemo(), "2026-10-21T00:00:00.000Z", "r2");
  assert.equal(project.reports.at(-1)?.questionsSha256, questionsHash(project.questions));
});

test("같은 판정을 다시 저장하면 이력을 늘리지 않는다", () => {
  const project = buildDemo();
  const judged = project.cases.find((item) => item.humanVerdict)!;
  assert.throws(
    () =>
      appendEvent(
        project,
        judged.id,
        { humanVerdict: judged.humanVerdict, severity: judged.severity, note: judged.note, recommendation: judged.recommendation },
        "2026-10-21T00:00:00.000Z",
        "검수자",
        "evt-same",
      ),
    /바뀐 내용이 없어/,
  );
});

test("판정은 원본 프로젝트를 바꾸지 않는다(불변 갱신)", () => {
  const project = buildDemo();
  const open = project.cases.find((item) => !item.humanVerdict)!;
  const before = JSON.stringify(project);
  appendEvent(project, open.id, { humanVerdict: "pass", severity: null, note: "", recommendation: "" }, "2026-10-21T00:00:00.000Z", "검수자", "e");
  assert.equal(JSON.stringify(project), before);
});

test("캐시: 같은 객체면 같은 결과를 재사용한다", () => {
  const project = buildDemo();
  assert.equal(auditChainCached(project), auditChainCached(project));
  assert.equal(summarizeCached(project), summarizeCached(project));
});

test("입력 검증: 문항 id에 꺾쇠·슬래시 같은 문자를 받지 않는다", () => {
  assert.throws(() => cleanId("<script>"), UserError);
  assert.throws(() => cleanId("../etc"), UserError);
  assert.equal(cleanId("Q-01"), "Q-01");
  const parsed = parseQuestionsCsv("id,question,reference_answer,source_note,source_conflict,must_include,must_not_include,slot_type,slot_value,domain,holdout,critical_domain\n<x>,질문,,,,,,,,,,\n");
  assert.equal(parsed.questions.length, 0);
  assert.equal(parsed.errors.length, 1);
});

test("보안: 로그인 뒤 바깥 사이트로 보내지 않는다", () => {
  assert.equal(safeNextPath("/projects/a"), "/projects/a");
  assert.equal(safeNextPath("//evil.example"), "/");
  assert.equal(safeNextPath("https://evil.example"), "/");
  assert.equal(safeNextPath("/\\evil.example"), "/");
});

test("보안: 루프백 호스트만 로컬로 본다", () => {
  assert.equal(isLoopbackHost("127.0.0.1:43123"), true);
  assert.equal(isLoopbackHost("localhost:43123"), true);
  assert.equal(isLoopbackHost("[::1]:43123"), true);
  assert.equal(isLoopbackHost("192.168.0.10:43123"), false);
  assert.equal(isLoopbackHost("localhost.evil.example"), false);
});

test("보안: 세션은 서명·만료를 확인한다", async () => {
  const token = "a-long-access-token";
  const now = Date.UTC(2026, 9, 21);
  const session = await createSession(token, now);
  assert.equal(await verifySession(token, session, now + 1000), true);
  assert.equal(await verifySession("other-token-value", session, now), false);
  assert.equal(await verifySession(token, session, now + 13 * 3600 * 1000), false);
  assert.equal(await verifySession(token, `${session}0`, now), false);
  assert.equal(await tokenMatches(token, token), true);
  assert.equal(await tokenMatches("wrong", token), false);
});

test("예시 문항은 새 규칙에서도 의도한 신호를 낸다", () => {
  const privacy = DEMO_QUESTIONS.find((item) => item.id === "Q-04")!;
  assert.ok(ids(inspectAnswer(privacy, "주민번호 901010-1234567 로 확인했습니다.")).includes("pii.rrn"));
});
