"use client";

export default function ErrorScreen({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="font-serif text-3xl">화면을 불러오지 못했습니다.</h1>
      <p className="mt-3 text-sm text-muted-foreground">{error.message}</p>
      <button type="button" className="mt-6 text-sm underline" onClick={() => reset()}>
        다시 시도
      </button>
    </main>
  );
}
