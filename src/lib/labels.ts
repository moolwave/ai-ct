import type {
  CollectionParty,
  Decision,
  DocKind,
  HumanVerdict,
  Severity,
} from "./types";

export const CERTIFICATE_LIMITS = [
  "이 문서는 인증이 아닙니다. 한 차례의 검수 기록입니다.",
  "검수자는 한 명입니다.",
  "문항마다 파일에 들어 있는 샘플만 봅니다. 같은 질문을 다시 하면 답이 달라질 수 있습니다.",
  "확인서를 낸 뒤 운영 중에 나오는 답변은 보장하지 않습니다.",
  "프롬프트 인젝션과 레드팀은 이번 범위 밖입니다.",
  "자동 검사에 걸린 상태는 규칙에 걸림일 뿐, 오류 확정이 아닙니다.",
  "사람이 판정하지 않은 문항은 통과가 아닙니다.",
];

export function documentTitle(kind: DocKind): string {
  return kind === "buyer" ? "발주처 의뢰 확인서" : "납품사 자체점검 리포트";
}

export function documentCaution(kind: DocKind): string {
  return kind === "buyer"
    ? "발주처가 의뢰한 검수 기록입니다. 납품사가 문항이나 판정을 고쳤다면 이 제목을 쓰면 안 됩니다."
    : "납품사 자체점검입니다. 제3자 검수 확인서가 아닙니다.";
}

export function collectionLabel(party: CollectionParty): string {
  switch (party) {
    case "buyer_present":
      return "발주처 입회";
    case "vendor_submitted":
      return "납품사 제출";
    case "direct_call":
      return "직접 호출";
  }
}

export function collectionCaveat(party: CollectionParty): string {
  const base =
    "수집 주체는 검수자가 이 파일에 대해 선언한 값입니다. ai ct는 챗봇 API를 호출하지 않습니다.";
  switch (party) {
    case "vendor_submitted":
      return `답변은 납품사가 제출한 파일입니다. 챗봇을 직접 호출한 결과가 아닙니다. ${base}`;
    case "buyer_present":
      return `답변 수집에 발주처가 입회했다고 선언했습니다. ${base}`;
    case "direct_call":
      return `질문셋을 직접 돌려 받은 답변이라고 선언했습니다. ${base}`;
  }
}

export function decisionLabel(decision: Decision): string {
  switch (decision) {
    case "incomplete":
      return "검수 미완료";
    case "stop":
      return "납품 보류";
    case "pending":
      return "미결 항목 있음";
    case "clear":
      return "중대 오류 없음";
  }
}

export function verdictLabel(verdict: HumanVerdict | null): string {
  switch (verdict) {
    case "pass":
      return "정상";
    case "error":
      return "오류";
    case "hold":
      return "판단 보류";
    case "unsettled":
      return "기준 불명";
    default:
      return "미판정";
  }
}

export function severityLabel(severity: Severity): string {
  switch (severity) {
    case "critical":
      return "중대";
    case "major":
      return "주요";
    case "minor":
      return "경미";
  }
}

export function decisionNote(decision: Decision, critical: number): string {
  switch (decision) {
    case "incomplete":
      return "아직 사람이 보지 않은 문항이 있습니다. 미검토는 통과로 세지 않습니다.";
    case "stop":
      return `사람이 확정한 중대 오류가 ${critical}건입니다. 설정상 중대 오류가 있으면 납품을 보류합니다.`;
    case "pending":
      return "판단 보류나 기준 불명이 남아 있습니다. 통과율 분모에는 넣지 않습니다.";
    case "clear":
      return "사람이 확정한 판정 안에 중대 오류가 없습니다. 주요·경미 오류가 있으면 수정 목록에 남아 있습니다.";
  }
}
