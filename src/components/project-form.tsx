"use client";

import { createProjectAction } from "@/lib/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const control =
  "h-9 w-full rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export function ProjectForm({ error }: { error?: string }) {
  return (
    <form action={createProjectAction} className="flex flex-col gap-8">
      {error ? (
        <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <Label htmlFor="name">검수 이름</Label>
          <Input id="name" name="name" placeholder="상담 챗봇 1차 납품 검수" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="client">발주처</Label>
          <Input id="client" name="client" placeholder="한빛커머스" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reviewer">검수자</Label>
          <Input id="reviewer" name="reviewer" placeholder="김서연" />
          <p className="text-xs text-muted-foreground">확인서에는 검수자 한 명만 적습니다.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chatbotName">챗봇</Label>
          <Input id="chatbotName" name="chatbotName" placeholder="한빛 상담봇" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="chatbotVersion">챗봇 버전</Label>
          <Input id="chatbotVersion" name="chatbotVersion" placeholder="0.9.4" />
        </div>
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="text-sm font-medium">문서 종류</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-4 has-[:checked]:border-foreground">
            <input className="mt-1" type="radio" name="docKind" value="buyer" defaultChecked />
            <span>
              <span className="block font-medium">발주처 의뢰 확인서</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                납품사가 문항과 판정을 고치지 않은 검수에만 이 제목을 씁니다.
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer gap-3 rounded-xl border border-border bg-card p-4 has-[:checked]:border-foreground">
            <input className="mt-1" type="radio" name="docKind" value="vendor_self" />
            <span>
              <span className="block font-medium">납품사 자체점검 리포트</span>
              <span className="mt-1 block text-sm text-muted-foreground">
                만든 쪽이 스스로 돌린 점검입니다. 제3자 검수라고 쓰지 않습니다.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="collectionParty">답변을 모은 주체</Label>
          <select id="collectionParty" name="collectionParty" className={control} defaultValue="vendor_submitted">
            <option value="vendor_submitted">납품사 제출</option>
            <option value="buyer_present">발주처 입회</option>
            <option value="direct_call">직접 호출 뒤 파일로 받음</option>
          </select>
          <p className="text-xs text-muted-foreground">
            선언값입니다. 앱이 챗봇 API를 대신 호출하지는 않습니다.
          </p>
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm">
          <input className="mt-1" type="checkbox" name="failOnCritical" defaultChecked />
          <span>
            <span className="block font-medium">중대 오류가 1건이라도 있으면 납품 보류</span>
            <span className="mt-1 block text-muted-foreground">
              사람이 오류·중대로 확정한 건만 셉니다. 자동 검사에 걸린 것만으로는 보류하지 않습니다.
            </span>
          </span>
        </label>
      </div>

      <div>
        <Button type="submit" size="lg">
          검수 만들기
        </Button>
      </div>
    </form>
  );
}
