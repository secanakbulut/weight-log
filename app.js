// weight log. one entry per day, latest wins.

const STORE_KEY = "weight-log-v1";

const $ = (id) => document.getElementById(id);
const form = $("entryForm");
const weightInput = $("weightInput");
const dateInput = $("dateInput");
const listEl = $("entryList");
const emptyMsg = $("emptyMsg");

let entries = load();

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

function fmtDate(iso) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function render() {
  // stats
  $("statLatest").textContent = entries.length
    ? entries[entries.length - 1].kg.toFixed(1) + " kg"
    : "--";
  $("statCount").textContent = entries.length;

  // list
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
