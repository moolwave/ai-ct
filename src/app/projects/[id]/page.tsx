import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteProjectAction } from "@/lib/actions";
import { AnswersTab } from "@/components/answers-tab";
import { CertificateView } from "@/components/certificate-view";
import { QuestionsTab } from "@/components/questions-tab";
import { ReviewBench, type ReviewItem } from "@/components/review-bench";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { collectionLabel, documentTitle } from "@/lib/labels";
import { auditChainCached as auditChain } from "@/lib/project";
import { summarizeCached as summarize } from "@/lib/summary";
import { findProject, readStore } from "@/lib/store";
import { cn } from "@/lib/utils";

const tabs = [
  ["questions", "질문셋"],
  ["answers", "답변"],
  ["review", "판정"],
  ["certificate", "확인서"],
] as const;

export default async function ProjectPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; error?: string }>;
}) {
  const { id } = await params;
  const { tab = "questions", error } = await searchParams;
  const project = findProject(readStore(), id);
  if (!project) notFound();
  const summary = summarize(project);
  const chain = auditChain(project);
  const active = tabs.some((item) => item[0] === tab) ? tab : "questions";
  // 답변마다 질문 배열을 다시 훑지 않도록 한 번만 Map으로 만듭니다.
  const questionById = new Map(project.questions.map((question) => [question.id, question]));
  const items: ReviewItem[] = project.cases.flatMap((item) => {
    const question = questionById.get(item.questionId);
    if (!question) return [];
    return [
      {
        caseId: item.id,
        questionId: item.questionId,
        domain: question.domain,
        holdout: question.holdout,
        criticalDomain: question.criticalDomain,
        question: question.text,
        referenceAnswer: question.referenceAnswer,
        sourceNote: question.sourceNote,
        answer: item.answer,
        findings: item.findings,
        humanVerdict: item.humanVerdict,
        severity: item.severity,
        note: item.note,
        recommendation: item.recommendation,
        reviewedAt: item.reviewedAt,
      },
    ];
  });

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">
            {project.client} · {documentTitle(project.docKind)} · {collectionLabel(project.collectionParty)}
          </p>
          <h1 className="mt-1 font-serif text-3xl tracking-tight">{project.name}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {project.chatbotName || "챗봇 이름 없음"} {project.chatbotVersion} · 검수자 {project.reviewer} · 중대 {summary.critical} · 미검토 {summary.unreviewed}
          </p>
        </div>
        <details className="text-sm">
          <summary className="cursor-pointer text-muted-foreground">검수 삭제</summary>
          <form action={deleteProjectAction} className="mt-2 flex w-64 flex-col gap-2">
            <input type="hidden" name="projectId" value={project.id} />
            <label className="text-xs text-muted-foreground" htmlFor="confirmName">
              지우려면 검수 이름을 똑같이 입력하세요. 되돌릴 수 없습니다.
            </label>
            <Input id="confirmName" name="confirmName" placeholder={project.name} autoComplete="off" required />
            <Button type="submit" variant="destructive" size="sm">
              이 검수와 확인서 해시를 지움
            </Button>
          </form>
        </details>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <nav className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map(([key, label]) => (
          <Link
            key={key}
            href={`/projects/${project.id}?tab=${key}`}
            className={cn(
              "shrink-0 border-b-2 px-3 py-2 text-sm",
              active === key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
            )}
          >
            {label}
            {key === "review" && summary.unreviewed > 0 ? ` ${summary.unreviewed}` : ""}
          </Link>
        ))}
      </nav>

      {active === "questions" ? (
        <QuestionsTab projectId={project.id} questions={project.questions} locked={Boolean(project.batch)} />
      ) : null}
      {active === "answers" ? (
        <AnswersTab
          projectId={project.id}
          batch={project.batch}
          questionCount={project.questions.length}
          machineHits={summary.machineHits}
          needsConfirm={project.events.length > 0 || project.reports.length > 0}
          missingAnswerIds={summary.missingAnswerIds}
        />
      ) : null}
      {active === "review" ? <ReviewBench projectId={project.id} items={items} /> : null}
      {active === "certificate" ? (
        <CertificateView project={project} summary={summary} chain={chain} />
      ) : null}
    </main>
  );
}
