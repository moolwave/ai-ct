"use client";

import Link from "next/link";

/**
 * 화면을 그리다 난 오류. 운영 모드에서 Next.js는 서버 오류 메시지를 숨기고 digest만 넘깁니다.
 * 같은 digest가 data/logs/errors.log에 스택과 함께 남습니다(src/instrumentation.ts).
 */
export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="font-serif text-3xl">화면을 불러오지 못했습니다.</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error.message || "알 수 없는 오류"}</p>
      {error.digest ? (
        <p className="mt-2 font-mono text-xs text-muted-foreground">오류 digest: {error.digest}</p>
      ) : null}
      <div className="mt-6 flex gap-4 text-sm">
        <button type="button" className="underline" onClick={() => reset()}>
          다시 시도
        </button>
        <Link className="underline" href="/errors">
          에러 로그 보기
        </Link>
      </div>
    </main>
  );
}
