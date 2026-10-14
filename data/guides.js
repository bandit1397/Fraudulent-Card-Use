/*
 * 현장 조치 · 증거 확보 · 질문 목록 · 범죄사실 문안 템플릿
 *
 * 조치 · 증거 · 질문은 사건 조건(ctx)에 따라 골라 쓴다. 각 항목의 when(ctx) 이 참일 때만 표시.
 * ctx = { mode, medium, acq, entrust, uses:[사용유형], ok, denied, relation, amount, laws:{적용조항:true},
 *         item, role, how, usedForFraud, moneyCase }
 *
 * 범죄사실은 형사소송법 제254조 제4항(시일·장소·방법 명시로 사실 특정)에 맞춰
 * 일시 → 장소 → 방법 → 결과 → "이로써 피의자는 …하였다." 순서로 쓴다.
 * {키} 는 화면의 입력칸 값으로 바뀌고, 비어 있으면 기본값 또는 ○○ 로 남는다.
 */
var GUIDES = (function () {
  var has = function (ctx, t) { return ctx.uses.indexOf(t) >= 0; };
  var anyUse = function (ctx, list) { return list.some(function (t) { return has(ctx, t); }); };
  var isUse = function (ctx) { return ctx.mode === "use"; };
  var discount = function (ctx) { return isUse(ctx) && anyUse(ctx, ["discount_transit", "free_transit"]); };
  // 사용 행위가 할인 · 무임 승차뿐인 경우 (일반 카드 사건 조치를 뺀다)
  var discountOnly = function (ctx) { return isUse(ctx) && ctx.uses.length > 0 && ctx.uses.every(function (u) { return u === "discount_transit" || u === "free_transit"; }); };
  var isFac = function (ctx) { return ctx.mode === "facility"; };
  var facIs = function (ctx, list) { return isFac(ctx) && list.indexOf(ctx.facilityCase) >= 0; };
  var lostOrStolen = function (ctx) { return ["found", "stolen", "temp", "received", "unknown", "info_illegal", "info_known"].indexOf(ctx.acq) >= 0; };
  var OBJ = { credit: "신용카드", check: "체크카드", cash: "현금카드 · 통장", prepaid: "교통카드", discount_card: "청소년(어린이)용 교통카드", free_card: "무임 교통카드", cardinfo: "카드", phone: "휴대전화", forged: "카드", impersonated: "카드" };
  // 목적격 조사까지 붙인 대상 이름 (받침 있으면 '을', 없으면 '를')
  var obj = function (ctx) {
    var w = OBJ[ctx.medium] || "카드", code = w.charCodeAt(w.length - 1) - 0xac00;
    return w + (code >= 0 && code <= 11171 && code % 28 ? "을" : "를");
  };
  var physicalCard = function (ctx) { return ["credit", "check", "cash", "prepaid", "discount_card", "free_card", "forged", "impersonated"].indexOf(ctx.medium) >= 0; };
  var transitCard = function (ctx) { return ["prepaid", "discount_card", "free_card"].indexOf(ctx.medium) >= 0; };

  // ── 현장 조치 ─────────────────────────────────────────
  var ACTIONS = [
    // 카드·계좌 무단사용
    { when: function (c) { return isUse(c) && c.acq === "robbed"; }, t: "피해자 부상 확인 · 응급조치, 긴급배치", d: "강도 사건 — 피해자 구호를 먼저 하고 인상착의·도주 방향을 전파. 흉기가 있으면 확보" },
    { when: function (c) { return isUse(c) && !discountOnly(c); }, t: "현행범인 체포 요건 확인", d: "범죄 실행 중이거나 실행 직후, 또는 카드·장물을 소지하고 추적되는 경우 영장 없이 체포 가능 (형사소송법 제211조·제212조)" },
    { when: function (c) { return isUse(c) && physicalCard(c) && !discountOnly(c); }, t: "카드 실물 · 영수증 확보", d: "피의자가 소지한 카드, 매출전표·영수증, 구입 물품을 임의제출받아 압수 (형사소송법 제218조). 다른 사람 명의 카드를 더 갖고 있는지 확인" },
    { when: function (c) { return isUse(c) && c.medium === "phone"; }, t: "휴대전화 · 결제 화면 확보", d: "명의자 휴대전화의 결제·이체 알림과 앱 내역을 촬영. 피의자 휴대전화는 임의제출 또는 영장으로 압수 (형사소송법 제218조)" },
    { when: function (c) { return isUse(c) && c.medium === "cardinfo"; }, t: "카드정보 저장 · 유출 경로 확보", d: "피의자 휴대전화·PC에 저장된 카드번호·사진·메모, 피싱 문자·링크 등 유출 경로를 임의제출 또는 영장으로 확보" },
    { when: function (c) { return isUse(c) && c.medium === "forged"; }, t: "위조카드 · 제작 장비 압수", d: "위조카드, 카드 판독·복제 장비(스키머 등), 공카드를 압수하고 감식 의뢰. 위조 미수·예비도 처벌 (여신전문금융업법 제70조 제6·7항)" },
    { when: function (c) { return isUse(c) && c.medium === "impersonated"; }, t: "카드 발급 경위 확인", d: "카드사에 발급신청서·본인확인 기록·발급 채널 회신 요청" },
    { when: function (c) { return isUse(c) && ["credit", "check", "cash", "impersonated", "cardinfo"].indexOf(c.medium) >= 0; }, t: "명의자에게 즉시 카드 정지 안내", d: "카드사 분실·도난 신고 시각을 기록 — 사용 시각과 비교하는 핵심 자료" },
    { when: function (c) { return isUse(c) && c.medium === "phone"; }, t: "명의자에게 계정 보호 안내", d: "휴대전화 분실 신고, 뱅킹앱·간편결제 비밀번호 변경, 인증서 폐기, 등록 카드 정지" },
    { when: function (c) { return isUse(c) && transitCard(c) && c.acq !== "own" && c.acq !== "borrowed"; }, t: "교통카드 사용 정지 · 잔액 확인", d: "기명(등록) 카드인지 확인 — 등록 카드는 운영사에 사용 정지·잔액 확인 요청" },
    { when: function (c) { return isUse(c) && anyUse(c, ["store", "kiosk", "cash_service", "online", "transit"]); }, t: "승인내역 확보", d: "명의자 휴대전화 결제 알림, 카드사 앱의 승인내역(일시·가맹점·금액·승인번호) 캡처 또는 출력 협조" },
    { when: function (c) { return isUse(c) && anyUse(c, ["atm_transfer", "bank_transfer"]); }, t: "이체 피해금 보전 안내", d: "명의자 거래 은행에 사고 신고, 수취 계좌 은행에 피해 사실 통보 요청 — 수취 계좌 명의인 확인" },
    { when: function (c) { return isUse(c) && anyUse(c, ["store", "kiosk", "atm_cash", "cash_service", "atm_transfer", "transit"]); }, t: "CCTV 보존 요청", d: "가맹점·ATM·역사 CCTV는 보존기간이 짧으므로 출동 당일 보존을 요청" },
    { when: function (c) { return isUse(c) && has(c, "online"); }, t: "배송 보류 요청", d: "배송 전이면 가맹점에 배송 보류를 요청하고 배송지·수령인 확인 — 검거 단서" },
    { when: function (c) { return isUse(c) && c.denied; }, t: "승인 거절 · 매출 취소 기록 확보", d: "실패한 거래의 시각·사유(정지 카드, 비밀번호 오류, 한도 초과) — 미수 여부 판단 근거 (2007도8767)" },
    { when: function (c) { return isUse(c) && c.acq === "found"; }, t: "습득 경위 확인", d: "사용하지 않고 습득만 한 사람이 신고·반환하려 한 경우라면 범죄가 아닌 유실물 처리 대상 — 영득 의사 여부 확인" },
    { when: function (c) { return isUse(c) && c.acq === "temp"; }, t: "반환 시점 · 장소 확인", d: "카드가 원래 자리로 언제 돌아왔는지 — 곧 반환했다면 카드 자체 절도는 불성립 (99도857)" },
    { when: function (c) { return isUse(c) && c.acq === "received"; }, t: "넘겨준 사람(본범) 추적", d: "카드를 넘겨준 사람의 인적사항·연락처 확보 — 절도·점유이탈물횡령 본범 수사" },
    { when: function (c) { return isUse(c) && (c.acq === "deceived" || c.acq === "extorted"); }, t: "속이거나 협박한 내용 보존", d: "문자·메신저·통화 녹음 등 기망·협박 내용을 보존 — 카드를 건넨 경위가 죄명을 가름 (2006도654, 2022도10629)" },
    { when: function (c) { return isUse(c) && c.acq === "entrusted"; }, t: "맡긴 범위 증거 확보", d: "인출·결제를 부탁한 금액·용도를 보여주는 메시지나 진술 확보 — 초과분만 범죄 (2005도3516)" },
    { when: function (c) { return c.relation && c.relation !== "none"; }, t: "고소 의사 확인", d: "명의자가 피해자인 재산범죄는 친족이면 친고죄 (형법 제328조) — 고소기간 6개월. 가맹점·금융기관이 피해자인 죄는 친족과 무관" },
    { when: function (c) { return c.amount >= 500000000; }, t: "특정경제범죄법 적용 검토 보고", d: "이득액 5억원 이상 — 특정경제범죄 가중처벌 등에 관한 법률 제3조. 즉시 상급 수사부서에 보고" },

    // 할인 · 무임 교통카드
    { when: discount, t: "역무원 · 운전기사에게서 인계", d: "부정승차 적발 경위(단말기 표시 · 안내음, 신분 확인 결과)와 카드 회수 여부를 확인" },
    { when: discount, t: "부가운임 안내", d: "운영기관이 승차 구간 운임 외 부가금을 징수 (철도 30배 범위 — 철도사업법 제10조, 도시철도 · 버스는 운송약관). 형벌과 별개" },
    { when: discount, t: "카드 사용내역 조회 협조", d: "운영기관 · 교통카드사에 해당 카드의 기간별 승하차 이력 요청 — 상습성 · 피해액(운임 차액) 산정 근거" },
    { when: function (c) { return discount(c) && c.acq === "borrowed"; }, t: "카드 명의자 확인", d: "명의자(자녀 등)의 나이 · 할인 등록 정보, 빌려준 경위 확인" },
    { when: function (c) { return discount(c) && c.acq === "own"; }, t: "자격 상실 인식 확인", d: "생년월일 등록 · 성인 자동 전환 여부, 운영기관 안내를 받았는지 — 고의가 없으면 범죄 아님" },
    { when: function (c) { return discount(c) || facIs(c, ["gate_jump", "bus_no_pay"]); }, t: "경미 사안 처리 기준", d: "1회 · 소액이면 부가운임 납부 또는 경범죄 범칙금 통고로 종결하는 것이 일반적. 상습 · 다액 · 납부 거부 시 형사 입건 검토. 경범죄만 해당하면 주거 불명일 때만 현행범 체포 (형사소송법 제214조)" },

    // 편의시설 부정이용
    { when: isFac, t: "설비 관리자(업주 · 역무원) 진술 확보", d: "피해 설비, 피해 금액(물건 · 이용료), 발견 경위" },
    { when: function (c) { return facIs(c, ["vending", "coin_machine", "payphone"]); }, t: "투입물 · 도구 압수", d: "기기 안의 위조 · 외국 동전, 이물질, 조작 도구를 임의제출 또는 압수 (형사소송법 제218조)" },
    { when: function (c) { return facIs(c, ["vending", "coin_machine", "payphone"]); }, t: "기기 손괴 여부 확인", d: "기기를 열거나 부쉈다면 재물손괴(형법 제366조) 별도 — 파손 부위 촬영" },
    { when: function (c) { return facIs(c, ["gate_jump"]); }, t: "역무원 인계 · 부가운임 안내", d: "개찰구 CCTV, 적발 경위 확인. 운영기관 부가운임 징수 안내" },
    { when: function (c) { return facIs(c, ["bus_no_pay"]); }, t: "운전기사 진술 · 차내 CCTV", d: "요금을 내지 않은 방법(태그한 척 등), 운전기사에게 한 말" },
    { when: function (c) { return facIs(c, ["others_card"]); }, t: "카드 실물 확보 · 명의자 확인", d: "사용한 후불식 카드를 압수하고 명의자 · 분실 경위 확인. 카드 자체의 절도 · 점유이탈물횡령은 별도" },

    // 대포통장·카드
    { when: function (c) { return c.mode === "mule"; }, t: "넘긴 매체 · 상대방 특정", d: "넘긴 카드·통장·OTP 종류와 개수, 상대방 연락처(전화·메신저 계정), 전달 방법(택배·퀵 송장)을 확보" },
    { when: function (c) { return c.mode === "mule" && c.role === "give"; }, t: "해당 계좌 사용 정지 · 피해 조회", d: "명의인 계좌의 지급정지·사기이용계좌 등록 여부와 피해 신고 접수 여부 조회 — 범죄 이용 사실 확인" },
    { when: function (c) { return c.mode === "mule" && c.role === "give" && c.how !== "sell"; }, t: "돌려받기로 했는지 · 대가 확인", d: "양도(확정 이전)인지 대여(일시 사용)인지가 적용 조항을 가름 (2021도6965, 2017도16946) — 대화 내용 확보" },
    { when: function (c) { return c.mode === "mule" && c.role === "take"; }, t: "소지한 타인 명의 매체 전량 압수", d: "타인 명의 카드·통장·OTP를 모두 압수하고 명의인 목록 작성 — 수거·전달 지시자 연락 내역 확보" },
    { when: function (c) { return c.mode === "mule" && c.role === "broker"; }, t: "광고 · 모집 게시물 보존", d: "광고 게시물, 계정, 수수료 수령 계좌를 화면 캡처·보존 요청" },
    { when: function (c) { return c.mode === "mule" && c.usedForFraud; }, t: "피해 사건과 연결", d: "그 계좌·카드로 발생한 피해 사건번호를 조회해 병합 수사 여부 확인" },

    // 잘못 들어온 돈
    { when: function (c) { return c.mode === "money"; }, t: "입금 · 인출 내역 확보", d: "입금 일시·금액·송금인, 이후 인출·이체·사용 내역 (계좌 거래내역)" },
    { when: function (c) { return c.mode === "money" && (c.moneyCase === "mistaken" || c.moneyCase === "refuse"); }, t: "반환 요청 경위 확인", d: "송금인·은행의 반환 요청 일시와 방법, 피의자의 답변 — 반환 거부는 그 자체로 횡령 가능" },
    { when: function (c) { return c.mode === "money" && (c.moneyCase === "fraud_not_accomplice" || c.moneyCase === "fraud_accomplice"); }, t: "피해자 지급정지 · 피해구제 신청 안내", d: "전기통신금융사기 피해자는 금융회사에 지급정지·피해구제 신청 가능 (통신사기피해환급법 제3조)" },
    { when: function (c) { return c.mode === "money" && c.moneyCase === "fraud_accomplice"; }, t: "현장 검거 시 현금 · 휴대전화 압수", d: "전달 전 현금, 조직과의 연락 휴대전화, 전달 장소·방법 기록" }
  ];

  // ── 확보할 증거 ───────────────────────────────────────
  var EVIDENCE = {
    store: ["매출전표 · 영수증 (서명 포함)", "가맹점 CCTV", "카드사 승인내역 (승인번호)", "구입 물품 및 그 행방"],
    kiosk: ["키오스크 · 무인점포 결제기록", "무인점포 CCTV · 출입기록", "가져간 물품 목록"],
    atm_cash: ["ATM 설치 금융기관 · 위치 · 기기번호", "거래일시 · 금액 (거래내역서)", "ATM CCTV (금융기관 보관 — 협조 요청 또는 영장)"],
    cash_service: ["ATM 위치 · 거래일시 · 금액", "카드사 현금서비스 내역", "ATM CCTV"],
    atm_transfer: ["이체 내역 (출금 · 입금 계좌)", "수취 계좌 명의인", "ATM CCTV", "이체 후 인출 내역"],
    online: ["가맹점 · 결제대행사(PG) 주문정보", "배송지 · 수령인 · 연락처", "접속 IP · 기기정보 (영장)", "간편결제 등록 기록"],
    bank_transfer: ["이체 내역 · 수취 계좌", "로그인 · 접속 IP · 기기 (영장)", "명의자 휴대전화 상태 (분실 · 원격제어 앱 설치 여부)"],
    transit: ["교통카드 사용내역 (승하차 시각 · 역 · 노선)", "역사 · 버스 CCTV", "카드 충전 내역"],
    discount_transit: ["운영기관 부정승차 적발 기록", "해당 카드 기간별 승하차 내역", "카드 등록 정보 (명의자 · 할인 유형 · 생년월일)", "역사 · 버스 CCTV"],
    free_transit: ["운영기관 부정승차 적발 기록", "해당 카드 기간별 승하차 내역", "카드 등록 정보 (명의자 · 무임 자격)", "역사 · 버스 CCTV"],
    facility: ["설비 관리자 진술 · 피해 금액 산정 자료", "설비 이용 · 판매 기록", "CCTV", "기기 안 투입물 · 파손 부위 사진"],
    mule: ["넘긴 매체 목록 (종류 · 개수 · 계좌)", "상대방과의 대화 (대가 · 반환 약속)", "택배 · 퀵 송장", "해당 계좌 거래내역 · 피해 신고 내역"],
    money: ["계좌 거래내역 (입금 · 인출)", "송금인 진술 · 송금 화면", "반환 요청 기록", "인출 장소 CCTV"]
  };

  // ── 질문 목록 ─────────────────────────────────────────
  var Q_VICTIM = [
    { when: function (c) { return isUse(c) && lostOrStolen(c); }, q: function (c) { return obj(c) + " 마지막으로 확인한 때와 장소"; } },
    { when: function (c) { return isUse(c) && lostOrStolen(c); }, q: function (c) { return "분실 · 도난을 알게 된 경위, " + (c.medium === "phone" ? "통신사" : "카드사") + " 신고 시각"; } },
    { when: function (c) { return isUse(c) && !lostOrStolen(c) && c.medium !== "forged" && c.medium !== "impersonated"; }, q: function (c) { return obj(c) + " 건넨(빼앗긴) 일시 · 장소 · 경위, 카드사 정지 신고 시각"; } },
    { when: function (c) { return isUse(c) && c.medium === "impersonated"; }, q: "카드 발급 사실을 언제 · 어떻게 알았는지, 신청한 적이 있는지" },
    { when: function (c) { return isUse(c) && anyUse(c, ["atm_cash", "cash_service", "atm_transfer", "bank_transfer"]); }, q: "비밀번호를 적어 두었거나 알려 준 사람이 있는지" },
    { when: function (c) { return isUse(c) && c.medium === "phone"; }, q: "휴대전화 잠금 · 간편결제 · 뱅킹앱 비밀번호를 아는 사람이 있는지" },
    { when: function (c) { return isUse(c) && c.medium === "cardinfo"; }, q: "카드번호를 입력한 사이트 · 받은 문자 · 카드를 남에게 보여준 적이 있는지" },
    { when: function (c) { return isUse(c) && c.acq === "temp"; }, q: "카드가 원래 있던 곳과 다시 발견된 때 · 장소" },
    { when: function (c) { return isUse(c) && c.acq === "robbed"; }, q: "폭행 · 협박 내용, 흉기 여부, 부상 정도, 범인 인상착의" },
    { when: function (c) { return isUse(c) && c.acq === "extorted"; }, q: "어떤 말로 겁을 줬는지, 카드를 '결제하라고' 직접 건넨 것인지" },
    { when: function (c) { return isUse(c) && c.acq === "deceived"; }, q: "어떤 말에 속아 카드를 건넸는지, 사용을 허락한 범위" },
    { when: function (c) { return isUse(c) && c.acq === "entrusted"; }, q: "카드를 맡긴 이유, 부탁한 금액 · 용도" },
    { when: isUse, q: "피의자를 아는지 — 친족 · 동거 여부" },
    { when: function (c) { return isUse(c) && c.acq !== "entrusted" && c.acq !== "deceived"; }, q: "사용을 허락한 적이 있는지" },
    { when: isUse, q: "피해 금액, 승인 · 거절 내역" },
    { when: function (c) { return isUse(c) && transitCard(c); }, q: "교통카드 등록(기명) 여부와 남아 있던 잔액" },
    { when: discount, q: "(역무원 · 운전기사) 적발 경위 — 단말기 표시 · 안내음, 신분 확인 결과" },
    { when: discount, q: "(운영기관) 해당 카드의 이전 부정승차 이력과 운임 차액" },
    { when: function (c) { return discount(c) && c.acq === "borrowed"; }, q: "(카드 명의자) 카드를 빌려준 경위, 할인 카드인 줄 알고 쓰게 했는지" },
    { when: isFac, q: "(관리자) 피해 설비와 피해 금액, 발견 경위" },
    { when: function (c) { return facIs(c, ["gate_jump", "bus_no_pay"]); }, q: "(역무원 · 운전기사) 요금을 내지 않은 방법, 이전에도 본 적이 있는지" },
    { when: function (c) { return facIs(c, ["others_card"]); }, q: "(카드 명의자) 카드를 잃어버린 때 · 장소, 사용 허락 여부" },
    { when: function (c) { return c.mode === "mule"; }, q: "(해당 계좌로 피해를 입은 사람이 있으면) 송금 경위와 금액" },
    { when: function (c) { return c.mode === "money"; }, q: "송금한 경위 (착오 · 속아서), 송금 일시 · 금액" },
    { when: function (c) { return c.mode === "money"; }, q: "반환을 요청한 일시 · 방법과 상대방의 답변" },
    { when: function (c) { return c.relation && c.relation !== "none"; }, q: "처벌을 원하는지 · 고소할 것인지 (친고죄)" },
    { when: function (c) { return (!c.relation || c.relation === "none") && !discount(c); }, q: "처벌 의사" },
    { when: discount, q: "(운영기관) 부가운임 징수 여부와 처벌 의사" }
  ];
  var Q_SUSPECT = [
    { when: function (c) { return isUse(c) && c.acq === "found"; }, q: "언제 · 어디서 주웠는지, 왜 신고하거나 돌려주지 않았는지" },
    { when: function (c) { return isUse(c) && c.acq === "stolen"; }, q: "언제 · 어디서 · 어떻게 가져갔는지" },
    { when: function (c) { return isUse(c) && c.acq === "temp"; }, q: "언제 돌려놓았는지, 처음부터 돌려놓을 생각이었는지" },
    { when: function (c) { return isUse(c) && c.acq === "received"; }, q: "누구로부터 받았는지, 훔치거나 주운 카드인 줄 알았는지, 대가" },
    { when: function (c) { return isUse(c) && (c.acq === "robbed" || c.acq === "extorted"); }, q: "피해자에게 한 말과 행동, 피해자가 카드를 건넬 때 한 말" },
    { when: function (c) { return isUse(c) && c.acq === "deceived"; }, q: "피해자에게 한 말, 그 말이 사실이었는지, 갚을 능력 · 의사" },
    { when: function (c) { return isUse(c) && c.acq === "entrusted"; }, q: "부탁받은 금액 · 용도, 그보다 더 쓴 이유" },
    { when: function (c) { return isUse(c) && (c.acq === "info_illegal" || c.acq === "info_known"); }, q: "카드정보 · 비밀번호를 알게 된 경위" },
    { when: function (c) { return isUse(c) && (c.medium === "forged" || c.medium === "impersonated"); }, q: "카드를 만든(발급받은) 경위, 공범, 다른 카드" },
    { when: function (c) { return isUse(c) && anyUse(c, ["atm_cash", "cash_service", "atm_transfer", "bank_transfer"]); }, q: "비밀번호를 알게 된 경위" },
    { when: function (c) { return isUse(c) && c.acq !== "own"; }, q: "명의자를 아는지, 사용 허락을 받았다고 믿은 근거" },
    { when: discount, q: "할인 · 무임 대상이 아닌 줄 알았는지, 몇 번이나 이렇게 탔는지" },
    { when: discount, q: "부가운임을 낼 의사가 있는지" },
    { when: isUse, q: "사용한 일시 · 장소 · 횟수 · 금액, 구입한 물품 · 인출금의 행방" },
    { when: function (c) { return isUse(c) && has(c, "online"); }, q: "결제한 사이트 · 계정 · 배송지" },
    { when: function (c) { return isUse(c) && c.denied; }, q: "결제(인출)가 거절된 뒤 다시 시도했는지" },
    { when: isUse, q: "함께한 사람(공범)이 있는지" },
    { when: function (c) { return isUse(c) && c.medium !== "cardinfo"; }, q: function (c) { return obj(c) + " 지금 어디에 두었는지"; } },
    { when: isUse, q: "다른 사람 명의 카드나 통장을 더 갖고 있는지" },

    { when: function (c) { return facIs(c, ["vending", "coin_machine", "payphone"]); }, q: "무엇을 어떻게 넣거나 조작했는지, 도구를 어디서 구했는지" },
    { when: function (c) { return facIs(c, ["vending", "coin_machine", "payphone"]); }, q: "같은 방법으로 이용한 횟수 · 다른 장소" },
    { when: function (c) { return facIs(c, ["gate_jump", "bus_no_pay"]); }, q: "요금을 내지 않은 이유, 이전에도 같은 방법으로 탔는지 (횟수 · 기간)" },
    { when: function (c) { return facIs(c, ["gate_jump", "bus_no_pay"]); }, q: "부가운임을 낼 의사가 있는지" },
    { when: function (c) { return facIs(c, ["others_card"]); }, q: "카드를 언제 · 어디서 얻었는지, 사용 횟수 · 금액" },
    { when: function (c) { return c.mode === "mule" && c.role === "give"; }, q: "상대방을 알게 된 경위 (광고 · 문자 · 지인)와 상대방과의 관계" },
    { when: function (c) { return c.mode === "mule" && c.role === "give"; }, q: "넘긴 매체 종류 · 개수 · 비밀번호까지 알려줬는지" },
    { when: function (c) { return c.mode === "mule" && c.role === "give"; }, q: "받기로 한 대가 (돈 · 대출 · 수수료), 실제로 받았는지" },
    { when: function (c) { return c.mode === "mule" && c.role === "give"; }, q: "돌려받기로 했는지, 돌려받았는지 (양도·대여 구분 — 2021도6965)" },
    { when: function (c) { return c.mode === "mule" && c.role === "give" && c.how === "loan_bait"; }, q: "대출 주체 · 금액 · 이자 · 상환 방법을 정했는지 (2022도8084 판단 요소)" },
    { when: function (c) { return c.mode === "mule" && c.role !== "broker"; }, q: "범죄에 쓰일 수 있다고 생각했는지" },
    { when: function (c) { return c.mode === "mule" && c.role === "take"; }, q: "누구 지시로 몇 개를 받아 어디로 전달했는지, 받은 수수료" },
    { when: function (c) { return c.mode === "mule" && c.role === "broker"; }, q: "광고 · 모집 방법, 연결해 준 건수와 받은 수익" },
    { when: function (c) { return c.mode === "money"; }, q: "입금 사실을 안 시점, 누구 돈인지 알았는지" },
    { when: function (c) { return c.mode === "money"; }, q: "인출 · 사용한 일시 · 금액 · 사용처, 반환 의사" },
    { when: function (c) { return c.mode === "money" && c.moneyCase.indexOf("fraud") === 0; }, q: "계좌를 누구에게 어떻게 제공했는지, 조직과의 연락 · 지시 내용" },
    { when: function (c) { return c.mode === "money" && c.moneyCase === "fraud_accomplice"; }, q: "인출 · 전달 횟수, 전달 받은 사람, 받은 수당" }
  ];

  function build(ctx) {
    var pick = function (list) { return list.filter(function (x) { return x.when(ctx); }); };
    var ev = [];
    var push = function (x) { if (ev.indexOf(x) < 0) ev.push(x); };
    if (ctx.mode === "use") ctx.uses.forEach(function (u) { (EVIDENCE[u] || []).forEach(push); });
    else (EVIDENCE[ctx.mode] || []).forEach(push);
    var text = function (x) { return typeof x.q === "function" ? x.q(ctx) : x.q; };
    return {
      actions: pick(ACTIONS),
      evidence: ev,
      victim: pick(Q_VICTIM).map(text),
      suspect: pick(Q_SUSPECT).map(text)
    };
  }

  // ── 범죄사실 템플릿 ───────────────────────────────────
  // 찾는 순서: "조항:사용유형" → "조항:상황(moneyCase · how · role)" → "조항"
  var FACTS = {
    "형법360①": "피의자는 {일시}경 {장소}에서 피해자 {명의자}가 분실한 {카드} 1개를 습득하였으면 이를 피해자에게 돌려주거나 경찰관서에 신고하는 등 필요한 절차를 밟아야 함에도 그대로 가지고 가 이를 횡령하였다.",
    "형법329": "피의자는 {일시}경 {장소}에서 피해자 {명의자} 소유의 {카드} 1개를 가지고 가 이를 절취하였다.",
    "형법362①": "피의자는 {일시}경 {장소}에서 성명불상자로부터 그가 절취(습득)한 피해자 {명의자} 명의의 {카드} 1개를 그것이 장물이라는 사실을 알면서도 넘겨받아 장물을 취득하였다.",
    "형법333": "피의자는 {일시}경 {장소}에서 피해자 {명의자}에게 ○○하는 등 폭행(협박)하여 피해자의 반항을 억압한 다음 피해자로부터 {카드} 1개를 빼앗아 이를 강취하였다.",
    "형법350": "피의자는 {일시}경 {장소}에서 피해자 {명의자}에게 \"○○\"라고 말하여 겁을 주고, 이에 겁을 먹은 피해자로부터 {카드} 1개와 그 비밀번호를 교부받아 이를 갈취하였다.",
    "형법347": "피의자는 {일시}경 {장소}에서 피해자 {명의자}에게 \"○○\"라고 거짓말하였다. 그러나 사실 피의자는 ○○할 의사나 능력이 없었다. 피의자는 이와 같이 피해자를 기망하여 이에 속은 피해자로부터 {카드} 1개를 교부받았다.",

    "여전70①3:store": "피의자는 {일시}경 {장소}에 있는 '{상호}'에서 위와 같이 취득한 피해자 {명의자} 명의의 {카드}를 마치 정당한 사용권자인 것처럼 제시하고 매출전표에 서명하여 {물품} 대금 {금액}원을 결제한 것을 비롯하여, 그때부터 ○○경까지 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 합계 ○○원 상당을 결제하였다.\n이로써 피의자는 분실(도난)된 {카드}를 사용하였다.",
    "여전70①4:store": "피의자는 {일시}경 {장소}에 있는 '{상호}'에서 위와 같이 강취(횡령·기망·공갈로 취득)한 피해자 {명의자} 명의의 {카드}를 제시하여 {물품} 대금 {금액}원을 결제한 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 합계 ○○원 상당을 결제하였다.\n이로써 피의자는 강취(횡령·기망·공갈)하여 취득한 {카드}를 사용하였다.",
    "여전70①2:store": "피의자는 {일시}경 {장소}에 있는 '{상호}'에서 위와 같이 위조된 {명의자} 명의의 {카드}를 진정한 카드인 것처럼 제시하여 {물품} 대금 {금액}원을 결제(하려 하였으나 승인이 거절되어 미수에 그쳤다)한 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 합계 ○○원 상당을 결제하였다.\n이로써 피의자는 위조된 신용카드를 사용(하려다 미수에 그쳤다)하였다.",
    "여전70①3:cash_service": "피의자는 {일시}경 {장소}에 있는 {상호} 현금자동지급기에 위와 같이 취득한 피해자 {명의자} 명의의 {카드}를 넣고 비밀번호를 입력하여 현금서비스 {금액}원을 받았다.\n이로써 피의자는 분실(도난)된 {카드}를 사용하였다.",
    "여전70①4:cash_service": "피의자는 {일시}경 {장소}에 있는 {상호} 현금자동지급기에 위와 같이 강취(기망·공갈로 취득)한 피해자 {명의자} 명의의 {카드}를 넣고 비밀번호를 입력하여 현금서비스 {금액}원을 받았다.\n이로써 피의자는 강취(기망·공갈)하여 취득한 {카드}를 사용하였다.",
    "여전70①2:cash_service": "피의자는 {일시}경 {장소}에 있는 {상호} 현금자동지급기에 위조된 {카드}를 넣고 비밀번호를 입력하여 현금서비스 {금액}원을 받았다.\n이로써 피의자는 위조된 신용카드를 사용하였다.",
    "여전70①1": "피의자는 {일시}경 {장소}에서 ○○(카드 복제기 등)을 이용하여 {명의자} 명의 신용카드의 정보를 공카드에 입력하는 방법으로 {카드} 1장을 위조하였다.\n이로써 피의자는 신용카드를 위조하였다.",
    "여전70①5": "피의자는 {일시}경 {장소}에서 성명불상자로부터 위조된 {카드} ○장을 ○○원에 사들여, 행사할 목적으로 위조된 신용카드를 취득하였다.",
    "형법347:store": "피의자는 제○항 기재 일시 · 장소에서 '{상호}'의 종업원인 피해자 ○○○에게 위 {카드}를 마치 정당한 사용권자인 것처럼 제시하여 이에 속은 피해자로부터 즉석에서 시가 {금액}원 상당의 {물품}을 교부받은 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 피해자들로부터 합계 ○○원 상당의 재물을 교부받았다.\n이로써 피의자는 피해자들을 기망하여 재물을 교부받았다.",
    "형법329:cash_service": "피의자는 제○항 기재 일시 · 장소에서 위와 같이 현금서비스를 받는 방법으로 피해자 {상호} 관리의 현금자동지급기에서 현금 {금액}원을 인출하여 가지고 가 이를 절취하였다.",
    "형법329:atm_cash": "피의자는 {일시}경 {장소}에 있는 피해자 {상호} 관리의 현금자동지급기에 위 {카드}를 넣고 비밀번호를 입력하여 현금 {금액}원을 인출한 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 합계 ○○원을 인출하여 가지고 가 이를 절취하였다.",
    "형법347의2:atm_cash": "피의자는 피해자 {명의자}로부터 현금 ○○원을 인출해 달라는 부탁과 함께 {카드}를 건네받은 것을 기화로, {일시}경 {장소}에 있는 {상호} 현금자동지급기에 위 카드를 넣고 비밀번호와 인출금액 {금액}원을 입력하여 위임받은 금액을 초과한 ○○원을 인출하였다.\n이로써 피의자는 컴퓨터등 정보처리장치에 권한 없이 정보를 입력하여 정보처리를 하게 함으로써 ○○원 상당의 재산상 이익을 취득하였다.",
    "형법347의2:atm_transfer": "피의자는 {일시}경 {장소}에 있는 {상호} 현금자동지급기에 위 {카드}를 넣고 권한 없이 비밀번호와 이체할 계좌번호 · 금액을 입력하여 피해자 {상호}로 하여금 {명의자} 명의 계좌에서 피의자 명의 ○○은행 계좌로 {금액}원을 이체하게 하였다.\n이로써 피의자는 컴퓨터등 정보처리장치에 권한 없이 정보를 입력하여 정보처리를 하게 함으로써 {금액}원 상당의 재산상 이익을 취득하였다.",
    "형법347의2:online": "피의자는 {일시}경 {장소}에서 휴대전화(컴퓨터)로 피해자 '{상호}'의 인터넷 사이트(앱)에 접속한 다음, {명의자}의 승낙 없이 {명의자} 명의의 {카드} 번호 · 유효기간 · 비밀번호 등을 입력하여 {물품} 대금 {금액}원을 결제한 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 합계 ○○원을 결제하였다.\n이로써 피의자는 컴퓨터등 정보처리장치에 권한 없이 정보를 입력하여 정보처리를 하게 함으로써 같은 금액 상당의 재산상 이익을 취득하였다.",
    "형법347의2:bank_transfer": "피의자는 {일시}경 {장소}에서 {명의자}의 휴대전화에 설치된 {상호} 모바일뱅킹 앱에 {명의자}의 승낙 없이 접속하여 비밀번호 등을 입력하고, 피해자 {상호}로 하여금 {명의자} 명의 계좌에서 피의자 명의 ○○은행 계좌로 {금액}원을 이체하게 하였다.\n이로써 피의자는 컴퓨터등 정보처리장치에 권한 없이 정보를 입력하여 정보처리를 하게 함으로써 {금액}원 상당의 재산상 이익을 취득하였다.",
    "형법347의2:store": "피의자는 {일시}경 {장소}에 있는 '{상호}'에서 {명의자}의 휴대전화에 등록된 간편결제를 {명의자}의 승낙 없이 실행하여 {물품} 대금 {금액}원을 결제하였다.\n이로써 피의자는 컴퓨터등 정보처리장치에 권한 없이 정보를 입력하여 정보처리를 하게 함으로써 같은 금액 상당의 재산상 이익을 취득하였다.",
    "형법347:atm_cash": "피의자는 {일시}경 {장소}에서 피해자 {명의자}에게 \"○○\"라고 거짓말하여 이에 속은 피해자로부터 {카드}와 비밀번호를 건네받은 다음, 같은 날 ○○경 ○○에 있는 현금자동지급기에서 위 카드로 {금액}원을 인출한 것을 비롯하여 총 {횟수}회에 걸쳐 합계 ○○원을 인출하였다.\n이로써 피의자는 피해자를 기망하여 재물을 교부받았다.",
    "형법350:atm_cash": "피의자는 {일시}경 {장소}에서 피해자 {명의자}에게 \"○○\"라고 말하여 겁을 주어 이에 겁을 먹은 피해자로부터 {카드}와 비밀번호를 건네받은 다음, 같은 날 ○○경 ○○에 있는 현금자동지급기에서 위 카드로 {금액}원을 인출한 것을 비롯하여 총 {횟수}회에 걸쳐 합계 ○○원을 인출하였다.\n이로써 피의자는 피해자를 공갈하여 재물을 교부받았다.",
    "여전70①6": "피의자는 {일시}경 {장소}에서 ○○(피싱 문자 · 몰래 촬영 등)의 방법으로 알아낸 {명의자} 명의의 신용카드 번호 · 유효기간 · CVC 번호를 휴대전화에 저장하여 보유하였다.\n이로써 피의자는 거짓이나 그 밖의 부정한 방법으로 알아낸 타인의 신용카드 정보를 보유하였다.",
    "여전70①6:online": "피의자는 {일시}경 {장소}에서 ○○(피싱 문자 · 몰래 촬영 등)의 방법으로 알아낸 {명의자} 명의의 신용카드 정보를 '{상호}' 결제화면에 입력하여 {물품} 대금 {금액}원을 결제하였다.\n이로써 피의자는 거짓이나 그 밖의 부정한 방법으로 알아낸 타인의 신용카드 정보를 이용하여 신용카드로 거래하였다.",

    // 할인 · 무임 교통카드
    "형법347의2:discount_transit": "피의자는 사실은 성인으로서 청소년(어린이) 할인 운임 대상이 아니다.\n그럼에도 피의자는 {일시}경 {장소}에 있는 {상호} 개찰구(버스 단말기)에서 {명의자} 명의의 {카드}를 단말기에 접촉하여 정상 운임 ○○원 대신 할인 운임 ○○원만 결제되도록 한 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 같은 방법으로 운임 차액 합계 {금액}원을 지급하지 아니하였다.\n이로써 피의자는 컴퓨터등 정보처리장치에 권한 없이 정보를 입력하여 정보처리를 하게 함으로써 피해자 {상호}로부터 같은 금액 상당의 재산상 이익을 취득하였다.",
    "형법347의2:free_transit": "피의자는 사실은 경로(장애인) 무임 승차 대상이 아니다.\n그럼에도 피의자는 {일시}경 {장소}에 있는 {상호} 개찰구에서 {명의자} 명의의 {카드}를 단말기에 접촉하여 정상 운임 ○○원을 내지 않고 무임으로 처리되도록 한 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 같은 방법으로 운임 합계 {금액}원을 지급하지 아니하였다.\n이로써 피의자는 컴퓨터등 정보처리장치에 권한 없이 정보를 입력하여 정보처리를 하게 함으로써 피해자 {상호}로부터 같은 금액 상당의 재산상 이익을 취득하였다.",
    "형법348의2:free_transit": "피의자는 {일시}경 {장소}에 있는 {상호} 개찰구에서 무임 승차 대상이 아님에도 {명의자} 명의의 {카드}를 접촉하는 부정한 방법으로 운임 ○○원을 지급하지 아니하고 자동개집표기를 통과하여 열차에 승차한 것을 비롯하여, 총 {횟수}회에 걸쳐 운임 합계 {금액}원을 지급하지 아니하였다.\n이로써 피의자는 부정한 방법으로 대가를 지급하지 아니하고 유료자동설비를 이용하여 재산상의 이익을 취득하였다.",
    "형법348의2:discount_transit": "피의자는 {일시}경 {장소}에 있는 {상호} 개찰구에서 할인 대상이 아님에도 {명의자} 명의의 {카드}를 접촉하는 부정한 방법으로 정상 운임과의 차액 ○○원을 지급하지 아니하고 자동개집표기를 통과하여 열차에 승차한 것을 비롯하여, 총 {횟수}회에 걸쳐 운임 차액 합계 {금액}원을 지급하지 아니하였다.\n이로써 피의자는 부정한 방법으로 대가를 지급하지 아니하고 유료자동설비를 이용하여 재산상의 이익을 취득하였다.",
    "경범3①39:discount_transit": "피의자는 {일시}경 {장소}에서 {상호} 지하철(버스)에 승차하면서 할인 대상이 아님에도 {카드}로 결제하여, 정당한 이유 없이 정상 운임과의 차액 {금액}원을 치르지 아니하였다.",
    "경범3①39:free_transit": "피의자는 {일시}경 {장소}에서 {상호} 지하철(버스)에 승차하면서 무임 대상이 아님에도 {카드}를 사용하여, 정당한 이유 없이 운임 {금액}원을 치르지 아니하였다.",

    // 편의시설 부정이용
    "형법348의2": "피의자는 {일시}경 {장소}에 있는 '{상호}'의 ○○(자동판매기 · 코인기기 등)에 ○○(외국 동전 · 이물질 등)을 넣는 부정한 방법으로 대가를 지급하지 아니하고 시가 {금액}원 상당의 {물품}을 취득(이용)하였다.\n이로써 피의자는 부정한 방법으로 대가를 지급하지 아니하고 유료자동설비를 이용하여 재물(재산상의 이익)을 취득하였다.",
    "형법348의2:payphone": "피의자는 {일시}경 {장소}에 설치된 공중전화기를 ○○하는 부정한 방법으로 조작하여 대가를 지급하지 아니하고 ○○분간 통화하여 통화요금 {금액}원 상당을 지급하지 아니하였다.\n이로써 피의자는 부정한 방법으로 대가를 지급하지 아니하고 유료자동설비를 이용하여 재산상의 이익을 취득하였다.",
    "형법348의2:gate_jump": "피의자는 {일시}경 {장소}에 있는 {상호} 개찰구에서 운임을 지급하지 아니하고 개찰구를 뛰어넘어(비상문을 통과하여) 승강장으로 들어가 열차에 승차한 것을 비롯하여, 별지 범죄일람표 기재와 같이 총 {횟수}회에 걸쳐 운임 합계 {금액}원을 지급하지 아니하였다.\n이로써 피의자는 부정한 방법으로 대가를 지급하지 아니하고 유료자동설비를 이용하여 재산상의 이익을 취득하였다.",
    "경범3①39": "피의자는 {일시}경 {장소}에서 {상호} 지하철(버스)에 승차하였음에도 정당한 이유 없이 운임 {금액}원을 치르지 아니하였다.",
    "형법347:bus_no_pay": "피의자는 {일시}경 {장소}에서 {상호} 버스에 승차하면서 운전기사인 피해자 ○○○에게 교통카드를 단말기에 접촉하는 척하는 등 운임을 낸 것처럼 행세하여, 이에 속은 피해자로부터 운임 {금액}원 상당의 운송 용역을 제공받았다.\n이로써 피의자는 피해자를 기망하여 재산상의 이익을 취득하였다.",
    "형법236": "피의자는 {일시}경 {장소}에 설치된 공중전화기에 위와 같이 절취(습득)한 피해자 {명의자} 명의의 후불식 전화카드를 넣어 통화하는 방법으로 이를 사용하여, 권리의무에 관한 타인의 사문서를 부정행사하였다.",
    "형법366": "피의자는 {일시}경 {장소}에 있는 '{상호}'의 ○○(기기)를 ○○하는 방법으로 손괴하여 수리비 {금액}원 상당이 들도록 그 효용을 해하였다.",

    // 잘못 들어온 돈
    "형법355①:mistaken": "피의자는 {일시}경 피해자 {명의자}가 착오로 피의자 명의 {상호} 계좌로 송금한 {금액}원을 피해자를 위하여 보관하던 중, ○○경 {장소}에서 그중 ○○원을 임의로 인출하여 사용함으로써 이를 횡령하였다.",
    "형법355①:refuse": "피의자는 {일시}경 피해자 {명의자}가 착오로 피의자 명의 {상호} 계좌로 송금한 {금액}원을 피해자를 위하여 보관하던 중, ○○경 피해자(은행)로부터 반환을 요구받았음에도 정당한 이유 없이 그 반환을 거부하여 이를 횡령하였다.",
    "형법355①:fraud_not_accomplice": "피의자는 {일시}경 전기통신금융사기 피해자 {명의자}가 성명불상자에게 속아 피의자 명의 {상호} 계좌로 송금한 {금액}원을 피해자를 위하여 보관하던 중, ○○경 {장소}에서 그중 ○○원을 임의로 인출하여 사용함으로써 이를 횡령하였다.",
    "통사15의2": "피의자는 성명불상의 전기통신금융사기 조직원들과 공모하여, 성명불상자는 {일시}경 피해자 {명의자}에게 전화하여 \"○○\"라고 거짓말하고, 이에 속은 피해자로 하여금 {상호} 계좌로 {금액}원을 송금하게 하였으며, 피의자는 ○○경 {장소}에서 위 계좌에서 그 돈을 인출하여 조직원에게 전달하였다.\n이로써 피의자는 성명불상자들과 공모하여 전기통신금융사기를 행하였다.",

    // 대포통장·카드
    "전금49④1": "누구든지 접근매체를 사용 및 관리함에 있어서 다른 법률에 특별한 규정이 없는 한 접근매체를 양도하거나 양수하여서는 아니 된다.\n그럼에도 피의자는 {일시}경 {장소}에서 성명불상자에게 피의자 명의 {상호} 계좌에 연결된 체크카드 1장과 비밀번호를 ○○(택배 · 직접 전달) 방법으로 건네주어 접근매체를 양도하였다.",
    "전금49④1:take": "누구든지 접근매체를 사용 및 관리함에 있어서 다른 법률에 특별한 규정이 없는 한 접근매체를 양도하거나 양수하여서는 아니 된다.\n그럼에도 피의자는 {일시}경 {장소}에서 {명의자}로부터 그 명의 {상호} 계좌에 연결된 체크카드 1장과 비밀번호를 ○○원에 넘겨받아 접근매체를 양수하였다.",
    "전금49④2": "누구든지 대가를 수수 · 요구 또는 약속하면서, 또는 범죄에 이용될 것을 알면서 접근매체를 대여하여서는 아니 된다.\n그럼에도 피의자는 {일시}경 {장소}에서 성명불상자로부터 ○○(대가)을 받기로 약속하고 피의자 명의 {상호} 계좌에 연결된 체크카드 1장을 ○○ 방법으로 보내 접근매체를 대여하였다.",
    "전금49④2:take": "누구든지 대가를 수수 · 요구 또는 약속하면서, 또는 범죄에 이용할 목적으로 접근매체를 보관 · 전달 · 유통하여서는 아니 된다.\n그럼에도 피의자는 {일시}경 {장소}에서 성명불상자로부터 건당 ○○원을 받기로 하고 {명의자} 명의 {상호} 계좌에 연결된 체크카드 1장을 건네받아 보관하고 ○○에게 전달하였다.",
    "전금49④3": "누구든지 접근매체를 질권의 목적으로 하여서는 아니 된다.\n그럼에도 피의자는 {일시}경 {장소}에서 ○○에게 ○○원을 빌리면서 그 담보로 피의자 명의 {상호} 계좌에 연결된 체크카드 1장과 비밀번호를 맡겨 접근매체를 질권의 목적으로 하였다.",
    "전금49④4": "누구든지 접근매체의 양도 · 대여 등을 알선 · 중개 · 광고하거나 대가를 수수 · 요구 또는 약속하면서 권유하여서는 아니 된다.\n그럼에도 피의자는 {일시}경 {장소}에서 ○○(SNS · 문자)에 \"통장 · 체크카드 대여 시 ○○원 지급\"이라는 광고를 게시하여 접근매체의 대여를 광고(알선)하였다.",
    "전금49④5": "누구든지 범죄에 이용할 목적으로 또는 범죄에 이용될 것을 알면서 계좌와 관련된 정보를 제공하거나 제공받아서는 아니 된다.\n그럼에도 피의자는 {일시}경 {장소}에서 그 정보가 범죄에 이용될 것을 알면서 성명불상자에게 피의자 명의 {상호} 계좌번호 등 계좌와 관련된 정보를 제공하였다.",
    "여전70④3": "신용카드는 양도 · 양수할 수 없다.\n그럼에도 피의자는 {일시}경 {장소}에서 ○○에게 피의자 명의 {카드} 1장을 ○○원에 넘겨주어 신용카드를 양도하였다.",
    "여전70④3:take": "신용카드는 양도 · 양수할 수 없다.\n그럼에도 피의자는 {일시}경 {장소}에서 {명의자}로부터 그 명의 {카드} 1장을 ○○원에 넘겨받아 신용카드를 양수하였다."
  };

  // 입력칸이 비었을 때 쓰는 기본값 (수단에 따라)
  var CARD_WORD = { credit: "신용카드", check: "체크카드", cash: "현금카드", prepaid: "교통카드", discount_card: "청소년(어린이)용 교통카드", free_card: "무임 교통카드", cardinfo: "신용카드", phone: "휴대전화", forged: "위조 신용카드", impersonated: "신용카드", access: "체크카드", accountinfo: "계좌정보" };

  function factKey(f, ctx) {
    var tries = [];
    if (f.useType) tries.push(f.law + ":" + f.useType);
    if (ctx.mode === "money") tries.push(f.law + ":" + ctx.moneyCase);
    if (ctx.mode === "mule") tries.push(f.law + ":" + ctx.role, f.law + ":" + ctx.how);
    tries.push(f.law);
    for (var i = 0; i < tries.length; i++) if (FACTS[tries[i]]) return tries[i];
    return null;
  }

  // 분석 입력 + 결과 → 안내를 고르는 조건
  function ctx(inp, r) {
    var laws = {};
    r.findings.forEach(function (f) { if (f.status === "apply" && f.law) laws[f.law] = true; });
    var uses = inp.uses || [];
    return {
      mode: inp.mode, medium: inp.medium, acq: inp.acq, entrust: inp.entrust,
      uses: uses.map(function (u) { return u.type; }),
      ok: uses.some(function (u) { return u.result !== "denied"; }),
      denied: uses.some(function (u) { return u.result === "denied"; }),
      relation: inp.relation || "none", amount: inp.amount || 0, laws: laws,
      item: inp.item, role: inp.role, how: inp.how, usedForFraud: !!inp.usedForFraud, moneyCase: inp.moneyCase || "",
      facilityCase: inp.facilityCase || "", result: inp.result
    };
  }

  return {
    ctx: ctx,
    build: build,
    facts: FACTS,
    factKey: factKey,
    defaults: function (ctx) { return { "카드": CARD_WORD[ctx.mode === "mule" ? ctx.item : ctx.medium] || "" }; },
    factsBasis: "형사소송법 제254조 제4항(범죄의 시일 · 장소 · 방법을 명시하여 사실을 특정)에 따라 일시 · 장소 · 방법 · 결과를 적는다. 피해자는 실제 피해 주체(명의자 / 가맹점 / 금융기관)로 명확히 특정한다 — 친족상도례 적용 여부가 피해자에 따라 달라진다 (2024도19846). 같은 카드 반복 사용은 포괄일죄이므로 대표 1건을 적고 나머지는 별지 범죄일람표로 정리한다 (96도1181)."
  };
})();

if (typeof module !== "undefined") module.exports = GUIDES;
