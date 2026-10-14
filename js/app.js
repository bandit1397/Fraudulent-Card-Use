/* 화면 동작 — 판단은 모두 engine.js 가 하고, 여기서는 입력을 모으고 결과를 그린다. */
(function () {
  "use strict";
  var E = window.Engine, L = window.LAWS, P = window.PRECEDENTS, G = window.GUIDES;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); };

  // 입력 상태 — 메모리에만 둔다 (저장 · 전송 없음)
  var S = {
    mode: "use",
    use: { medium: "credit", acq: "found", entrust: "asked", uses: [{ type: "store", result: "ok" }], relation: "none", date: "after20251223", amount: 0 },
    mule: { item: "access", role: "give", how: "sell", usedForFraud: false },
    money: { moneyCase: "mistaken", relation: "none", date: "after20251223", amount: 0 },
    facility: { facilityCase: "vending", result: "ok" },
    fields: {}
  };

  var ENTRUST = { asked: "예 — 정해진 금액·용도로 부탁받음", keep: "아니요 — 보관만 맡음" };
  var RESULT = { ok: "결제·인출 됨", denied: "실패·승인 거절" };
  var HOW_LABEL = {
    give: { sell: "팔거나 아주 넘겨줌", rent_paid: "대가(돈·대출 등)를 받기로 하고 빌려줌", rent_crime: "범죄에 쓰일 줄 알면서 빌려줌", loan_bait: "대출해 준다는 말에 속아 보냄", pledge: "빚 담보로 맡김", free_family: "가족·지인에게 대가 없이 잠깐 빌려줌" },
    take: { sell: "사들이거나 아주 넘겨받음", rent_paid: "대가를 받기로 하고 보관·전달", rent_crime: "범죄에 쓰일 줄 알면서 보관·전달" }
  };
  var HOW_INFO = { rent_crime: "범죄에 쓰일 줄 알면서 제공·전달", rent_paid: "대가를 받고 제공 (범죄 이용 인식 불명)", free_family: "가족·지인에게 알려줌" };

  // ── 공통: 선택 칩 ───────────────────────────────────
  function chips(el, options, selected, onPick, keys) {
    keys = keys || Object.keys(options);
    el.innerHTML = keys.map(function (k) {
      return '<button type="button" class="chip" data-k="' + k + '" aria-pressed="' + (k === selected) + '">' + esc(options[k]) + "</button>";
    }).join("");
    el.onclick = function (e) {
      var b = e.target.closest(".chip");
      if (b) onPick(b.getAttribute("data-k"));
    };
  }

  // ── 카드·계좌 무단사용 입력 ─────────────────────────
  function renderUse() {
    var u = S.use;
    var acqKeys = E.ACQ_BY_MEDIUM[u.medium];
    if (acqKeys.indexOf(u.acq) < 0) u.acq = acqKeys[0];
    var useKeys = E.USES_BY_MEDIUM[u.medium];
    u.uses = u.uses.filter(function (x) { return useKeys.indexOf(x.type) >= 0; });
    if (!u.uses.length) u.uses.push({ type: useKeys[0], result: "ok" });

    // 수단을 바꾸면 2·3단계를 그 수단의 대표 사례로 다시 시작 (예: 청소년 카드 → 빌림 · 성인 승차)
    chips($("medium"), E.MEDIA, u.medium, function (k) {
      if (k === u.medium) return;
      u.medium = k;
      u.acq = E.ACQ_BY_MEDIUM[k][0];
      u.uses = [{ type: E.USES_BY_MEDIUM[k][0], result: "ok" }];
      renderUse();
    });
    chips($("acq"), E.ACQ, u.acq, function (k) { u.acq = k; renderUse(); }, acqKeys);
    $("entrust-box").hidden = u.acq !== "entrusted";
    chips($("entrust"), ENTRUST, u.entrust, function (k) { u.entrust = k; renderUse(); });

    var box = $("uses");
    box.innerHTML = "";
    u.uses.forEach(function (row, i) {
      var div = document.createElement("div");
      div.className = "use-row";
      div.innerHTML = '<div class="use-row-head"><span>사용 행위 ' + (i + 1) + "</span>" + (u.uses.length > 1 ? '<button class="del" type="button">삭제</button>' : "") + '</div>' +
        '<div class="mini-label">무엇을 했나</div><div class="chips t"></div><div class="mini-label">결과</div><div class="chips r"></div>';
      box.appendChild(div);
      chips(div.querySelector(".t"), E.USES, row.type, function (k) { row.type = k; renderUse(); }, useKeys);
      chips(div.querySelector(".r"), RESULT, row.result, function (k) { row.result = k; renderUse(); });
      var del = div.querySelector(".del");
      if (del) del.onclick = function () { u.uses.splice(i, 1); renderUse(); };
    });
    $("add-use").onclick = function () { u.uses.push({ type: useKeys[0], result: "ok" }); renderUse(); };

    chips($("relation"), E.RELATION, u.relation, function (k) { u.relation = k; renderUse(); });
    chips($("date"), E.DATE, u.date, function (k) { u.date = k; renderUse(); });
    analyze();
  }
  $("amount").oninput = function () { S.use.amount = Number(this.value.replace(/[^0-9]/g, "")) || 0; analyze(); };

  // ── 대포통장·카드 입력 ───────────────────────────────
  function renderMule() {
    var m = S.mule;
    chips($("item"), E.MULE_ITEM, m.item, function (k) { m.item = k; renderMule(); });
    chips($("role"), E.MULE_ROLE, m.role, function (k) { m.role = k; renderMule(); });
    var opts = m.item === "accountinfo" ? HOW_INFO : (HOW_LABEL[m.role] || {});
    var keys = Object.keys(opts);
    $("how-step").hidden = m.role === "broker";
    if (keys.length && keys.indexOf(m.how) < 0) m.how = keys[0];
    if (keys.length) chips($("how"), opts, m.how, function (k) { m.how = k; renderMule(); });
    $("usedForFraud").checked = m.usedForFraud;
    analyze();
  }
  $("usedForFraud").onchange = function () { S.mule.usedForFraud = this.checked; analyze(); };

  // ── 잘못 들어온 돈 입력 ──────────────────────────────
  function renderMoney() {
    var m = S.money;
    chips($("moneyCase"), E.MONEY_CASE, m.moneyCase, function (k) { m.moneyCase = k; renderMoney(); });
    chips($("relation2"), E.RELATION, m.relation, function (k) { m.relation = k; renderMoney(); });
    chips($("date2"), E.DATE, m.date, function (k) { m.date = k; renderMoney(); });
    analyze();
  }
  $("amount2").oninput = function () { S.money.amount = Number(this.value.replace(/[^0-9]/g, "")) || 0; analyze(); };

  // ── 편의시설 부정이용 입력 ───────────────────────────
  function renderFacility() {
    var f = S.facility;
    chips($("facilityCase"), E.FACILITY_CASE, f.facilityCase, function (k) { f.facilityCase = k; renderFacility(); });
    chips($("facilityResult"), E.FACILITY_RESULT, f.result, function (k) { f.result = k; renderFacility(); });
    analyze();
  }

  // ── 분석 · 결과 ─────────────────────────────────────
  function currentInput() {
    if (S.mode === "mule") return Object.assign({ mode: "mule", date: "after20251223" }, S.mule);
    if (S.mode === "money") return Object.assign({ mode: "money" }, S.money);
    if (S.mode === "facility") return Object.assign({ mode: "facility", date: "after20251223" }, S.facility);
    return Object.assign({ mode: "use" }, JSON.parse(JSON.stringify(S.use)));
  }

  function lawLabel(key) {
    var l = L[key];
    return l ? l.law + " " + l.art : "";
  }

  function precButtons(list) {
    if (!list || !list.length) return "";
    return '<div class="precs">' + list.map(function (p) { return '<button type="button" class="prec" data-p="' + esc(p) + '">' + esc(precLabel(p)) + "</button>"; }).join("") + "</div>";
  }

  function findingHtml(f) {
    var badge = { apply: '<span class="badge b-apply">적용</span>', review: '<span class="badge b-review">검토</span>', no: '<span class="badge b-no">불성립</span>' }[f.status] +
      (f.status === "review" && f.why ? '<span class="why why-' + f.why + '">' + esc(E.WHY[f.why]) + "</span>" : "");
    var name = f.title || (L[f.law] ? L[f.law].name : "");
    var meta = [lawLabel(f.law), f.status === "apply" ? f.penalty : ""].filter(Boolean).join(" · ");
    return '<div class="finding ' + f.status + '"><h3>' + badge + esc(name) + "</h3>" +
      (meta ? '<div class="meta">' + esc(meta) + "</div>" : "") +
      (f.reason ? '<p class="reason">' + esc(f.reason) + "</p>" : "") +
      (f.notes.length ? '<ul class="fnotes">' + f.notes.map(function (n) { return "<li>" + esc(n) + "</li>"; }).join("") + "</ul>" : "") +
      precButtons(f.precs) + "</div>";
  }

  // 적용 죄명 문안을 먼저, 그다음 '검토' 죄명 문안. 문안마다 관련 결과(유의사항용)를 묶는다
  function factKeys(r, ctx) {
    var keys = [];
    keys.review = {};
    keys.findings = {};
    ["apply", "review"].forEach(function (st) {
      r.findings.forEach(function (f) {
        if (f.status !== st || !f.law) return;
        var k = G.factKey(f, ctx);
        if (!k) return;
        if (keys.indexOf(k) < 0) { keys.push(k); keys.findings[k] = []; if (st === "review") keys.review[k] = true; }
        keys.findings[k].push(f);
      });
    });
    return keys;
  }

  function factText(tpl, defaults) {
    return tpl.replace(/\{([^}]+)\}/g, function (_, k) { return (S.fields[k] || "").trim() || defaults[k] || "○○"; });
  }

  // 문안 아래 유의사항: 검토 죄명은 검토 이유 · 메모 · 근거 판례, 적용 죄명은 메모가 있을 때만
  function cautionHtml(k, keys) {
    var items = [], precs = [];
    var add = function (x) { if (x && items.indexOf(x) < 0) items.push(x); };
    keys.findings[k].forEach(function (f) {
      if (keys.review[k]) add(f.reason);
      f.notes.forEach(add);
      f.precs.forEach(function (p) { if (precs.indexOf(p) < 0) precs.push(p); });
    });
    if (keys.review[k]) add("현장에서 확정하지 말고 수사팀 · 검사와 협의한 뒤 적용 여부를 정할 것");
    if (!items.length) return "";
    var whys = [];
    keys.findings[k].forEach(function (f) { if (f.status === "review" && f.why && whys.indexOf(f.why) < 0) whys.push(f.why); });
    var whyHtml = whys.map(function (w) { return '<span class="why why-' + w + '">' + esc(E.WHY[w]) + "</span>"; }).join("");
    return '<div class="caution' + (keys.review[k] ? " review" : "") + '"><b>유의사항 ' + whyHtml + '</b><ul>' +
      items.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>" + precButtons(precs) + "</div>";
  }

  function factsHtml(keys, defaults) {
    if (!keys.length) return '<p class="basis">적용 · 검토 죄명이 나오면 문안 템플릿이 표시됩니다.</p>';
    var F = [["일시", "예: 2026. 10. 14. 14:30"], ["장소", "예: 서울 ○○구 ○○로 12"], ["상호", "가맹점 · 은행명"], ["명의자", "명의자 · 피해자"], ["카드", defaults["카드"] || "예: ○○카드 신용카드"], ["금액", "예: 35,000"], ["횟수", "예: 5"], ["물품", "예: 담배 등"]];
    var fields = '<div class="fields">' + F.map(function (x) {
      return '<div><label for="f-' + x[0] + '">' + x[0] + '</label><input id="f-' + x[0] + '" data-f="' + x[0] + '" placeholder="' + esc(x[1]) + '" value="' + esc(S.fields[x[0]] || "") + '"></div>';
    }).join("") + "</div>";
    var body = keys.map(function (k, i) {
      var f0 = keys.findings[k][0];
      // 제목은 30초 요약과 같은 죄명 이름, 아래 줄에 세부 상황(검토 사유 제목 · 사용 행위)
      var name = L[f0.law].name + (keys.review[k] ? " (검토)" : "");
      var sub = [];
      if (keys.review[k] && f0.title && f0.title !== L[f0.law].name) sub.push(f0.title);
      if (f0.useType && E.USES[f0.useType]) sub.push(E.USES[f0.useType].split(" (")[0]);
      return '<div class="fact-head" id="draft-' + i + '" data-law="' + esc(f0.law) + '"><span>' + (i + 1) + ". " + esc(name) + (keys.review[k] ? ' <span class="badge b-review">검토</span>' + (f0.why ? '<span class="why why-' + f0.why + '">' + esc(E.WHY[f0.why]) + "</span>" : "") : ' <span class="badge b-apply">적용</span>') +
        (sub.length ? '<small class="fact-sub">' + esc(sub.join(" · ")) + "</small>" : "") + '</span><button type="button" class="copy" data-i="' + i + '">복사</button></div>' +
        '<div class="fact" id="fact-' + i + '">' + esc(factText(G.facts[k], defaults)) + "</div>" + cautionHtml(k, keys);
    }).join("");
    return fields + body + '<p class="basis">' + esc(G.factsBasis) + "</p>";
  }

  var list = function (arr) { return '<ul class="list">' + arr.map(function (x) { return "<li>" + esc(x) + "</li>"; }).join("") + "</ul>"; };

  function analyze() {
    var out = $("result");
    $("result-divider").hidden = S.mode === "ref";
    if (S.mode === "ref") { out.innerHTML = ""; return; }
    var inp = currentInput();
    var r = E.analyze(inp);
    var ctx = G.ctx(inp, r);
    var g = G.build(ctx);
    var keys = factKeys(r, ctx);
    var defaults = G.defaults(ctx);

    // 검토 죄명: 이미 적용된 조항 · 형벌이 아닌 항목(부가운임 등) · 조항 없는 메모는 뺀다
    var applied = {}, reviewTags = [];
    r.summary.forEach(function (s) { applied[s.law] = true; });
    r.findings.forEach(function (f) {
      if (f.status !== "review" || !f.law || applied[f.law] || L[f.law].penal === false) return;
      if (reviewTags.indexOf(f.law) < 0) reviewTags.push(f.law);
    });
    var tags = (r.summary.length || reviewTags.length)
      ? '<div class="crime-tags">' + r.summary.map(function (s) {
          return '<button type="button" class="crime-tag" data-law="' + esc(s.law) + '">' + esc(s.name) + (s.count > 1 ? " <small>×" + s.count + "</small>" : "") + "</button>";
        }).join("") + reviewTags.map(function (law) {
          return '<button type="button" class="crime-tag review" data-law="' + esc(law) + '">' + esc(L[law].name) + " <small>(검토)</small></button>";
        }).join("") + "</div>" +
        '<p class="tag-hint">죄명을 누르면 범죄사실 초안으로 이동합니다 — 초안 ' + keys.length + '건 (적용 ' + keys.filter(function (k) { return !keys.review[k]; }).length + " · 검토 " + keys.filter(function (k) { return keys.review[k]; }).length + "건)</p>" +
        (r.summary.length ? "" : '<p class="empty">확정 적용 죄명 없음 — (검토) 죄명은 범죄사실 초안 아래 유의사항을 확인하세요.</p>')
      : '<p class="empty">적용 죄명 없음 — 아래 단계별 검토를 확인하세요.</p>';
    var conc = r.concurrence.length
      ? '<ul class="conc">' + r.concurrence.map(function (c) { return "<li>" + esc(c.text) + precButtons(c.precs) + "</li>"; }).join("") + "</ul>"
      : "";

    // 단계별 묶음
    var stages = [], byStage = {};
    r.findings.forEach(function (f) {
      if (!byStage[f.stage]) { byStage[f.stage] = []; stages.push(f.stage); }
      byStage[f.stage].push(f);
    });
    var detail = stages.map(function (s) {
      return '<div class="stage-title">' + esc(s) + "</div>" + byStage[s].map(findingHtml).join("");
    }).join("");

    // 현장 조치 · 증거 · 질문 — 사건 조건에 맞춘 항목
    var actions = '<ul class="list">' + g.actions.map(function (a) { return "<li><b>" + esc(a.t) + "</b>" + esc(a.d) + "</li>"; }).join("") + "</ul>" +
      (g.evidence.length ? '<div class="stage-title">확보할 증거</div>' + list(g.evidence) : "");
    var qs = '<div class="stage-title">' + (inp.mode === "money" ? "송금인 · 피해자" : "피해자 · 명의자") + "</div>" + list(g.victim) +
      '<div class="stage-title">피의자</div>' + list(g.suspect);

    // 다시 그려도 사용자가 펼친 칸은 그대로 유지
    var open = {};
    out.querySelectorAll("details[id]").forEach(function (d) { open[d.id] = d.open; });
    var isOpen = function (id, def) { return (id in open ? open[id] : def) ? " open" : ""; };

    out.innerHTML =
      '<div class="summary"><h2>30초 요약 — 적용 죄명 <small class="legend">(검토) = 대법원 판례가 없거나, 사실관계에 따라 결론이 달라지는 죄명</small></h2>' + tags + conc + "</div>" +
      '<details class="block" id="detail-block"' + isOpen("detail-block", true) + '><summary>단계별 검토 (' + r.findings.length + '건)</summary><div class="body">' + detail + "</div></details>" +
      '<details class="block" id="action-block"' + isOpen("action-block", false) + '><summary>현장 조치 · 증거 확보 (' + (g.actions.length + g.evidence.length) + '건)</summary><div class="body">' + actions + "</div></details>" +
      '<details class="block" id="question-block"' + isOpen("question-block", false) + '><summary>질문 목록 (' + (g.victim.length + g.suspect.length) + '건)</summary><div class="body">' + qs + "</div></details>" +
      '<details class="block" id="facts-block"' + isOpen("facts-block", false) + '><summary>범죄사실 초안 (' + keys.length + '건)</summary><div class="body">' + factsHtml(keys, defaults) + "</div></details>";

    // 요약 죄명 → 해당 범죄사실 초안으로 이동
    out.querySelector(".summary").addEventListener("click", function (e) {
      var t = e.target.closest(".crime-tag[data-law]");
      if (!t) return;
      var law = t.getAttribute("data-law");
      var head = out.querySelector('.fact-head[data-law="' + law + '"]');
      $("facts-block").open = true;
      if (!head) return;
      // 펼친 직후 위치가 정해지도록 다음 프레임에 이동 (부드러운 스크롤은 기기에 따라 멈추는 경우가 있어 즉시 이동)
      requestAnimationFrame(function () { head.scrollIntoView({ block: "center" }); });
      head.classList.remove("flash"); void head.offsetWidth; head.classList.add("flash");
    });

    // 범죄사실 입력칸 · 복사
    var fb = $("facts-block");
    fb.addEventListener("input", function (e) {
      var k = e.target.getAttribute("data-f");
      if (!k) return;
      S.fields[k] = e.target.value;
      keys.forEach(function (key, i) { var el = $("fact-" + i); if (el) el.textContent = factText(G.facts[key], defaults); });
    });
    fb.addEventListener("click", function (e) {
      var b = e.target.closest(".copy");
      if (!b) return;
      var t = $("fact-" + b.getAttribute("data-i")).textContent;
      var done = function () { b.textContent = "복사됨"; setTimeout(function () { b.textContent = "복사"; }, 1200); };
      if (navigator.clipboard) navigator.clipboard.writeText(t).then(done, function () {});
    });
  }

  // ── 판례 팝업 ───────────────────────────────────────
  var dlg = document.createElement("dialog");
  document.body.appendChild(dlg);
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".prec");
    if (!b) return;
    var no = b.getAttribute("data-p"), p = P[no];
    if (!p) return;
    dlg.innerHTML = '<button class="close" aria-label="닫기">×</button><h3>' + (p.lower ? esc(p.court) + " " + esc(p.date) + " 선고 (하급심)" : "대법원 " + esc(p.date) + " 선고 " + esc(no)) + (p.en ? " " + esc(p.en) : "") + "</h3>" +
      '<p><b>' + esc(p.title) + "</b></p><p>" + esc(p.holding) + '</p><p><a href="' + precUrl(no) + '" target="_blank" rel="noopener">' + (p.seq ? "국가법령정보센터 원문 보기" : "관련 보도 보기") + '</a></p>';
    dlg.querySelector(".close").onclick = function () { dlg.close(); };
    if (dlg.showModal) dlg.showModal();
  });
  dlg.addEventListener("click", function (e) { if (e.target === dlg) dlg.close(); });

  // ── 법령·판례 탭 ────────────────────────────────────
  function renderRef() {
    var el = $("mode-ref");
    var lawKeys = Object.keys(L).filter(function (k) { return k !== "meta"; });
    el.innerHTML = '<input class="text ref-search" id="ref-q" placeholder="검색 (예: 직불, 접근매체, 2003도3977)">' + '<div id="ref-list"></div>';
    var draw = function (q) {
      q = (q || "").trim();
      var hit = function (s) { return !q || s.indexOf(q) >= 0; };
      var laws = lawKeys.filter(function (k) { var l = L[k]; return hit([l.law, l.art, l.name, l.text || "", l.penalty || "", l.note || ""].join(" ")); }).map(function (k) {
        var l = L[k];
        return '<div class="ref-item"><h3>' + esc(l.name) + '</h3><div class="meta">' + esc(l.law + " " + l.art) + "</div>" +
          (l.text ? "<p>" + esc(l.text) + "</p>" : "") + (l.penalty ? "<p><b>법정형</b> " + esc(l.penalty) + "</p>" : "") +
          (l.penaltyOld ? "<p><b>구 법정형</b> " + esc(l.penaltyOld) + "</p>" : "") + (l.attempt ? "<p><b>미수</b> " + esc(l.attempt) + "</p>" : "") +
          (l.note ? "<p>" + esc(l.note) + "</p>" : "") + "</div>";
      }).join("");
      var precs = Object.keys(P).filter(function (k) { return hit(k + " " + P[k].title + " " + P[k].holding); }).map(function (k) {
        var p = P[k];
        return '<div class="ref-item"><h3>' + esc(precLabel(k)) + " — " + esc(p.title) + '</h3><div class="meta">' + esc(p.date) + ' 선고 · <a href="' + precUrl(k) + '" target="_blank" rel="noopener">' + (p.seq ? "원문" : "보도") + '</a></div><p>' + esc(p.holding) + "</p></div>";
      }).join("");
      $("ref-list").innerHTML = '<h2 class="ref-h">법령 (' + L.meta.verified + " 원문 대조)</h2>" + (laws || '<p class="basis">검색 결과 없음</p>') + '<h2 class="ref-h">판례</h2>' + (precs || '<p class="basis">검색 결과 없음</p>');
    };
    draw("");
    $("ref-q").oninput = function () { draw(this.value); };
  }

  // ── 탭 · 테마 · 오프라인 ────────────────────────────
  function setMode(mode) {
    S.mode = mode;
    document.querySelectorAll(".tabs button").forEach(function (b) { b.setAttribute("aria-selected", String(b.getAttribute("data-mode") === mode)); });
    ["use", "mule", "money", "facility", "ref"].forEach(function (m) { $("mode-" + m).hidden = m !== mode; });
    if (mode === "use") renderUse();
    else if (mode === "mule") renderMule();
    else if (mode === "money") renderMoney();
    else if (mode === "facility") renderFacility();
    else { renderRef(); analyze(); }
    window.scrollTo(0, 0);
  }
  document.querySelector(".tabs").onclick = function (e) {
    var b = e.target.closest("button[data-mode]");
    if (b) setMode(b.getAttribute("data-mode"));
  };

  var themes = ["auto", "dark", "light"];
  function applyTheme(t) {
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }
  var theme = "auto";
  try { theme = localStorage.getItem("theme") || "auto"; } catch (e) {}
  applyTheme(theme);
  $("theme").onclick = function () {
    theme = themes[(themes.indexOf(theme) + 1) % themes.length];
    applyTheme(theme);
    try { localStorage.setItem("theme", theme); } catch (e) {}
  };

  // 범행 시기 참고사항을 두 메뉴에 붙인다
  var helpTpl = $("date-help");
  document.querySelectorAll(".date-help-slot").forEach(function (slot) {
    slot.appendChild(helpTpl.content.cloneNode(true));
  });

  $("verified").textContent = "법령·판례 원문 대조 " + L.meta.verified + " · 앱 " + L.meta.appVersion;
  if ("serviceWorker" in navigator && location.protocol.indexOf("http") === 0) {
    var hadController = !!navigator.serviceWorker.controller, reloaded = false;
    // 업데이트된 서비스워커가 제어를 넘겨받으면 한 번 새로고침해 최신 화면을 보여준다
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (hadController && !reloaded) { reloaded = true; location.reload(); }
    });
    navigator.serviceWorker.register("sw.js").then(function (reg) { reg.update(); }).catch(function () {});
  }

  setMode("use");
})();
