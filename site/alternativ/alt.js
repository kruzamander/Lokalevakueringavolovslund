(function () {
  "use strict";
  var D = window.ALT;
  var T = D.text;
  var S = D.schools;
  var ALTS = D.alts;
  var BENCH = D.bench;
  var NBSP = " ";
  var view = document.getElementById("view");
  var live = document.getElementById("live");
  var menuLinks = document.querySelectorAll(".menu a");
  var PDF = "Alternativ-evakuering-Olovslundsskolan-A4-utkast-3.pdf";

  /* ---------------------------------------------------------------- helpers */
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function sv(x, d) { return x.toFixed(d); }
  function dec(x, d) { return x.toFixed(d).replace(".", ","); }
  function pct(v, d) { return dec(v * 100, d === undefined ? 1 : d) + NBSP + "%"; }
  function pp(v) {
    var r = Math.round(Math.abs(v) * 10) / 10;
    return (v < 0 ? "−" : "+") + dec(r, 1) + NBSP + "pp";
  }
  function n0(v) { return String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP); }
  function km(v) { return dec(v, 1) + NBSP + "km"; }
  var uidN = 0;
  function uid() { uidN += 1; return "u" + uidN; }
  function byNr(n) { return ALTS[n - 1]; }
  function winIdx(a) { return a.start === 2028 ? 0 : a.start === 2030 ? 1 : 2; }
  function isOver(a) { return a.max_bel > BENCH + 1e-9; }

  var O = S.OL;
  var COS = Math.cos(O.lat * Math.PI / 180);
  var KMDEG = 111.19; // km per grad (R = 6371 km)
  function proj(lat, lon) { return { x: (lon - O.lon) * COS * KMDEG, y: (lat - O.lat) * KMDEG }; }
  function dist(code) {
    var s = S[code];
    if (s.lat === undefined) return null;
    var p = proj(s.lat, s.lon);
    return Math.sqrt(p.x * p.x + p.y * p.y);
  }
  var KOMMUN = ["VAL", "AL"];

  /* ---------------------------------------------------------- district data */
  var districts = null; // GeoJSON FeatureCollection, om districts.geojson finns

  function loadDistricts() {
    if (!window.fetch) return;
    fetch("districts.geojson", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (g) {
        if (g && g.type === "FeatureCollection" && g.features && g.features.length) {
          districts = g;
          route();
        }
      })
      .catch(function () {});
  }

  function ringPath(ring, W, H, vb) {
    return ring.map(function (c, i) {
      var p = proj(c[1], c[0]);
      return (i ? "L" : "M") + sv(vb.px(p.x), 1) + " " + sv(vb.py(p.y), 1);
    }).join("") + "Z";
  }
  function featName(f) {
    var p = f.properties || {};
    var k = ["name", "NAMN", "namn", "stadsdelsomrade", "STADSDELSOMRADE", "SDO_NAMN", "sdo_namn", "Name"];
    for (var i = 0; i < k.length; i++) if (typeof p[k[i]] === "string") return p[k[i]];
    for (var key in p) if (typeof p[key] === "string") return p[key];
    return "";
  }

  /* ------------------------------------------------------------------ svg: tidslinje */
  function timelineSVG(a) {
    var W = 360, x0 = 8, span = 344, y0 = 2026, n = 9;
    function X(y) { return x0 + (y - y0) / n * span; }
    var wins = [2028, 2030, 2032];
    var out = '<svg viewBox="0 0 ' + W + ' 104" role="img" aria-label="Tidslinje 2026 till 2034: ' + esc(a.sub) +
      ', jämfört med förvaltningens förslag ht 2028 till vt 2030">';
    // år
    for (var y = y0; y < y0 + n; y++) {
      out += '<line x1="' + sv(X(y), 1) + '" x2="' + sv(X(y), 1) + '" y1="76" y2="81" stroke="#7f918f"/>';
      out += '<text x="' + sv(X(y + 0.5), 1) + '" y="96" font-size="10.5" text-anchor="middle" fill="#55615f">' + y + "</text>";
    }
    out += '<line x1="' + x0 + '" x2="' + (x0 + span) + '" y1="76" y2="76" stroke="#7f918f" stroke-width="1.5"/>';
    out += '<line x1="' + (x0 + span) + '" x2="' + (x0 + span) + '" y1="76" y2="81" stroke="#7f918f"/>';
    // beslut
    var bx = X(2026.95);
    out += '<path d="M' + sv(bx, 1) + ' 6l5 5-5 5-5-5z" fill="#1c1c1c"/>';
    out += '<text x="' + sv(bx + 9, 1) + '" y="15" font-size="10.5" fill="#1c1c1c">Beslut i nämnden, dec 2026</text>';
    // förvaltningen
    out += '<rect x="' + sv(X(2028.65), 1) + '" y="24" width="' + sv(X(2030.5) - X(2028.65), 1) + '" height="9" rx="4.5" fill="#b3261e"/>';
    out += '<text x="' + sv(X(2030.5) + 6, 1) + '" y="32" font-size="10.5" fill="#b3261e" font-weight="500">Förvaltningens förslag</text>';
    // fönster
    var cx0 = X(a.start + 0.65), cx1 = X(a.start + 2.5);
    var late = a.start >= 2032;
    out += '<text x="' + sv(late ? cx1 : cx0, 1) + '" y="49" font-size="10.5" font-weight="600" fill="#1c7a49" text-anchor="' +
      (late ? "end" : "start") + '">Alt ' + a.nr + ": " + esc(a.sub.replace("Evakuering ", "").replace("Renoveringen skjuts ", "skjuts ")) + "</text>";
    wins.forEach(function (w) {
      var cur = w === a.start;
      out += '<rect x="' + sv(X(w + 0.65), 1) + '" y="55" width="' + sv(X(w + 2.5) - X(w + 0.65), 1) + '" height="11" rx="5.5" fill="' +
        (cur ? "#1c7a49" : "#d7dedd") + '"/>';
    });
    out += "</svg>";
    return out;
  }

  /* ------------------------------------------------------------------ svg: skillnad mot nivån */
  function diffBarSVG(d) {
    var W = 360, lo = -12, hi = 6, x0 = 10, span = 340;
    function X(v) { return x0 + (v - lo) / (hi - lo) * span; }
    var out = '<svg viewBox="0 0 ' + W + ' 58" role="img" aria-label="Skillnad mot förvaltningens nivå: ' + esc(pp(d)) + '">';
    out += '<rect x="' + x0 + '" y="14" width="' + span + '" height="22" rx="5" fill="#efe7e0"/>';
    var v = Math.max(lo, Math.min(hi, d));
    var over = d > 0;
    var xa = Math.min(X(0), X(v)), w = Math.abs(X(v) - X(0));
    out += '<rect x="' + sv(xa, 1) + '" y="14" width="' + sv(Math.max(w, 2), 1) + '" height="22" fill="' + (over ? "#b3261e" : "#1c7a49") + '"/>';
    out += '<line x1="' + sv(X(0), 1) + '" x2="' + sv(X(0), 1) + '" y1="8" y2="42" stroke="#1c1c1c" stroke-width="2"/>';
    [-12, -8, -4, 4].forEach(function (t) {
      out += '<text x="' + sv(X(t), 1) + '" y="54" font-size="10" text-anchor="middle" fill="#55615f">' + (t < 0 ? "−" : "+") + Math.abs(t) + "</text>";
    });
    out += '<text x="' + sv(X(0), 1) + '" y="54" font-size="10" text-anchor="middle" fill="#1c1c1c" font-weight="600">0</text>';
    if (over) out += '<text x="' + sv(X(v) + 4, 1) + '" y="30" font-size="13" fill="#b3261e">▲</text>';
    out += "</svg>";
    return out;
  }

  /* ------------------------------------------------------------------ kapacitetsstaplar */
  function capBars(a, yi, only) {
    var y = a.years[yi];
    var html = '<div class="bars">';
    y.schools.slice(0, only || y.schools.length).forEach(function (s) {
      var sc = S[s.s];
      var over = s.bel > BENCH + 1e-9;
      var ordW = s.ord / s.kap / 1.25 * 100;
      var evW = s.evak / s.kap / 1.25 * 100;
      var nums = s.ord > 0 ? n0(s.ord) + " + " + n0(s.evak) : n0(s.evak);
      html += '<div class="bar-row"><div class="top2"><span class="nm">' + esc(sc.short) + ' <span class="sw">' + n0(s.kap) +
        ' platser</span></span><span class="pct' + (over ? " over" : "") + '">' + (over ? "▲ " : "") + pct(s.bel) + "</span></div>" +
        '<div class="track" role="img" aria-label="' + esc(sc.short + " " + pct(s.bel) + (s.ord > 0 ? ", " + n0(s.ord) + " ordinarie och " + n0(s.evak) + " från Olovslund" : ", " + n0(s.evak) + " från Olovslund")) + '">' +
        '<span class="ord" style="width:' + sv(ordW, 2) + '%"></span>' +
        '<span class="evk" style="left:' + sv(ordW, 2) + "%;width:" + sv(evW, 2) + '%"></span>' +
        '<span class="m100" style="left:80%"></span><span class="mk" style="left:' + sv(BENCH / 1.25 * 100, 2) + '%"></span></div>' +
        '<div class="sub2"><span>' + (s.ord > 0 ? "ordinarie + från Olovslund" : "från Olovslund") + "</span><span>" + nums + "</span></div></div>";
    });
    return html + "</div>";
  }
  function capLegend() {
    return '<div class="legend"><span><i class="sq" style="background:#d7dedd"></i>Platser</span>' +
      '<span><i class="sq" style="background:#7f918f"></i>Ordinarie elever</span>' +
      '<span><i class="sq" style="background:#1c1c1c"></i>Elever från Olovslund</span>' +
      '<span><i class="ln" style="border-color:#1c1c1c;border-top-width:2px"></i>100' + NBSP + '%</span>' +
      '<span><i class="ln d"></i>' + pct(BENCH) + " = förvaltningens nivå</span></div>";
  }

  /* ------------------------------------------------------------------ karta */
  var XR = [-4.3, 3.0], YR = [-1.6, 4.3], MW = 360;
  var MS = MW / (XR[1] - XR[0]);
  var MH = Math.round((YR[1] - YR[0]) * MS);
  var vb = {
    px: function (x) { return (x - XR[0]) * MS; },
    py: function (y) { return (YR[1] - y) * MS; }
  };
  var LABEL = {
    OL: { dx: 0, dy: 25, a: "middle" },
    ABA: { dx: 0, dy: -12, a: "middle" },
    NA: { dx: 10, dy: 4, a: "start" },
    NE: { dx: 10, dy: 4, a: "start" },
    AV: { dx: 12, dy: 22, a: "end" },
    AL: { dx: -9, dy: 18, a: "end" },
    VAL: { dx: 11, dy: 4, a: "start" }
  };

  function routeLine(code, color, dashed, off) {
    var p = proj(S[code].lat, S[code].lon);
    var x1 = vb.px(0), y1 = vb.py(0), x2 = vb.px(p.x), y2 = vb.py(p.y);
    var dx = x2 - x1, dy = y2 - y1, len = Math.sqrt(dx * dx + dy * dy) || 1;
    var ox = -dy / len * off, oy = dx / len * off;
    return '<line x1="' + sv(x1 + ox, 1) + '" y1="' + sv(y1 + oy, 1) + '" x2="' + sv(x2 + ox, 1) + '" y2="' + sv(y2 + oy, 1) +
      '" stroke="' + color + '" stroke-width="3.4" stroke-linecap="round"' + (dashed ? ' stroke-dasharray="7 5"' : "") + "/>";
  }

  function mapSVG(a) {
    var id = uid();
    var green = a ? a.schools.filter(function (c) { return S[c].lat !== undefined; }) : [];
    var hasPav = a ? a.schools.indexOf("PAV") >= 0 : false;
    var out = '<svg viewBox="0 0 ' + MW + " " + MH + '" role="img" aria-label="' +
      esc("Karta över Olovslundsskolan och skolorna i " + (a ? "alternativ " + a.nr + " och i förvaltningens förslag" : "förvaltningens förslag") +
        ". Röda streckade linjer visar förvaltningens förslag, gröna linjer visar alternativet. Avstånden är fågelväg.") + '">';
    out += '<defs><clipPath id="' + id + '"><rect width="' + MW + '" height="' + MH + '"/></clipPath></defs>';
    out += '<g clip-path="url(#' + id + ')">';
    // stadsdelsområden (om kartdata finns)
    if (districts) {
      districts.features.forEach(function (f) {
        var g = f.geometry; if (!g) return;
        var nm = featName(f);
        var cls = /bromma/i.test(nm) ? "#7f918f" : /v.llingby|h.sselby/i.test(nm) ? "#c98d72" : "#b9b2ab";
        var polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
        var d = "";
        polys.forEach(function (poly) { poly.forEach(function (ring) { d += ringPath(ring, MW, MH, vb); }); });
        if (d) out += '<path d="' + d + '" fill="' + cls + '" fill-opacity=".14" fill-rule="evenodd" stroke="' + cls + '" stroke-width="1.6" stroke-dasharray="2 3"><title>' + esc(nm) + "</title></path>";
      });
    }
    // ringar
    [1, 2, 3, 5].forEach(function (r) {
      out += '<circle cx="' + sv(vb.px(0), 1) + '" cy="' + sv(vb.py(0), 1) + '" r="' + sv(r * MS, 1) + '" fill="none" stroke="#cfc4ba" stroke-width="1" stroke-dasharray="3 4"/>';
    });
    // resvägar
    KOMMUN.forEach(function (c) {
      out += routeLine(c, "#b3261e", true, green.indexOf(c) >= 0 ? -2.2 : 0);
    });
    green.forEach(function (c) {
      out += routeLine(c, "#1c7a49", false, KOMMUN.indexOf(c) >= 0 ? 2.2 : 0);
    });
    // skolor
    Object.keys(S).forEach(function (c) {
      var s = S[c];
      if (c === "OL" || s.lat === undefined) return;
      var p = proj(s.lat, s.lon), x = vb.px(p.x), y = vb.py(p.y);
      var inG = green.indexOf(c) >= 0, inK = KOMMUN.indexOf(c) >= 0;
      var strong = inG || inK;
      var col = inG ? "#1c7a49" : inK ? "#b3261e" : "#7f918f";
      var hv = s.district !== "Bromma";
      var fill = hv ? "#f2d4c4" : (strong ? "#fff" : "#d7dedd");
      out += hv
        ? '<rect x="' + sv(x - 5.5, 1) + '" y="' + sv(y - 5.5, 1) + '" width="11" height="11" rx="2" fill="' + fill + '" stroke="' + col + '" stroke-width="2.4"/>'
        : '<circle cx="' + sv(x, 1) + '" cy="' + sv(y, 1) + '" r="6" fill="' + fill + '" stroke="' + col + '" stroke-width="2.4"/>';
      var L = LABEL[c] || { dx: 9, dy: 4, a: "start" };
      var d = dist(c);
      var txt = s.short + (strong ? " " + dec(d, 1) + " km" : "");
      out += '<text x="' + sv(x + L.dx, 1) + '" y="' + sv(y + L.dy, 1) + '" text-anchor="' + L.a + '" font-size="' + (strong ? 11.5 : 10) +
        '" font-weight="' + (strong ? 600 : 400) + '" fill="' + (strong ? "#1c1c1c" : "#55615f") +
        '" stroke="#f4efe9" stroke-width="3.2" paint-order="stroke" stroke-linejoin="round">' + esc(txt) + "</text>";
    });
    // Olovslund
    var ox = vb.px(0), oy = vb.py(0);
    out += '<circle cx="' + sv(ox, 1) + '" cy="' + sv(oy, 1) + '" r="9" fill="#1c1c1c" stroke="#fff" stroke-width="2.5"/>';
    out += '<text x="' + sv(ox, 1) + '" y="' + sv(oy + 25, 1) + '" text-anchor="middle" font-size="12" font-weight="600" fill="#1c1c1c" stroke="#f4efe9" stroke-width="3.4" paint-order="stroke" stroke-linejoin="round">Olovslundsskolan</text>';
    // skala och norr
    var u = MS;
    out += '<line x1="12" x2="' + sv(12 + u, 1) + '" y1="' + (MH - 12) + '" y2="' + (MH - 12) + '" stroke="#1c1c1c" stroke-width="2"/>';
    out += '<text x="' + sv(12 + u / 2, 1) + '" y="' + (MH - 17) + '" font-size="10" text-anchor="middle" fill="#1c1c1c">1 km</text>';
    out += '<path d="M' + (MW - 20) + ' 12l6 14-6-4-6 4z" fill="#1c1c1c"/><text x="' + (MW - 20) + '" y="40" font-size="11" font-weight="600" text-anchor="middle" fill="#1c1c1c">N</text>';
    out += "</g></svg>";

    var leg = '<div class="legend"><span><i class="ln d"></i>Förvaltningens förslag (barnens resväg)</span>' +
      (a ? '<span><i class="ln g"></i>Alternativ ' + a.nr + " (barnens resväg)</span>" : "") +
      '<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><circle cx="7" cy="7" r="5" fill="#d7dedd" stroke="#7f918f" stroke-width="2"/></svg>Stadsdelsområde Bromma</span>' +
      '<span><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><rect x="2" y="2" width="10" height="10" rx="2" fill="#f2d4c4" stroke="#c98d72" stroke-width="2"/></svg>Stadsdelsområde Hässelby-Vällingby</span></div>';
    var note = '<p class="mapnote">Avstånd i fågelväg från Olovslundsskolan, inte verklig väg. Ringar: 1, 2, 3 och 5' + NBSP + 'km. ' +
      (hasPav ? "Paviljong Åkeshovsvägen 7 är inte inritad: läget är inte angivet i underlaget. " : "") +
      (districts ? "Skuggade ytor visar stadsdelsområdenas gränser." : 'Stadsdelsområde anges per skola enligt stadens indelning. Gränslinjerna ritas när kartdata läggs in (se <a href="#/karta">Om kartan</a>).') + "</p>";
    return '<div class="mapwrap">' + out + "</div>" + leg + note;
  }

  /* ------------------------------------------------------------------ delar för kort och detalj */
  function distChip(code) {
    var s = S[code];
    var hv = s.district !== "Bromma";
    return '<span class="chip' + (hv ? " hv" : "") + '"><i></i>' + esc(s.district) + " stadsdelsområde</span>";
  }
  function schoolsBox(a) {
    var html = '<div class="schools">';
    a.schools.forEach(function (c) {
      var s = S[c], d = dist(c);
      html += '<div class="school"><span class="nm">' + esc(s.name) + '</span><span class="cp">' + n0(s.cap) + " platser</span>" +
        '<span class="dist">' + distChip(c) +
        (d !== null ? '<span class="sw">' + km(d) + " fågelväg</span>" : '<span class="chip dash">läge ej utsatt på kartan</span>') + "</span></div>";
    });
    return html + "</div>";
  }
  function maxDist(codes) {
    var m = 0, any = false;
    codes.forEach(function (c) { var d = dist(c); if (d !== null) { any = true; if (d > m) m = d; } });
    return any ? m : null;
  }
  function windowAnp(a, row) { return T.anp.rows[row][1 + winIdx(a)]; }

  function compareBox(a) {
    var over = isOver(a);
    var md = maxDist(a.schools);
    var hasPav = a.schools.indexOf("PAV") >= 0;
    return '<div class="cmp-big ' + (over ? "over" : "ok") + '"><b>' + (over ? "▲ " : "") + esc(pp(a.diff_pp)) + "</b><span>" +
      (over ? "över" : "under") + " förvaltningens nivå (" + pct(BENCH) + ")</span></div>" +
      diffBarSVG(a.diff_pp) +
      '<p class="cmp-sub">0 = förvaltningens nivå. Stapeln visar högsta beläggningen under de två åren.</p>' +
      '<div class="vs"><div class="k"><b>Förvaltningens förslag</b>Vällingby + Ålsten<br>' + pct(BENCH) + " (Ålsten)<br>Bussning av ca 380 elever<br>Längst " + km(dist("VAL")) + "<br>Anpassad grundskola: avvecklas 2028</div>" +
      '<div class="f"><b>Alternativ ' + a.nr + "</b>" + esc(a.title) + "<br>" + pct(a.max_bel) + " högst<br>Ingen daglig busstransport<br>" +
      (md !== null ? "Längst " + km(md) + (hasPav ? " + paviljong (läge ej utsatt)" : "") : "Läge ej utsatt") + "<br>Anpassad grundskola: " + esc(a.anp.charAt(0).toLowerCase() + a.anp.slice(1)) + "</div></div>";
  }

  function card(a) {
    var over = isOver(a);
    return '<article class="card" data-nr="' + a.nr + '" tabindex="0" aria-label="Alternativ ' + a.nr + " av " + ALTS.length + ": " + esc(a.title) + '. Dubbelklicka eller tryck Enter för detaljer.">' +
      '<div class="card-in">' +
      '<div class="chead"><div class="num" aria-hidden="true">' + a.nr + '</div><div><div class="win">' + esc(a.window) + "</div><h2>" + esc(a.title) +
      '</h2><div class="sub">' + esc(a.sub) + '</div></div><div class="verdict ' + (over ? "over" : "ok") + '"><b>' + (over ? "▲ " : "") + pct(a.max_bel) + "</b>" + esc(pp(a.diff_pp)) + " mot nivån</div></div>" +
      '<div class="cgrid">' +
      '<section class="box c-tl"><h3>Tidslinje</h3>' + timelineSVG(a) + "</section>" +
      '<section class="box c-sch"><h3>Skolor och stadsdelsområde</h3>' + schoolsBox(a) + "</section>" +
      '<section class="box c-cap"><h3>Kapacitet och beläggning, ' + esc(a.years[0].label) + "</h3>" + capBars(a, 0) + capLegend() + "</section>" +
      '<section class="box c-cmp"><h3>Jämfört med förvaltningens förslag</h3>' + compareBox(a) + "</section>" +
      '<section class="box c-map"><h3>Karta och resvägar</h3>' + mapSVG(a) + "</section>" +
      "</div>" +
      '<div class="opener"><a class="btn" href="#/alt/' + a.nr + '">Öppna detaljer <span aria-hidden="true">↓</span></a><span class="tip">Dubbelklicka eller dubbeltryck på kortet</span></div>' +
      "</div></article>";
  }

  /* ------------------------------------------------------------------ vyer */
  function setMenu(key) {
    for (var i = 0; i < menuLinks.length; i++) {
      if (menuLinks[i].getAttribute("data-r") === key) menuLinks[i].setAttribute("aria-current", "page");
      else menuLinks[i].removeAttribute("aria-current");
    }
  }

  function groupInfo() {
    return [
      { label: "2028–30", first: 1, n: 4 },
      { label: "2030–32", first: 5, n: 6 },
      { label: "2032–34", first: 11, n: 4 }
    ];
  }

  function cover() {
    var c = T.cover, g = groupInfo();
    var html = '<section class="cover"><div class="in"><div class="big">14<small>ALTERNATIV<br>OLOVSLUNDSSKOLAN</small></div>' +
      '<p class="kick" style="margin-top:26px">' + esc(c.kicker) + "</p><h1>" + esc(c.title) + '</h1><p class="by">' + esc(c.by) + '</p><span class="tag">' + esc(c.tag) + "</span><br>" +
      '<a class="cta" href="#/svajp/1">Svajpa genom alla 14 alternativ <span class="arr" aria-hidden="true">→</span></a>' +
      '<p class="hint">Svajpa åt sidan mellan alternativen. Dubbelklicka (dubbeltryck) för att dyka ned i detaljerna.</p>' +
      '<div class="groups">';
    g.forEach(function (x) {
      html += '<a href="#/svajp/' + x.first + '"><b>' + x.label + "</b><span>" + x.n + " alternativ</span></a>";
    });
    html += "</div></div></section>";
    html += '<div class="page"><h2 style="margin-top:0">Hitta rätt</h2><div class="tiles">' +
      tile("#/svajp/1", "Svajpa alla alternativ", "Tidslinje, skolor, kapacitet, jämförelse och karta för varje alternativ.") +
      tile("#/oversikt", "Alla alternativ på en sida", "11 av 14 ligger på eller under den beläggning förvaltningen själv accepterar.") +
      tile("#/jamforelse", "Åtta mått jämförda", "Förvaltningens förslag och föräldragruppens alternativ sida vid sida.") +
      tile("#/kommun", "Förvaltningens förslag", "Vällingby och Ålsten 2028–2030: elever, kostnad och karta.") +
      tile("#/tidsfonster", "Tre tidsfönster", "Lediga platser ökar medan elevtalet minskar.") +
      tile("#/anpassad", "Anpassad grundskola", "Tidpunkten avgör vad som händer med de anpassade grupperna.") +
      tile("#/begaran", "Begäran och tidplan", "Utred fler alternativ innan beslutet i december.") +
      tile("#/las", "Läsanvisning", "Fyra frågor, samma svar på varje sida.") +
      tile("#/mer", "Underlag och källor", "Att utreda vidare, antaganden, kartdata och PDF.") +
      "</div>" +
      '<p><a class="dl" href="' + PDF + '" download>↓ Ladda ned hela underlaget som PDF (15 sidor)</a></p></div>';
    return html;
  }
  function tile(href, t, s) { return '<a class="tile" href="' + href + '"><b>' + esc(t) + "</b><span>" + esc(s) + "</span></a>"; }

  /* ---- svajp */
  function deckView(start) {
    var g = groupInfo();
    var html = '<div class="deckwrap"><div class="gtabs" role="group" aria-label="Tidsfönster">';
    g.forEach(function (x, i) {
      html += '<button type="button" class="gtab" data-first="' + x.first + '" aria-pressed="false">' + x.label + " · " + x.n + "</button>";
    });
    html += '</div><div class="deck" id="deck" role="region" aria-roledescription="bildspel" aria-label="De 14 alternativen" tabindex="-1">';
    ALTS.forEach(function (a) { html += card(a); });
    html += '</div><div class="dctl"><button type="button" class="arrow" id="prev" aria-label="Föregående alternativ">←</button>' +
      '<div class="dots" role="group" aria-label="Gå till alternativ">';
    ALTS.forEach(function (a) {
      html += '<button type="button" class="dot' + (isOver(a) ? " over" : "") + '" data-i="' + (a.nr - 1) + '" aria-label="Alternativ ' + a.nr + (isOver(a) ? ", över förvaltningens nivå" : "") + '">' + a.nr + "</button>";
    });
    html += '</div><button type="button" class="arrow" id="next" aria-label="Nästa alternativ">→</button></div></div>';
    return html;
  }

  function bindDeck(start) {
    var deck = document.getElementById("deck");
    var cards = Array.prototype.slice.call(deck.querySelectorAll(".card"));
    var dots = Array.prototype.slice.call(document.querySelectorAll(".dot"));
    var tabs = Array.prototype.slice.call(document.querySelectorAll(".gtab"));
    var prev = document.getElementById("prev"), next = document.getElementById("next");
    var index = -1, frame;

    function go(i, instant) {
      i = Math.max(0, Math.min(cards.length - 1, i));
      deck.scrollTo({ left: i * deck.clientWidth, behavior: instant ? "instant" : "smooth" });
      if (instant) update();
    }
    function update() {
      var i = Math.round(deck.scrollLeft / Math.max(1, deck.clientWidth));
      i = Math.max(0, Math.min(cards.length - 1, i));
      if (i === index) return;
      index = i;
      cards.forEach(function (c, n) { if (n === i) c.removeAttribute("inert"); else c.setAttribute("inert", ""); });
      dots.forEach(function (d, n) { if (n === i) { d.setAttribute("aria-current", "true"); var strip = d.parentNode; if (strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: d.offsetLeft - (strip.clientWidth - d.offsetWidth) / 2, behavior: "smooth" }); } else d.removeAttribute("aria-current"); });
      var a = ALTS[i], gi = winIdx(a);
      tabs.forEach(function (t, n) { t.setAttribute("aria-pressed", n === gi ? "true" : "false"); });
      prev.disabled = i === 0; next.disabled = i === cards.length - 1;
      if (live) live.textContent = "Alternativ " + a.nr + " av " + ALTS.length + ": " + a.title;
      try { history.replaceState(null, "", "#/svajp/" + a.nr); } catch (e) {}
    }
    deck.addEventListener("scroll", function () { cancelAnimationFrame(frame); frame = requestAnimationFrame(update); }, { passive: true });
    prev.addEventListener("click", function () { go(index - 1); });
    next.addEventListener("click", function () { go(index + 1); });
    dots.forEach(function (d) { d.addEventListener("click", function () { go(+d.getAttribute("data-i")); }); });
    tabs.forEach(function (t) { t.addEventListener("click", function () { go(+t.getAttribute("data-first") - 1); }); });

    // dubbelklick / dubbeltryck
    var down = null, last = { t: 0, x: 0, y: 0 };
    function openFrom(target) {
      var c = target.closest && target.closest(".card");
      if (!c || c.hasAttribute("inert")) return;
      location.hash = "#/alt/" + c.getAttribute("data-nr");
    }
    deck.addEventListener("pointerdown", function (e) { down = { x: e.clientX, y: e.clientY }; });
    deck.addEventListener("pointercancel", function () { down = null; last.t = 0; });
    deck.addEventListener("pointerup", function (e) {
      if (!down) return;
      var moved = Math.hypot(e.clientX - down.x, e.clientY - down.y) > 10;
      down = null;
      if (moved || (e.pointerType === "mouse" && e.button !== 0) || (e.target.closest && e.target.closest("a,button"))) { last.t = 0; return; }
      if (e.timeStamp - last.t < 420 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 40) { last.t = 0; openFrom(e.target); }
      else last = { t: e.timeStamp, x: e.clientX, y: e.clientY };
    });
    deck.addEventListener("dblclick", function (e) {
      if (e.target.closest && e.target.closest("a,button")) return;
      openFrom(e.target);
    });
    deck.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && e.target.classList && e.target.classList.contains("card")) { openFrom(e.target); e.preventDefault(); }
    });
    var onKey = function (e) {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (!document.getElementById("deck")) { document.removeEventListener("keydown", onKey); return; }
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
      if (e.key === "ArrowRight") { go(index + 1); e.preventDefault(); }
      else if (e.key === "ArrowLeft") { go(index - 1); e.preventDefault(); }
      else if (e.key === "Home") { go(0); e.preventDefault(); }
      else if (e.key === "End") { go(cards.length - 1); e.preventDefault(); }
    };
    document.addEventListener("keydown", onKey);
    var onResize = function () {
      if (!document.getElementById("deck")) { window.removeEventListener("resize", onResize); return; }
      go(index, true);
    };
    window.addEventListener("resize", onResize);
    go(start - 1, true);
  }

  /* ---- detalj */
  function detailView(nr) {
    var a = byNr(nr);
    if (!a) return notFound();
    var over = isOver(a), md = maxDist(a.schools), hasPav = a.schools.indexOf("PAV") >= 0;
    var prev = byNr(nr - 1), next = byNr(nr + 1);
    var nav = '<div class="dnav"><a class="back" href="#/svajp/' + nr + '">← Tillbaka till svajp</a><span>' +
      (prev ? '<a class="back" href="#/alt/' + prev.nr + '" rel="prev">‹ Alt ' + prev.nr + "</a> " : "") +
      (next ? '<a class="back" href="#/alt/' + next.nr + '" rel="next" style="margin-left:14px">Alt ' + next.nr + " ›</a>" : "") + "</span></div>";
    var html = '<div class="page">' + nav +
      '<div class="dhead"><div class="num" aria-hidden="true">' + a.nr + '</div><div><p class="kick">' + esc(a.window) + " · " + esc(a.sub) + "</p><h1>" + esc(a.title) + "</h1></div></div>" +
      '<div class="stats"><div class="stat"><b>' + n0(a.years[0].ol) + "</b><span>elever från Olovslund (F–6) " + esc(a.years[0].label) + "</span></div>" +
      '<div class="stat"><b>' + a.schools.length + "</b><span>lokaler</span></div>" +
      '<div class="stat ' + (over ? "over" : "ok") + '"><b>' + (over ? "▲ " : "") + pct(a.max_bel) + "</b><span>högsta beläggning</span></div>" +
      '<div class="stat ' + (over ? "over" : "ok") + '"><b>' + esc(pp(a.diff_pp)) + "</b><span>" + (over ? "över" : "under") + " förvaltningens nivå, " + pct(BENCH) + "</span></div></div>";

    html += "<h2>Tidslinje</h2>" + '<div class="box" style="max-width:640px">' + timelineSVG(a) +
      '<div class="legend"><span><i class="sq" style="background:#1c7a49"></i>Alternativ ' + a.nr + '</span><span><i class="sq" style="background:#b3261e"></i>Förvaltningens förslag, ht 2028 – vt 2030</span><span><i class="sq" style="background:#d7dedd"></i>Övriga tidsfönster</span></div></div>';

    html += "<h2>Skolor och kapacitet</h2>" + '<div class="dgrid two"><div>' + schoolsBox(a) + "</div><div></div></div>";
    a.years.forEach(function (y, i) {
      html += '<div class="yr box" style="max-width:640px"><h4>' + esc(y.label) + (i === 0 ? " (år 1)" : " (år 2)") + ": " + n0(y.ol) + " elever från Olovslund, ca " + n0(y.per_ak) + " per årskurs</h4>" + capBars(a, i) + "</div>";
    });
    html += capLegend();
    html += '<p class="src" style="font-size:16px;color:var(--ink)">' + esc(a.place) + "</p>";
    if (a.special) html += '<div class="note">Paviljongen: matsal, musik, idrott och slöjd ska lösas (se <a href="#/utreda">Att utreda vidare</a>).</div>';
    if (a.corrected) html += '<div class="note">Beräknat med 3 + 4 årskurser (arbetsbladet hade 8).</div>';
    html += '<details class="more"><summary>Visa beräkningen i siffror</summary><div>' + calcTable(a) + "</div></details>";

    html += "<h2>Jämfört med kommunens lösning</h2>" + '<div class="dgrid two"><div class="box">' + compareBox(a) + "</div><div>" + compareTable(a, md, hasPav) + "</div></div>";

    html += "<h2>Karta och resvägar</h2>" + '<div class="dgrid two"><div class="box">' + mapSVG(a) + "</div><div>" + routeTable(a) + "</div></div>";

    html += "<h2>Anpassad grundskola</h2><p class=\"lead\" style=\"font-size:18px\"><b>" + esc(a.window) + ":</b> " + esc(windowAnp(a, 0)) + ". " + esc(T.anp.rows[1][0]) + ": " + esc(windowAnp(a, 1).toLowerCase()) + ".</p>";

    html += "<h2>Åtta mått</h2>" + '<details class="more"><summary>Förvaltningens förslag jämfört med föräldragruppens alternativ</summary><div>' + mattTable() + "</div></details>";
    html += '<div style="margin-top:28px">' + nav + "</div>";
    html += "</div>";
    return html;
  }

  function calcTable(a) {
    var h = '<table class="tbl"><thead><tr><th>År</th><th>Skola</th><th class="n">Kapacitet</th><th class="n">Ordinarie</th><th class="n">Åk</th><th class="n">Från Olovslund</th><th class="n">Summa</th><th class="n">Beläggning</th></tr></thead><tbody>';
    a.years.forEach(function (y) {
      y.schools.forEach(function (s, i) {
        var over = s.bel > BENCH + 1e-9;
        h += "<tr><td>" + (i === 0 ? esc(y.label) : "") + "</td><td>" + esc(S[s.s].short) + '</td><td class="n">' + n0(s.kap) + '</td><td class="n">' + n0(s.ord) + '</td><td class="n">' + s.ak + '</td><td class="n">' + n0(s.evak) + '</td><td class="n">' + n0(s.tot) + '</td><td class="n' + (over ? " over" : "") + '">' + (over ? "▲ " : "") + pct(s.bel) + "</td></tr>";
      });
    });
    return h + '</tbody></table><p class="src">Åk = antal årskurser från Olovslund i lokalen. Beläggning = (ordinarie + från Olovslund) ÷ kapacitet.</p>';
  }

  function compareTable(a, md, hasPav) {
    var rows = [
      ["Tidpunkt", "ht 2028 – vt 2030", a.sub.replace("Evakuering ", "")],
      ["Lokaler", "Vällingbyskolan (paviljonger) + Ålstensskolan", a.title],
      ["Högsta beläggning", pct(BENCH) + " (Ålsten) = nivån", pct(a.max_bel)],
      ["Skillnad mot nivån", "0", pp(a.diff_pp) + (isOver(a) ? " ▲" : "")],
      ["Längsta avstånd (fågelväg)", km(dist("VAL")), md !== null ? km(md) + (hasPav ? " + paviljong (läge ej utsatt)" : "") : "läge ej utsatt"],
      ["Bussning", "Ca 380 elever", "Ingen daglig busstransport"],
      ["Anpassad grundskola", "Avvecklas ht 2028 utan alternativ", a.anp]
    ];
    var h = '<table class="tbl stack twocol"><thead><tr><th></th><th>Förvaltningens förslag</th><th>Alternativ ' + a.nr + "</th></tr></thead><tbody>";
    rows.forEach(function (r) { h += "<tr><th scope=\"row\">" + esc(r[0]) + '</th><td data-l="Förvaltningens förslag">' + esc(r[1]) + '</td><td data-l="Alternativ ' + a.nr + '">' + esc(r[2]) + "</td></tr>"; });
    return h + "</tbody></table>";
  }

  function routeTable(a) {
    var h = '<table class="tbl stack"><thead><tr><th>Resväg från Olovslundsskolan</th><th>Stadsdelsområde</th><th class="n">Fågelväg</th></tr></thead><tbody>';
    h += '<tr class="grp"><td colspan="3"><span class="ln d" style="vertical-align:middle"></span> Förvaltningens förslag</td></tr>';
    KOMMUN.forEach(function (c) { h += '<tr><td data-l="Resväg">' + esc(S[c].name) + '</td><td data-l="Stadsdelsområde">' + esc(S[c].district) + '</td><td class="n" data-l="Fågelväg">' + km(dist(c)) + "</td></tr>"; });
    h += '<tr class="grp"><td colspan="3"><span class="ln g" style="vertical-align:middle"></span> Alternativ ' + a.nr + "</td></tr>";
    a.schools.forEach(function (c) {
      var d = dist(c);
      h += '<tr><td data-l="Resväg">' + esc(S[c].name) + '</td><td data-l="Stadsdelsområde">' + esc(S[c].district) + '</td><td class="n" data-l="Fågelväg">' + (d !== null ? km(d) : "läge ej utsatt") + "</td></tr>";
    });
    return h + '</tbody></table><p class="src">Avstånd i fågelväg från Olovslundsskolan. Verkliga resvägar och restider mäts separat.</p>';
  }

  function mattTable() {
    var h = '<table class="tbl stack twocol"><thead><tr><th>Mått</th><th>Förvaltningens förslag</th><th>Föräldragruppens alternativ</th></tr></thead><tbody>';
    T.matt.forEach(function (r) {
      h += '<tr><th scope="row">' + esc(r[0]) + '</th><td data-l="Förvaltningens förslag">' + esc(r[1]) + '</td><td data-l="Föräldragruppens alternativ">' + esc(r[2]) + "</td></tr>";
    });
    return h + "</tbody></table><p class=\"src\">* Uppskattning, se <a href=\"#/kommun\">Förvaltningens förslag</a>.</p>";
  }

  /* ---- översikt */
  function dbarMini(d) {
    var lo = -12, hi = 6, W = 100;
    function X(v) { return (v - lo) / (hi - lo) * W; }
    var v = Math.max(lo, Math.min(hi, d)), over = d > 0;
    var xa = Math.min(X(0), X(v)), w = Math.abs(X(v) - X(0));
    return '<svg viewBox="0 0 100 10" preserveAspectRatio="none" style="width:100%;height:10px" aria-hidden="true"><rect width="100" height="10" rx="3" fill="#efe7e0"/><rect x="' + sv(xa, 1) + '" width="' + sv(Math.max(w, 1), 1) + '" height="10" fill="' + (over ? "#b3261e" : "#1c7a49") + '"/><line x1="' + sv(X(0), 1) + '" x2="' + sv(X(0), 1) + '" y1="0" y2="10" stroke="#1c1c1c" stroke-width="1.2"/></svg>';
  }
  function overviewView() {
    var under = ALTS.filter(function (a) { return !isOver(a); }).length;
    var html = '<div class="page"><p class="kick">Översikt</p><h1>Alla alternativ på en sida</h1><p class="lead">' + under + " av " + ALTS.length +
      " alternativ ligger på eller under den beläggning förvaltningen själv accepterar. Ju senare evakueringen sker, desto lägre blir beläggningen.</p>";
    var heads = [["2028–2030", "Evakuering ht 2028 – vt 2030", 0, 4], ["2030–2032", "Renoveringen skjuts två år", 4, 10], ["2032–2034", "Renoveringen skjuts fyra år", 10, 14]];
    heads.forEach(function (h, gi) {
      html += '<div class="ov-grp"><h2>' + h[0] + '</h2><span class="muted">' + h[1] + "</span></div><div class=\"ov\">";
      if (gi === 0) {
        html += '<a href="#/kommun"><span class="n1 f" aria-hidden="true">F</span><span><span class="t1">Vällingby + Ålsten</span><br><span class="t2">Förvaltningens förslag · 534 elever · Stängs 2028</span></span><span class="p1">' + pct(BENCH) + "<small>= nivån</small></span></a>";
      } else {
        html += '<a href="#/kommun"><span class="n1 f" aria-hidden="true">F</span><span><span class="t1">Förvaltningens förslag</span><br><span class="t2">Ej analyserat</span></span><span class="p1">–</span></a>';
      }
      for (var i = h[2]; i < h[3]; i++) {
        var a = ALTS[i], over = isOver(a);
        html += '<a href="#/alt/' + a.nr + '"><span class="n1" aria-hidden="true">' + a.nr + '</span><span><span class="t1">' + esc(a.title) + '</span><br><span class="t2">' + a.schools.map(function (c) { return n0(S[c].cap); }).join(" + ") + " platser · " + n0(a.years[0].ol) + " elever · " + esc(a.anp) +
          '</span></span><span class="p1' + (over ? " over" : "") + '">' + (over ? "▲ " : "") + pct(a.max_bel) + "<small>" + esc(pp(a.diff_pp)) + '</small></span><span class="dbar">' + dbarMini(a.diff_pp) + "</span></a>";
      }
      html += "</div>";
    });
    html += '<p class="src">Platser = bedömd kapacitet per lokal. Evakuerade = elever från Olovslund första året. Paviljong = Åkeshovsvägen 7 (8–9 salar, 240 platser). Skillnad mot nivån: stapeln visar högsta beläggningen under de två åren jämfört med förvaltningens nivå (' + pct(BENCH) + '), som är nollstrecket. Grön stapel åt vänster = under nivån, röd åt höger och ▲ = över. Skillnaden anges i procentenheter (pp). "Utom åk 1–2" = anpassad grundskola fasas ut utom dagens åk 1–2.</p></div>';
    return html;
  }

  function compareView() {
    return '<div class="page"><p class="kick">Jämförelse</p><h1>Åtta mått jämförda</h1><p class="lead">Samma åtta mått för förvaltningens förslag och för föräldragruppens alternativ.</p><div style="margin-top:18px">' + mattTable() + "</div></div>";
  }

  function kommunView() {
    var k = T.kommun, html = '<div class="page"><p class="kick">Förvaltningens förslag</p><h1>Vällingby och Ålsten, 2028–2030</h1><p class="lead">Det enda alternativ förvaltningen har analyserat. Barnen delas på två lokaler, och fem av sju årskurser åker buss.</p><div class="facts">';
    k.facts.forEach(function (f) { html += "<div><b>" + esc(f[0]) + "</b><span>" + esc(f[1]) + "</span></div>"; });
    html += '</div><div class="kcards">';
    [k.val, k.als].forEach(function (c) {
      html += '<div class="kcard"><h3>' + esc(c.title) + '</h3><div class="bg">' + esc(c.big) + "</div><p>" + esc(c.big_t) + "</p>" + c.lines.map(function (l, i) { return '<p class="' + (i ? "small" : "") + '">' + esc(l) + "</p>"; }).join("") + "</div>";
    });
    html += "</div><h2>Kostnad enligt föräldragruppens uträkning</h2>" + '<table class="tbl cost"><tbody>';
    k.cost.forEach(function (r) {
      html += '<tr class="' + r[0] + '"><td>' + esc(r[1]) + '</td><td class="r">' + esc(r[2]) + "</td></tr>";
    });
    html += '</tbody></table><p class="src">' + esc(k.note1) + "</p><p class=\"src\">" + esc(k.note2) + "</p>" +
      '<h2>Karta: förvaltningens resvägar</h2><div class="box" style="max-width:660px">' + mapSVG(null) + "</div>";
    html += '<p style="margin-top:22px"><a class="btn" href="#/svajp/1">Se föräldragruppens 14 alternativ <span aria-hidden="true">→</span></a></p></div>';
    return html;
  }

  function windowsView() {
    var w = T.windows;
    var html = '<div class="page"><p class="kick">Tre tidsfönster</p><h1>Lediga platser ökar medan elevtalet minskar</h1><p class="lead">' + esc(w.lead) + "</p>";
    html += "<h2>Så full blir skolan utan evakuering</h2><p class=\"muted\">Ordinarie elever ÷ kapacitet. Skalan är inzoomad: 55–95" + NBSP + "%. Stjärnorna visar hur mycket plats som finns kvar 2033.</p>";
    html += '<div class="box chart">' + lineChart() + "</div>";
    html += '<table class="tbl stack" style="margin-top:14px"><thead><tr><th>Skola</th><th class="n">Beläggning 2033</th><th>Lediga platser 2033</th></tr></thead><tbody>';
    D.chart.slice().sort(function (a, b) { return b.free - a.free; }).forEach(function (c) {
      html += '<tr><td data-l="Skola">' + esc(S[c.s].short) + '</td><td class="n" data-l="Beläggning 2033">' + pct(c.end, 0) + '</td><td data-l="Lediga platser 2033"><span class="stars" aria-label="' + c.stars + ' av 5 stjärnor">' + starStr(c.stars) + "</span> " + pct(c.free, 0) + "</td></tr>";
    });
    html += '</tbody></table><p class="src">Stjärnor = lediga platser 2033 som andel av kapaciteten: 1 = under 10' + NBSP + '%, 2 = 10–19' + NBSP + '%, 3 = 20–29' + NBSP + '%, 4 = 30–39' + NBSP + '%, 5 = 40' + NBSP + '% eller mer. De visar bara lediga platser, inte avstånd eller lämplighet.</p>';
    html += '<table class="tbl stack" style="margin-top:22px"><thead><tr><th></th><th>2028–2030</th><th>2030–2032</th><th>2032–2034</th></tr></thead><tbody>';
    w.rows.forEach(function (r) {
      html += '<tr><th scope="row">' + esc(r[0]) + '</th><td data-l="2028–2030">' + esc(r[1]) + '</td><td data-l="2030–2032">' + esc(r[2]) + '</td><td data-l="2032–2034">' + esc(r[3]) + "</td></tr>";
    });
    html += '</tbody></table><p class="src">' + esc(w.src) + "</p></div>";
    return html;
  }
  function starStr(n) {
    var s = "";
    for (var i = 1; i <= 5; i++) s += i <= n ? "★" : '<span class="off">★</span>';
    return s;
  }
  function lineChart() {
    var W = 360, H = 250, L = 34, R = 100, Tp = 12, B = 28, lo = 0.55, hi = 0.95, yrs = 6;
    function X(i) { return L + i / (yrs - 1) * (W - L - R); }
    function Y(v) { return Tp + (hi - v) / (hi - lo) * (H - Tp - B); }
    var cols = { NE: "#1c1c1c", NA: "#2c6e7a", AV: "#7a4a74", AL: "#c06a43", ABA: "#7f918f" };
    var dash = { NE: "", NA: "", AV: "", AL: "5 3", ABA: "" };
    var out = '<svg viewBox="0 0 ' + W + " " + H + '" role="img" aria-label="Linjediagram över beläggning 2028 till 2033 för fem skolor utan evakuering">';
    for (var v = 0.55; v <= 0.951; v += 0.1) {
      out += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + sv(Y(v), 1) + '" y2="' + sv(Y(v), 1) + '" stroke="#e6d9d0"/><text x="' + (L - 5) + '" y="' + sv(Y(v) + 3.5, 1) + '" font-size="10" text-anchor="end" fill="#55615f">' + Math.round(v * 100) + "%</text>";
    }
    for (var i = 0; i < yrs; i++) out += '<text x="' + sv(X(i), 1) + '" y="' + (H - 8) + '" font-size="10.5" text-anchor="middle" fill="#55615f">' + (2028 + i) + "</text>";
    var ends = [];
    D.chart.forEach(function (c) {
      var pts = c.series.map(function (s, i) { return sv(X(i), 1) + "," + sv(Y(s), 1); }).join(" ");
      out += '<polyline points="' + pts + '" fill="none" stroke="' + cols[c.s] + '" stroke-width="2.4" stroke-linejoin="round"' + (dash[c.s] ? ' stroke-dasharray="' + dash[c.s] + '"' : "") + "/>";
      ends.push({ c: c, y: Y(c.end) });
    });
    ends.sort(function (a, b) { return a.y - b.y; });
    for (var k = 1; k < ends.length; k++) if (ends[k].y - ends[k - 1].y < 13) ends[k].y = ends[k - 1].y + 13;
    ends.forEach(function (e) {
      out += '<text x="' + (W - R + 6) + '" y="' + sv(e.y + 3.5, 1) + '" font-size="11" font-weight="500" fill="' + cols[e.c.s] + '">' + esc(S[e.c.s].short) + " " + Math.round(e.c.end * 100) + "%</text>";
    });
    return out + "</svg>";
  }

  function anpassadView() {
    var a = T.anp;
    var html = '<div class="page"><p class="kick">Anpassad grundskola</p><h1>Tidpunkten avgör vad som händer med de anpassade grupperna</h1><p class="lead">' + esc(a.lead) + "</p>";
    html += '<table class="tbl stack" style="margin-top:20px"><thead><tr><th></th><th>2028–2030</th><th>2030–2032</th><th>2032–2034</th></tr></thead><tbody>';
    a.rows.forEach(function (r) {
      html += '<tr><th scope="row">' + esc(r[0]) + '</th><td data-l="2028–2030">' + esc(r[1]) + '</td><td data-l="2030–2032">' + esc(r[2]) + '</td><td data-l="2032–2034">' + esc(r[3]) + "</td></tr>";
    });
    return html + '</tbody></table><p class="src">' + esc(a.src) + "</p></div>";
  }

  function askView() {
    var a = T.ask;
    var html = '<div class="page"><p class="kick">Begäran och tidplan</p><h1>' + esc(a.h1) + '</h1><p class="lead">' + esc(a.lead) + '</p><ol class="asks">';
    a.asks.forEach(function (x) { html += "<li><div><b>" + esc(x[0]) + "</b> " + esc(x[1]) + "</div></li>"; });
    html += '</ol><h2>Tidplan</h2><div class="steps">';
    a.tl.forEach(function (t) { html += '<div class="step"><b>' + esc(t[0]) + "</b><span>" + esc(t[1]) + "</span></div>"; });
    return html + '</div><p class="src">Kontakt: <a href="mailto:olovslundsskolanforaldrar@gmail.com">olovslundsskolanforaldrar@gmail.com</a></p></div>';
  }

  function howtoView() {
    var h = T.howto;
    var html = '<div class="page"><p class="kick">Läsanvisning</p><h1>Fyra frågor, samma svar på varje sida</h1><p class="lead">Varje alternativ besvarar samma fyra frågor i samma ordning, så att man kan bläddra mellan dem och jämföra.</p><div class="steps" style="grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">';
    h.keys.forEach(function (k) { html += '<div class="step"><b>' + esc(k[0]) + "</b><span>" + esc(k[1]) + "</span></div>"; });
    html += "</div><h2>Så läser du ett stapeldiagram</h2><p class=\"muted\">Exemplet är alternativ 1, ht 2028, Abrahamsbergsskolan.</p>" +
      '<div class="box" style="max-width:520px">' + capBars(ALTS[0], 0, 1) + capLegend() + "</div>" +
      '<p class="src">Under procenttalet: ordinarie elever + elever från Olovslund.</p><ul class="list" style="margin-top:18px">';
    h.defs.forEach(function (d) { html += "<li><b>" + esc(d[0]) + ".</b> " + esc(d[1]) + "</li>"; });
    return html + "</ul></div>";
  }

  function todoView() {
    var html = '<div class="page"><p class="kick">Att utreda vidare</p><h1>Vad förvaltningen behöver svara på</h1><ul class="list" style="margin-top:18px">';
    T.todo.forEach(function (t) { html += "<li><b>" + esc(t[0]) + "</b> " + esc(t[1]) + "</li>"; });
    return html + "</ul></div>";
  }
  function sourcesView() {
    var html = '<div class="page"><p class="kick">Underlag</p><h1>Källor och antaganden</h1><ul class="list" style="margin-top:18px">';
    T.kallor.forEach(function (t) { html += "<li><b>" + esc(t[0]) + ".</b> " + esc(t[1]) + "</li>"; });
    return html + '</ul><p><a class="dl" href="' + PDF + '" download>↓ Ladda ned underlaget som PDF (15 sidor)</a></p></div>';
  }
  function aboutMapView() {
    return '<div class="page"><p class="kick">Om kartan</p><h1>Vad kartan visar och inte visar</h1><ul class="list" style="margin-top:18px">' +
      "<li><b>Resvägar.</b> Röda streckade linjer är förvaltningens förslag (Vällingbyskolan och Ålstensskolan). Gröna heldragna linjer är föräldragruppens alternativ. Linjerna är fågelväg från Olovslundsskolan, inte verklig väg. Verkliga restider mäts separat.</li>" +
      "<li><b>Stadsdelsområde.</b> Varje skola är märkt med det stadsdelsområde den ligger i enligt stadens indelning: Olovslundsskolan, Abrahamsbergsskolan, Norra Ängby skola, Nya Elementar, Äppelviksskolan och Ålstensskolan i Bromma, Vällingbyskolan i Hässelby-Vällingby. Märkningen är inte uträknad från kartdata.</li>" +
      "<li><b>Gränslinjer.</b> " + (districts ? "Stadsdelsområdenas gränser ritas från filen <code>districts.geojson</code>." : "Stadsdelsområdenas gränslinjer ritas inte ännu, eftersom kartdata inte kunde hämtas när sidan byggdes. Sidan ritar dem automatiskt så fort filen <code>districts.geojson</code> (GeoJSON, WGS84, polygoner per stadsdelsområde) läggs i samma mapp som sidan.") + "</li>" +
      "<li><b>Koordinater.</b> Skolornas lägen kommer från SL:s platsdata. Paviljong Åkeshovsvägen 7 är inte inritad: läget är inte angivet i underlaget.</li>" +
      "<li><b>Ringar.</b> 1, 2, 3 och 5" + NBSP + "km från Olovslundsskolan.</li></ul></div>";
  }
  function moreView() {
    return '<div class="page"><p class="kick">Mer</p><h1>Underlag och bakgrund</h1><div class="tiles" style="margin-top:18px">' +
      tile("#/tidsfonster", "Tre tidsfönster", "Lediga platser ökar medan elevtalet minskar.") +
      tile("#/anpassad", "Anpassad grundskola", "Tidpunkten avgör vad som händer.") +
      tile("#/begaran", "Begäran och tidplan", "Vad vi ber nämnden göra, och när.") +
      tile("#/las", "Läsanvisning", "Så läser du staplarna och begreppen.") +
      tile("#/utreda", "Att utreda vidare", "Åtta punkter för förvaltningen.") +
      tile("#/underlag", "Källor och antaganden", "Elevprognoser, kapacitet, FAQ 2 och vad som inte ingår.") +
      tile("#/karta", "Om kartan", "Resvägar, stadsdelsområden och koordinater.") +
      '<a class="tile" href="' + PDF + '" download><b>PDF</b><span>Hela underlaget, 15 sidor, utkast 2026-10-25.</span></a></div></div>';
  }
  function notFound() {
    return '<div class="page"><h1>Sidan finns inte</h1><p><a class="btn" href="#/">Till omslaget</a></p></div>';
  }

  /* ------------------------------------------------------------------ router */
  var ROUTES = {
    "": { t: "14 alternativ till evakuering av Olovslundsskolan", m: "", f: cover },
    oversikt: { t: "Alla alternativ", m: "oversikt", f: overviewView },
    jamforelse: { t: "Åtta mått jämförda", m: "jamforelse", f: compareView },
    kommun: { t: "Förvaltningens förslag", m: "kommun", f: kommunView },
    tidsfonster: { t: "Tre tidsfönster", m: "mer", f: windowsView },
    anpassad: { t: "Anpassad grundskola", m: "mer", f: anpassadView },
    begaran: { t: "Begäran och tidplan", m: "mer", f: askView },
    las: { t: "Läsanvisning", m: "mer", f: howtoView },
    utreda: { t: "Att utreda vidare", m: "mer", f: todoView },
    underlag: { t: "Källor och antaganden", m: "mer", f: sourcesView },
    karta: { t: "Om kartan", m: "mer", f: aboutMapView },
    mer: { t: "Underlag", m: "mer", f: moreView }
  };
  var SUFFIX = " · 14 alternativ, Olovslundsskolan";

  function route() {
    var parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
    var head = parts[0] || "";
    var isDeck = head === "svajp";
    document.body.classList.toggle("deck-mode", isDeck);
    var html, title, menu;
    if (isDeck) {
      var n = Math.max(1, Math.min(ALTS.length, parseInt(parts[1], 10) || 1));
      html = deckView(n); title = "Svajpa alla alternativ"; menu = "svajp";
      view.innerHTML = html;
      bindDeck(n);
    } else if (head === "alt") {
      var nr = parseInt(parts[1], 10);
      html = detailView(nr); title = byNr(nr) ? "Alternativ " + nr + ": " + byNr(nr).title : "Sidan finns inte"; menu = "svajp";
      view.innerHTML = html;
    } else {
      var r = ROUTES[head];
      html = r ? r.f() : notFound(); title = r ? r.t : "Sidan finns inte"; menu = r ? r.m : "";
      view.innerHTML = html;
    }
    setMenu(menu);
    document.title = (head === "" ? title : title + SUFFIX);
    if (!isDeck) window.scrollTo(0, 0);
    try { view.focus({ preventScroll: true }); } catch (e) {}
  }

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && /^#\/alt\/\d+/.test(location.hash)) {
      var m = location.hash.match(/\d+/);
      location.hash = "#/svajp/" + m[0];
    }
  });
  window.addEventListener("hashchange", route);
  route();
  loadDistricts();
})();
