"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveVerdictAction } from "@/lib/actions";
import { verdictLabel } from "@/lib/labels";
import { hasMachineHit } from "@/lib/rules";
import type { HumanVerdict, Severity } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export type ReviewItem = {
  caseId: string;
  questionId: string;
  domain: string;
  holdout: boolean;
  criticalDomain: boolean;
  question: string;
  referenceAnswer: string;
  sourceNote: string;
  answer: string;
  findings: Array<{
    ruleId: string;
    kind: "hit" | "info";
    summary: string;
    evidence: string;
  }>;
  humanVerdict: HumanVerdict | null;
  severity: Severity | null;
  note: string;
  recommendation: string;
  reviewedAt: string | null;
};

type Filter = "open" | "hit" | "critical" | "all";

const filters: Array<{ id: Filter; label: string }> = [
  { id: "open", label: "미판정" },
  { id: "hit", label: "규칙에 걸림" },
  { id: "critical", label: "중대 도메인" },
  { id: "all", label: "전체" },
];

// 필터 목록과 개수 배지가 같은 기준을 쓰도록 한 곳에 둡니다(예전에는 두 군데에 복사돼 있었음).
function matches(filter: Filter, item: ReviewItem): boolean {
  if (filter === "open") return !item.humanVerdict;
  if (filter === "hit") return hasMachineHit(item.findings);
  if (filter === "critical") return item.criticalDomain;
  return true;
}

export function ReviewBench({
  projectId,
  items,
}: {
  projectId: string;
  items: ReviewItem[];
}) {
  const [filter, setFilter] = useState<Filter>(items.some((item) => !item.humanVerdict) ? "open" : "all");
  const visible = useMemo(
    () => items.filter((item) => matches(filter, item)).sort((a, b) => rank(a) - rank(b)),
    [filter, items],
  );
  // 배지 숫자는 items가 바뀔 때만 다시 셉니다. 예전에는 입력할 때마다 필터 4개 × 전체 문항을 다시 셌습니다.
  const counts = useMemo(
    () => Object.fromEntries(filters.map((item) => [item.id, items.filter((row) => matches(item.id, row)).length])) as Record<Filter, number>,
    [items],
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-serif text-2xl">사람 판정</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          규칙에 걸림은 순서를 정하는 신호입니다. 확인서의 결론은 여기서 고른 판정만 사용합니다. 자동 검사에 안 걸린 문항도 통과가 되려면 사람이 정상으로 적어야 합니다.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {filters.map((item) => (
          <Button
            key={item.id}
            type="button"
            size="sm"
            variant={filter === item.id ? "default" : "outline"}
            onClick={() => setFilter(item.id)}
          >
            {item.label}
            <span className="text-xs opacity-70">{counts[item.id]}</span>
          </Button>
        ))}
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10">
          <p className="font-medium">판정할 답변이 없습니다.</p>
          <p className="mt-1 text-sm text-muted-foreground">답변 탭에서 CSV를 가져오면 이 작업대가 채워집니다.</p>
        </div>
      ) : null}
      {items.length > 0 && visible.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-8 text-sm text-muted-foreground">
          이 필터에 해당하는 문항이 없습니다.
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        {visible.map((item) => (
          <CaseCard key={`${item.caseId}-${item.reviewedAt ?? "new"}`} projectId={projectId} item={item} />
        ))}
      </div>
    </div>
  );
}

function rank(item: ReviewItem): number {
  const open = item.humanVerdict ? 1 : 0;
  const hit = hasMachineHit(item.findings) ? 0 : 1;
  const critical = item.criticalDomain ? 0 : 1;
  return open * 4 + hit * 2 + critical;
}

function CaseCard({ projectId, item }: { projectId: string; item: ReviewItem }) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<HumanVerdict | null>(item.humanVerdict);
  const [severity, setSeverity] = useState<Severity | "">(item.severity ?? "");
  const [note, setNote] = useState(item.note);
  const [recommendation, setRecommendation] = useState(item.recommendation);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const hits = item.findings.filter((finding) => finding.kind === "hit");
  const info = item.findings.filter((finding) => finding.kind === "info");

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="font-mono text-xs text-muted-foreground">{item.questionId}</span>
          <h3 className="font-medium">{item.domain}</h3>
          {item.holdout ? <span className="text-xs text-muted-foreground">홀드아웃</span> : null}
          {item.criticalDomain ? <span className="text-xs text-destructive">중대 도메인</span> : null}
        </div>
        <span className="text-sm">{verdictLabel(item.humanVerdict)}</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div>
          <p className="text-xs text-muted-foreground">질문</p>
          <p className="mt-1 text-sm">{item.question}</p>
          <p className="mt-3 text-xs text-muted-foreground">참고 답변 · 자동 일치하지 않음</p>
          <p className="mt-1 text-sm">{item.referenceAnswer || "없음"}</p>
          <p className="mt-3 text-xs text-muted-foreground">근거</p>
          <p className="mt-1 text-sm">{item.sourceNote || "없음"}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">챗봇 답변</p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{item.answer}</p>
          {hits.length > 0 ? (
            <ul className="mt-3 flex flex-col gap-2">
              {hits.map((finding, index) => (
                <li key={`${finding.ruleId}-${index}`} className="rounded-lg bg-secondary px-3 py-2 text-sm">
                  <span className="block text-xs text-muted-foreground">규칙에 걸림 · {finding.ruleId}</span>
                  {finding.summary}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">자동 검사에는 걸리지 않았습니다. 이것만으로 통과는 아닙니다.</p>
          )}
          {info.map((finding, index) => (
            <p key={`${finding.ruleId}-${index}`} className="mt-2 text-sm text-pending">
              {finding.summary}
            </p>
          ))}
        </div>
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            setMessage(null);
            start(async () => {
              const result = await saveVerdictAction(projectId, item.caseId, {
                humanVerdict: verdict ?? "",
                severity: verdict === "error" ? severity : "",
                note,
                recommendation,
              });
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            {(["pass", "error", "hold", "unsettled"] as HumanVerdict[]).map((value) => (
              <Button
                key={value}
                type="button"
                variant={verdict === value ? "default" : "outline"}
                onClick={() => setVerdict(value)}
              >
                {verdictLabel(value)}
              </Button>
            ))}
          </div>
          {verdict === "error" ? (
            <label className="flex flex-col gap-1 text-sm">
              심각도
              <select
                className="h-9 rounded-lg border border-input bg-card px-2.5"
                value={severity}
                onChange={(event) => setSeverity(event.target.value as Severity)}
                required
              >
                <option value="">선택</option>
                <option value="critical">중대</option>
                <option value="major">주요</option>
                <option value="minor">경미</option>
              </select>
            </label>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            판정 근거
            <Textarea value={note} onChange={(event) => setNote(event.target.value)} className="min-h-20" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            수정 권고
            <Textarea
              value={recommendation}
              onChange={(event) => setRecommendation(event.target.value)}
              className="min-h-16"
            />
          </label>
          {item.holdout ? (
            <p className="text-xs text-muted-foreground">이 문항 본문은 납품사용 수정 목록에 실리지 않습니다.</p>
          ) : null}
          {message ? <p className="text-sm text-destructive">{message}</p> : null}
          <Button type="submit" disabled={pending || !verdict} className={cn(pending && "opacity-70")}>
            판정 저장
          </Button>
        </form>
      </div>
    </article>
  );
}
