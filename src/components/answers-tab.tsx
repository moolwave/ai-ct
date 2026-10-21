"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importAnswersAction } from "@/lib/actions";
import { formatWhen, shortHash } from "@/lib/format";
import { RULE_VERSION } from "@/lib/rules";
import type { ImportBatch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function AnswersTab({
  projectId,
  batch,
  questionCount,
  machineHits,
  needsConfirm,
}: {
  projectId: string;
  batch: ImportBatch | null;
  questionCount: number;
  machineHits: number;
  needsConfirm: boolean;
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("answers.csv");
  const [confirm, setConfirm] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="font-serif text-2xl">답변 파일</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          납품 챗봇에 질문셋을 돌린 결과를 CSV로 받습니다. 가져오는 즉시 규칙 검사를 하고, 파일 해시가 판정 체인의 시작점이 됩니다.
        </p>
      </div>

      {questionCount === 0 ? (
        <div className="rounded-xl border border-dashed border-border px-5 py-10">
          <p className="font-medium">질문셋이 아직 없습니다.</p>
          <p className="mt-1 text-sm text-muted-foreground">질문셋 탭에서 문항을 먼저 넣으세요.</p>
        </div>
      ) : null}

      {batch ? (
        <dl className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted-foreground">파일</dt>
            <dd className="mt-1 text-sm">{batch.filename}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">SHA-256</dt>
            <dd className="mt-1 font-mono text-xs" title={batch.sha256}>
              {shortHash(batch.sha256)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">행 · 규칙</dt>
            <dd className="mt-1 text-sm">
              {batch.rowCount}행 · {batch.ruleVersion}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">가져온 시각</dt>
            <dd className="mt-1 text-sm">{formatWhen(batch.importedAt)}</dd>
          </div>
          <div className="sm:col-span-4 text-sm">
            규칙에 걸린 문항 {machineHits}개. 걸린 것은 오류 확정이 아닙니다.
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">아직 가져온 답변이 없습니다. 규칙 버전 {RULE_VERSION}.</p>
      )}

      <section className="rounded-xl border border-border bg-card p-4">
        <h3 className="font-medium">CSV 가져오기</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          열 이름: question_id, answer. 쉼표가 있는 답은 큰따옴표로 감쌉니다.{" "}
          <a className="underline" href="/samples/hanbit-answers.csv">
            한빛커머스 예시 답변
          </a>
        </p>
        <Textarea
          className="mt-3 min-h-40 font-mono text-xs"
          value={csv}
          onChange={(event) => setCsv(event.target.value)}
          placeholder={"question_id,answer\nQ-01,\"상품 수령 후 7일 이내입니다.\""}
          disabled={questionCount === 0}
        />
        <input
          className="mt-3 block text-sm"
          type="file"
          accept=".csv,text/csv,text/plain"
          disabled={questionCount === 0}
          onChange={async (event) => {
            const file = event.target.files?.[0];
            if (!file) return;
            setFilename(file.name);
            setCsv(await file.text());
          }}
        />
        {needsConfirm ? (
          <label className="mt-3 flex items-start gap-2 text-sm">
            <input
              className="mt-1"
              type="checkbox"
              checked={confirm}
              onChange={(event) => setConfirm(event.target.checked)}
            />
            <span>판정 이력과 확정된 확인서 해시를 지우고, 이 파일로 다시 시작합니다.</span>
          </label>
        ) : null}
        {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
        {warnings.length > 0 ? (
          <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
            {warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        ) : null}
        <Button
          className="mt-3"
          type="button"
          disabled={pending || questionCount === 0 || csv.trim() === "" || (needsConfirm && !confirm)}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await importAnswersAction(projectId, filename, csv, confirm || !needsConfirm);
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              setWarnings(result.warnings ?? []);
              setCsv("");
              setConfirm(false);
              router.refresh();
            });
          }}
        >
          가져오고 자동 검사
        </Button>
      </section>
    </div>
  );
}
