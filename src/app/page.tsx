import Link from "next/link";
import { restoreDemoAction } from "@/lib/actions";
import { DecisionStamp } from "@/components/decision-stamp";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatWhen, shortHash } from "@/lib/format";
import { collectionLabel, decisionLabel, documentTitle } from "@/lib/labels";
import { auditChainCached as auditChain } from "@/lib/project";
import { summarizeCached as summarize } from "@/lib/summary";
import { readStore } from "@/lib/store";

const steps = [
  ["기준", "발주처 문서와 합격 규칙"],
  ["질문셋", "참고 답변, 필수·금지 표현"],
  ["답변 파일", "해시가 체인의 시작"],
  ["자동 검사", "규칙에 걸림은 결론이 아님"],
  ["사람 판정", "정상, 오류, 보류, 기준 불명"],
  ["확인서", "중대 오류와 최종 해시"],
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const projects = readStore().projects;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 py-10">
      {error ? <p className="text-sm text-destructive">{error.slice(0, 200)}</p> : null}
      <section className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr] lg:items-end">
        <div>
          <p className="text-sm text-muted-foreground">발주처를 위한 AI 챗봇 납품 검수</p>
          <h1 className="mt-2 max-w-xl font-serif text-4xl leading-tight tracking-tight">
            받은 챗봇이 기준대로 답하는지, 기록으로 남깁니다.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-6 text-muted-foreground">
            질문셋으로 답을 대조하고 사람이 판정합니다. 확인서에는 중대 오류 건수, 사람 판정 수, 미검토 수, 답변을 모은 주체, 최종 해시가 들어갑니다. 사람이 보지 않은 문항은 통과가 아닙니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/projects/new" className={cn(buttonVariants({ size: "lg" }))}>
              새 검수
            </Link>
            <form action={restoreDemoAction}>
              <Button type="submit" size="lg" variant="outline">
                한빛커머스 예시 열기
              </Button>
            </form>
          </div>
        </div>
        <ol className="grid grid-cols-2 gap-3 text-sm">
          {steps.map(([title, body], index) => (
            <li key={title} className="border-t border-border pt-2">
              <span className="font-mono text-xs text-muted-foreground">0{index + 1}</span>
              <span className="mt-1 block font-medium">{title}</span>
              <span className="mt-1 block text-muted-foreground">{body}</span>
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="font-serif text-2xl">검수 목록</h2>
          <p className="text-sm text-muted-foreground">{projects.length}건</p>
        </div>
        {projects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-5 py-12">
            <p className="font-medium">아직 검수가 없습니다.</p>
            <p className="mt-2 max-w-lg text-sm text-muted-foreground">
              한빛커머스 상담 챗봇 예시에는 환불 금액 오류, 없는 보상, 주민번호 출력, 비공개 홀드아웃, 아직 안 본 문항이 들어 있습니다. 빈 검수에서 CSV부터 시작해도 됩니다.
            </p>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-xl border border-border bg-card">
            {projects.map((project) => {
              const summary = summarize(project);
              const chain = auditChain(project);
              const href =
                summary.unreviewed > 0 || project.cases.length === 0
                  ? `/projects/${project.id}?tab=${project.cases.length === 0 ? "questions" : "review"}`
                  : `/projects/${project.id}?tab=certificate`;
              return (
                <li key={project.id} className="border-b border-border last:border-b-0">
                  <Link href={href} className="grid gap-3 px-4 py-4 hover:bg-secondary/60 sm:grid-cols-[1fr_auto] sm:items-center">
                    <div>
                      <div className="flex flex-wrap items-baseline gap-2">
                        <span className="font-medium">{project.name}</span>
                        <span className="text-sm text-muted-foreground">{project.client}</span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {documentTitle(project.docKind)} · {collectionLabel(project.collectionParty)} · {project.chatbotName} {project.chatbotVersion}
                      </p>
                      <p className="mt-2 text-sm">
                        {decisionLabel(summary.decision)} · 중대 {summary.critical} · 미검토 {summary.unreviewed} · 판정 {summary.reviewed}/{summary.questionCount}
                      </p>
                      <p className="mt-1 font-mono text-xs text-muted-foreground">
                        {chain.liveHash ? shortHash(chain.liveHash) : "해시 없음"} · {formatWhen(project.createdAt)}
                        {chain.ok ? "" : " · 체인 깨짐"}
                      </p>
                    </div>
                    <DecisionStamp decision={summary.decision} />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
