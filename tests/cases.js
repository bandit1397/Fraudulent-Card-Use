/*
 * 판례 기반 회귀 테스트
 * 각 판례의 사실관계를 입력값으로 넣고, 엔진이 판례와 같은 결론을 내는지 확인한다.
 *   apply     : 반드시 '적용'으로 나와야 하는 조항
 *   notApply  : '적용'으로 나오면 안 되는 조항 (stage 를 주면 해당 단계만 검사)
 *   status    : 특정 조항의 상태 (첫 번째 결과 기준, stage 로 제한 가능)
 *   conc      : 경합 설명에 포함되어야 하는 판례
 *   noteHas   : 결과 메모 어딘가에 포함되어야 하는 문구
 */
var CASES = [
  { name: "96도1181 절취 신용카드로 가맹점 2곳 결제 → 절도 + 부정사용(포괄일죄) + 사기",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "stolen", relation: "none", uses: [{ type: "store", result: "ok" }, { type: "store", result: "ok" }] },
    expect: { apply: ["형법329", "여전70①3", "형법347"], conc: ["96도1181", "92도77"] } },

  { name: "92도77 매출전표 서명 → 사문서위조 별도 불성립",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "found", relation: "none", uses: [{ type: "store", result: "ok" }] },
    expect: { apply: ["형법360①", "여전70①3", "형법347"], notApply: ["형법231"], conc: ["92도77"] } },

  { name: "2003도3977 절취 체크카드로 ATM 예금 인출 → 절도, 부정사용 아님",
    input: { mode: "use", date: "after20251223", medium: "check", acq: "stolen", relation: "none", uses: [{ type: "atm_cash", result: "ok" }] },
    expect: { apply: ["형법329"], notApply: ["여전70①3"], status: { "여전70①3": "no" } } },

  { name: "95도997 절취 신용카드로 현금서비스 → 부정사용 + 절도",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "stolen", relation: "none", uses: [{ type: "cash_service", result: "ok" }] },
    expect: { apply: ["여전70①3", "형법329"], conc: ["95도997"] } },

  { name: "2007도1375 강취 현금카드로 인출 → 강도 + 별도 절도",
    input: { mode: "use", date: "after20251223", medium: "cash", acq: "robbed", relation: "none", uses: [{ type: "atm_cash", result: "ok" }] },
    expect: { apply: ["형법333", "형법329"], conc: ["2007도1375"] } },

  { name: "2007도1375 / 95도1728 갈취 현금카드로 인출 → 공갈 포괄일죄, 절도 아님",
    input: { mode: "use", date: "after20251223", medium: "cash", acq: "extorted", relation: "none", uses: [{ type: "atm_cash", result: "ok" }] },
    expect: { apply: ["형법350"], notApply: ["형법329"] } },

  { name: "2005도5869 편취 현금카드로 인출 → 사기 포괄일죄, 절도 아님",
    input: { mode: "use", date: "after20251223", medium: "cash", acq: "deceived", relation: "none", uses: [{ type: "atm_cash", result: "ok" }, { type: "atm_cash", result: "ok" }] },
    expect: { apply: ["형법347"], notApply: ["형법329"], conc: ["2005도5869"] } },

  { name: "2005도3516 부탁받은 금액 초과 인출 → 컴퓨터등사용사기",
    input: { mode: "use", date: "after20251223", medium: "cash", acq: "entrusted", entrust: "asked", relation: "none", uses: [{ type: "atm_cash", result: "ok" }] },
    expect: { apply: ["형법347의2"], notApply: ["형법329"] } },

  { name: "99도857 카드 몰래 쓰고 곧 반환 → 카드 절도 불성립, 현금 절도·부정사용은 성립",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "temp", relation: "none", uses: [{ type: "cash_service", result: "ok" }] },
    expect: { status: { "형법329": "no" }, apply: ["여전70①3", "형법329"] } },

  { name: "2007도8767 절취 카드 승인 후 매출취소 → 부정사용 미수 불처벌",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "stolen", relation: "none", uses: [{ type: "store", result: "denied" }] },
    expect: { notApply: ["여전70①3"], status: { "여전70①3": "no" } } },

  { name: "2008도2440 절취 카드로 ATM 계좌이체 → 컴퓨터등사용사기, 이체·인출은 절도 아님",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "stolen", relation: "none", uses: [{ type: "atm_transfer", result: "ok" }] },
    expect: { apply: ["형법347의2"], notApply: [{ law: "형법329", stage: "사용" }] } },

  { name: "2006도2704 친족 통장 절취 후 ATM 이체 → 피해자 금융기관, 친족상도례 불적용",
    input: { mode: "use", date: "after20251223", medium: "cash", acq: "stolen", relation: "close", uses: [{ type: "atm_transfer", result: "ok" }] },
    expect: { apply: ["형법347의2"], noteHas: ["친족상도례 적용 안 됨"] } },

  { name: "2024도19846 동거 처제 카드정보로 앱 결제 → 가맹점에 대한 컴퓨터등사용사기",
    input: { mode: "use", date: "after20251223", medium: "cardinfo", acq: "info_known", relation: "close", uses: [{ type: "online", result: "ok" }] },
    expect: { apply: ["형법347의2"], noteHas: ["2024도19846"] } },

  { name: "2002도2134 명의 모용 발급 카드로 현금서비스 → 절도, 컴퓨터등사용사기 아님",
    input: { mode: "use", date: "after20251223", medium: "impersonated", acq: "applied", relation: "none", uses: [{ type: "cash_service", result: "ok" }] },
    expect: { apply: ["형법329"], notApply: ["형법347의2"] } },

  { name: "2022도10629 속여서 받은 신용카드로 결제 → 제70조 제1항 제4호",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "deceived", relation: "none", uses: [{ type: "store", result: "ok" }] },
    expect: { apply: ["여전70①4"] } },

  { name: "2006도654 협박 후 피해자가 건넨 카드 → 제4호 검토 필요",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "extorted", relation: "none", uses: [{ type: "store", result: "ok" }] },
    expect: { status: { "여전70①4": "review" } } },

  { name: "제70조 제6항 위조카드 사용 미수는 처벌",
    input: { mode: "use", date: "after20251223", medium: "forged", acq: "obtained", relation: "none", uses: [{ type: "store", result: "denied" }] },
    expect: { apply: ["여전70①5", "여전70①2"] } },

  { name: "선불교통카드 습득 후 승차 → 카드 부정사용 대상 아님",
    input: { mode: "use", date: "after20251223", medium: "prepaid", acq: "found", relation: "none", uses: [{ type: "transit", result: "ok" }] },
    expect: { apply: ["형법360①"], notApply: ["여전70①3", "경범3①39"] } },

  { name: "2025. 12. 22. 이전 사기는 구 법정형",
    input: { mode: "use", date: "mid", medium: "credit", acq: "stolen", relation: "none", uses: [{ type: "store", result: "ok" }] },
    expect: { penalty: { "형법347": "10년 이하" } } },

  { name: "2024. 6. 26. 이전 동거가족 카드 절취 → 구법 형 면제 안내",
    input: { mode: "use", date: "before20240627", medium: "credit", acq: "stolen", relation: "close", uses: [{ type: "store", result: "ok" }] },
    expect: { noteHas: ["형 면제", "친족상도례 적용 안 됨"] } },

  { name: "2024. 6. 27. 이후 친족 카드 절취 → 친고죄 안내",
    input: { mode: "use", date: "after20251223", medium: "credit", acq: "stolen", relation: "other", uses: [] },
    expect: { noteHas: ["고소가 있어야"] } },

  { name: "2010도891 착오송금 인출 → 횡령",
    input: { mode: "money", moneyCase: "mistaken", date: "after20251223", relation: "none" },
    expect: { apply: ["형법355①"] } },

  { name: "2017도17494 피해금 계좌 명의인(공범 아님) 인출 → 횡령",
    input: { mode: "money", moneyCase: "fraud_not_accomplice", date: "after20251223", relation: "none" },
    expect: { apply: ["형법355①"] } },

  { name: "2017도17494 사기 공범이 인출 → 별도 횡령 없음",
    input: { mode: "money", moneyCase: "fraud_accomplice", date: "after20251223", relation: "none" },
    expect: { apply: ["통사15의2"], notApply: ["형법355①"] } },

  { name: "2021도6965 체크카드를 아주 넘김 → 접근매체 양도",
    input: { mode: "mule", item: "access", role: "give", how: "sell", date: "after20251223" },
    expect: { apply: ["전금49④1"] } },

  { name: "2022도8084 대출 미끼에 속아 체크카드 교부 → 양도 여부 검토",
    input: { mode: "mule", item: "access", role: "give", how: "loan_bait", date: "after20251223" },
    expect: { status: { "전금49④1": "review" }, notApply: ["전금49④1"] } },

  { name: "2017도16946 대가 약속 체크카드 대여 → 접근매체 대여",
    input: { mode: "mule", item: "access", role: "give", how: "rent_paid", date: "after20251223" },
    expect: { apply: ["전금49④2"] } },

  { name: "2021도10861 수수료 받기로 하고 타인 체크카드 보관 → 접근매체 보관",
    input: { mode: "mule", item: "access", role: "take", how: "rent_paid", date: "after20251223" },
    expect: { apply: ["전금49④2"] } },

  { name: "2001도3625 / 2002도461 훔친 후불 전화카드로 공중전화 → 편의시설부정이용 아님, 사문서부정행사",
    input: { mode: "facility", facilityCase: "others_card", result: "ok", date: "after20251223" },
    expect: { status: { "형법348의2": "no" }, apply: ["형법236"] } },

  { name: "이물질로 자판기 물건 취득 → 편의시설부정이용",
    input: { mode: "facility", facilityCase: "vending", result: "ok", date: "after20251223" },
    expect: { apply: ["형법348의2"] } },

  { name: "자판기 조작 실패 → 편의시설부정이용 미수도 처벌",
    input: { mode: "facility", facilityCase: "coin_machine", result: "denied", date: "after20251223" },
    expect: { apply: ["형법348의2"] } },

  { name: "개찰구 뛰어넘기 → 경범죄 무임승차, 편의시설부정이용 검토(하급심)",
    input: { mode: "facility", facilityCase: "gate_jump", result: "ok", date: "after20251223" },
    expect: { apply: ["경범3①39"], status: { "형법348의2": "review" } } },

  { name: "성인이 자녀 청소년 교통카드로 승차 → 컴퓨터등사용사기 검토, 카드 부정사용 아님",
    input: { mode: "use", date: "after20251223", medium: "prepaid", acq: "borrowed", relation: "none", uses: [{ type: "discount_transit", result: "ok" }] },
    expect: { status: { "형법347의2": "review", "형법348의2": "review" }, notApply: ["여전70①3", "형법347의2"], noteHas: ["부산지법"] } },

  { name: "경로 무임카드 타인 사용 → 편의시설부정이용 해당 여지 큼",
    input: { mode: "use", date: "after20251223", medium: "prepaid", acq: "borrowed", relation: "none", uses: [{ type: "free_transit", result: "ok" }] },
    expect: { status: { "형법348의2": "review" }, noteHas: ["여지가 큼"] } },

  { name: "주운 청소년 교통카드로 승차 → 점유이탈물횡령 + 할인 차액 검토",
    input: { mode: "use", date: "after20251223", medium: "prepaid", acq: "found", relation: "none", uses: [{ type: "discount_transit", result: "ok" }] },
    expect: { apply: ["형법360①"], status: { "형법347의2": "review" } } },

  { name: "명의자 승낙받아 빌린 체크카드로 결제 → 범죄 아님",
    input: { mode: "use", date: "after20251223", medium: "check", acq: "borrowed", relation: "none", uses: [{ type: "store", result: "ok" }] },
    expect: { notApply: ["여전70①3", "여전70①4", "형법347"] } },

  { name: "신용카드 양도 → 여신전문금융업법 제70조 제4항 제3호",
    input: { mode: "mule", item: "credit", role: "give", how: "sell", date: "after20251223" },
    expect: { apply: ["여전70④3"] } }
];

if (typeof module !== "undefined") module.exports = CASES;
