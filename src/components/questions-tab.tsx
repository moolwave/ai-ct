"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addQuestionAction, importQuestionsAction, loadSampleQuestionsAction } from "@/lib/actions";
import type { Question } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function QuestionsTab({
  projectId,
  questions,
  locked,
}: {
  projectId: string;
  questions: Question[];
  locked: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [csv, setCsv] = useState("");

  function run(work: () => Promise<{ ok: boolean; message?: string; warnings?: string[] }>) {
    setMessage(null);
    start(async () => {
      const result = await work();
      if (!result.ok) {
        setMessage(result.message ?? "처리하지 못했습니다.");
        return;
      }
      setWarnings(result.warnings ?? []);
      setCsv("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-serif text-2xl">질문셋</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            기대 답변은 사람이 옆에 두는 참고문입니다. 자동 검사는 필수 표현, 금지 표현, 금액·날짜 슬롯, 개인정보 형식만 봅니다.
          </p>
        </div>
        <form action={loadSampleQuestionsAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <Button type="submit" variant="outline" disabled={locked || questions.length > 0}>
            상담 예시 12문항
          </Button>
        </form>
      </div>

      {message ? <p className="text-sm text-destructive">{message}</p> : null}
      {warnings.length > 0 ? (
        <ul className="list-disc pl-5 text-sm text-muted-foreground">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10">
          <p className="font-medium">아직 문항이 없습니다.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            상담 예시 12문항을 넣거나, CSV를 가져오세요. 예시 답변 파일은{" "}
            <a className="underline" href="/samples/hanbit-answers.csv">
              hanbit-answers.csv
            </a>
            입니다.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {questions.map((question) => (
            <details key={question.id} className="border-b border-border px-4 py-3 last:border-b-0">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{question.id}</span>
                    <span className="font-medium">{question.domain}</span>
                    {question.holdout ? (
                      <span className="text-xs text-muted-foreground">납품사 비공개</span>
                    ) : null}
                    {question.criticalDomain ? (
                      <span className="text-xs text-destructive">중대 도메인</span>
                    ) : null}
                    {question.sourceConflict ? (
                      <span className="text-xs text-pending">기준 충돌</span>
                    ) : null}
                  </div>
                </div>
                <p className="mt-1 text-sm">{question.text}</p>
              </summary>
              <div className="mt-3 grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                <p>
                  <span className="block text-xs text-foreground">참고 답변</span>
                  {question.referenceAnswer || "없음"}
                </p>
                <p>
                  <span className="block text-xs text-foreground">근거</span>
                  {question.sourceNote || "없음"}
                </p>
                <p>
                  <span className="block text-xs text-foreground">필수 표현</span>
                  {question.mustInclude.join(" · ") || "없음"}
                </p>
                <p>
                  <span className="block text-xs text-foreground">금지 표현</span>
                  {question.mustNotInclude.join(" · ") || "없음"}
                </p>
                {question.slotType !== "none" ? (
                  <p>
                    <span className="block text-xs text-foreground">슬롯</span>
                    {question.slotType} {question.slotValue}
                  </p>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-border bg-card p-4">
          <h3 className="font-medium">CSV로 넣기</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            열: id, question, reference_answer, source_note, source_conflict, must_include, must_not_include, slot_type, slot_value, domain, holdout, critical_domain.
            표현이 여러 개면 | 로 나눕니다.{" "}
            <a className="underline" href="/samples/hanbit-questions.csv">
              예시 파일
            </a>
          </p>
          <Textarea
            className="mt-3 min-h-36 font-mono text-xs"
            value={csv}
            onChange={(event) => setCsv(event.target.value)}
            placeholder="id,question,reference_answer,..."
            disabled={locked}
          />
          <input
            className="mt-3 block text-sm"
            type="file"
            accept=".csv,text/csv,text/plain"
            disabled={locked}
            onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              setCsv(await file.text());
            }}
          />
          <Button
            className="mt-3"
            type="button"
            disabled={locked || pending || csv.trim() === ""}
            onClick={() => run(() => importQuestionsAction(projectId, csv))}
          >
            질문셋 가져오기
          </Button>
          {locked ? (
            <p className="mt-2 text-xs text-muted-foreground">
              답변 파일을 가져온 뒤에는 질문셋을 통째로 바꾸지 않습니다.
            </p>
          ) : (
            <p className="mt-2 text-xs text-muted-foreground">가져오면 지금 질문셋을 이 파일로 바꿉니다.</p>
          )}
        </section>

        <QuestionForm
          disabled={pending}
          onSubmit={(input) => run(() => addQuestionAction(projectId, input))}
        />
      </div>
    </div>
  );
}

function QuestionForm({
  disabled,
  onSubmit,
}: {
  disabled: boolean;
  onSubmit: (input: {
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
  }) => void;
}) {
  const [slotType, setSlotType] = useState("none");
  return (
    <form
      className="rounded-xl border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        onSubmit({
          id: String(form.get("id") ?? ""),
          text: String(form.get("text") ?? ""),
          referenceAnswer: String(form.get("referenceAnswer") ?? ""),
          sourceNote: String(form.get("sourceNote") ?? ""),
          sourceConflict: form.get("sourceConflict") === "on",
          mustInclude: String(form.get("mustInclude") ?? ""),
          mustNotInclude: String(form.get("mustNotInclude") ?? ""),
          slotType,
          slotValue: String(form.get("slotValue") ?? ""),
          domain: String(form.get("domain") ?? ""),
          holdout: form.get("holdout") === "on",
          criticalDomain: form.get("criticalDomain") === "on",
        });
        event.currentTarget.reset();
        setSlotType("none");
      }}
    >
      <h3 className="font-medium">문항 하나 추가</h3>
      <div className="mt-3 grid gap-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="qid">문항 id</Label>
            <Input id="qid" name="id" placeholder="Q-13" required />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="domain">도메인</Label>
            <Input id="domain" name="domain" placeholder="환불 금액" />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="qtext">질문</Label>
          <Textarea id="qtext" name="text" required className="min-h-20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reference">참고 답변</Label>
          <Textarea id="reference" name="referenceAnswer" className="min-h-20" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="source">근거 문서</Label>
          <Input id="source" name="sourceNote" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="must">필수 표현</Label>
            <Input id="must" name="mustInclude" placeholder="7일|주문번호" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mustnot">금지 표현</Label>
            <Input id="mustnot" name="mustNotInclude" placeholder="200%|왕복 배송비" />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slot">슬롯</Label>
            <select
              id="slot"
              className="h-9 rounded-lg border border-input bg-card px-2.5 text-sm"
              value={slotType}
              onChange={(event) => setSlotType(event.target.value)}
            >
              <option value="none">없음</option>
              <option value="amount">금액</option>
              <option value="date">날짜·기간</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="slotValue">슬롯 값</Label>
            <Input id="slotValue" name="slotValue" placeholder="30000" />
          </div>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <label className="flex gap-2">
            <input type="checkbox" name="criticalDomain" /> 중대 도메인
          </label>
          <label className="flex gap-2">
            <input type="checkbox" name="holdout" /> 홀드아웃 (수정 목록에 본문을 넣지 않음)
          </label>
          <label className="flex gap-2">
            <input type="checkbox" name="sourceConflict" /> 근거 문서가 서로 다름
          </label>
        </div>
        <Button type="submit" disabled={disabled}>
          문항 추가
        </Button>
      </div>
    </form>
  );
}
