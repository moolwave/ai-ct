"use client";

import { useEffect, useRef, useState } from "react";
import { shortHash } from "@/lib/format";

type CopyState = "idle" | "done" | "failed";

/** HTTPS나 localhost가 아니면 navigator.clipboard가 없습니다. 그때는 예전 방식으로 복사합니다. */
async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    // 권한 거부 등. 아래 대체 방식으로 넘어갑니다.
  }
  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.opacity = "0";
  document.body.appendChild(area);
  area.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    area.remove();
  }
}

export function CopyHash({ value }: { value: string }) {
  const [state, setState] = useState<CopyState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 화면을 떠날 때 남은 타이머를 지워, 사라진 컴포넌트의 상태를 바꾸지 않게 합니다.
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  if (!value) return <span className="text-muted-foreground">아직 없음</span>;
  return (
    <button
      type="button"
      title={value}
      className="max-w-full truncate text-left font-mono text-xs text-foreground hover:underline"
      onClick={async () => {
        const ok = await copyText(value);
        setState(ok ? "done" : "failed");
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setState("idle"), 2000);
      }}
    >
      {shortHash(value)}
      <span className="ml-2 text-muted-foreground">
        {state === "done" ? "복사됨" : state === "failed" ? "복사 실패 · 길게 눌러 선택" : "복사"}
      </span>
    </button>
  );
}
