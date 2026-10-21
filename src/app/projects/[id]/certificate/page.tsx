import { notFound } from "next/navigation";
import { CertificateView } from "@/components/certificate-view";
import { auditChainCached as auditChain } from "@/lib/project";
import { summarizeCached as summarize } from "@/lib/summary";
import { findProject, readStore } from "@/lib/store";

export default async function CertificatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const project = findProject(readStore(), id);
  if (!project) notFound();
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-8">
      <CertificateView project={project} summary={summarize(project)} chain={auditChain(project)} printable />
    </main>
  );
}
