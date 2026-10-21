import Link from "next/link";
import { CopyHash } from "@/components/copy-hash";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatWhen } from "@/lib/format";
import { decisionLabel } from "@/lib/labels";
import { auditChain } from "@/lib/project";
import { readStore } from "@/lib/store";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ hash?: string; project?: string }>;
}) {
  const { hash = "", project: projectId = "" } = await searchParams;
  const needle = hash.trim().toLowerCase();
  const store = readStore();
  const rows = store.projects.map((project) => {
    const chain = auditChain(project);
    const matchedReport = project.reports.find((report) => report.finalHash === needle);
    return { project, chain, matchedReport };
  });
  const pastedHit = needle
    ? rows.find((row) => row.matchedReport || row.chain.liveHash === needle)
    : undefined;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <div>
        <p className="text-sm text-muted-foreground">해시 검증</p>
        <h1 className="mt-2 font-serif text-4xl tracking-tight">확인서에 적힌 해시를 체인과 대조합니다.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          각 판정은 앞 해시와 판정 내용을 이어 붙인 SHA-256입니다. 첫 해시의 앞은 답변 파일 해시입니다. 이력 한 줄이 바뀌면 마지막 해시가 달라집니다.
        </p>
      </div>

      <form action="/verify" className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 sm:flex-row">
        <Input
          name="hash"
          defaultValue={hash}
          placeholder="확인서의 최종 해시"
          className="font-mono sm:flex-1"
          aria-label="확인할 해시"
        />
        <Button type="submit">대조</Button>
      </form>

      {needle ? (
        <section className="rounded-xl border border-border bg-card p-4">
          {pastedHit ? (
            <div>
              <p className="font-medium">
                {pastedHit.matchedReport ? "확정된 확인서와 같습니다." : "현재 판정 체인과 같습니다. 그 해시로 확정된 확인서는 없습니다."}
              </p>
              <p className="mt-2 text-sm">
                <Link className="underline" href={`/projects/${pastedHit.project.id}?tab=certificate`}>
                  {pastedHit.project.client} · {pastedHit.project.name}
                </Link>
              </p>
              {pastedHit.matchedReport ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  {formatWhen(pastedHit.matchedReport.issuedAt)} · {decisionLabel(pastedHit.matchedReport.decision)} · 중대 {pastedHit.matchedReport.critical} · 미검토 {pastedHit.matchedReport.unreviewed}
                </p>
              ) : null}
              <p className="mt-2 text-sm text-muted-foreground">
                {pastedHit.chain.ok ? "저장소를 다시 계산해도 체인이 이어집니다." : "저장소 안의 체인은 깨져 있습니다. 해시가 같다는 말만으로 파일을 믿지 마세요."}
              </p>
            </div>
          ) : (
            <p>이 서버에 같은 해시는 없습니다. 다른 파일에서 나왔거나, 판정 이후 해시가 바뀌었습니다.</p>
          )}
        </section>
      ) : null}

      <section>
        <h2 className="font-serif text-2xl">이 서버의 검수</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">대조할 검수가 없습니다.</p>
        ) : (
          <ul className="mt-3 overflow-hidden rounded-xl border border-border bg-card">
            {rows.map(({ project, chain }) => (
              <li
                key={project.id}
                className="flex flex-col gap-2 border-b border-border px-4 py-4 last:border-b-0 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <Link href={`/projects/${project.id}?tab=certificate`} className="font-medium underline-offset-4 hover:underline">
                    {project.name}
                  </Link>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {chain.ok ? "체인 재계산 일치" : `체인 깨짐 · ${chain.brokenAt}`}
                    {projectId === project.id ? " · 이 검수에서 이동" : ""}
                  </p>
                </div>
                <CopyHash value={chain.liveHash} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
