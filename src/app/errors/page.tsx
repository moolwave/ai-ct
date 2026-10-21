import Link from "next/link";
import { ERROR_LOG_PATH, readErrorLog } from "@/lib/error-log";
import { formatWhen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ErrorsPage({
  searchParams,
}: {
  searchParams: Promise<{ level?: string }>;
}) {
  const { level } = await searchParams;
  const all = readErrorLog(300);
  const entries = level === "error" || level === "warn" ? all.filter((entry) => entry.level === level) : all;
  const errorCount = all.filter((entry) => entry.level === "error").length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">에러 로그</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">서버에서 난 오류를 최신 순으로 봅니다.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          파일: <code className="font-mono">{ERROR_LOG_PATH}</code> (1MB가 넘으면 errors.1.log로 넘깁니다). error는 예상하지 못한
          예외로 스택이 함께 남고, warn은 입력 오류처럼 사용자가 고칠 수 있는 경우입니다. 답변·질문 본문은 기록하지 않습니다.
        </p>
      </div>

      <nav className="flex gap-2 text-sm">
        <Link className={!level ? "font-medium underline" : "underline-offset-4 hover:underline"} href="/errors">
          전체 {all.length}
        </Link>
        <Link className={level === "error" ? "font-medium underline" : "underline-offset-4 hover:underline"} href="/errors?level=error">
          error {errorCount}
        </Link>
        <Link className={level === "warn" ? "font-medium underline" : "underline-offset-4 hover:underline"} href="/errors?level=warn">
          warn {all.length - errorCount}
        </Link>
      </nav>

      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border px-5 py-10 text-sm text-muted-foreground">
          기록된 오류가 없습니다.
        </p>
      ) : (
        <ol className="overflow-hidden rounded-xl border border-border bg-card">
          {entries.map((entry) => (
            <li key={entry.id} className="border-b border-border px-4 py-3 last:border-b-0">
              <details>
                <summary className="cursor-pointer list-none">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm">
                    <span className={entry.level === "error" ? "font-medium text-destructive" : "text-pending"}>
                      {entry.level}
                    </span>
                    <span className="font-mono text-xs text-muted-foreground">{entry.id}</span>
                    <span className="text-muted-foreground">{formatWhen(entry.at)}</span>
                    <span className="font-mono text-xs">{entry.source}</span>
                  </div>
                  <p className="mt-1 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">{entry.name}</span> {entry.message}
                  </p>
                </summary>
                <dl className="mt-3 grid gap-2 text-xs">
                  {entry.digest ? (
                    <div>
                      <dt className="text-muted-foreground">digest</dt>
                      <dd className="font-mono">{entry.digest}</dd>
                    </div>
                  ) : null}
                  {entry.context ? (
                    <div>
                      <dt className="text-muted-foreground">context</dt>
                      <dd className="font-mono break-all">{JSON.stringify(entry.context)}</dd>
                    </div>
                  ) : null}
                  {entry.stack ? (
                    <div>
                      <dt className="text-muted-foreground">stack</dt>
                      <dd>
                        <pre className="mt-1 max-h-80 overflow-auto rounded-lg bg-secondary p-3 font-mono text-[11px] leading-5 whitespace-pre-wrap">
                          {entry.stack}
                        </pre>
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </details>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
