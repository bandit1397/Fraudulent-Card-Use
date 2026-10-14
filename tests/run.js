// 사용법: node tests/run.js
global.LAWS = require("../data/laws.js");
var P = require("../data/precedents.js");
global.PRECEDENTS = P.PRECEDENTS;
var Engine = require("../js/engine.js");
var CASES = require("./cases.js");

var fail = 0;

// 모든 결과가 존재하는 조항·판례만 참조하는지 확인
function checkRefs(name, r) {
  var errs = [];
  r.findings.forEach(function (f) {
    if (f.law && !LAWS[f.law]) errs.push("없는 조항: " + f.law);
    f.precs.forEach(function (p) { if (!PRECEDENTS[p]) errs.push("없는 판례: " + p); });
  });
  r.concurrence.forEach(function (c) { c.precs.forEach(function (p) { if (!PRECEDENTS[p]) errs.push("없는 판례: " + p); }); });
  return errs;
}

CASES.forEach(function (c) {
  var r = Engine.analyze(JSON.parse(JSON.stringify(c.input)));
  var e = c.expect, errs = checkRefs(c.name, r);
  var inStage = function (f, stage) { return !stage || (f.stage || "").indexOf(stage) === 0; };

  (e.apply || []).forEach(function (law) {
    if (!r.findings.some(function (f) { return f.law === law && f.status === "apply"; })) errs.push("적용되어야 함: " + law);
  });
  (e.notApply || []).forEach(function (x) {
    var law = x.law || x, stage = x.stage;
    if (r.findings.some(function (f) { return f.law === law && f.status === "apply" && inStage(f, stage); })) errs.push("적용되면 안 됨: " + law + (stage ? " (" + stage + ")" : ""));
  });
  Object.keys(e.status || {}).forEach(function (law) {
    var f = r.findings.filter(function (f) { return f.law === law; })[0];
    if (!f || f.status !== e.status[law]) errs.push(law + " 상태 기대 " + e.status[law] + ", 실제 " + (f ? f.status : "없음"));
  });
  (e.noStatus || []).forEach(function (law) {
    if (r.findings.some(function (f) { return f.law === law; })) errs.push("나오면 안 되는 조항: " + law);
  });
  (e.conc || []).forEach(function (p) {
    if (!r.concurrence.some(function (c) { return c.precs.indexOf(p) >= 0; })) errs.push("경합 설명에 판례 없음: " + p);
  });
  var allText = JSON.stringify(r);
  (e.noteHas || []).forEach(function (t) { if (allText.indexOf(t) < 0) errs.push("문구 없음: " + t); });
  Object.keys(e.penalty || {}).forEach(function (law) {
    var f = r.findings.filter(function (f) { return f.law === law; })[0];
    if (!f || f.penalty.indexOf(e.penalty[law]) !== 0) errs.push(law + " 법정형 기대 '" + e.penalty[law] + "…', 실제 '" + (f ? f.penalty : "없음") + "'");
  });

  if (errs.length) { fail++; console.log("✗ " + c.name + "\n    - " + errs.join("\n    - ")); }
  else console.log("✓ " + c.name);
});

// 모든 선택지 조합이 오류 없이 돌아가는지 (화면에서 고를 수 있는 모든 조합)
var combos = 0;
Object.keys(Engine.ACQ_BY_MEDIUM).forEach(function (m) {
  Engine.ACQ_BY_MEDIUM[m].forEach(function (a) {
    Engine.USES_BY_MEDIUM[m].forEach(function (u) {
      ["ok", "denied"].forEach(function (res) {
        Object.keys(Engine.RELATION).forEach(function (rel) {
          Object.keys(Engine.DATE).forEach(function (d) {
            var r = Engine.analyze({ mode: "use", date: d, medium: m, acq: a, entrust: "asked", relation: rel, amount: 600000000, uses: [{ type: u, result: res }] });
            var errs = checkRefs("", r);
            if (!r.findings.length) errs.push("결과 없음");
            if (errs.length) { fail++; console.log("✗ 조합 " + [m, a, u, res, rel, d].join("/") + ": " + errs.join(", ")); }
            combos++;
          });
        });
      });
    });
  });
});
// ── 검토 이유(대법원 판례 없음 / 사실관계 확인 필요) ─────────────
function whyOf(inp, law) {
  var r = Engine.analyze(JSON.parse(JSON.stringify(inp)));
  var f = r.findings.filter(function (x) { return x.status === "review" && x.law === law; })[0];
  return f ? f.why : "없음";
}
[
  [{ mode: "use", date: "after20251223", medium: "discount_card", acq: "borrowed", relation: "none", uses: [{ type: "discount_transit", result: "ok" }] }, "형법347의2", "noprec"],
  [{ mode: "use", date: "after20251223", medium: "credit", acq: "found", relation: "none", uses: [{ type: "kiosk", result: "ok" }] }, "여전70①3", "noprec"],
  [{ mode: "use", date: "after20251223", medium: "credit", acq: "extorted", relation: "none", uses: [{ type: "store", result: "ok" }] }, "여전70①4", "fact"],
  [{ mode: "use", date: "after20251223", medium: "credit", acq: "entrusted", relation: "none", uses: [{ type: "store", result: "ok" }] }, "여전70①4", "fact"],
  [{ mode: "use", date: "after20251223", medium: "credit", acq: "entrusted", relation: "none", uses: [{ type: "store", result: "ok" }] }, "형법355①", "fact"],
  [{ mode: "mule", item: "access", role: "give", how: "loan_bait", date: "after20251223" }, "전금49④1", "fact"],
  [{ mode: "facility", facilityCase: "gate_jump", result: "ok", date: "after20251223" }, "형법348의2", "noprec"]
].forEach(function (t) {
  var w = whyOf(t[0], t[1]);
  if (w !== t[2]) { fail++; console.log("✗ 검토 이유 " + t[1] + ": 기대 " + t[2] + ", 실제 " + w); }
});

// ── 현장 조치 · 질문 · 범죄사실이 사건 조건에 맞게 나오는지 ─────────
var G = require("../data/guides.js");
var guideFail = 0;
function guideCheck(label, inp) {
  var r = Engine.analyze(JSON.parse(JSON.stringify(inp)));
  var ctx = G.ctx(inp, r), g = G.build(ctx), errs = [];
  r.findings.forEach(function (f) {
    if (f.status === "apply" && f.law && !G.factKey(f, ctx)) errs.push("범죄사실 문안 없음: " + f.law + (f.useType ? ":" + f.useType : ""));
    if (f.status === "review" && f.law && LAWS[f.law].penal !== false && !G.factKey(f, ctx)) errs.push("검토 죄명 문안 없음: " + f.law + (f.useType ? ":" + f.useType : ""));
    if (f.law && LAWS[f.law].penal === false && G.factKey(f, ctx)) errs.push("형벌 아닌 항목에 문안: " + f.law);
  });
  r.findings.forEach(function (f) { if (f.status === "review" && !f.why && !(f.law && LAWS[f.law].penal === false)) errs.push("검토 이유 없음: " + (f.law || f.title)); });
  if (!g.actions.length) errs.push("현장 조치 없음");
  if (!g.victim.length || !g.suspect.length) errs.push("질문 목록 없음");
  if (inp.mode === "use" && !g.evidence.length) errs.push("증거 목록 없음");
  if (errs.length) { guideFail++; fail++; console.log("✗ 안내 " + label + ": " + errs.join(", ")); }
  return g;
}
var guideCombos = 0;
Object.keys(Engine.ACQ_BY_MEDIUM).forEach(function (m) {
  Engine.ACQ_BY_MEDIUM[m].forEach(function (a) {
    Engine.USES_BY_MEDIUM[m].forEach(function (u) {
      ["ok", "denied"].forEach(function (res) {
        guideCheck([m, a, u, res].join("/"), { mode: "use", date: "after20251223", medium: m, acq: a, entrust: "asked", relation: "none", uses: [{ type: u, result: res }] });
        guideCombos++;
      });
    });
  });
});
Object.keys(Engine.MULE_ITEM).forEach(function (i) {
  Object.keys(Engine.MULE_ROLE).forEach(function (ro) {
    Object.keys(Engine.MULE_HOW).forEach(function (h) {
      guideCheck([i, ro, h].join("/"), { mode: "mule", item: i, role: ro, how: h, date: "after20251223", usedForFraud: true });
      guideCombos++;
    });
  });
});
Object.keys(Engine.MONEY_CASE).forEach(function (c) {
  guideCheck(c, { mode: "money", moneyCase: c, relation: "none", date: "after20251223" });
  guideCombos++;
});
Object.keys(Engine.FACILITY_CASE).forEach(function (c) {
  Object.keys(Engine.FACILITY_RESULT).forEach(function (res) {
    var inp = { mode: "facility", facilityCase: c, result: res, date: "after20251223" };
    guideCheck("facility/" + c + "/" + res, inp);
    var r = Engine.analyze(inp), errs = checkRefs("", r);
    if (!r.findings.length) errs.push("결과 없음");
    if (errs.length) { fail++; console.log("✗ 편의시설 " + c + "/" + res + ": " + errs.join(", ")); }
    guideCombos++;
  });
});
// 할인 승차는 부가운임·사용내역 안내가 나와야 한다
var gDisc = guideCheck("discount", { mode: "use", date: "after20251223", medium: "discount_card", acq: "borrowed", relation: "none", uses: [{ type: "discount_transit", result: "ok" }] });
var dIn = { mode: "use", date: "after20251223", medium: "discount_card", acq: "borrowed", relation: "none", uses: [{ type: "discount_transit", result: "ok" }] };
var dR = Engine.analyze(JSON.parse(JSON.stringify(dIn)));
dR.findings.filter(function (f) { return f.status === "review" && ["형법347의2", "형법348의2", "경범3①39"].indexOf(f.law) >= 0; }).forEach(function (f) {
  var k = G.factKey(f, G.ctx(dIn, dR));
  if (k !== f.law + ":discount_transit") { fail++; guideFail++; console.log("✗ 할인 승차 " + f.law + " 문안이 상황 전용이 아님: " + k); }
});
if (JSON.stringify(gDisc).indexOf("부가운임") < 0 || JSON.stringify(gDisc).indexOf("사용내역") < 0) { fail++; guideFail++; console.log("✗ 할인 승차에 부가운임·사용내역 안내 없음"); }

// 조건이 바뀌면 안내도 바뀌어야 한다
function texts(g) { return JSON.stringify(g); }
var base = { mode: "use", date: "after20251223", medium: "credit", acq: "found", relation: "none", uses: [{ type: "store", result: "ok" }] };
function variant(o) { var x = JSON.parse(JSON.stringify(base)); Object.keys(o).forEach(function (k) { x[k] = o[k]; }); return guideCheck("variant", x); }
var gBase = variant({});
[
  ["강취", { acq: "robbed" }, "부상"],
  ["친족", { relation: "close" }, "고소"],
  ["ATM 인출", { medium: "check", uses: [{ type: "atm_cash", result: "ok" }] }, "ATM"],
  ["온라인", { medium: "cardinfo", acq: "info_illegal", uses: [{ type: "online", result: "ok" }] }, "배송"],
  ["승인 거절", { uses: [{ type: "store", result: "denied" }] }, "거절"],
  ["휴대전화", { medium: "phone", acq: "stolen", uses: [{ type: "bank_transfer", result: "ok" }] }, "뱅킹앱"]
].forEach(function (t) {
  var g = variant(t[1]);
  if (texts(g) === texts(gBase) || texts(g).indexOf(t[2]) < 0) { fail++; guideFail++; console.log("✗ 조건 '" + t[0] + "'인데 안내가 바뀌지 않음 ('" + t[2] + "' 없음)"); }
});
var gMule = guideCheck("mule", { mode: "mule", item: "access", role: "give", how: "sell", date: "after20251223" });
if (texts(gMule).indexOf("카드 실물") >= 0) { fail++; guideFail++; console.log("✗ 대포통장 메뉴에 카드 사건 조치가 섞임"); }
var gMoney = guideCheck("money", { mode: "money", moneyCase: "refuse", relation: "none", date: "after20251223" });
var rRefuse = Engine.analyze({ mode: "money", moneyCase: "refuse", relation: "none", date: "after20251223" });
if (G.factKey(rRefuse.findings[0], G.ctx({ mode: "money", moneyCase: "refuse" }, rRefuse)) !== "형법355①:refuse") { fail++; guideFail++; console.log("✗ 반환 거부 사건에 착오송금 인출 문안이 나옴"); }

console.log("\n조합 검사 " + combos + "건, 판례 테스트 " + CASES.length + "건, 안내·문안 검사 " + guideCombos + "건(실패 " + guideFail + "), 전체 실패 " + fail + "건");
process.exit(fail ? 1 : 0);
