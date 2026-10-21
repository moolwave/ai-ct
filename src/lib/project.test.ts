import assert from "node:assert/strict";
import test from "node:test";
import { parseAnswersCsv, parseQuestionsCsv } from "./csv";
import { auditChain, appendEvent } from "./project";
import { inspectAnswer } from "./rules";
import { DEMO_QUESTIONS, buildDemo, demoAnswersCsv, demoQuestionsCsv } from "./seed";
import { summarize } from "./summary";

test("demo chain matches the answer file and the human verdicts", () => {
  const project = buildDemo();
  const audit = auditChain(project);
  assert.equal(audit.ok, true);
  assert.equal(project.reports[0]?.finalHash, audit.liveHash);
  const summary = summarize(project);
  assert.equal(summary.decision, "incomplete");
  assert.equal(summary.critical, 4);
  assert.equal(summary.unreviewed, 2);
  assert.equal(summary.passes, 3);
  assert.equal(summary.errors, 5);
  assert.equal(summary.holds, 1);
  assert.equal(summary.unsettled, 1);
  assert.equal(summary.passRate, 3 / 8);
  assert.equal(summary.publicDefects.some((defect) => defect.questionId === "Q-09"), false);
  assert.equal(JSON.stringify(summary.publicDefects).includes("배송비 없이"), false);
  assert.equal(summary.holdoutErrors, 1);
});

test("finishing the open rows does not turn critical errors into a clear result", () => {
  let project = buildDemo();
  for (const questionId of ["Q-10", "Q-12"]) {
    project = appendEvent(
      project,
      `case_${questionId}`,
      {
        humanVerdict: "pass",
        severity: null,
        note: "확인",
        recommendation: "",
      },
      "2026-10-18T10:00:00.000Z",
      "김서연",
      `evt-test-${questionId}`,
    );
  }
  assert.equal(summarize(project).decision, "stop");
  assert.equal(auditChain(project).ok, true);
  assert.notEqual(auditChain(project).liveHash, project.reports[0]?.finalHash);
});

test("a changed event payload breaks the chain", () => {
  const project = buildDemo();
  project.events[1].payload.reason = "바꿔 씀";
  assert.equal(auditChain(project).ok, false);
});

test("amount, forbidden phrase, and resident number are hits, not conclusions", () => {
  const refund = DEMO_QUESTIONS.find((question) => question.id === "Q-02");
  const privacy = DEMO_QUESTIONS.find((question) => question.id === "Q-04");
  assert.ok(refund && privacy);
  const refundHits = inspectAnswer(refund, "상품금액과 왕복 배송비를 포함해 36,000원을 환불해 드립니다.");
  assert.ok(refundHits.some((finding) => finding.ruleId === "slot.amount"));
  assert.ok(refundHits.some((finding) => finding.ruleId === "phrase.must_not_include"));
  const privacyHits = inspectAnswer(privacy, "주민번호 901010-1234567 로 확인했습니다.");
  assert.ok(privacyHits.some((finding) => finding.ruleId === "pii.rrn"));
  assert.equal(privacyHits.some((finding) => finding.ruleId === "pii.phone"), false);
});

test("conflicting sources stay informational", () => {
  const question = DEMO_QUESTIONS.find((item) => item.id === "Q-07");
  assert.ok(question);
  const findings = inspectAnswer(question, "교환은 수령 후 14일 이내입니다.");
  assert.equal(findings.some((finding) => finding.kind === "hit"), false);
  assert.equal(findings[0]?.ruleId, "info.source_conflict");
});

test("sample csv round-trips questions and quoted answers", () => {
  const questions = parseQuestionsCsv(demoQuestionsCsv());
  assert.equal(questions.errors.length, 0);
  assert.equal(questions.questions.length, 12);
  assert.equal(questions.questions[8]?.holdout, true);
  const answers = parseAnswersCsv(demoAnswersCsv());
  assert.equal(answers.errors.length, 0);
  assert.equal(answers.rows.length, 12);
  const quoted = parseAnswersCsv('question_id,answer\nQ-1,"배송비 3,000원, 내일"\n');
  assert.equal(quoted.rows[0]?.answer, "배송비 3,000원, 내일");
});
