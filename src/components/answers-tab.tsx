"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { importAnswersAction, importSupplementAction, type ActionResult } from "@/lib/actions";
import { formatWhen, shortHash } from "@/lib/format";
import { RULE_VERSION } from "@/lib/rules";
import type { ImportBatch } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

// 서버 한도(500KB)와 같습니다. 큰 파일을 통째로 메모리에 읽기 전에 막습니다.
const MAX_FILE_BYTES = 500_000;

export function AnswersTab({
  projectId,
  batch,
  questionCount,
  machineHits,
  needsConfirm,
  missingAnswerIds,
}: {
  projectId: string;
  batch: ImportBatch | null;
  questionCount: number;
  machineHits: number;
  needsConfirm: boolean;
  missingAnswerIds: string[];
}) {
  const [confirm, setConfirm] = useState(false);

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

      {batch && missingAnswerIds.length > 0 ? (
        <CsvImport
          title="빠진 문항 답변 추가"
          description={`답변이 없는 문항 ${missingAnswerIds.length}개(${missingAnswerIds.slice(0, 5).join(", ")}${
            missingAnswerIds.length > 5 ? " 외" : ""
          })의 답만 붙입니다. 기존 판정 이력은 그대로 두고, 이 파일의 해시를 체인에 이벤트로 남깁니다.`}
          buttonLabel="추가 답변 가져오기"
          disabled={false}
          submit={(filename, csv) => importSupplementAction(projectId, filename, csv)}
        />
      ) : null}

      <CsvImport
        title={batch ? "답변 파일 바꾸기" : "CSV 가져오기"}
        description="열 이름: question_id, answer. 쉼표가 있는 답은 큰따옴표로 감쌉니다."
        sampleHref="/samples/hanbit-answers.csv"
        buttonLabel="가져오고 자동 검사"
        disabled={questionCount === 0 || (needsConfirm && !confirm)}
        inputDisabled={questionCount === 0}
        extra={
          needsConfirm ? (
            <label className="mt-3 flex items-start gap-2 text-sm">
              <input
                className="mt-1"
                type="checkbox"
                checked={confirm}
                onChange={(event) => setConfirm(event.target.checked)}
              />
              <span>판정 이력과 확정된 확인서 해시를 지우고, 이 파일로 다시 시작합니다.</span>
            </label>
          ) : null
        }
        submit={async (filename, csv) => {
          const result = await importAnswersAction(projectId, filename, csv, confirm || !needsConfirm);
          if (result.ok) setConfirm(false);
          return result;
        }}
      />
    </div>
  );
}

function CsvImport({
  title,
  description,
  sampleHref,
  buttonLabel,
  disabled,
  inputDisabled = false,
  extra,
  submit,
}: {
  title: string;
  description: string;
  sampleHref?: string;
  buttonLabel: string;
  disabled: boolean;
  inputDisabled?: boolean;
  extra?: React.ReactNode;
  submit: (filename: string, csv: string) => Promise<ActionResult>;
}) {
  const router = useRouter();
  const [csv, setCsv] = useState("");
  const [filename, setFilename] = useState("answers.csv");
  const [message, setMessage] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [pending, start] = useTransition();

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-medium">{title}</h3>
      <p className="mt-1 text-xs text-muted-foreground">
        {description}{" "}
        {sampleHref ? (
          <a className="underline" href={sampleHref}>
            한빛커머스 예시 답변
          </a>
        ) : null}
      </p>
      <Textarea
        className="mt-3 min-h-40 font-mono text-xs"
        value={csv}
        onChange={(event) => setCsv(event.target.value)}
        placeholder={"question_id,answer\nQ-01,\"상품 수령 후 7일 이내입니다.\""}
        disabled={inputDisabled}
      />
      <input
        key={fileKey}
        className="mt-3 block text-sm"
        type="file"
        accept=".csv,text/csv,text/plain"
        disabled={inputDisabled}
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          if (file.size > MAX_FILE_BYTES) {
            setMessage(`파일이 큽니다(${Math.round(file.size / 1000)}KB). 500KB 이하의 CSV만 가져옵니다.`);
            setFileKey((key) => key + 1);
            return;
          }
          setMessage(null);
          setFilename(file.name);
          try {
            setCsv(await file.text());
          } catch {
            setMessage("파일을 읽지 못했습니다. UTF-8 CSV인지 확인하세요.");
          }
        }}
      />
      {extra}
      {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
      {warnings.length > 0 ? (
        <ul className="mt-3 list-disc pl-5 text-sm text-muted-foreground">
          {warnings.map((warning, index) => (
            <li key={`${index}-${warning}`}>{warning}</li>
          ))}
        </ul>
      ) : null}
      <Button
        className="mt-3"
        type="button"
        disabled={pending || disabled || csv.trim() === ""}
        onClick={() => {
          setMessage(null);
          start(async () => {
            const result = await submit(filename, csv);
            if (!result.ok) {
              setMessage(result.message);
              return;
            }
            setWarnings(result.warnings ?? []);
            setCsv("");
            setFilename("answers.csv");
            setFileKey((key) => key + 1);
            router.refresh();
          });
        }}
      >
        {buttonLabel}
      </Button>
    </section>
  );
}
