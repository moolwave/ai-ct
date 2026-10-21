import { ProjectForm } from "@/components/project-form";

export default async function NewProjectPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <p className="text-sm text-muted-foreground">새 검수</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">누구의 문서로 남길지 먼저 정합니다.</h1>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        발주처 의뢰와 납품사 자체점검은 제목부터 다릅니다. 만든 쪽이 문항이나 판정을 고친 기록을 제3자 확인서처럼 내지 않기 위해서입니다.
      </p>
      <div className="mt-8">
        <ProjectForm error={error} />
      </div>
    </main>
  );
}
