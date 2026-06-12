"use strict";

/* ============================================================
 * Parser: Funktionsterm -> Koeffizienten-Array (Index = Potenz)
 * ============================================================ */

const SUPERSCRIPTS = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

function parsePolynomial(input) {
  let s = input.trim();
  if (!s) throw new Error("Bitte einen Funktionsterm eingeben.");

  // Normalisieren: Unicode-Minus, Mal-Zeichen, Hochzahlen, Dezimalkomma
  s = s
    .replace(/[−–]/g, "-")
    .replace(/[·×*]/g, "")
    .replace(/\s+/g, "")
    .replace(/X/g, "x")
    .replace(/,/g, ".")
    .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPTS[c]).join(""));

  if (/^f\(x\)=/.test(s)) s = s.slice(5);
  if (/^y=/.test(s)) s = s.slice(2);

  const invalid = s.match(/[^0-9x^+\-.]/);
  if (invalid) throw new Error(`Ungültiges Zeichen: „${invalid[0]}"`);

  // In Terme zerlegen (Vorzeichen bleibt am Term)
  const terms = s.match(/[+-]?[^+-]+/g);
  if (!terms) throw new Error("Der Funktionsterm konnte nicht gelesen werden.");

  const coeffs = [];
  const termRe = /^([+-]?)(\d+(?:\.\d+)?|\.\d+)?(x(?:\^(\d+))?)?$/;

  for (const term of terms) {
    const m = term.match(termRe);
    if (!m || (!m[2] && !m[3])) {
      throw new Error(`Term „${term}" konnte nicht gelesen werden.`);
    }
    const sign = m[1] === "-" ? -1 : 1;
    const coeff = sign * (m[2] !== undefined ? parseFloat(m[2]) : 1);
    const power = m[3] ? (m[4] !== undefined ? parseInt(m[4], 10) : 1) : 0;
    if (power > 50) throw new Error("Maximal unterstützter Grad: 50.");
    coeffs[power] = (coeffs[power] || 0) + coeff;
  }

  for (let i = 0; i < coeffs.length; i++) coeffs[i] = coeffs[i] || 0;
  while (coeffs.length > 1 && coeffs[coeffs.length - 1] === 0) coeffs.pop();
  return coeffs;
}

/* ============================================================
 * Komplexe Arithmetik + Polynom-Auswertung
 * ============================================================ */

const C = {
  add: (a, b) => ({ re: a.re + b.re, im: a.im + b.im }),
  sub: (a, b) => ({ re: a.re - b.re, im: a.im - b.im }),
  mul: (a, b) => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re }),
  div: (a, b) => {
    const d = b.re * b.re + b.im * b.im;
    return { re: (a.re * b.re + a.im * b.im) / d, im: (a.im * b.re - a.re * b.im) / d };
  },
  abs: (a) => Math.hypot(a.re, a.im),
};

function evalPolyC(coeffs, z) {
  let r = { re: 0, im: 0 };
  for (let i = coeffs.length - 1; i >= 0; i--) {
    r = C.add(C.mul(r, z), { re: coeffs[i], im: 0 });
  }
  return r;
}

function evalPoly(coeffs, x) {
  let r = 0;
  for (let i = coeffs.length - 1; i >= 0; i--) r = r * x + coeffs[i];
  return r;
}

function derivative(coeffs) {
  return coeffs.slice(1).map((c, i) => c * (i + 1));
}

/* ============================================================
 * Lösungsverfahren
 * ============================================================ */

// Polynomdivision durch (x - r), gibt Quotient zurück
function deflate(coeffs, r) {
  const n = coeffs.length - 1;
  const q = new Array(n);
  q[n - 1] = coeffs[n];
  for (let i = n - 2; i >= 0; i--) q[i] = coeffs[i + 1] + r * q[i + 1];
  return q;
}

function isNearlyInteger(x) {
  return Math.abs(x - Math.round(x)) < 1e-9;
}

function divisors(n) {
  n = Math.abs(Math.round(n));
  const d = [];
  for (let i = 1; i * i <= n; i++) {
    if (n % i === 0) {
      d.push(i);
      if (i !== n / i) d.push(n / i);
    }
  }
  return d.sort((a, b) => a - b);
}

// Rationale Nullstellen p/q (Satz über rationale Nullstellen), nur bei ganzzahligen Koeffizienten
function findRationalRoots(coeffs, steps) {
  if (!coeffs.every(isNearlyInteger)) return { roots: [], rest: coeffs };

  let work = coeffs.map(Math.round);
  const found = [];
  let changed = true;

  while (changed && work.length > 3) {
    changed = false;
    const a0 = work[0];
    const an = work[work.length - 1];
    if (a0 === 0) break; // Nullstelle x=0 wird vorher abgespalten
    const ps = divisors(a0);
    const qs = divisors(an);

    outer: for (const p of ps) {
      for (const q of qs) {
        for (const sign of [1, -1]) {
          const r = (sign * p) / q;
          if (Math.abs(evalPoly(work, r)) < 1e-9 * Math.max(1, Math.abs(evalPoly(work, 0)))) {
            found.push({ value: r, num: sign * p, den: q });
            steps.push(
              `Rationale Nullstelle gefunden: x = ${formatFraction(sign * p, q)} ` +
              `(Teiler von ${a0} / Teiler von ${an}). Polynomdivision durch (x − ${formatNumber(r)}).`
            );
            work = deflate(work, r);
            if (work.every(isNearlyInteger)) work = work.map(Math.round);
            changed = true;
            break outer;
          }
        }
      }
    }
  }

  return { roots: found, rest: work };
}

// Durand-Kerner: alle komplexen Nullstellen gleichzeitig, numerisch
function durandKerner(coeffs) {
  const n = coeffs.length - 1;
  const an = coeffs[n];
  const monic = coeffs.map((c) => c / an);

  const radius = 1 + Math.max(...monic.slice(0, n).map(Math.abs));
  let roots = [];
  for (let i = 0; i < n; i++) {
    const ang = (2 * Math.PI * i) / n + 0.4;
    roots.push({ re: radius * 0.7 * Math.cos(ang), im: radius * 0.7 * Math.sin(ang) });
  }

  for (let iter = 0; iter < 1000; iter++) {
    let maxDelta = 0;
    const next = roots.map((zi, i) => {
      let denom = { re: 1, im: 0 };
      for (let j = 0; j < n; j++) {
        if (j !== i) denom = C.mul(denom, C.sub(zi, roots[j]));
      }
      const delta = C.div(evalPolyC(monic, zi), denom);
      maxDelta = Math.max(maxDelta, C.abs(delta));
      return C.sub(zi, delta);
    });
    roots = next;
    if (maxDelta < 1e-14) break;
  }

  // Newton-Nachschärfung am Originalpolynom
  const deriv = derivative(coeffs);
  return roots.map((z) => {
    let zi = z;
    for (let k = 0; k < 20; k++) {
      const f = evalPolyC(coeffs, zi);
      const fp = evalPolyC(deriv, zi);
      if (C.abs(fp) < 1e-300) break;
      const step = C.div(f, fp);
      zi = C.sub(zi, step);
      if (C.abs(step) < 1e-15 * Math.max(1, C.abs(zi))) break;
    }
    return zi;
  });
}

function solveQuadratic(a, b, c, steps) {
  const disc = b * b - 4 * a * c;
  steps.push(`Diskriminante: D = b² − 4ac = (${formatNumber(b)})² − 4·${formatNumber(a)}·${formatNumber(c)} = ${formatNumber(disc)}`);
  if (disc > 0) {
    const sq = Math.sqrt(disc);
    steps.push("D > 0 → zwei reelle Nullstellen (Mitternachtsformel).");
    return [
      { re: (-b - sq) / (2 * a), im: 0 },
      { re: (-b + sq) / (2 * a), im: 0 },
    ];
  }
  if (disc === 0) {
    steps.push("D = 0 → eine doppelte reelle Nullstelle.");
    return [
      { re: -b / (2 * a), im: 0 },
      { re: -b / (2 * a), im: 0 },
    ];
  }
  const sq = Math.sqrt(-disc);
  steps.push("D < 0 → keine reellen, aber zwei komplexe Nullstellen.");
  return [
    { re: -b / (2 * a), im: -sq / (2 * a) },
    { re: -b / (2 * a), im: sq / (2 * a) },
  ];
}

function solve(coeffs) {
  const steps = [];
  const degree = coeffs.length - 1;

  if (degree === 0) {
    if (coeffs[0] === 0) {
      return { roots: [], steps: ["f(x) = 0 für alle x – jede Zahl ist Nullstelle."], allZero: true };
    }
    return { roots: [], steps: [`f(x) = ${formatNumber(coeffs[0])} ist konstant und nie 0 → keine Nullstellen.`] };
  }

  steps.push(`Grad des Polynoms: ${degree} → höchstens ${degree} reelle Nullstellen.`);

  let allRoots = [];
  const exact = new Map(); // "re|im" -> {num, den}
  let work = coeffs.slice();

  // x^k ausklammern
  let zeroMult = 0;
  while (work.length > 1 && work[0] === 0) {
    zeroMult++;
    work = work.slice(1);
  }
  if (zeroMult > 0) {
    steps.push(`x${zeroMult > 1 ? "^" + zeroMult : ""} ausklammern → Nullstelle x = 0${zeroMult > 1 ? ` (${zeroMult}-fach)` : ""}.`);
    for (let i = 0; i < zeroMult; i++) allRoots.push({ re: 0, im: 0 });
    exact.set("0|0", { num: 0, den: 1 });
  }

  let deg = work.length - 1;

  if (deg >= 3) {
    const { roots: rational, rest } = findRationalRoots(work, steps);
    for (const r of rational) {
      allRoots.push({ re: r.value, im: 0 });
      exact.set(`${r.value}|0`, { num: r.num, den: r.den });
    }
    work = rest;
    deg = work.length - 1;
  }

  if (deg === 1) {
    const x = -work[0] / work[1];
    steps.push(`Lineare Gleichung ${formatNumber(work[1])}x + ${formatNumber(work[0])} = 0 → x = ${formatNumber(x)}`);
    allRoots.push({ re: x, im: 0 });
  } else if (deg === 2) {
    allRoots.push(...solveQuadratic(work[2], work[1], work[0], steps));
  } else if (deg >= 3) {
    steps.push(`Restpolynom vom Grad ${deg} ohne (weitere) rationale Nullstellen → numerische Lösung mit dem Durand-Kerner-Verfahren.`);
    allRoots.push(...durandKerner(work));
  }

  // Reelle Klassifikation und Gruppierung nach Vielfachheit
  const scale = Math.max(1, ...allRoots.map(C.abs));
  const cleaned = allRoots.map((z) => (Math.abs(z.im) < 1e-8 * scale ? { re: z.re, im: 0 } : z));

  const groups = [];
  for (const z of cleaned) {
    const g = groups.find((g) => Math.hypot(g.re - z.re, g.im - z.im) < 1e-7 * scale);
    if (g) g.multiplicity++;
    else groups.push({ re: z.re, im: z.im, multiplicity: 1, exact: exact.get(`${z.re}|${z.im}`) || null });
  }

  groups.sort((a, b) => (a.im === 0) !== (b.im === 0) ? (a.im === 0 ? -1 : 1) : a.re - b.re || a.im - b.im);

  return { roots: groups, steps };
}

/* ============================================================
 * Formatierung
 * ============================================================ */

function formatNumber(x) {
  if (Object.is(x, -0)) x = 0;
  let s;
  if (Number.isInteger(x)) {
    s = String(x);
  } else {
    const rounded = parseFloat(x.toPrecision(10));
    s = Number.isInteger(rounded) ? String(rounded) : String(parseFloat(rounded.toFixed(6)));
  }
  return s.replace(".", ",").replace("-", "−");
}

// Erkennt Werte wie 1/3 oder -5/4 für eine schönere Bruchdarstellung
function tryFraction(x) {
  for (let den = 2; den <= 64; den++) {
    const num = Math.round(x * den);
    if (Math.abs(x * den - num) < 1e-9 && Math.abs(num) < 1e6) {
      let g = gcd(Math.abs(num), den);
      return { num: num / g, den: den / g };
    }
  }
  return null;
}

function gcd(a, b) {
  while (b) [a, b] = [b, a % b];
  return a;
}

function formatFraction(num, den) {
  if (den === 1 || num === 0) return formatNumber(num / den);
  return `${formatNumber(num)}/${den}`;
}

function formatRoot(g) {
  if (g.im === 0) {
    const frac = g.exact && g.exact.den !== 1 ? g.exact : !Number.isInteger(g.re) ? tryFraction(g.re) : null;
    if (frac && frac.den !== 1) {
      return `${formatFraction(frac.num, frac.den)} ≈ ${formatNumber(g.re)}`;
    }
    return formatNumber(g.re);
  }
  const absIm = Math.abs(g.im);
  const imPart = absIm === 1 ? "i" : `${formatNumber(absIm)}i`;
  if (g.re === 0) return `${g.im < 0 ? "−" : ""}${imPart}`;
  return `${formatNumber(g.re)} ${g.im < 0 ? "−" : "+"} ${imPart}`;
}

function formatPolynomial(coeffs) {
  const parts = [];
  for (let i = coeffs.length - 1; i >= 0; i--) {
    const c = coeffs[i];
    if (c === 0) continue;
    const abs = Math.abs(c);
    const coeffStr = abs === 1 && i > 0 ? "" : formatNumber(abs);
    const xStr = i === 0 ? "" : i === 1 ? "x" : `x^${i}`;
    const sign = parts.length === 0 ? (c < 0 ? "−" : "") : c < 0 ? " − " : " + ";
    parts.push(sign + coeffStr + xStr);
  }
  return parts.length ? parts.join("") : "0";
}

/* ============================================================
 * Graph (Canvas)
 * ============================================================ */

function drawGraph(canvas, coeffs, realRoots) {
  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth;
  const cssH = canvas.clientHeight;
  canvas.width = cssW * dpr;
  canvas.height = cssH * dpr;
  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);
  ctx.clearRect(0, 0, cssW, cssH);

  // x-Bereich: alle reellen Nullstellen + Rand
  let xMin = -5, xMax = 5;
  if (realRoots.length > 0) {
    const lo = Math.min(...realRoots);
    const hi = Math.max(...realRoots);
    const pad = Math.max(2, (hi - lo) * 0.3);
    xMin = lo - pad;
    xMax = hi + pad;
  }

  // y-Bereich aus Stichproben (robust gegen Ausreißer: Quantile)
  const samples = [];
  const N = 400;
  for (let i = 0; i <= N; i++) {
    const x = xMin + ((xMax - xMin) * i) / N;
    const y = evalPoly(coeffs, x);
    if (Number.isFinite(y)) samples.push(y);
  }
  const sorted = [...samples].sort((a, b) => a - b);
  let yLo = sorted[Math.floor(sorted.length * 0.05)];
  let yHi = sorted[Math.ceil(sorted.length * 0.95) - 1];
  if (yLo > 0) yLo = -Math.abs(yHi) * 0.1;
  if (yHi < 0) yHi = Math.abs(yLo) * 0.1;
  const yPad = Math.max((yHi - yLo) * 0.15, 1);
  let yMin = yLo - yPad, yMax = yHi + yPad;

  const toX = (x) => ((x - xMin) / (xMax - xMin)) * cssW;
  const toY = (y) => cssH - ((y - yMin) / (yMax - yMin)) * cssH;

  // Gitter + Achsen
  const style = getComputedStyle(document.documentElement);
  ctx.strokeStyle = style.getPropertyValue("--card-border").trim() || "#334155";
  ctx.lineWidth = 0.5;
  ctx.fillStyle = style.getPropertyValue("--text-dim").trim() || "#94a3b8";
  ctx.font = "11px system-ui, sans-serif";

  const xStep = niceStep((xMax - xMin) / 8);
  for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
    const px = toX(x);
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, cssH);
    ctx.stroke();
    if (Math.abs(x) > xStep / 2) ctx.fillText(formatNumber(parseFloat(x.toPrecision(10))), px + 2, toY(0) + 13);
  }
  const yStep = niceStep((yMax - yMin) / 6);
  for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
    const py = toY(y);
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(cssW, py);
    ctx.stroke();
    if (Math.abs(y) > yStep / 2) ctx.fillText(formatNumber(parseFloat(y.toPrecision(10))), toX(0) + 4, py - 3);
  }

  ctx.strokeStyle = ctx.fillStyle;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(0, toY(0));
  ctx.lineTo(cssW, toY(0));
  ctx.moveTo(toX(0), 0);
  ctx.lineTo(toX(0), cssH);
  ctx.stroke();

  // Funktionsgraph
  ctx.strokeStyle = style.getPropertyValue("--accent").trim() || "#38bdf8";
  ctx.lineWidth = 2;
  ctx.beginPath();
  let pen = false;
  for (let i = 0; i <= N; i++) {
    const x = xMin + ((xMax - xMin) * i) / N;
    const y = evalPoly(coeffs, x);
    const py = toY(y);
    if (!Number.isFinite(py) || py < -2 * cssH || py > 3 * cssH) {
      pen = false;
      continue;
    }
    if (pen) ctx.lineTo(toX(x), py);
    else ctx.moveTo(toX(x), py);
    pen = true;
  }
  ctx.stroke();

  // Nullstellen markieren
  ctx.fillStyle = style.getPropertyValue("--green").trim() || "#4ade80";
  for (const r of realRoots) {
    ctx.beginPath();
    ctx.arc(toX(r), toY(0), 5, 0, 2 * Math.PI);
    ctx.fill();
  }
}

function niceStep(raw) {
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  if (norm < 1.5) return mag;
  if (norm < 3.5) return 2 * mag;
  if (norm < 7.5) return 5 * mag;
  return 10 * mag;
}

/* ============================================================
 * UI
 * ============================================================ */

const input = document.getElementById("polyInput");
const solveBtn = document.getElementById("solveBtn");
const errorBox = document.getElementById("errorBox");
const resultCard = document.getElementById("resultCard");
const graphCard = document.getElementById("graphCard");
const parsedPoly = document.getElementById("parsedPoly");
const rootsList = document.getElementById("rootsList");
const stepsList = document.getElementById("stepsList");
const canvas = document.getElementById("graph");

let lastResult = null;

function run() {
  errorBox.classList.add("hidden");
  try {
    const coeffs = parsePolynomial(input.value);
    const { roots, steps, allZero } = solve(coeffs);

    parsedPoly.textContent = `f(x) = ${formatPolynomial(coeffs)}`;
    rootsList.innerHTML = "";

    const realGroups = roots.filter((g) => g.im === 0);
    const complexGroups = roots.filter((g) => g.im !== 0);

    if (allZero) {
      rootsList.innerHTML = `<p class="no-roots">Das Nullpolynom: jede reelle Zahl ist Nullstelle.</p>`;
    } else if (realGroups.length === 0) {
      rootsList.innerHTML = `<p class="no-roots">Keine reellen Nullstellen.</p>`;
    } else {
      realGroups.forEach((g, i) => {
        const div = document.createElement("div");
        div.className = "root-item real";
        div.innerHTML =
          `<span class="root-value">x${realGroups.length > 1 ? "<sub>" + (i + 1) + "</sub>" : ""} = ${formatRoot(g)}</span>` +
          (g.multiplicity > 1 ? `<span class="root-meta">${g.multiplicity}-fache Nullstelle</span>` : "");
        rootsList.appendChild(div);
      });
    }

    for (const g of complexGroups) {
      const div = document.createElement("div");
      div.className = "root-item complex";
      div.innerHTML =
        `<span class="root-value">x = ${formatRoot(g)}</span>` +
        `<span class="root-meta">komplex${g.multiplicity > 1 ? `, ${g.multiplicity}-fach` : ""}</span>`;
      rootsList.appendChild(div);
    }

    stepsList.innerHTML = steps.map((s) => `<li>${s}</li>`).join("");

    resultCard.classList.remove("hidden");

    if (coeffs.length > 1) {
      lastResult = { coeffs, realRoots: realGroups.map((g) => g.re) };
      graphCard.classList.remove("hidden");
      drawGraph(canvas, coeffs, lastResult.realRoots);
    } else {
      lastResult = null;
      graphCard.classList.add("hidden");
    }
  } catch (e) {
    errorBox.textContent = e.message;
    errorBox.classList.remove("hidden");
    resultCard.classList.add("hidden");
    graphCard.classList.add("hidden");
    lastResult = null;
  }
}

solveBtn.addEventListener("click", run);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") run();
});

document.querySelectorAll(".chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    input.value = chip.dataset.example;
    run();
  });
});

let resizeTimer;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (lastResult) drawGraph(canvas, lastResult.coeffs, lastResult.realRoots);
  }, 150);
});

run();
