// weight log. one entry per day, latest wins.
// data shape: { entries: [{date:"YYYY-MM-DD", kg:74.2}], target: 70 | null }

const STORE_KEY = "weight-log-v1";

const $ = (id) => document.getElementById(id);
const form = $("entryForm");
const weightInput = $("weightInput");
const dateInput = $("dateInput");
const targetInput = $("targetInput");
const clearTargetBtn = $("clearTargetBtn");
const targetHint = $("targetHint");
const listEl = $("entryList");
const emptyMsg = $("emptyMsg");

let state = load();
let chart = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { entries: [], target: null };
    const p = JSON.parse(raw);
    // migrate from the old shape (just an array of entries)
    if (Array.isArray(p)) return { entries: p, target: null };
    if (!p.entries) p.entries = [];
    if (p.target === undefined) p.target = null;
    return p;
  } catch (e) {
    console.warn("could not parse stored data, starting fresh", e);
    return { entries: [], target: null };
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function sortEntries() {
  state.entries.sort((a, b) => a.date.localeCompare(b.date));
}

function upsert(date, kg) {
  const i = state.entries.findIndex((e) => e.date === date);
  if (i >= 0) state.entries[i].kg = kg;
  else state.entries.push({ date, kg });
  sortEntries();
}

// 7-day moving average. window is the 7 days ending at index i (inclusive),
// only counting days actually logged so gaps don't pad the window.
function movingAvg(entries, windowDays = 7) {
  const out = [];
  for (let i = 0; i < entries.length; i++) {
    const cutoff = new Date(entries[i].date);
    cutoff.setDate(cutoff.getDate() - (windowDays - 1));
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    let sum = 0, n = 0;
    for (let j = i; j >= 0; j--) {
      if (entries[j].date < cutoffISO) break;
      sum += entries[j].kg;
      n++;
    }
    out.push(n ? sum / n : null);
  }
  return out;
}

// linear regression slope on (dayIndex, kg) for the last `days` calendar days.
// returns kg per day. positive = gaining.
// slope = (n*Σxy - Σx*Σy) / (n*Σx^2 - (Σx)^2)
function trendSlope(entries, days = 30) {
  if (entries.length < 2) return null;
  const last = new Date(entries[entries.length - 1].date);
  const cutoff = new Date(last);
  cutoff.setDate(cutoff.getDate() - (days - 1));
  const cutoffISO = cutoff.toISOString().slice(0, 10);

  const pts = entries.filter((e) => e.date >= cutoffISO);
  if (pts.length < 2) return null;

  const day0 = new Date(pts[0].date).getTime();
  let sx = 0, sy = 0, sxy = 0, sxx = 0;
  const n = pts.length;
  for (const p of pts) {
    const x = (new Date(p.date).getTime() - day0) / 86400000;
    const y = p.kg;
    sx += x; sy += y; sxy += x * y; sxx += x * x;
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return 0;
  return (n * sxy - sx * sy) / denom;
}

function fmtKg(v) {
  return (v == null || isNaN(v)) ? "--" : v.toFixed(1) + " kg";
}

function fmtDate(iso) {
  // short, locale-ish: "Jul 16"
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderStats() {
  const entries = state.entries;
  const latest = entries.length ? entries[entries.length - 1].kg : null;
  $("statLatest").textContent = fmtKg(latest);

  const avgs = movingAvg(entries, 7);
  const avg = avgs.length ? avgs[avgs.length - 1] : null;
  $("statAvg").textContent = fmtKg(avg);

  const slope = trendSlope(entries, 30);
  const trendEl = $("statTrend");
  trendEl.classList.remove("up", "down", "flat");
  if (slope == null) {
    trendEl.textContent = "--";
  } else {
    const perWeek = slope * 7;
    const sign = perWeek > 0 ? "+" : "";
    trendEl.textContent = `${sign}${perWeek.toFixed(2)} kg/wk`;
    if (Math.abs(perWeek) < 0.05) trendEl.classList.add("flat");
    else if (perWeek > 0) trendEl.classList.add("up");
    else trendEl.classList.add("down");
  }
}

function renderList() {
  listEl.innerHTML = "";
  if (!state.entries.length) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  // newest first in the list, even though we keep the array sorted asc
  const reversed = [...state.entries].map((e, i) => ({ e, i })).reverse();
  for (const { e, i } of reversed) {
    const li = document.createElement("li");
    li.className = "entryRow";
    li.innerHTML = `
      <span class="date">${fmtDate(e.date)}</span>
      <span class="weight">${e.kg.toFixed(1)} kg</span>
      <span class="actions">
        <button class="iconBtn" data-act="edit" data-i="${i}">edit</button>
        <button class="iconBtn" data-act="del"  data-i="${i}">delete</button>
      </span>
    `;
    listEl.appendChild(li);
  }
}

function renderTargetHint() {
  if (state.target == null || !state.entries.length) {
    targetHint.textContent = "";
    return;
  }
  const latest = state.entries[state.entries.length - 1].kg;
  const diff = latest - state.target;
  if (Math.abs(diff) < 0.05) {
    targetHint.textContent = "you're at target.";
    return;
  }
  const slope = trendSlope(state.entries, 30);
  let etaTxt = "";
  // only show ETA if the trend is pointing the right way
  if (slope && ((diff > 0 && slope < 0) || (diff < 0 && slope > 0))) {
    const days = Math.abs(diff / slope);
    if (days < 365 * 5) {
      etaTxt = ` at the current trend, about ${Math.round(days)} days away.`;
    }
  }
  const dir = diff > 0 ? "above" : "below";
  targetHint.textContent = `${Math.abs(diff).toFixed(1)} kg ${dir} target.${etaTxt}`;
}

function renderChart() {
  const ctx = $("chart").getContext("2d");
  const entries = state.entries;
  const labels = entries.map((e) => e.date);
  const raw = entries.map((e) => e.kg);
  const avg = movingAvg(entries, 7);
  const targetLine = state.target != null ? entries.map(() => state.target) : null;

  const datasets = [
    {
      label: "weight",
      data: raw,
      borderColor: "#bbb",
      backgroundColor: "#1c1c1c",
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 1,
      showLine: false,
    },
    {
      label: "7-day avg",
      data: avg,
      borderColor: "#1c1c1c",
      backgroundColor: "transparent",
      pointRadius: 0,
      borderWidth: 2,
      tension: 0.25,
      spanGaps: true,
    },
  ];

  if (targetLine) {
    datasets.push({
      label: "target",
      data: targetLine,
      borderColor: "#c75555",
      borderDash: [5, 4],
      pointRadius: 0,
      borderWidth: 1.5,
    });
  }

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: "index" },
      plugins: {
        legend: { display: true, labels: { boxWidth: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            title: (items) => fmtDate(items[0].label),
            label: (ctx) => {
              const v = ctx.parsed.y;
              return `${ctx.dataset.label}: ${v == null ? "--" : v.toFixed(1) + " kg"}`;
            },
          },
        },
      },
      scales: {
        x: {
          ticks: {
            callback: function (val) { return fmtDate(this.getLabelForValue(val)); },
            maxRotation: 0,
            autoSkip: true,
            maxTicksLimit: 8,
          },
          grid: { display: false },
        },
        y: {
          ticks: { callback: (v) => v + " kg" },
          grid: { color: "#eee" },
        },
      },
    },
  });
}

function renderAll() {
  renderStats();
  renderList();
  renderTargetHint();
  renderChart();
}

// events

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const kg = parseFloat(weightInput.value);
  const date = dateInput.value;
  if (!date || isNaN(kg) || kg <= 0) return;
  upsert(date, kg);
  save();
  weightInput.value = "";
  renderAll();
});

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const i = parseInt(btn.dataset.i, 10);
  const act = btn.dataset.act;
  if (act === "del") {
    if (!confirm("delete this entry?")) return;
    state.entries.splice(i, 1);
    save();
    renderAll();
  } else if (act === "edit") {
    const cur = state.entries[i];
    const next = prompt(`new weight for ${cur.date} (kg)`, cur.kg);
    if (next == null) return;
    const v = parseFloat(next);
    if (isNaN(v) || v <= 0) return;
    state.entries[i].kg = v;
    save();
    renderAll();
  }
});

targetInput.addEventListener("change", () => {
  const v = parseFloat(targetInput.value);
  state.target = isNaN(v) ? null : v;
  save();
  renderAll();
});

clearTargetBtn.addEventListener("click", () => {
  state.target = null;
  targetInput.value = "";
  save();
  renderAll();
});

// init
dateInput.value = todayISO();
if (state.target != null) targetInput.value = state.target;
renderAll();
