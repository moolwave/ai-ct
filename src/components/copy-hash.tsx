"use client";

import { useState } from "react";
import { shortHash } from "@/lib/format";

export function CopyHash({ value }: { value: string }) {
  const [done, setDone] = useState(false);
  if (!value) return <span className="text-muted-foreground">아직 없음</span>;
  return (
    <button
      type="button"
      title={value}
      className="max-w-full truncate text-left font-mono text-xs text-foreground hover:underline"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
      }}
    >
      {shortHash(value)}
      <span className="ml-2 text-muted-foreground">{done ? "복사됨" : "복사"}</span>
    </button>
  );
}
