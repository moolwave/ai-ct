import Link from "next/link";
import { CopyHash } from "@/components/copy-hash";
import { DecisionStamp } from "@/components/decision-stamp";
import { IssueBar } from "@/components/issue-bar";
import { formatPercent, formatWhen } from "@/lib/format";
import {
  CERTIFICATE_LIMITS,
  collectionCaveat,
  collectionLabel,
  decisionLabel,
  decisionNote,
  documentCaution,
  documentTitle,
  severityLabel,
} from "@/lib/labels";
import type { ChainAudit, Project, Summary } from "@/lib/types";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "cn";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export function CertificateView({
  project,
  summary,
  chain,
  printable,
}: {
  project: Project;
  summary: Summary;
  chain: ChainAudit;
  printable?: boolean;
}) {
  const latest = project.reports.at(-1) ?? null;
  const aligned = Boolean(latest && chain.ok && latest.finalHash === chain.liveHash);
  const holdoutCaseIds = new Set(
    project.questions.filter((question) => question.holdout).map((question) => `case_${question.id}`),
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-serif text-2xl">확인서</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            결재용 한 장과, 납품사에게 줄 수정 목록입니다. 홀드아웃 문항 본문은 목록에 넣지 않습니다.
          </p>
        </div>
        {printable ? null : (
          <Link
            href={`/projects/${project.id}/certificate`}
            className={cn(buttonVariants({ variant: "outline" }))}
          >
            인쇄용 보기
          </Link>
        )}
      </div>

      <article className="certificate-sheet rounded-xl border border-border bg-card px-5 py-8 sm:px-10">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-xs tracking-[0.18em] text-muted-foreground">ai ct</p>
            <h1 className="mt-2 font-serif text-3xl tracking-tight">{documentTitle(project.docKind)}</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">{documentCaution(project.docKind)}</p>
          </div>
          <DecisionStamp decision={summary.decision} />
        </div>

        <p className="mt-6 text-sm">{decisionNote(summary.decision, summary.critical)}</p>

        <dl className="mt-8 grid gap-x-6 gap-y-4 border-y border-border py-5 sm:grid-cols-2">
          <Meta label="발주처" value={project.client} />
          <Meta label="검수" value={project.name} />
          <Meta label="챗봇" value={`${project.chatbotName || "미기재"} ${project.chatbotVersion}`} />
          <Meta label="검수자" value={`${project.reviewer} · 단일 검수자`} />
          <Meta label="수집 주체" value={collectionLabel(project.collectionParty)} />
          <Meta label="규칙 버전" value={project.batch?.ruleVersion ?? "답변 파일 없음"} />
          <Meta
            label="답변 파일"
            value={project.batch ? `${project.batch.filename} · ${project.batch.rowCount}행` : "없음"}
          />
          <Meta label="파일 해시" value={project.batch?.sha256 ?? ""} hash />
        </dl>

        <p className="mt-4 text-sm text-muted-foreground">{collectionCaveat(project.collectionParty)}</p>

        <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat value={String(summary.critical)} label="중대 오류" tone={summary.critical > 0 ? "stop" : "plain"} />
          <Stat value={`${summary.reviewed}/${summary.questionCount}`} label="사람 판정" />
          <Stat value={String(summary.unreviewed + summary.missingAnswerIds.length)} label="미검토·답변 없음" />
          <Stat value={`${summary.holds}/${summary.unsettled}`} label="보류 / 기준 불명" />
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          참고 통과율 {formatPercent(summary.passRate)}. 정상만 분자로 두고, 분모는 정상과 오류입니다. 보류, 기준 불명, 미검토는 통과율에 넣지 않습니다. 규칙에 걸린 문항은 {summary.machineHits}개입니다.
        </p>

        <h2 className="mt-8 font-serif text-xl">수정 목록</h2>
        <p className="mt-1 text-sm text-muted-foreground">사람이 오류로 확정한 공개 문항입니다.</p>
        {summary.publicDefects.length === 0 ? (
          <p className="mt-3 text-sm">공개 문항에 확정된 오류가 없습니다.</p>
        ) : (
          <Table className="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>문항</TableHead>
                <TableHead>심각도</TableHead>
                <TableHead>답변</TableHead>
                <TableHead>수정 권고</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.publicDefects.map((defect) => (
                <TableRow key={defect.questionId}>
                  <TableCell className="align-top">
                    <span className="font-mono text-xs">{defect.questionId}</span>
                    <span className="mt-1 block">{defect.domain}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">{defect.sourceNote}</span>
                  </TableCell>
                  <TableCell className="align-top">{severityLabel(defect.severity)}</TableCell>
                  <TableCell className="align-top">{defect.answerExcerpt}</TableCell>
                  <TableCell className="align-top">
                    {defect.recommendation || "권고 없음"}
                    {defect.findingSummaries.length > 0 ? (
                      <span className="mt-2 block text-xs text-muted-foreground">
                        {defect.findingSummaries.join(" / ")}
                      </span>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        <div className="mt-6 rounded-lg border border-border px-4 py-3 text-sm">
          <p className="font-medium">홀드아웃</p>
          <p className="mt-1 text-muted-foreground">
            {summary.holdoutTotal}문항 중 사람 판정 {summary.holdoutReviewed}건, 오류 {summary.holdoutErrors}건.
            문항과 답변 본문은 수정 목록에 넣지 않습니다.
          </p>
        </div>

        <h2 className="mt-8 font-serif text-xl">한계</h2>
        <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground">
          {CERTIFICATE_LIMITS.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        <div className="mt-8 border-t border-border pt-4">
          <p className="text-xs text-muted-foreground">현재 판정 체인 해시</p>
          <div className="mt-1">
            <CopyHash value={chain.liveHash} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {chain.ok
              ? "파일 해시부터 판정 이벤트까지 다시 계산한 결과가 저장값과 같습니다."
              : `체인이 깨졌습니다. 깨진 지점: ${chain.brokenAt ?? "알 수 없음"}`}
          </p>
          <p className="mt-3 text-sm">
            {aligned
              ? `마지막 확정(${formatWhen(latest!.issuedAt)})과 현재 판정이 같습니다.`
              : latest
                ? `마지막 확정(${formatWhen(latest.issuedAt)}, ${decisionLabel(latest.decision)}) 이후 판정이 바뀌었습니다. 보내기 전에 다시 확정하세요.`
                : "아직 확정된 확인서가 없습니다. 아래 버튼이 지금 판정의 해시를 남깁니다."}
          </p>
        </div>

        {project.reports.length > 0 ? (
          <div className="mt-6">
            <h2 className="font-serif text-xl">확정 이력</h2>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {project.reports.map((report) => (
                <li key={report.id} className="flex flex-col gap-1 border-b border-border py-2">
                  <span>
                    {formatWhen(report.issuedAt)} · {decisionLabel(report.decision)} · 중대 {report.critical} · 미검토 {report.unreviewed}
                  </span>
                  <CopyHash value={report.finalHash} />
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <details className="mt-6 text-sm">
          <summary className="cursor-pointer text-muted-foreground">판정 해시 체인 {project.events.length}건</summary>
          <ol className="mt-3 flex flex-col gap-2">
            {project.events.map((event, index) => (
              <li
                key={holdoutCaseIds.has(event.payload.caseId) ? event.eventHash : event.id}
                className="font-mono text-xs"
              >
                {index + 1}. {event.payload.reason} ·{" "}
                {holdoutCaseIds.has(event.payload.caseId) ? "비공개 홀드아웃" : event.payload.caseId} ·{" "}
                {event.eventHash.slice(0, 16)}
              </li>
            ))}
          </ol>
        </details>
      </article>

      <IssueBar projectId={project.id} canIssue={Boolean(project.batch) && project.cases.length > 0} aligned={aligned} />
      <p className="no-print text-sm">
        <Link className="underline" href={`/verify?project=${project.id}`}>
          해시 검증 화면에서 이 검수를 대조
        </Link>
      </p>
    </div>
  );
}

function Meta({ label, value, hash }: { label: string; value: string; hash?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-sm break-all">{hash ? <CopyHash value={value} /> : value || "—"}</dd>
    </div>
  );
}

function Stat({
  value,
  label,
  tone = "plain",
}: {
  value: string;
  label: string;
  tone?: "plain" | "stop";
}) {
  return (
    <div>
      <p className={tone === "stop" ? "font-serif text-3xl text-destructive" : "font-serif text-3xl"}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
