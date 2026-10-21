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
};

export type ReviewEvent = {
  id: string;
  prevHash: string;
  eventHash: string;
  payload: {
    caseId: string;
    at: string;
    reviewer: string;
    reason: string;
    prev: VerdictSnapshot;
    next: VerdictSnapshot;
  };
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
};

export type StoreData = {
  projects: Project[];
};

export type ChainAudit = {
  ok: boolean;
  brokenAt: string | null;
  liveHash: string;
};
