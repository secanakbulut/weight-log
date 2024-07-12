// weight log. one entry per day, latest wins.

const STORE_KEY = "weight-log-v1";

const $ = (id) => document.getElementById(id);
const form = $("entryForm");
const weightInput = $("weightInput");
const dateInput = $("dateInput");
const listEl = $("entryList");
const emptyMsg = $("emptyMsg");

let entries = load();
let chart = null;

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    return [];
  }
}

function save() {
  localStorage.setItem(STORE_KEY, JSON.stringify(entries));
}

function todayISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function upsert(date, kg) {
  const i = entries.findIndex((e) => e.date === date);
  if (i >= 0) entries[i].kg = kg;
  else entries.push({ date, kg });
  entries.sort((a, b) => a.date.localeCompare(b.date));
}

// 7-day moving average. window is the 7 days ending at index i (inclusive),
// only counting days actually logged so gaps don't pad the window.
function movingAvg(arr, windowDays = 7) {
  const out = [];
  for (let i = 0; i < arr.length; i++) {
    const cutoff = new Date(arr[i].date);
    cutoff.setDate(cutoff.getDate() - (windowDays - 1));
    const cutoffISO = cutoff.toISOString().slice(0, 10);
    let sum = 0, n = 0;
    for (let j = i; j >= 0; j--) {
      if (arr[j].date < cutoffISO) break;
      sum += arr[j].kg;
      n++;
    }
    out.push(n ? sum / n : null);
  }
  return out;
}

function fmtKg(v) {
  return (v == null || isNaN(v)) ? "--" : v.toFixed(1) + " kg";
}

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function renderStats() {
  $("statLatest").textContent = entries.length
    ? fmtKg(entries[entries.length - 1].kg)
    : "--";
  const avgs = movingAvg(entries, 7);
  $("statAvg").textContent = avgs.length ? fmtKg(avgs[avgs.length - 1]) : "--";
  $("statCount").textContent = entries.length;
}

function renderList() {
  listEl.innerHTML = "";
  if (!entries.length) {
    emptyMsg.classList.remove("hidden");
    return;
  }
  emptyMsg.classList.add("hidden");

  const reversed = [...entries].map((e, i) => ({ e, i })).reverse();
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

function renderChart() {
  const ctx = $("chart").getContext("2d");
  const labels = entries.map((e) => e.date);
  const raw = entries.map((e) => e.kg);
  const avg = movingAvg(entries, 7);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
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
      ],
    },
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

function render() {
  renderStats();
  renderList();
  renderChart();
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const kg = parseFloat(weightInput.value);
  const date = dateInput.value;
  if (!date || isNaN(kg) || kg <= 0) return;
  upsert(date, kg);
  save();
  weightInput.value = "";
  render();
});

listEl.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const i = parseInt(btn.dataset.i, 10);
  const act = btn.dataset.act;
  if (act === "del") {
    if (!confirm("delete this entry?")) return;
    entries.splice(i, 1);
    save();
    render();
  } else if (act === "edit") {
    const cur = entries[i];
    const next = prompt(`new weight for ${cur.date} (kg)`, cur.kg);
    if (next == null) return;
    const v = parseFloat(next);
    if (isNaN(v) || v <= 0) return;
    entries[i].kg = v;
    save();
    render();
  }
});

dateInput.value = todayISO();
render();
