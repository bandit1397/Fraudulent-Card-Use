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
console.log("\n조합 검사 " + combos + "건, 판례 테스트 " + CASES.length + "건, 실패 " + fail + "건");
process.exit(fail ? 1 : 0);
