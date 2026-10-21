import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginAction } from "@/lib/actions";
import { configuredToken, safeNextPath } from "@/lib/session";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;
  const target = safeNextPath(next);
  if (!configuredToken()) redirect(target);

  return (
    <main className="mx-auto w-full max-w-sm px-4 py-16">
      <h1 className="font-serif text-3xl">ai ct 로그인</h1>
      <p className="mt-2 text-sm text-muted-foreground">서버를 연 사람이 정한 접근 토큰(AICT_ACCESS_TOKEN)을 입력하세요.</p>
      <form action={loginAction} className="mt-6 flex flex-col gap-3">
        <input type="hidden" name="next" value={target} />
        <Label htmlFor="token">접근 토큰</Label>
        <Input id="token" name="token" type="password" autoComplete="current-password" required autoFocus />
        {error ? <p className="text-sm text-destructive">{error.slice(0, 200)}</p> : null}
        <Button type="submit">들어가기</Button>
      </form>
    </main>
  );
}
