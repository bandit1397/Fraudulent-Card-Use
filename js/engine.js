/*
 * 판단 엔진 — 입력(사건 사실)을 받아 죄명 검토 결과를 돌려준다.
 * 화면 코드와 분리되어 있어 tests/run.js 에서 Node로 그대로 검증한다.
 *
 * 결과 항목(finding)
 *   status : "apply"(적용) | "review"(검토 필요) | "no"(불성립·해당 없음)
 *   law    : data/laws.js 의 키
 *   victim : "holder"(명의자·소유자) | "merchant"(가맹점) | "bank"(금융기관·ATM 관리자)
 *            | "cardco"(카드사) | "public"(사회적 법익) | "sender"(송금인·피해자)
 *   precs  : 근거 판례 사건번호 (data/precedents.js)
 */
(function (root) {
  "use strict";

  // ── 선택지 정의 (화면과 테스트가 함께 쓴다) ───────────────
  var MEDIA = {
    credit: "신용카드 (후불교통 기능 포함)",
    check: "체크카드 (직불)",
    cash: "현금카드 · 통장",
    prepaid: "선불카드 · 일반 교통카드",
    discount_card: "청소년 · 어린이 할인 교통카드",
    free_card: "경로 · 장애인 등 무임 교통카드",
    cardinfo: "카드번호 등 카드정보만",
    phone: "타인 휴대전화 (간편결제 · 뱅킹앱)",
    forged: "위조 · 변조 카드",
    impersonated: "타인 명의로 몰래 발급받은 카드"
  };

  var ACQ = {
    found: "길 등에서 습득",
    stolen: "절취 (훔침)",
    temp: "몰래 꺼내 쓰고 곧 제자리에 둠",
    received: "훔치거나 주운 것임을 알고 넘겨받음",
    robbed: "폭행 · 협박으로 강제로 빼앗음 (강취)",
    extorted: "겁을 줘서 받아냄 (공갈)",
    deceived: "속여서 받음 (기망)",
    entrusted: "맡아서 보관 중 · 심부름으로 받음",
    info_illegal: "피싱 · 몰래 촬영 · 해킹 등으로 정보를 알아냄",
    info_known: "평소 알고 있던 정보 · 잠금 비밀번호",
    made: "직접 위조 · 변조함",
    obtained: "위조 · 변조 카드를 구입 · 입수함",
    applied: "타인 명의를 도용해 발급 신청",
    borrowed: "명의자(가족 등)에게 빌림 · 사용 승낙 있음",
    own: "본인 명의 카드인데 할인 · 무임 자격이 없어짐 (성인이 됨, 자격 해제 등)",
    unknown: "취득 경위 불명"
  };

  // 수단별로 선택 가능한 취득 경위
  var ACQ_BY_MEDIUM = {
    credit: ["found", "stolen", "temp", "received", "robbed", "extorted", "deceived", "entrusted", "borrowed", "unknown"],
    check: ["found", "stolen", "temp", "received", "robbed", "extorted", "deceived", "entrusted", "borrowed", "unknown"],
    cash: ["found", "stolen", "temp", "received", "robbed", "extorted", "deceived", "entrusted", "unknown"],
    prepaid: ["found", "stolen", "temp", "received", "robbed", "extorted", "deceived", "borrowed", "unknown"],
    discount_card: ["borrowed", "own", "found", "stolen", "temp", "received", "robbed", "extorted", "deceived", "unknown"],
    free_card: ["borrowed", "own", "found", "stolen", "temp", "received", "robbed", "extorted", "deceived", "unknown"],
    cardinfo: ["info_illegal", "info_known", "found", "stolen"],
    phone: ["stolen", "found", "temp", "entrusted", "info_known", "robbed", "unknown"],
    forged: ["made", "obtained"],
    impersonated: ["applied"]
  };

  var USES = {
    store: "대면 가맹점 결제 (편의점 · 식당 등)",
    kiosk: "무인 단말기 결제 (키오스크 · 무인점포 · 주유기)",
    atm_cash: "ATM 예금 인출",
    cash_service: "ATM 현금서비스 (카드론 포함)",
    atm_transfer: "ATM에서 계좌이체",
    online: "온라인 · 앱 결제 / 비대면 대출",
    bank_transfer: "모바일 · 인터넷뱅킹 계좌이체",
    transit: "지하철 · 버스 승차",
    discount_transit: "성인 등 할인 대상이 아닌 사람이 지하철 · 버스 승차",
    free_transit: "무임 대상이 아닌 사람이 지하철 · 버스 승차"
  };

  var USES_BY_MEDIUM = {
    credit: ["store", "kiosk", "cash_service", "atm_transfer", "online", "transit"],
    check: ["store", "kiosk", "atm_cash", "atm_transfer", "online", "transit"],
    cash: ["atm_cash", "atm_transfer"],
    prepaid: ["store", "kiosk", "transit"],
    discount_card: ["discount_transit", "store", "kiosk"],
    free_card: ["free_transit"],
    cardinfo: ["online"],
    phone: ["store", "online", "bank_transfer"],
    forged: ["store", "kiosk", "cash_service"],
    impersonated: ["store", "kiosk", "cash_service", "online"]
  };

  var RELATION = {
    none: "친족 아님",
    close: "직계혈족 · 배우자 · 동거친족 · 동거가족 (또는 그 배우자)",
    other: "그 밖의 친족"
  };

  var DATE = {
    after20251223: "2025. 12. 23. 이후",
    mid: "2024. 6. 27. ~ 2025. 12. 22.",
    before20240627: "2024. 6. 26. 이전"
  };

  // ── 도우미 ─────────────────────────────────────────────
  function F(status, law, o) {
    o = o || {};
    return {
      status: status, law: law, title: o.title || null, victim: o.victim || null,
      reason: o.reason || "", precs: o.precs || [], notes: o.notes || [], stage: o.stage || null,
      fact: o.fact || null // 범죄사실 문안 키를 직접 지정할 때
    };
  }

  var isCardLike = function (m) { return m === "credit" || m === "check" || m === "forged" || m === "impersonated"; };
  // 제70조 제1항 제3·4호의 객체는 '신용카드나 직불카드'만
  var isCreditOrDebit = function (m) { return m === "credit" || m === "check"; };
  // 잔액이 카드에 저장된 교통카드류 (여신전문금융업법 제70조 제1항 제3·4호 대상 아님)
  var isPrepaidLike = function (m) { return m === "prepaid" || m === "discount_card" || m === "free_card"; };
  var LOST_STOLEN = ["found", "stolen", "temp", "received", "unknown"];
  var TAKEN_BY_FORCE_OR_FRAUD = ["robbed", "extorted", "deceived", "entrusted"];

  // ── 1. 취득 단계 ───────────────────────────────────────
  function acquisition(inp) {
    var m = inp.medium, a = inp.acq, out = [];
    var obj = m === "phone" ? "휴대전화" : (m === "cardinfo" ? "카드" : "카드");
    switch (a) {
      case "found":
        out.push(F("apply", "형법360①", { victim: "holder", reason: "분실된 " + obj + "를 습득하여 영득(가져감·사용)", notes: ["습득 후 곧바로 경찰·유실물센터에 신고하려 했다는 주장이 있으면 영득의사 확인"] }));
        break;
      case "stolen":
        out.push(F("apply", "형법329", { victim: "holder", reason: obj + " 자체에 대한 절도", notes: ["주거·건조물 침입이 함께 있으면 주거침입 등 별도 검토", "상습성이 있으면 상습절도(형법 제332조) 검토"] }));
        break;
      case "temp":
        out.push(F("no", "형법329", { victim: "holder", title: obj + " 자체 절도 — 불성립 가능", reason: "잠깐 쓰고 곧 제자리에 돌려놓았다면 " + obj + " 자체에 대한 불법영득의사 부정", precs: ["99도857"], notes: ["반환까지 걸린 시간, 원래 장소에 돌려놓았는지 확인 — 장시간 보유하거나 다른 곳에 버렸다면 절도 성립 가능", "카드 절도가 안 되더라도 '도난 카드'에는 해당 (99도857)"] }));
        break;
      case "received":
        out.push(F("apply", "형법362①", { victim: "holder", reason: "절도·점유이탈물횡령 등으로 얻은 카드임을 알면서 넘겨받음 (장물취득)", notes: ["'훔친(주운) 것인 줄 알았는지' 인식 확인이 핵심", "넘겨준 사람(본범) 인적사항 확보"] }));
        break;
      case "robbed":
        out.push(F("apply", "형법333", { victim: "holder", reason: "폭행·협박으로 반항을 억압하여 " + obj + " 강취", notes: ["폭행·협박이 반항을 억압할 정도에 이르지 않으면 공갈로 검토", "상해가 있으면 강도상해(형법 제337조)"] }));
        break;
      case "extorted":
        out.push(F("apply", "형법350", { victim: "holder", reason: "겁을 주어 " + obj + "를 교부받음 (공갈)", notes: ["반항을 억압할 정도의 폭행·협박이었다면 강도로 검토 (판단에 따라 이후 인출의 죄명이 달라짐 — 2007도1375)"] }));
        break;
      case "deceived":
        out.push(F("apply", "형법347", { victim: "holder", reason: "명의자를 속여 " + obj + "를 교부받음 (사기)" }));
        break;
      case "entrusted":
        out.push(F("review", "형법355①", { victim: "holder", fact: "형법355①:card", title: "횡령 (카드 자체를 영득했다면)", reason: "맡아 보관하던 " + obj + "를 돌려주지 않거나 자기 것처럼 처분했다면 횡령", notes: ["반환 거부·처분 여부 확인 — 맡은 상태에서 몰래 사용만 했다면 사용 단계의 죄명 위주로 검토"] }));
        break;
      case "info_illegal":
        if (m === "cardinfo") {
          out.push(F("apply", "여전70①6", { victim: "public", reason: "거짓이나 부정한 방법으로 알아낸 타인의 신용카드 정보 '보유' — 사용하지 않았어도 보유만으로 성립", notes: ["체크카드 정보는 제6호의 '신용카드 정보'에 해당하는지 검토 필요", "정보 취득 방법에 따라 정보통신망법·개인정보 보호법 위반 별도 검토"] }));
        }
        break;
      case "made":
        out.push(F("apply", "여전70①1", { victim: "public", reason: "신용카드등을 위조·변조 (미수·예비·음모도 처벌)" }));
        break;
      case "obtained":
        out.push(F("apply", "여전70①5", { victim: "public", reason: "행사할 목적으로 위조·변조 카드 취득" }));
        break;
      case "applied":
        out.push(F("review", "형법231", { victim: "public", fact: "형법231:applied", title: "사문서위조·행사 (발급신청서)", reason: "타인 명의로 카드 발급신청서를 작성·제출" }));
        out.push(F("review", "형법347", { victim: "cardco", fact: "형법347:applied", title: "사기 (카드사 기망 — 카드 발급)", reason: "명의를 모용해 카드사를 속여 카드를 발급받음" }));
        break;
      case "borrowed":
        out.push(F("no", null, { title: "카드 취득 — 범죄 아님", reason: "명의자의 승낙을 받아 빌린 카드 — 취득 행위 자체는 처벌 대상이 아님", notes: ["승낙 범위를 넘어 쓴 경우는 '맡아서 보관 중 · 심부름으로 받음'을 선택", "카드를 빌려준 명의자(청소년 등)는 원칙적으로 처벌 대상 아님 — 부정 사용에 적극 가담했다면 방조 검토"] }));
        break;
      case "own":
        out.push(F("no", null, { title: "카드 취득 — 범죄 아님", reason: "본인 명의 카드", notes: ["할인 · 무임 자격이 없어진 사실을 알고도 계속 썼는지(고의)가 핵심 — 운영기관의 성인 전환 안내 · 자동 전환 여부 확인"] }));
        break;
      case "unknown":
        out.push(F("review", null, { title: "취득 경위 수사 필요", reason: "명의자 진술로 '분실·도난' 여부를 먼저 확정하면 사용 단계 판단은 가능 (취득자가 처벌받을 필요 없음 — 99도857)", precs: ["99도857"], notes: ["취득 경위가 확인되면 절도·점유이탈물횡령·장물취득 중 해당 죄명 추가"] }));
        break;
    }
    out.forEach(function (f) { f.stage = "취득"; });
    return out;
  }

  // 사용 단계에서 쓰는 '부정사용' 조항 선택
  function misuseLaw(inp) {
    if (inp.medium === "forged") return "여전70①2";
    if (!isCreditOrDebit(inp.medium)) return null;
    if (LOST_STOLEN.indexOf(inp.acq) >= 0) return "여전70①3";
    if (inp.acq === "robbed" || inp.acq === "extorted" || inp.acq === "deceived") return "여전70①4";
    if (inp.acq === "entrusted") return "여전70①4"; // 횡령한 카드인 경우에만
    return null; // borrowed · own: 명의자 승낙 또는 본인 카드
  }

  function misuseFinding(inp, how, okPrecs) {
    var law = misuseLaw(inp);
    if (!law) return null;
    var precs = (okPrecs || []).slice();
    var notes = [];
    var status = "apply";
    if (law === "여전70①3") {
      if (inp.acq === "temp") precs.push("99도857");
      if (inp.acq === "unknown") notes.push("명의자 진술로 분실·도난 카드임을 확인");
    }
    if (law === "여전70①4") {
      if (inp.acq === "deceived") precs.push("2022도10629");
      if (inp.acq === "extorted") {
        status = "review";
        precs.push("2006도654");
        notes.push("피해자가 합의에 따라 '결제하라고' 직접 건넨 카드라면 점유가 의사에 반해 배제된 것이 아니어서 부정사용 불성립 (2006도654)");
      }
      if (inp.acq === "entrusted") {
        status = "review";
        notes.push("카드 자체를 횡령(영득)한 경우에만 제4호. 맡은 범위를 넘어 쓴 것만으로는 제4호 해당 여부 다툼 — 수사팀 검토");
      }
    }
    if (inp.medium === "check") notes.push("체크카드는 직불카드(제2조 제6호) — 소액 신용한도 기능이 있으면 신용카드 측면도 검토");
    return F(status, law, { victim: "public", reason: how, precs: precs, notes: notes });
  }

  // ── 2. 사용 단계 ───────────────────────────────────────
  function useFindings(inp, use) {
    var m = inp.medium, a = inp.acq, ok = use.result !== "denied", out = [];
    var mis;

    if (use.type === "discount_transit" || use.type === "free_transit") return discountTransit(inp, use);
    if (a === "borrowed" || a === "own") {
      out.push(F("no", null, { title: "카드 사용 — 범죄 아님", reason: (a === "own" ? "본인 카드" : "명의자 승낙 범위 안의 사용") + " — 카드 부정사용 · 사기 등 불성립", notes: ["할인 · 무임 교통카드를 자격 없이 쓴 경우는 '1. 무엇을 사용했나'에서 '청소년 · 어린이 할인 교통카드' 또는 '경로 · 장애인 등 무임 교통카드'를 선택"] }));
      return out;
    }

    switch (use.type) {
      // 대면 가맹점 결제
      case "store":
        if (isPrepaidLike(m)) {
          out.push(F("no", "여전70①3", { title: "카드 부정사용 — 해당 없음", reason: "제70조 제1항 제3·4호의 대상은 신용카드·직불카드뿐이고 선불카드는 빠져 있음" }));
          out.push(F("review", null, { title: "선불카드 결제의 재산범죄", reason: "카드에 저장된 금액 자체를 영득한 것으로 보아 취득 단계(절도·점유이탈물횡령)에 포함되는지, 가맹점에 대한 사기가 별도로 성립하는지 판례 미확인", notes: ["전자금융거래법 제49조 제2항 제3호(분실·도난 접근매체 사용) 해당 여부도 검토 — 판례 미확인"] }));
          break;
        }
        if (ok) {
          mis = misuseFinding(inp, "카드를 제시하고 매출전표에 서명·교부하여 대금 결제", ["92도77", "96도1181"]);
          if (m === "phone") mis = null;
          if (mis) out.push(mis);
          if (m === "phone") {
            out.push(F("apply", "형법347의2", { victim: "merchant", title: "컴퓨터등사용사기 (간편결제)", reason: "타인 휴대전화의 간편결제에 권한 없이 인증정보를 입력해 결제 — 결제 처리 자체는 정보처리장치가 수행", precs: ["2024도19846"], notes: ["점원이 명의를 확인하고 처분한 구조라면 사기(형법 제347조)로 볼 여지 — 결제 방식 확인", "휴대전화 등록 카드가 분실·도난 카드인지에 따라 여신전문금융업법 검토"] }));
          } else if (a === "deceived" || a === "extorted") {
            out.push(F("review", "형법347", { victim: "merchant", title: "사기 (가맹점 또는 명의자)", reason: "명의자를 속여(겁줘서) 받은 카드는 형식상 사용 승낙이 있어, 가맹점에 대한 사기와 명의자에 대한 사기(대금 편취) 중 어느 쪽으로 구성할지 검토", precs: ["2022도10629"] }));
          } else if (m !== "impersonated") {
            out.push(F("apply", "형법347", { victim: "merchant", title: "사기 (가맹점별)", reason: "정당한 카드 사용권자인 것처럼 가맹점을 속여 물품·용역을 받음", precs: ["96도1181"], notes: ["가맹점마다 별개의 사기죄 (실체적 경합)"] }));
          } else {
            out.push(F("apply", "형법347", { victim: "merchant", title: "사기 (가맹점)", reason: "명의 모용 카드로 정당한 회원인 것처럼 가맹점을 속여 물품·용역을 받음", notes: ["카드사에 대한 사기로 구성할지 검토"] }));
          }
        } else {
          var law = misuseLaw(inp);
          if (law && law !== "여전70①2") {
            out.push(F("no", law, { title: "카드 부정사용 — 미수(처벌 규정 없음)", reason: "승인 거절·매출 취소로 사용이 완성되지 않음. 제70조 제6항은 제1호·제2호 미수만 처벌", precs: ["2007도8767"] }));
          } else if (law === "여전70①2") {
            out.push(F("apply", "여전70①2", { title: "여신전문금융업법위반 (위조카드 사용 미수)", reason: "위조카드 사용은 미수도 처벌 (제70조 제6항)" }));
          }
          out.push(F("review", "형법347", { victim: "merchant", title: "사기미수", reason: "카드를 제시해 가맹점을 속이려 한 실행의 착수 여부 확인 (형법 제352조)" }));
        }
        break;

      // 무인 단말기
      case "kiosk":
        if (isPrepaidLike(m)) {
          out.push(F("no", "여전70①3", { title: "카드 부정사용 — 해당 없음", reason: "선불카드는 제3·4호 대상 아님" }));
          out.push(F("review", null, { title: "무인 결제의 재산범죄", reason: "판례 미확인 — 수사팀 검토" }));
          break;
        }
        if (ok) {
          mis = misuseFinding(inp, "무인 단말기에 카드를 넣어 대금 결제 — 기계 결제도 카드 본래 용도의 사용으로 본 판례 취지(95도997)", ["95도997"]);
          if (mis) { mis.status = mis.status === "apply" ? "review" : mis.status; mis.notes.push("무인 결제를 '사용'으로 직접 판단한 대법원 판례는 미확인 — 현금서비스 판례(95도997)의 취지상 해당 가능성이 높음"); out.push(mis); }
          out.push(F("no", "형법347", { title: "사기 — 불성립 가능", reason: "속은 사람(처분행위자)이 없음" }));
          out.push(F("review", null, { title: "물품 취득의 재산범죄 (절도 또는 컴퓨터등사용사기)", reason: "무인점포에서 물건을 가져간 경우 재물 취득은 절도, 결제로 얻은 이익은 컴퓨터등사용사기 검토 — 컴퓨터등사용사기의 객체는 재산상 이익만 (2002도2134)", precs: ["2002도2134"] }));
        } else if (m === "forged") {
          out.push(F("apply", "여전70①2", { title: "여신전문금융업법위반 (위조카드 사용 미수)", reason: "위조카드 사용은 미수도 처벌 (제70조 제6항)" }));
        } else if (misuseLaw(inp)) {
          out.push(F("no", misuseLaw(inp), { title: "카드 부정사용 — 미수(처벌 규정 없음)", reason: "결제가 완성되지 않음. 제70조 제6항은 제1호·제2호 미수만 처벌", precs: ["2007도8767"] }));
        }
        break;

      // ATM 예금 인출
      case "atm_cash":
        if (a === "deceived") {
          out.push(F("no", "형법329", { title: "인출한 현금 절도 — 불성립", reason: "속여서 받은 카드로 인출하면 카드 편취와 인출 전체가 하나의 사기죄(포괄일죄)", precs: ["2005도5869"] }));
          out.push(F("apply", "형법347", { victim: "holder", title: "사기 (카드 편취 + 예금 인출 포괄일죄)", reason: "명의자를 속여 카드와 인출 승낙을 받은 뒤 인출", precs: ["2005도5869"] }));
        } else if (a === "extorted") {
          out.push(F("no", "형법329", { title: "인출한 현금 절도 — 불성립", reason: "겁줘서 받은 카드로 인출하면 공갈죄 하나(포괄일죄)", precs: ["2007도1375", "95도1728"] }));
          out.push(F("apply", "형법350", { victim: "holder", title: "공갈 (카드 갈취 + 예금 인출 포괄일죄)", reason: "겁을 주어 카드와 인출 승낙을 받은 뒤 인출", precs: ["2007도1375", "95도1728"] }));
        } else if (a === "entrusted" && inp.entrust === "asked") {
          out.push(F(ok ? "apply" : "review", "형법347의2", { victim: "bank", title: "컴퓨터등사용사기 (위임 금액 초과분)", reason: "부탁받은 금액을 넘겨 인출한 차액", precs: ["2005도3516"] }));
        } else {
          out.push(F(ok && a !== "entrusted" ? "apply" : "review", "형법329", { victim: "bank", title: ok ? "절도 (인출한 현금)" : "절도미수 (인출 시도)", reason: ok ? "ATM 관리자의 의사에 반하여 현금을 자기 지배로 옮김" : "카드 투입·비밀번호 입력 등 실행의 착수 여부 확인 (형법 제342조)", precs: a === "robbed" ? ["2007도1375"] : ["95도997"], notes: a === "entrusted" ? ["보관만 부탁받은 카드로 인출 — 인출 위임이 없다면 절도 검토"] : [] }));
        }
        if (isCreditOrDebit(m)) {
          out.push(F("no", misuseLaw(inp) || "여전70①3", { title: "카드 부정사용 — 해당 없음", reason: "직불·현금카드로 ATM에서 예금을 인출하는 것은 카드 본래 용법의 '사용'이 아님", precs: ["2003도3977"] }));
        }
        if (LOST_STOLEN.indexOf(a) >= 0 || a === "robbed") {
          out.push(F("review", a === "robbed" ? "전금49②5" : "전금49②3", { victim: "public", title: "전자금융거래법위반 (분실·도난·강취 접근매체 사용) 병기 여부", reason: "현금카드·체크카드는 접근매체(전자식 카드)에 해당. ATM 인출에 이 조항을 함께 적용한 대법원 판례는 미확인 — 검사 지휘·관할 실무 확인" }));
        }
        break;

      // ATM 현금서비스
      case "cash_service":
        if (m === "impersonated") {
          out.push(F(ok ? "apply" : "review", "형법329", { victim: "bank", title: ok ? "절도 (현금서비스로 받은 현금)" : "절도미수", reason: "명의 모용 발급 카드의 현금대출은 카드사가 허용한 행위가 아님", precs: ["2002도2134"] }));
          out.push(F("no", "형법347의2", { title: "컴퓨터등사용사기 — 불성립", reason: "객체가 현금(재물)이므로 재산상 이익만 대상으로 하는 컴퓨터등사용사기는 적용 불가", precs: ["2002도2134"] }));
          break;
        }
        if (ok) {
          mis = misuseFinding(inp, "현금서비스도 신용카드 본래 용도의 사용", ["95도997"]);
          if (mis) out.push(mis);
        } else if (m === "forged") {
          out.push(F("apply", "여전70①2", { title: "여신전문금융업법위반 (위조카드 사용 미수)", reason: "위조카드 사용은 미수도 처벌 (제70조 제6항)" }));
        } else {
          out.push(F("no", misuseLaw(inp) || "여전70①3", { title: "카드 부정사용 — 미수(처벌 규정 없음)", reason: "현금서비스가 이루어지지 않음. 제70조 제6항은 제1호·제2호 미수만 처벌", precs: ["2007도8767"] }));
        }
        if (a === "deceived" || a === "extorted") {
          out.push(F("review", "형법329", { victim: "bank", title: "별도 절도 성립 여부", reason: "속이거나 겁줘서 받은 카드의 예금 인출은 취득 범죄의 포괄일죄로 본 판례(2005도5869, 2007도1375)가 있으나, 현금서비스(카드사 대출)에 대한 직접 판례는 미확인", precs: ["2005도5869", "2007도1375"] }));
        } else {
          out.push(F(ok ? "apply" : "review", "형법329", { victim: "bank", title: ok ? "절도 (현금서비스로 받은 현금)" : "절도미수", reason: "현금을 취득하여 ATM 관리자의 지배를 배제", precs: a === "robbed" ? ["95도997", "2007도1375"] : ["95도997"], notes: ["카드 부정사용죄와 절도죄는 실체적 경합"] }));
        }
        break;

      // ATM 계좌이체
      case "atm_transfer":
        if (a === "deceived" || a === "extorted") {
          out.push(F("review", a === "deceived" ? "형법347" : "형법350", { victim: "holder", title: (a === "deceived" ? "사기" : "공갈") + " 포괄일죄 여부", reason: "카드와 사용 승낙을 받은 경우 인출 판례(2005도5869, 2007도1375)의 취지상 취득 범죄에 포함될 가능성 — 계좌이체 직접 판례 미확인", precs: ["2005도5869", "2007도1375"] }));
          break;
        }
        out.push(F(ok ? "apply" : "review", "형법347의2", { victim: "bank", title: ok ? "컴퓨터등사용사기 (계좌이체)" : "컴퓨터등사용사기 미수", reason: "타인 카드로 권한 없이 ATM에 정보를 입력해 자기(제3자) 계좌로 이체 — 피해자는 명의자 거래 금융기관", precs: ["2008도2440", "2006도2704"] }));
        out.push(F("no", "형법329", { title: "절도 — 불성립", reason: "계좌이체는 절취가 아니고, 이체 후 자기 카드로 인출한 것도 절도가 아님", precs: ["2008도2440"] }));
        break;

      // 온라인·앱 결제
      case "online":
        out.push(F(ok ? "apply" : "review", "형법347의2", { victim: "merchant", title: ok ? "컴퓨터등사용사기" : "컴퓨터등사용사기 미수", reason: "인터넷 사이트·앱에 승낙 없이 타인 카드번호·비밀번호 등을 입력해 결제하거나 대출받음 — 피해자는 가맹점·대출금융기관", precs: ["2024도19846"] }));
        if (m === "cardinfo" && a === "info_illegal") {
          out.push(F(ok ? "apply" : "no", "여전70①6", { victim: "public", title: "여신전문금융업법위반 (부정 취득 카드정보로 거래)", reason: "부정한 방법으로 알아낸 신용카드 정보를 이용해 신용카드로 거래" }));
        } else {
          // 카드 자체가 분실·도난(제3호)되거나 강취·기망 등으로 취득(제4호)된 경우에만 해당
          var onlineLaw = m === "cardinfo" ? ((a === "found" || a === "stolen") ? "여전70①3" : null) : misuseLaw(inp);
          if (onlineLaw && onlineLaw !== "여전70①2") {
            out.push(F("review", onlineLaw, { victim: "public", title: "카드 부정사용 해당 여부", reason: "실물 카드를 제시하지 않고 번호만 입력한 결제가 카드 '사용'인지 다툼 — 판례 미확인", notes: ["카드정보를 부정한 방법으로 알아냈다면 제70조 제1항 제6호 검토"] }));
          }
        }
        if (m === "phone") out.push(F("review", "전금49②3", { victim: "public", title: "전자금융거래법위반 (분실·도난 접근매체 사용)", reason: "휴대전화에 저장된 인증서·간편결제 정보가 접근매체에 해당하는지, 분실·도난된 것인지 검토" }));
        break;

      // 모바일·인터넷뱅킹 이체
      case "bank_transfer":
        out.push(F(ok ? "apply" : "review", "형법347의2", { victim: "bank", title: ok ? "컴퓨터등사용사기 (계좌이체)" : "컴퓨터등사용사기 미수", reason: "명의자 승낙 없이 뱅킹앱에 인증정보를 입력해 이체 — 피해자는 명의자 거래 금융기관이므로 친족상도례 적용 안 됨", precs: ["2006도2704", "2024도19846"], notes: ["이체가 완료되면 기수 — 이후 취소되어도 영향 없음 (2006도4127 취지)"] }));
        out.push(F("review", a === "robbed" ? "전금49②5" : "전금49②3", { victim: "public", title: "전자금융거래법위반 (접근매체 사용)", reason: "인증서·OTP·비밀번호 등 접근매체가 분실·도난(강취 등)된 것이면 해당 가능 — 판례 미확인" }));
        break;

      // 대중교통 승차
      case "transit":
        if (isPrepaidLike(m)) {
          out.push(F("no", "여전70①3", { title: "카드 부정사용 — 해당 없음", reason: "선불교통카드는 제3·4호 대상(신용·직불카드)이 아님" }));
          out.push(F("review", null, { title: "승차 행위의 별도 범죄", reason: "카드 잔액은 카드 자체의 영득(절도·점유이탈물횡령)에 포함된다고 볼지, 승차마다 별도 범죄(컴퓨터등사용사기 등)로 볼지 판례 미확인", notes: ["운임은 카드로 지급되었으므로 경범죄 무임승차·철도 부가운임 대상은 아님"] }));
        } else {
          out.push(F("review", misuseLaw(inp) || "여전70①3", { victim: "public", title: "카드 부정사용 (교통카드 기능)", reason: "후불·체크 교통 기능으로 단말기에 태그한 것이 카드 본래 용도의 '사용'인지 — 판례 미확인, 현금서비스 판례(95도997) 취지상 해당 가능성" , precs: ["95도997"] }));
          out.push(F("review", "형법347의2", { victim: "merchant", title: "운임 상당 재산상 이익", reason: "사람의 처분행위 없이 단말기 처리로 운임 결제 — 컴퓨터등사용사기 해당 여부 판례 미확인" }));
        }
        out.push(F("no", "경범3①39", { title: "무임승차 — 해당 없음", reason: "운임이 카드로 지급됨" }));
        break;
    }
    return out;
  }

  // 할인 · 무임 교통카드를 자격 없는 사람이 사용
  function discountTransit(inp, use) {
    var a = inp.acq, ok = use.result !== "denied", out = [], free = use.type === "free_transit";
    var what = free ? "무임 운임" : "할인 운임";
    // 남의 카드를 주웠거나 훔친 경우 카드 자체 · 잔액 문제는 일반 승차와 같다
    if (LOST_STOLEN.indexOf(a) >= 0 || a === "robbed" || a === "extorted" || a === "deceived") {
      useFindings(inp, { type: "transit", result: use.result }).forEach(function (f) { if (f.law !== "경범3①39") out.push(f); });
    }
    out.push(F(ok ? "review" : "no", "형법347의2", { victim: "merchant", title: "컴퓨터등사용사기 (" + (free ? "운임 전액" : "운임 차액") + ")",
      reason: "할인 · 무임 대상이 아님에도 해당 카드를 단말기에 접촉해 " + what + "으로 처리되게 함 — 정상 운임과의 차액이 재산상 이익. 피해자는 운송사업자",
      precs: ["부산지법2019"], notes: ["대법원 판례 없음 — 하급심(부산지법 2019. 11. 13.)에서 자녀의 어린이 카드 사용에 컴퓨터등사용사기 등으로 벌금형 (언론 보도)", "버스에서 기사가 단말기 안내음을 듣고 태운 경우는 사람의 판단이 개입 — 사기(형법 제347조) 해당 여부도 검토", "소액 · 1회성이면 실무상 운영기관 부가운임 징수로 끝나는 경우가 많음 — 상습 · 다액 · 납부 거부 시 형사 입건 검토"] }));
    out.push(F("review", "형법348의2", { victim: "merchant", title: "편의시설부정이용 해당 여부",
      reason: free ? "운임을 전혀 내지 않고 자동개집표기 등을 통과 — '대가를 지급하지 아니하고'에 해당할 여지가 큼" : "할인 운임은 냈으므로 '대가를 지급하지 아니하고'에 해당하는지 다툼",
      precs: ["2001도3625"] }));
    if (ok) out.push(F("review", "경범3①39", { victim: "merchant", title: "경범죄 무임승차", reason: "영업용 차량에 타고 정당한 이유 없이 '제 값'을 치르지 않음 — 형사 입건하지 않는 경미 사안은 범칙금 통고 검토" }));
    var fare = F("review", "철도10", { title: "부가운임 징수 (운영기관)", reason: "철도는 승차 구간 운임 외 30배 범위, 도시철도 · 버스는 운송약관에 따른 부가금 — 형벌이 아니라 운영기관이 징수. 미납 시 경범죄 고발 등 실무 확인" });
    if (a === "own") fare.notes.push("본인 카드 — 자격 상실을 알았는지(고의) 확인. 몰랐다면 범죄 불성립");
    out.push(fare);
    return out;
  }

  // ── 3. 친족 관계 · 범행 시기 ───────────────────────────
  var HOLDER_PROPERTY = ["형법329", "형법347", "형법347의2", "형법350", "형법355①", "형법360①", "형법362①"];

  function relativeNote(inp, f) {
    if (inp.relation === "none" || !inp.relation) return null;
    if (f.status === "no") return null;
    if (f.law === "형법333") return "강도죄는 친족상도례 적용 대상이 아님";
    if (HOLDER_PROPERTY.indexOf(f.law) < 0) return null;
    if (f.victim === "merchant" || f.victim === "bank" || f.victim === "cardco")
      return "피해자가 가맹점·금융기관·카드사이므로 친족상도례 적용 안 됨 (2006도2704, 2024도19846) — 범죄사실에 피해자를 명확히 특정할 것";
    if (f.victim !== "holder") return null;
    if (inp.date === "before20240627") {
      return inp.relation === "close"
        ? "2024. 6. 26. 이전 범행 + 직계혈족·배우자·동거친족 등 → 구 형법 제328조 제1항 '형 면제' 적용 (헌법불합치결정의 소급효 없음 — 2024도19846). 처리 방식 수사팀 확인"
        : "2024. 6. 26. 이전 범행 + 그 밖의 친족 → 구 형법 제328조 제2항 친고죄 (고소 필요)";
    }
    var s = "친족 → 고소가 있어야 공소제기 가능 (개정 형법 제328조 제1항, 2024. 6. 27. 이후 범행부터 적용). 직계존속도 고소 가능. 고소기간은 범인을 안 날부터 6개월 (형사소송법 제230조)";
    s += " / 2024. 6. 27.~2025. 12. 30. 범행은 개정법 부칙 제3조에 따라 2025. 12. 31.부터 6개월까지 고소할 수 있었음 — 해당하면 고소 시기 확인";
    return s;
  }

  // ── 4. 경합(죄수) 정리 ─────────────────────────────────
  function concurrence(inp, findings) {
    var notes = [];
    var applied = findings.filter(function (f) { return f.status === "apply"; });
    var has = function (law) { return applied.some(function (f) { return f.law === law; }); };
    var acqApplied = applied.filter(function (f) { return f.stage === "취득"; });
    var useApplied = applied.filter(function (f) { return f.stage !== "취득"; });

    if (acqApplied.length && useApplied.length && ["deceived", "extorted"].indexOf(inp.acq) < 0)
      notes.push({ text: "취득 단계의 죄와 사용 단계의 죄는 실체적 경합 — 사용은 취득의 불가벌적 사후행위가 아님", precs: ["96도1181"] });
    var misuseUses = applied.filter(function (f) { return /^여전70①[234]$/.test(f.law); });
    if (misuseUses.length > 1 || (misuseUses.length === 1 && inp.uses.length > 1))
      notes.push({ text: "같은 카드를 한 번의 범의로 여러 번 부정사용 → 카드 부정사용죄는 포괄일죄 (사용 횟수·금액은 범죄일람표로)", precs: ["96도1181"] });
    if (has("형법347") && misuseUses.length)
      notes.push({ text: "카드 부정사용죄와 가맹점에 대한 사기죄는 실체적 경합, 가맹점별 사기죄끼리도 실체적 경합", precs: ["96도1181"] });
    if (has("형법329") && misuseUses.length && inp.uses.some(function (u) { return u.type === "cash_service"; }))
      notes.push({ text: "현금서비스: 카드 부정사용죄와 현금 절도죄는 실체적 경합", precs: ["95도997"] });
    if (inp.uses.some(function (u) { return u.type === "store" && u.result !== "denied"; }) && misuseUses.length)
      notes.push({ text: "매출전표 서명의 사문서위조·행사는 카드 부정사용죄에 흡수 — 별도 입건하지 않음", precs: ["92도77"] });
    if (inp.acq === "deceived" && inp.uses.some(function (u) { return u.type === "atm_cash"; }))
      notes.push({ text: "카드 편취와 예금 인출은 하나의 사기죄(포괄일죄)", precs: ["2005도5869"] });
    if (inp.acq === "extorted" && inp.uses.some(function (u) { return u.type === "atm_cash"; }))
      notes.push({ text: "카드 갈취와 예금 인출은 하나의 공갈죄(포괄일죄)", precs: ["2007도1375", "95도1728"] });
    if (inp.acq === "robbed" && inp.uses.some(function (u) { return u.type === "atm_cash" || u.type === "cash_service"; }))
      notes.push({ text: "강도죄와 별도로 인출 현금에 대한 절도죄 성립 (실체적 경합)", precs: ["2007도1375"] });
    if (inp.amount >= 500000000 && applied.some(function (f) { return ["형법347", "형법347의2", "형법350", "형법355①"].indexOf(f.law) >= 0; }))
      notes.push({ text: "사기·컴퓨터등사용사기·공갈·횡령 이득액이 5억원 이상이면 특정경제범죄법 제3조 가중처벌 검토 (포괄일죄는 합산)", precs: [], law: "특경3" });
    return notes;
  }

  // ── 5. 범행 시기별 법정형 ──────────────────────────────
  function penaltyFor(law, inp) {
    var L = root.LAWS[law];
    if (!L) return "";
    if (L.penaltyOld && inp.date !== "after20251223") return L.penaltyOld;
    return L.penalty || "";
  }

  // ── 진입점: 카드·계좌·간편결제 무단 사용 ─────────────────
  function analyzeUse(inp) {
    inp.uses = inp.uses || [];
    var findings = acquisition(inp);
    inp.uses.forEach(function (u, i) {
      useFindings(inp, u).forEach(function (f) {
        f.stage = "사용 " + (i + 1) + " · " + USES[u.type] + (u.result === "denied" ? " (실패·거절)" : "");
        f.useType = u.type;
        findings.push(f);
      });
    });
    findings.forEach(function (f) {
      var r = relativeNote(inp, f);
      if (r) f.notes.push(r);
      f.penalty = f.law ? penaltyFor(f.law, inp) : "";
    });
    return { findings: findings, concurrence: concurrence(inp, findings), summary: summarize(findings) };
  }

  // ── 진입점: 대포통장·대포카드 (양도·대여·보관) ───────────
  var MULE_ITEM = {
    access: "체크카드 · 현금카드 · 통장 · OTP · 인증서 (접근매체)",
    credit: "신용카드",
    accountinfo: "계좌번호 등 계좌정보만"
  };
  var MULE_ROLE = {
    give: "자기 명의 것을 넘겨줌 (명의인)",
    take: "넘겨받음 · 보관 · 전달 (수거책 · 운반책 포함)",
    broker: "알선 · 중개 · 광고 · 모집"
  };
  var MULE_HOW = {
    sell: "팔거나 아주 넘겨줌 (돌려받을 생각 없음)",
    rent_paid: "돈 · 대출 등 대가를 받기로 하고 빌려줌",
    rent_crime: "범죄에 쓰일 줄 알면서 빌려줌",
    loan_bait: "대출해 준다는 말에 속아 보냄",
    pledge: "빚 담보로 맡김",
    free_family: "가족 · 지인에게 대가 없이 잠깐 빌려줌"
  };

  function analyzeMule(inp) {
    var f = [];
    var item = inp.item, role = inp.role, how = inp.how;
    if (role === "broker") {
      if (item === "credit") f.push(F("review", "여전70④3", { fact: "여전70④3:알선", title: "신용카드 양도·양수 알선 — 공범(방조) 검토", reason: "여신전문금융업법에는 알선 처벌 규정이 따로 없음" }));
      else f.push(F("apply", "전금49④4", { reason: "양도·대여 등을 알선·중개·광고하거나 대가를 받고 권유" }));
    } else if (item === "accountinfo") {
      f.push(F(how === "rent_crime" ? "apply" : "review", "전금49④5", { reason: "범죄에 이용할 목적 또는 범죄에 이용될 것을 알면서 계좌정보를 제공(제공받음)·보관·전달", notes: ["범죄 이용에 대한 인식(미필적 인식 포함)이 있어야 성립 — 인식 여부 확인"] }));
    } else if (item === "credit") {
      if (how === "sell") {
        f.push(F("apply", "여전70④3", { reason: "신용카드를 " + (role === "give" ? "양도" : "양수") + " (제15조 위반)" }));
      } else if (how === "pledge") {
        f.push(F("no", "여전70④3", { title: "신용카드 질권설정 — 처벌 규정 없음", reason: "제15조는 질권 설정도 금지하지만 처벌조항(제70조 제4항 제3호)은 '양도·양수'만 처벌", notes: ["돌려받지 않기로 한 확정적 이전이면 '양도'로 검토", "전자금융거래법상 접근매체 질권(제49조 제4항 제3호) 적용 여부는 수사팀 검토"] }));
      } else {
        f.push(F("review", "여전70④3", { fact: "여전70④3:대여", title: "신용카드 대여 — 양도 해당 여부", reason: "제15조는 양도·양수·질권만 금지 — 대여는 직접 규정 없음. 돌려받을 예정 없는 확정적 이전인지 확인", notes: ["신용카드도 전자식 카드로서 전자금융거래법상 접근매체에 해당하는지 검토 (제6조 제3항 '다른 법률에 특별한 규정이 없는 한')"] }));
      }
    } else {
      switch (how) {
        case "sell":
          f.push(F("apply", "전금49④1", { reason: "접근매체의 소유권·처분권을 확정적으로 이전 (" + (role === "give" ? "양도" : "양수") + ")", precs: ["2021도6965"] }));
          break;
        case "rent_paid":
          f.push(F("apply", "전금49④2", { reason: "대가를 받기로 하고 접근매체를 " + (role === "give" ? "대여" : "대여받거나 보관·전달") + " — 대출 기회도 대가", precs: role === "give" ? ["2017도16946"] : ["2021도10861"] }));
          break;
        case "rent_crime":
          f.push(F("apply", "전금49④2", { reason: "범죄에 이용될 것을 알면서(미필적 인식 포함) " + (role === "give" ? "대여" : "보관·전달·유통"), precs: ["2021도10861"] }));
          break;
        case "loan_bait":
          f.push(F("review", "전금49④1", { title: "양도 해당 여부", reason: "일시 사용 위임이면 양도 아님. 대출의 대가로 상대방이 임의로 거래하는 것을 미필적으로라도 용인했다면 양도", precs: ["2022도8084", "2021도6965"], notes: ["교부 동기, 상대방과의 관계, 보낸 개수, 이후 정황, 대출 조건(주체·금액·이자) 합의 여부를 조사"] }));
          f.push(F("review", "전금49④2", { title: "대가 약속 대여 해당 여부", reason: "대출을 받기로 약속하고 체크카드를 보냈다면 '대가를 약속하면서 대여'에 해당할 수 있음", precs: ["2017도16946"] }));
          break;
        case "pledge":
          f.push(F("apply", "전금49④3", { reason: "접근매체를 질권(담보)의 목적으로 함" }));
          break;
        case "free_family":
          f.push(F("review", "전금49④2", { title: "처벌 대상 여부", reason: "대가도 없고 범죄 이용 인식도 없는 단순 대여는 제6조 제3항 제2·3호에 해당하지 않을 수 있음 — 대가·인식 여부 확인" }));
          break;
      }
    }
    if (inp.usedForFraud) {
      f.push(F("review", "형법347", { fact: "형법347:사기방조", title: "사기방조 (또는 공범)", reason: "넘긴 통장·카드가 보이스피싱 등에 실제 쓰였고 그 가능성을 인식했다면 사기방조 검토. 직접 인출·전달에 가담했다면 전기통신금융사기(통신사기피해환급법 제15조의2) 공범 검토", notes: ["사기 공범이 아닌 명의인이 피해금을 인출하면 횡령 (2017도17494) — '잘못 들어온 돈' 메뉴 참고"], precs: ["2017도17494"] }));
    }
    f.forEach(function (x) { x.stage = "양도·대여"; x.penalty = x.law ? penaltyFor(x.law, inp) : ""; });
    return { findings: f, concurrence: [], summary: summarize(f) };
  }

  // ── 진입점: 잘못 들어온 돈 · 피해금 인출 ─────────────────
  var MONEY_CASE = {
    mistaken: "착오로 송금된 돈을 인출 · 사용",
    refuse: "착오송금 반환 요청을 거부",
    fraud_not_accomplice: "보이스피싱 피해금이 내 계좌에 들어와 인출 (사기 공범 아님)",
    fraud_accomplice: "보이스피싱 조직과 공모해 피해금 인출 · 전달"
  };

  function analyzeMoney(inp) {
    var f = [];
    switch (inp.moneyCase) {
      case "mistaken":
        f.push(F("apply", "형법355①", { victim: "sender", reason: "착오로 입금된 돈은 송금인을 위해 보관하는 지위 — 임의 인출·소비하면 횡령. 송금인과 거래관계가 없어도 성립", precs: ["2010도891"], notes: ["원심에서 점유이탈물횡령으로 인정된 사례도 있으나 대법원은 횡령죄로 판단"] }));
        break;
      case "refuse":
        f.push(F("apply", "형법355①", { victim: "sender", title: "횡령 (반환 거부)", reason: "보관하는 타인의 재물에 대한 반환 거부 — 정당한 이유(상계 등) 여부 확인", precs: ["2010도891"] }));
        break;
      case "fraud_not_accomplice":
        f.push(F("apply", "형법355①", { victim: "sender", reason: "사기 피해금이 송금된 계좌의 명의인은 피해자를 위해 보관하는 지위 — 영득 의사로 인출하면 피해자에 대한 횡령 (사기범에 대한 횡령은 아님)", precs: ["2017도17494"], notes: ["계좌를 넘겨준 행위는 '대포통장' 메뉴에서 전자금융거래법 별도 검토"] }));
        break;
      case "fraud_accomplice":
        f.push(F("apply", "통사15의2", { reason: "전기통신을 이용해 타인을 기망·공갈하여 자금을 송금·이체·출금하게 하는 행위에 공모 가담", notes: ["형법상 사기죄와의 관계 검토"] }));
        f.push(F("no", "형법355①", { title: "횡령 — 별도 불성립", reason: "사기 공범이 피해금을 인출하는 것은 사기 실행행위일 뿐 새로운 법익침해가 아님", precs: ["2017도17494"] }));
        break;
    }
    f.forEach(function (x) { x.stage = "인출·사용"; x.penalty = x.law ? penaltyFor(x.law, inp) : ""; });
    if (inp.relation && inp.relation !== "none") f.forEach(function (x) { var r = relativeNote(inp, Object.assign({}, x, { victim: "holder" })); if (r && x.law === "형법355①") x.notes.push(r.replace("명의자", "송금인")); });
    var conc = [];
    if (inp.amount >= 500000000 && f.some(function (x) { return x.status === "apply" && x.law === "형법355①"; }))
      conc.push({ text: "횡령액 5억원 이상이면 특정경제범죄법 제3조 가중처벌 검토", precs: [], law: "특경3" });
    return { findings: f, concurrence: conc, summary: summarize(f) };
  }

  // ── 진입점: 편의시설 부정이용 ─────────────────────────
  var FACILITY_CASE = {
    vending: "위조 · 외국 동전, 이물질 등으로 자판기에서 물건을 꺼냄",
    coin_machine: "코인세탁기 · 코인노래방 · 인형뽑기 · 주차정산기 등을 조작해 무료로 이용",
    payphone: "공중전화를 조작해 무료로 통화",
    gate_jump: "지하철 개찰구를 뛰어넘거나 비상문 · 꼬리물기로 통과",
    bus_no_pay: "버스에 요금을 내지 않고 승차 (태그한 척 등)",
    others_card: "남의 후불식 카드(전화카드 등)를 훔치거나 주워 유료설비에 사용"
  };
  var FACILITY_RESULT = { ok: "이용함 (물건 · 서비스 취득)", denied: "시도했으나 실패" };

  function analyzeFacility(inp) {
    var f = [], ok = inp.result !== "denied";
    switch (inp.facilityCase) {
      case "vending":
      case "coin_machine":
      case "payphone":
        f.push(F("apply", "형법348의2", { victim: "merchant", title: "편의시설부정이용" + (ok ? "" : " 미수"), reason: "부정한 방법으로 대가를 지급하지 않고 유료자동설비를 이용해 " + (inp.facilityCase === "vending" ? "재물(물건)" : "재산상 이익(이용)") + "을 취득" + (ok ? "" : " — 미수도 처벌 (제352조)") }));
        if (inp.facilityCase === "vending") f.push(F("review", null, { title: "위조 동전을 쓴 경우", reason: "위조한 대한민국 주화를 사용했다면 위조통화행사(형법 제207조) 검토 — 외국 동전 · 이물질은 해당 없음" }));
        f.push(F("review", "형법366", { title: "기기를 부순 경우 — 재물손괴", reason: "기기를 열거나 부숴 이용했다면 재물손괴 별도 검토 (실체적 경합)" }));
        break;
      case "gate_jump":
        f.push(F(ok ? "review" : "no", "형법348의2", { victim: "merchant", title: "편의시설부정이용", reason: "운임을 내지 않고 자동개집표기를 통과 — 하급심에서 개찰구 무단통과를 편의시설부정이용 등으로 처벌한 사례 (대법원 판례 없음)", precs: ["부산지법2019"] }));
        f.push(F(ok ? "apply" : "no", "경범3①39", { victim: "merchant", title: "경범죄 무임승차", reason: "영업용 차량(지하철)에 타고 정당한 이유 없이 제 값을 치르지 않음 — 경미 사안은 범칙금 통고" }));
        f.push(F("review", "철도10", { title: "부가운임 징수 (운영기관)", reason: "운영기관이 승차 구간 운임 외 부가금(철도 30배 범위)을 징수 — 형벌 아님" }));
        break;
      case "bus_no_pay":
        f.push(F(ok ? "apply" : "no", "경범3①39", { victim: "merchant", title: "경범죄 무임승차", reason: "버스에 타고 정당한 이유 없이 요금을 내지 않음" }));
        f.push(F("review", "형법347", { victim: "merchant", title: "사기 (운전기사를 속인 경우)", reason: "태그한 척하거나 거짓말로 운전기사를 속여 탔다면 사기 검토 — 상습 · 다액이면 형사 입건" }));
        f.push(F("review", "철도10", { title: "부가금 (운송약관)", reason: "버스 운송약관에 따른 부가금 — 서울시는 미납 시 경범죄 고발" }));
        break;
      case "others_card":
        f.push(F("no", "형법348의2", { title: "편의시설부정이용 — 불성립", reason: "요금은 카드 명의자가 부담하게 되므로 '대가를 지급하지 아니하고' 이용한 것이 아님", precs: ["2001도3625"] }));
        f.push(F(ok ? "apply" : "no", "형법236", { victim: "holder", title: "사문서부정행사", reason: "후불식 전화카드는 하나의 사문서 — 공중전화기에 넣어 사용하면 부정행사", precs: ["2002도461"], notes: ["카드 자체는 절도 · 점유이탈물횡령 별도", "신용 · 체크 · 교통카드는 '카드·계좌 무단사용' 메뉴에서 판단 — IC 교통카드에 사문서부정행사를 적용한 판례는 미확인"] }));
        break;
    }
    f.forEach(function (x) { x.stage = "편의시설 이용"; x.useType = inp.facilityCase; x.penalty = x.law ? penaltyFor(x.law, inp) : ""; });
    return { findings: f, concurrence: [], summary: summarize(f) };
  }

  // ── 요약: 적용 죄명 목록 (중복 제거) ─────────────────────
  function summarize(findings) {
    var seen = {}, list = [];
    findings.forEach(function (f) {
      if (f.status !== "apply" || !f.law) return;
      var name = root.LAWS[f.law] ? root.LAWS[f.law].name : f.law;
      if (!seen[f.law]) { seen[f.law] = { law: f.law, name: name, count: 0 }; list.push(seen[f.law]); }
      seen[f.law].count++;
    });
    return list;
  }

  function analyze(inp) {
    if (inp.mode === "mule") return analyzeMule(inp);
    if (inp.mode === "money") return analyzeMoney(inp);
    if (inp.mode === "facility") return analyzeFacility(inp);
    return analyzeUse(inp);
  }

  var api = {
    analyze: analyze,
    MEDIA: MEDIA, ACQ: ACQ, ACQ_BY_MEDIUM: ACQ_BY_MEDIUM, USES: USES, USES_BY_MEDIUM: USES_BY_MEDIUM,
    RELATION: RELATION, DATE: DATE, MULE_ITEM: MULE_ITEM, MULE_ROLE: MULE_ROLE, MULE_HOW: MULE_HOW, MONEY_CASE: MONEY_CASE, FACILITY_CASE: FACILITY_CASE, FACILITY_RESULT: FACILITY_RESULT
  };
  root.Engine = api;
  if (typeof module !== "undefined") module.exports = api;
})(typeof window !== "undefined" ? window : global);
