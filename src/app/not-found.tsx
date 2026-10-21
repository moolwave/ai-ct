import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <h1 className="font-serif text-3xl">검수를 찾지 못했습니다.</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        주소가 바뀌었거나 이 서버에서 지워진 검수입니다.
      </p>
      <Link href="/" className="mt-6 inline-block text-sm underline">
        검수 목록
      </Link>
    </main>
  );
}
