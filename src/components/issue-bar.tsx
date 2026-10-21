"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { issueCertificateAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";

export function IssueBar({
  projectId,
  canIssue,
  aligned,
}: {
  projectId: string;
  canIssue: boolean;
  aligned: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="no-print flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          disabled={!canIssue || pending || aligned}
          onClick={() => {
            setMessage(null);
            start(async () => {
              const result = await issueCertificateAction(projectId);
              if (!result.ok) {
                setMessage(result.message);
                return;
              }
              router.refresh();
            });
          }}
        >
          {aligned ? "현재 체인과 같은 확인서가 이미 확정됐습니다" : "이 판정으로 확인서 확정"}
        </Button>
        <Button type="button" variant="outline" onClick={() => window.print()}>
          인쇄
        </Button>
      </div>
      {!canIssue ? (
        <p className="text-sm text-muted-foreground">답변 파일을 가져온 뒤에 확정할 수 있습니다.</p>
      ) : null}
      {message ? <p className="text-sm text-destructive">{message}</p> : null}
    </div>
  );
}
