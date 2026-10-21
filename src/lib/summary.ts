import type { Defect, Project, Question, Severity, Summary } from "./types";

const SEVERITY_RANK: Record<Severity, number> = {
  critical: 0,
  major: 1,
  minor: 2,
};

function excerpt(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  if (flat.length <= 160) return flat;
  return `${flat.slice(0, 157)}…`;
}

function questionMap(project: Project): Map<string, Question> {
  return new Map(project.questions.map((question) => [question.id, question]));
}

export function summarize(project: Project): Summary {
  const questions = questionMap(project);
  const missingAnswerIds = project.questions
    .filter((question) => !project.cases.some((item) => item.questionId === question.id))
    .map((question) => question.id);

  const reviewedCases = project.cases.filter((item) => item.humanVerdict);
  const unreviewed = project.cases.filter((item) => !item.humanVerdict).length;
  const passes = reviewedCases.filter((item) => item.humanVerdict === "pass");
  const errors = reviewedCases.filter((item) => item.humanVerdict === "error");
  const holds = reviewedCases.filter((item) => item.humanVerdict === "hold");
  const unsettled = reviewedCases.filter((item) => item.humanVerdict === "unsettled");
  const critical = errors.filter((item) => item.severity === "critical").length;
  const major = errors.filter((item) => item.severity === "major").length;
  const minor = errors.filter((item) => item.severity === "minor").length;
  const denominator = passes.length + errors.length;

  const publicDefects: Defect[] = errors
    .flatMap((item) => {
      const question = questions.get(item.questionId);
      if (!question || question.holdout || !item.severity) return [];
      return [
        {
          questionId: item.questionId,
          domain: question.domain,
          severity: item.severity,
          answerExcerpt: excerpt(item.answer),
          sourceNote: question.sourceNote,
          recommendation: item.recommendation,
          findingSummaries: item.findings
            .filter((finding) => finding.kind === "hit")
            .map((finding) => finding.summary),
        },
      ];
    })
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);

  const holdoutCases = project.cases.filter((item) => questions.get(item.questionId)?.holdout);
  const holdoutErrors = holdoutCases.filter((item) => item.humanVerdict === "error").length;
  const holdoutReviewed = holdoutCases.filter((item) => item.humanVerdict).length;

  let decision: Summary["decision"];
  if (
    project.questions.length === 0 ||
    missingAnswerIds.length > 0 ||
    unreviewed > 0 ||
    project.cases.length === 0
  ) {
    decision = "incomplete";
  } else if (project.failOnCritical && critical > 0) {
    decision = "stop";
  } else if (holds.length > 0 || unsettled.length > 0) {
    decision = "pending";
  } else {
    decision = "clear";
  }

  return {
    questionCount: project.questions.length,
    answerCount: project.cases.length,
    missingAnswerIds,
    reviewed: reviewedCases.length,
    unreviewed,
    passes: passes.length,
    errors: errors.length,
    critical,
    major,
    minor,
    holds: holds.length,
    unsettled: unsettled.length,
    passRate: denominator === 0 ? null : passes.length / denominator,
    decision,
    publicDefects,
    holdoutTotal: holdoutCases.length,
    holdoutErrors,
    holdoutReviewed,
    machineHits: project.cases.filter((item) =>
      item.findings.some((finding) => finding.kind === "hit"),
    ).length,
  };
}
