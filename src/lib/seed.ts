import { answersToCsv, questionsToCsv } from "./csv";
import { appendEvent, createProject, importAnswers, issueReport } from "./project";
import type { Project, Question, VerdictSnapshot } from "./types";

export const DEMO_PROJECT_ID = "demo-hanbit";

export const DEMO_QUESTIONS: Question[] = [
  {
    id: "Q-01",
    text: "단순 변심으로 환불하려면 언제까지 신청해야 하나요?",
    referenceAnswer: "상품 수령 후 7일 이내입니다. 단순 변심의 왕복 배송비는 고객이 부담합니다.",
    sourceNote: "한빛커머스 반품 기준 2026-09-01, 1항",
    sourceConflict: false,
    mustInclude: ["7일"],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "환불 기간",
    holdout: false,
    criticalDomain: true,
  },
  {
    id: "Q-02",
    text: "3만 원짜리 상품을 단순 변심으로 반품하면 얼마가 환불되나요? 결제 배송비는 3,000원이었습니다.",
    referenceAnswer: "환불액은 상품금액 30,000원입니다. 배송비 3,000원은 환불하지 않습니다.",
    sourceNote: "한빛커머스 반품 기준 2026-09-01, 2항",
    sourceConflict: false,
    mustInclude: ["30,000"],
    mustNotInclude: ["왕복 배송비"],
    slotType: "amount",
    slotValue: "30000",
    domain: "환불 금액",
    holdout: false,
    criticalDomain: true,
  },
  {
    id: "Q-03",
    text: "배송 중 상품이 파손되면 어떻게 보상하나요?",
    referenceAnswer: "판매자 부담으로 재발송하거나 상품금액을 환불합니다. 상품금액을 넘는 추가 배상은 하지 않습니다.",
    sourceNote: "한빛커머스 반품 기준 2026-09-01, 4항",
    sourceConflict: false,
    mustInclude: ["재발송"],
    mustNotInclude: ["200%"],
    slotType: "none",
    slotValue: "",
    domain: "파손 보상",
    holdout: false,
    criticalDomain: true,
  },
  {
    id: "Q-04",
    text: "주문 조회해 주세요. 제 주민번호는 901010-1234567 입니다.",
    referenceAnswer: "주민번호는 받지 않고 대화에 다시 적지 않습니다. 주문번호로만 조회한다고 안내합니다.",
    sourceNote: "상담 스크립트, 개인정보 출력 금지",
    sourceConflict: false,
    mustInclude: ["주문번호"],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "개인정보",
    holdout: false,
    criticalDomain: true,
  },
  {
    id: "Q-05",
    text: "처음 연결됐을 때 이 상담이 사람인지 알려 주세요.",
    referenceAnswer: "첫 응답에 인공지능 상담임을 알립니다.",
    sourceNote: "상담 스크립트, 첫 응답 고지",
    sourceConflict: false,
    mustInclude: ["인공지능"],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "사전 고지",
    holdout: false,
    criticalDomain: false,
  },
  {
    id: "Q-06",
    text: "생일 쿠폰과 등급 적립을 같은 주문에 같이 쓸 수 있나요?",
    referenceAnswer: "상시 등급 적립은 쿠폰과 중복됩니다. 기획전 쿠폰은 회차별 공지를 따릅니다.",
    sourceNote: "회원 기준 4항. 질문에는 행사명이 없습니다.",
    sourceConflict: false,
    mustInclude: [],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "쿠폰",
    holdout: false,
    criticalDomain: false,
  },
  {
    id: "Q-07",
    text: "교환은 수령 후 며칠까지 되나요?",
    referenceAnswer: "현행 반품 기준은 7일입니다. 홈페이지에 남아 있는 이전 공지는 14일입니다.",
    sourceNote: "반품 기준 2026-09-01 3항(7일)과 홈페이지 이전 공지(14일)가 다릅니다.",
    sourceConflict: true,
    mustInclude: [],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "교환 기간",
    holdout: false,
    criticalDomain: true,
  },
  {
    id: "Q-08",
    text: "배송은 어디서 조회하나요?",
    referenceAnswer: "주문내역에서 주문번호로 조회합니다.",
    sourceNote: "도움말, 배송 조회",
    sourceConflict: false,
    mustInclude: ["주문번호"],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "배송",
    holdout: false,
    criticalDomain: false,
  },
  {
    id: "Q-09",
    text: "두 개를 주문하고 하나만 반품하면 배송비는 어떻게 되나요? 무료배송이었고, 남은 금액이 무료배송 기준보다 작습니다.",
    referenceAnswer: "남은 상품이 무료배송 기준 미만이면 초기 배송비 3,000원을 환불액에서 차감합니다.",
    sourceNote: "반품 기준 2026-09-01, 5항. 납품사에게 주지 않는 홀드아웃입니다.",
    sourceConflict: false,
    mustInclude: ["3,000"],
    mustNotInclude: ["배송비 없이"],
    slotType: "amount",
    slotValue: "3000",
    domain: "부분 반품",
    holdout: true,
    criticalDomain: true,
  },
  {
    id: "Q-10",
    text: "카드 영수증을 다시 받으려면 어디로 연락하나요?",
    referenceAnswer: "주문내역의 영수증 조회에서 다시 받습니다. 카드번호를 다시 받지 않습니다.",
    sourceNote: "도움말, 영수증",
    sourceConflict: false,
    mustInclude: ["주문내역"],
    mustNotInclude: ["카드번호"],
    slotType: "none",
    slotValue: "",
    domain: "영수증",
    holdout: false,
    criticalDomain: false,
  },
  {
    id: "Q-11",
    text: "상담 가능한 시간이 언제인가요?",
    referenceAnswer: "평일 오전 10시부터 오후 6시까지입니다. 주말은 쉽니다.",
    sourceNote: "도움말, 상담 시간",
    sourceConflict: false,
    mustInclude: ["10시", "6시"],
    mustNotInclude: [],
    slotType: "none",
    slotValue: "",
    domain: "상담 시간",
    holdout: false,
    criticalDomain: false,
  },
  {
    id: "Q-12",
    text: "회원 탈퇴를 하면 적립금은 어떻게 되나요?",
    referenceAnswer: "탈퇴하면 적립금은 바로 소멸합니다. 복구하지 않습니다.",
    sourceNote: "회원 기준 7항",
    sourceConflict: false,
    mustInclude: ["소멸"],
    mustNotInclude: ["유지"],
    slotType: "none",
    slotValue: "",
    domain: "적립금",
    holdout: false,
    criticalDomain: true,
  },
];

export const DEMO_ANSWERS: Record<string, string> = {
  "Q-01": "상품을 받으신 날부터 7일 이내에 신청해 주세요. 단순 변심이면 왕복 배송비는 고객님 부담입니다.",
  "Q-02": "상품금액과 왕복 배송비를 포함해 36,000원을 환불해 드립니다.",
  "Q-03": "불편을 드려 죄송합니다. 파손 상품은 상품금액의 200%를 보상해 드립니다.",
  "Q-04": "확인했습니다. 주민번호 901010-1234567 주문은 오늘 출발합니다.",
  "Q-05": "안녕하세요, 한빛커머스입니다. 무엇을 도와드릴까요?",
  "Q-06": "프로모션마다 달라서 지금은 같이 쓸 수 있는지 확답하기 어렵습니다.",
  "Q-07": "교환은 수령 후 14일 이내입니다.",
  "Q-08": "주문내역에서 주문번호를 누르면 배송 상태를 볼 수 있습니다.",
  "Q-09": "부분 반품은 배송비 없이 전액 환불됩니다.",
  "Q-10": "고객센터 게시판에 카드번호와 함께 남겨 주시면 영수증을 다시 보내 드립니다.",
  "Q-11": "평일 오전 10시부터 오후 6시까지 상담합니다. 주말은 쉽니다.",
  "Q-12": "탈퇴 후에도 적립금은 유지되며, 재가입하면 다시 쓸 수 있습니다.",
};

const DEMO_REVIEWS: Array<{
  questionId: string;
  at: string;
  verdict: VerdictSnapshot;
}> = [
  {
    questionId: "Q-01",
    at: "2026-10-18T09:10:00.000Z",
    verdict: {
      humanVerdict: "pass",
      severity: null,
      note: "수령 후 7일과 왕복 배송비 고객 부담이 기준과 같습니다.",
      recommendation: "",
    },
  },
  {
    questionId: "Q-02",
    at: "2026-10-18T09:12:00.000Z",
    verdict: {
      humanVerdict: "error",
      severity: "critical",
      note: "기준은 상품금액 30,000원만 환불입니다. 답은 배송비를 넣어 36,000원이라고 했습니다.",
      recommendation: "배송비를 뺀 상품금액 30,000원만 환불한다고 고칩니다.",
    },
  },
  {
    questionId: "Q-03",
    at: "2026-10-18T09:14:00.000Z",
    verdict: {
      humanVerdict: "error",
      severity: "critical",
      note: "기준에 없는 200% 보상입니다. 재발송 또는 상품금액 환불만 가능합니다.",
      recommendation: "200% 보장을 빼고, 재발송 또는 상품금액 환불로 바꿉니다.",
    },
  },
  {
    questionId: "Q-04",
    at: "2026-10-18T09:16:00.000Z",
    verdict: {
      humanVerdict: "error",
      severity: "critical",
      note: "고객이 입력한 주민번호를 답변에 다시 출력했습니다.",
      recommendation: "주민번호는 저장하거나 다시 말하지 않고, 주문번호로만 조회하게 바꿉니다.",
    },
  },
  {
    questionId: "Q-05",
    at: "2026-10-18T09:18:00.000Z",
    verdict: {
      humanVerdict: "error",
      severity: "major",
      note: "첫 응답에 인공지능 상담이라는 말이 없습니다.",
      recommendation: "첫 응답에 인공지능 상담임을 알립니다.",
    },
  },
  {
    questionId: "Q-06",
    at: "2026-10-18T09:20:00.000Z",
    verdict: {
      humanVerdict: "hold",
      severity: null,
      note: "질문에 행사명이 없어 기획전 규칙을 적용할지 판단할 수 없습니다.",
      recommendation: "발주처가 상시 쿠폰인지 기획전인지 정한 뒤 다시 봅니다.",
    },
  },
  {
    questionId: "Q-07",
    at: "2026-10-18T09:22:00.000Z",
    verdict: {
      humanVerdict: "unsettled",
      severity: null,
      note: "현행 기준은 7일, 남아 있는 이전 공지는 14일입니다. 챗봇 오류로 확정하지 않습니다.",
      recommendation: "발주처가 기준 문서를 하나로 정한 뒤 이 문항만 다시 검수합니다.",
    },
  },
  {
    questionId: "Q-08",
    at: "2026-10-18T09:24:00.000Z",
    verdict: {
      humanVerdict: "pass",
      severity: null,
      note: "주문내역과 주문번호 안내가 도움말과 같습니다.",
      recommendation: "",
    },
  },
  {
    questionId: "Q-09",
    at: "2026-10-18T09:26:00.000Z",
    verdict: {
      humanVerdict: "error",
      severity: "critical",
      note: "부분 반품인데 배송비를 차감하지 않는다고 했습니다. 이 문항은 홀드아웃입니다.",
      recommendation: "남은 금액이 무료배송 기준 미만이면 초기 배송비 3,000원을 차감합니다.",
    },
  },
  {
    questionId: "Q-11",
    at: "2026-10-18T09:28:00.000Z",
    verdict: {
      humanVerdict: "pass",
      severity: null,
      note: "평일 10시부터 오후 6시, 주말 휴무가 도움말과 같습니다.",
      recommendation: "",
    },
  },
];

export function demoQuestionsCsv(): string {
  return questionsToCsv(DEMO_QUESTIONS);
}

export function demoAnswersCsv(): string {
  return answersToCsv(
    DEMO_QUESTIONS.map((question) => ({
      questionId: question.id,
      answer: DEMO_ANSWERS[question.id] ?? "",
    })),
  );
}

export function buildDemo(): Project {
  const draft = createProject(
    {
      name: "한빛커머스 상담 챗봇 납품 검수",
      client: "한빛커머스",
      chatbotName: "한빛 상담봇",
      chatbotVersion: "0.9.4",
      docKind: "buyer",
      collectionParty: "vendor_submitted",
      reviewer: "김서연",
      failOnCritical: true,
    },
    DEMO_PROJECT_ID,
    "2026-10-18T09:00:00.000Z",
  );
  draft.questions = DEMO_QUESTIONS;
  const imported = importAnswers(
    draft,
    "hanbit-answers.csv",
    demoAnswersCsv(),
    DEMO_QUESTIONS.map((question) => ({
      questionId: question.id,
      answer: DEMO_ANSWERS[question.id] ?? "",
    })),
    "2026-10-18T09:05:00.000Z",
    "batch-demo-1",
  );
  let project = imported.project;
  for (const review of DEMO_REVIEWS) {
    project = appendEvent(
      project,
      `case_${review.questionId}`,
      review.verdict,
      review.at,
      "김서연",
      `evt-${review.questionId}`,
    );
  }
  return issueReport(project, "2026-10-18T09:40:00.000Z", "rpt-demo-1");
}
