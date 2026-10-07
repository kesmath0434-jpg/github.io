'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// 設定・定数
// ─────────────────────────────────────────────────────────────────────────────
const STATIONS = [
  { key: 'minamata',     name: '水俣',   fileId: '00' },
  { key: 'akune',        name: '阿久根', fileId: '01' },
  { key: 'kagoshima',    name: '鹿児島', fileId: '02' },
  { key: 'makurazaki',   name: '枕崎',   fileId: '03' },
  { key: 'shibushi',     name: '志布志', fileId: '04' },
  { key: 'oodomari',     name: '大泊',   fileId: '05' },
  { key: 'nishinoomote', name: '西之表', fileId: '06' },
  { key: 'tanegashima',  name: '種子島', fileId: '07' },
  { key: 'nakanoshima',  name: '中之島', fileId: '08' },
  { key: 'naze',         name: '名瀬',   fileId: '09' },
  { key: 'amami',        name: '奄美',   fileId: '10' },
];

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'];
const MIN_DATE_STR = '2026-01-01';
const MAX_DATE_STR = '2027-12-31';

/** @type {Chart|null} */
let tideChart = null;

// ─────────────────────────────────────────────────────────────────────────────
// 初期化
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // 地点ドロップダウン作成
  const select = document.getElementById('station-select');
  STATIONS.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.key;
    opt.textContent = s.name;
    select.appendChild(opt);
  });

  // 日付入力の初期値（本日 or データ範囲内に収める）
  const today = new Date();
  const todayStr = dateToStr(today);
  const defaultDate = clampDateStr(todayStr, MIN_DATE_STR, MAX_DATE_STR);
  document.getElementById('date-input').value = defaultDate;

  // データロードチェック
  if (!window.TIDE_DATA || Object.keys(window.TIDE_DATA).length === 0) {
    document.getElementById('data-warning').style.display = 'block';
  }

  // 確定ボタン
  document.getElementById('submit-btn').addEventListener('click', onSubmit);
  // Enter キーでも確定
  document.getElementById('date-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') onSubmit();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 日付ユーティリティ
// ─────────────────────────────────────────────────────────────────────────────
/** Date → 'YYYY-MM-DD' */
function dateToStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** 'YYYY-MM-DD' → Date（タイムゾーンズレ防止のため時刻を明示） */
function strToDate(s) {
  return new Date(`${s}T00:00:00`);
}

/** dateStr を [minStr, maxStr] の範囲にクランプ */
function clampDateStr(dateStr, minStr, maxStr) {
  if (dateStr < minStr) return minStr;
  if (dateStr > maxStr) return maxStr;
  return dateStr;
}

/** 日付文字列に日数を加算した文字列を返す */
function addDays(dateStr, n) {
  const d = strToDate(dateStr);
  d.setDate(d.getDate() + n);
  return dateToStr(d);
}

/** 'YYYY-MM-DD' → 曜日文字（例: '月'） */
function getDayOfWeek(dateStr) {
  return WEEKDAYS[strToDate(dateStr).getDay()];
}

/** 'YYYY-MM-DD' → '1/5(月)' のような表示文字列 */
function formatDateLabel(dateStr) {
  const d = strToDate(dateStr);
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`;
}

// ─────────────────────────────────────────────────────────────────────────────
// データアクセス
// ─────────────────────────────────────────────────────────────────────────────
/**
 * 指定地点・日付のデータを返す。なければ null。
 * @param {string} stationKey
 * @param {string} dateStr 'YYYY-MM-DD'
 * @returns {object|null}
 */
function getDataForDate(stationKey, dateStr) {
  const year = dateStr.substring(0, 4);
  const td = window.TIDE_DATA;
  if (!td || !td[year] || !td[year][stationKey]) return null;
  return td[year][stationKey].find(r => r.date === dateStr) || null;
}

// ─────────────────────────────────────────────────────────────────────────────
// メイン処理（確定ボタン）
// ─────────────────────────────────────────────────────────────────────────────
function onSubmit() {
  const stationKey = document.getElementById('station-select').value;
  const dateStr    = document.getElementById('date-input').value;

  if (!dateStr) {
    alert('日付を選択してください。');
    return;
  }
  if (dateStr < MIN_DATE_STR || dateStr > MAX_DATE_STR) {
    alert(`日付は ${MIN_DATE_STR} 〜 ${MAX_DATE_STR} の範囲で選択してください。`);
    return;
  }

  // ── 表示日付範囲の計算（前後15日、データ範囲でクランプ）──────────────────
  const startStr = clampDateStr(addDays(dateStr, -15), MIN_DATE_STR, MAX_DATE_STR);
  const endStr   = clampDateStr(addDays(dateStr,  15), MIN_DATE_STR, MAX_DATE_STR);

  // 範囲内の全日付リスト
  const dates = [];
  let cur = startStr;
  while (cur <= endStr) {
    dates.push(cur);
    cur = addDays(cur, 1);
  }

  // 各日のデータ取得
  const dayRecords = dates.map(d => ({
    date: d,
    data: getDataForDate(stationKey, d),
  }));

  // ── 表示更新 ─────────────────────────────────────────────────────────────
  const stationName = STATIONS.find(s => s.key === stationKey)?.name ?? stationKey;
  document.getElementById('result-title').textContent =
    `${stationName}　${formatDateLabel(dateStr)} を基準とした前後 15 日間`;

  buildChart(dayRecords, dateStr);
  buildSummaryTable(dayRecords, dateStr, stationKey);
  buildDetailTable(dateStr, getDataForDate(stationKey, dateStr));

  document.getElementById('results').style.display = 'block';
  // 結果へスクロール
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─────────────────────────────────────────────────────────────────────────────
// グラフ構築
// ─────────────────────────────────────────────────────────────────────────────
function buildChart(dayRecords, selectedDate) {
  const hourlyPoints    = [];
  const highTidePoints  = [];
  const lowTidePoints   = [];

  dayRecords.forEach(({ date, data }) => {
    const [y, m, d] = date.split('-').map(Number);

    if (data) {
      // 毎時潮位
      data.hourly.forEach((level, h) => {
        hourlyPoints.push({
          x: new Date(y, m - 1, d, h, 0).getTime(),
          y: (level !== null && level !== undefined) ? level : null,
        });
      });

      // 満潮マーカー
      data.high_tides.forEach(t => {
        if (t) {
          highTidePoints.push({
            x: new Date(y, m - 1, d, t.hour, t.min).getTime(),
            y: t.level,
          });
        }
      });

      // 干潮マーカー
      data.low_tides.forEach(t => {
        if (t) {
          lowTidePoints.push({
            x: new Date(y, m - 1, d, t.hour, t.min).getTime(),
            y: t.level,
          });
        }
      });
    } else {
      // データなし日：null 点を積んでギャップを表現
      for (let h = 0; h < 24; h++) {
        hourlyPoints.push({ x: new Date(y, m - 1, d, h, 0).getTime(), y: null });
      }
    }
  });

  // 選択日のハイライト範囲
  const [sy, sm, sd] = selectedDate.split('-').map(Number);
  const hlStart = new Date(sy, sm - 1, sd,  0,  0).getTime();
  const hlEnd   = new Date(sy, sm - 1, sd, 23, 59).getTime();

  const cfg = {
    type: 'scatter',
    data: {
      datasets: [
        {
          // ─ 毎時潮位 折れ線 ─
          label: '毎時潮位',
          data: hourlyPoints,
          type: 'line',
          borderColor: 'rgba(37, 103, 168, 0.75)',
          backgroundColor: 'rgba(37, 103, 168, 0.08)',
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 1.5,
          tension: 0.3,
          spanGaps: true,
          order: 3,
        },
        {
          // ─ 満潮 ▲ ─
          label: '満潮',
          data: highTidePoints,
          type: 'scatter',
          backgroundColor: 'rgba(231, 76, 60, 0.85)',
          borderColor: 'rgba(231, 76, 60, 1)',
          pointStyle: 'triangle',
          pointRadius: 7,
          pointHoverRadius: 9,
          order: 1,
        },
        {
          // ─ 干潮 ▽ ─
          label: '干潮',
          data: lowTidePoints,
          type: 'scatter',
          backgroundColor: 'rgba(39, 174, 96, 0.85)',
          borderColor: 'rgba(39, 174, 96, 1)',
          pointStyle: 'triangle',
          rotation: 180,
          pointRadius: 7,
          pointHoverRadius: 9,
          order: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: {
          type: 'time',
          time: {
            unit: 'day',
            tooltipFormat: 'M/d HH:mm',
            displayFormats: { day: 'M/d' },
          },
          grid: { color: 'rgba(0,0,0,0.07)' },
          ticks: {
            maxRotation: 0,
            font: { size: 11 },
          },
        },
        y: {
          title: {
            display: true,
            text: '潮位 (cm)',
            font: { size: 12 },
            color: '#6b7f93',
          },
          grid: { color: 'rgba(0,0,0,0.07)' },
          ticks: { font: { size: 11 } },
        },
      },
      plugins: {
        legend: {
          position: 'top',
          labels: { font: { size: 12 }, padding: 16 },
        },
        tooltip: {
          callbacks: {
            title(items) {
              const ts = items[0].parsed.x;
              const dt = new Date(ts);
              const dow = WEEKDAYS[dt.getDay()];
              const hh  = String(dt.getHours()).padStart(2, '0');
              const mm  = String(dt.getMinutes()).padStart(2, '0');
              return `${dt.getMonth() + 1}/${dt.getDate()}(${dow}) ${hh}:${mm}`;
            },
            label(item) {
              const v = item.parsed.y;
              return `${item.dataset.label}: ${v !== null ? v + ' cm' : '--'}`;
            },
          },
        },
        annotation: {
          annotations: {
            selectedDay: {
              type: 'box',
              xMin: hlStart,
              xMax: hlEnd,
              backgroundColor: 'rgba(255, 220, 0, 0.13)',
              borderColor: 'rgba(245, 216, 0, 0.55)',
              borderWidth: 1,
            },
          },
        },
      },
    },
  };

  const ctx = document.getElementById('tide-chart').getContext('2d');
  if (tideChart) tideChart.destroy();
  tideChart = new Chart(ctx, cfg);
}

// ─────────────────────────────────────────────────────────────────────────────
// 日別サマリーテーブル構築
// ─────────────────────────────────────────────────────────────────────────────
function buildSummaryTable(dayRecords, selectedDate, stationKey) {
  const tbody = document.getElementById('summary-tbody');
  tbody.innerHTML = '';

  dayRecords.forEach(({ date, data }) => {
    const tr = document.createElement('tr');
    if (date === selectedDate) tr.classList.add('selected-row');

    // 日付列
    const tdDate = document.createElement('td');
    tdDate.textContent = formatDateLabel(date);
    // 土日色
    const dow = strToDate(date).getDay();
    if (dow === 0) tdDate.style.color = '#c0392b';
    if (dow === 6) tdDate.style.color = '#2980b9';
    tr.appendChild(tdDate);

    if (data) {
      // 最高・最低潮位
      const validH = data.hourly.filter(v => v !== null);
      const maxLv = validH.length ? Math.max(...validH) : null;
      const minLv = validH.length ? Math.min(...validH) : null;

      const tdMax = document.createElement('td');
      tdMax.textContent = maxLv !== null ? maxLv + ' cm' : '--';
      tr.appendChild(tdMax);

      const tdMin = document.createElement('td');
      tdMin.textContent = minLv !== null ? minLv + ' cm' : '--';
      tr.appendChild(tdMin);

      // 満潮列
      const tdHigh = document.createElement('td');
      tdHigh.style.textAlign = 'left';
      const highTexts = data.high_tides
        .filter(t => t !== null)
        .map(t => formatTide(t));
      tdHigh.innerHTML = highTexts.length
        ? highTexts.map(s => `<span class="tide-high">${s}</span>`).join('　')
        : '<span class="tide-none">--</span>';
      tr.appendChild(tdHigh);

      // 干潮列
      const tdLow = document.createElement('td');
      tdLow.style.textAlign = 'left';
      const lowTexts = data.low_tides
        .filter(t => t !== null)
        .map(t => formatTide(t));
      tdLow.innerHTML = lowTexts.length
        ? lowTexts.map(s => `<span class="tide-low">${s}</span>`).join('　')
        : '<span class="tide-none">--</span>';
      tr.appendChild(tdLow);

    } else {
      // データなし
      for (let i = 0; i < 4; i++) {
        const td = document.createElement('td');
        td.innerHTML = '<span class="tide-none">--</span>';
        tr.appendChild(td);
      }
    }

    // 行クリックで詳細表示を切り替え
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected-row'));
      tr.classList.add('selected-row');
      buildDetailTable(date, getDataForDate(stationKey, date));
    });

    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 時間別詳細テーブル構築
// ─────────────────────────────────────────────────────────────────────────────
function buildDetailTable(dateStr, data) {
  const d = strToDate(dateStr);
  document.getElementById('detail-title').textContent =
    `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]}) 時間別`;

  const tbody = document.getElementById('detail-tbody');
  tbody.innerHTML = '';

  if (!data) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 3;
    td.textContent = 'データなし';
    td.style.textAlign = 'center';
    td.style.color = '#b0b8c4';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }

  // 満潮・干潮の時刻インデックスを作成（hour 単位で近似）
  const highHours = new Set();
  const lowHours  = new Set();
  data.high_tides.forEach(t => { if (t) highHours.add(t.hour); });
  data.low_tides.forEach(t  => { if (t) lowHours.add(t.hour); });

  data.hourly.forEach((level, h) => {
    const tr = document.createElement('tr');

    // 時刻列
    const tdTime = document.createElement('td');
    tdTime.textContent = `${String(h).padStart(2, '0')}:00`;
    tr.appendChild(tdTime);

    // 潮位列
    const tdLevel = document.createElement('td');
    tdLevel.textContent = level !== null ? level + ' cm' : '--';
    tr.appendChild(tdLevel);

    // 満・干列
    const tdMark = document.createElement('td');
    if (highHours.has(h)) {
      tdMark.innerHTML = '<span class="tide-high">▲満</span>';
    } else if (lowHours.has(h)) {
      tdMark.innerHTML = '<span class="tide-low">▽干</span>';
    } else {
      tdMark.textContent = '';
    }
    tr.appendChild(tdMark);

    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// フォーマットヘルパー
// ─────────────────────────────────────────────────────────────────────────────
/** 満潮/干潮オブジェクト → '07:08 (298cm)' */
function formatTide(t) {
  if (!t) return '--';
  const h = String(t.hour).padStart(2, '0');
  const m = String(t.min).padStart(2, '0');
  return `${h}:${m} (${t.level}cm)`;
}
