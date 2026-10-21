export type DocKind = "buyer" | "vendor_self";

export type CollectionParty =
  | "buyer_present"
  | "vendor_submitted"
  | "direct_call";

export type SlotType = "none" | "amount" | "date";

export type HumanVerdict = "pass" | "error" | "hold" | "unsettled";

export type Severity = "critical" | "major" | "minor";

export type Decision = "incomplete" | "stop" | "pending" | "clear";

export type Question = {
  id: string;
  text: string;
  referenceAnswer: string;
  sourceNote: string;
  sourceConflict: boolean;
  mustInclude: string[];
  mustNotInclude: string[];
  slotType: SlotType;
  slotValue: string;
  domain: string;
  holdout: boolean;
  criticalDomain: boolean;
};

export type Finding = {
  ruleId: string;
  ruleVersion: string;
  kind: "hit" | "info";
  summary: string;
  evidence: string;
};

export type VerdictSnapshot = {
  humanVerdict: HumanVerdict | null;
  severity: Severity | null;
  note: string;
  recommendation: string;
};

export type ImportBatch = {
  id: string;
  filename: string;
  sha256: string;
  rowCount: number;
  ruleVersion: string;
  importedAt: string;
  raw: string;
};

export type Case = {
  id: string;
  questionId: string;
  answer: string;
  findings: Finding[];
  humanVerdict: HumanVerdict | null;
  severity: Severity | null;
  note: string;
  recommendation: string;
  reviewedAt: string | null;
  reviewer: string;
  /** 이 답변이 들어온 답변 파일. 없으면 첫 답변 파일(project.batch)입니다. */
  batchId?: string;
};

/** 사람 판정 이벤트. 기존 체인과 해시가 같도록 필드를 바꾸지 않습니다. */
export type VerdictPayload = {
  caseId: string;
  at: string;
  reviewer: string;
  reason: string;
  prev: VerdictSnapshot;
  next: VerdictSnapshot;
};

/** 답변 파일을 가져온 뒤 추가한 문항의 답변을 붙인 이벤트. */
export type SupplementPayload = {
  kind: "supplement";
  at: string;
  reviewer: string;
  reason: string;
  batch: { id: string; filename: string; sha256: string; rowCount: number };
  caseIds: string[];
};

export type ReviewEvent = {
  id: string;
  prevHash: string;
  eventHash: string;
  payload: VerdictPayload | SupplementPayload;
};

export type Report = {
  id: string;
  issuedAt: string;
  batchSha256: string;
  finalHash: string;
  decision: Decision;
  critical: number;
  reviewed: number;
  unreviewed: number;
  /** 확정 시점 질문셋의 해시. 이전 버전에서 만든 확인서에는 없습니다. */
  questionsSha256?: string;
};

export type Project = {
  id: string;
  name: string;
  client: string;
  chatbotName: string;
  chatbotVersion: string;
  docKind: DocKind;
  collectionParty: CollectionParty;
  reviewer: string;
  failOnCritical: boolean;
  createdAt: string;
  questions: Question[];
  batch: ImportBatch | null;
  /** 추가 문항용 답변 파일. 이전 버전 저장소에는 없습니다. */
  supplements?: ImportBatch[];
  cases: Case[];
  events: ReviewEvent[];
  reports: Report[];
};

export type ProjectDraft = {
  name: string;
  client: string;
  chatbotName: string;
  chatbotVersion: string;
  docKind: DocKind;
  collectionParty: CollectionParty;
  reviewer: string;
  failOnCritical: boolean;
};

export type Defect = {
  questionId: string;
  domain: string;
  severity: Severity;
  answerExcerpt: string;
  sourceNote: string;
  recommendation: string;
  findingSummaries: string[];
};

export type Summary = {
  questionCount: number;
  answerCount: number;
  missingAnswerIds: string[];
  reviewed: number;
  unreviewed: number;
  passes: number;
  errors: number;
  critical: number;
  major: number;
  minor: number;
  holds: number;
  unsettled: number;
  passRate: number | null;
  decision: Decision;
  publicDefects: Defect[];
  holdoutTotal: number;
  holdoutErrors: number;
  holdoutReviewed: number;
  machineHits: number;
  criticalDomainTotal: number;
  criticalDomainErrors: number;
  criticalDomainOpen: number;
};

export type StoreData = {
  projects: Project[];
};

export type ChainAudit = {
  ok: boolean;
  brokenAt: string | null;
  liveHash: string;
};
