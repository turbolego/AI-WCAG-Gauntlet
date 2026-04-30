'use strict';

/* ── Chart palette ───────────────────────────────────────────── */
const C = {
  accent: '#e8ff47',
  accent2: '#47d4ff',
  accent3: '#ff7070',
  accent4: '#c084fc',
  pass: '#4ade80',
  warn: '#fbbf24',
  bg: '#0b0c10',
  surface: '#13151c',
  surface2: '#1e2130',
  border: '#2e3245',
  muted: '#a8afc4',
  text: '#f0f2f8',
};

const MODEL_COLORS = [C.accent, C.accent2, C.accent4, C.pass, C.warn, '#f472b6', '#67e8f9'];
const modelColor = (i) => MODEL_COLORS[i % MODEL_COLORS.length];

/* Chart.js defaults applied to all charts */
const CD = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: C.muted,
        font: { family: 'DM Mono', size: 11 },
        boxWidth: 12,
        padding: 16,
      },
    },
    tooltip: {
      backgroundColor: C.surface2,
      borderColor: C.border,
      borderWidth: 1,
      titleColor: C.text,
      bodyColor: C.muted,
      titleFont: { family: 'DM Mono', size: 12 },
      bodyFont: { family: 'DM Mono', size: 11 },
      padding: 10,
    },
  },
  scales: {
    x: {
      ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
      grid: { color: C.border },
    },
    y: {
      ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
      grid: { color: C.border },
    },
  },
};

function mergeCD(opts) {
  return {
    ...CD, ...opts,
    plugins: { ...CD.plugins, ...(opts.plugins || {}) },
    scales: { ...CD.scales, ...(opts.scales || {}) },
  };
}

/* ── Helpers ─────────────────────────────────────────────────── */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fmtDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', timeZone: 'UTC',
    }) + ' UTC';
  } catch { return iso; }
}

/** Returns CSS class and aria label for a numeric error count */
function numInfo(n, lowThreshold = 2, highThreshold = 5) {
  if (n === 0) return { cls: 'num-zero', label: 'zero' };
  if (n <= lowThreshold) return { cls: 'num-warn', label: 'warning' };
  return { cls: 'num-bad', label: 'high' };
}

function numCell(n) {
  const { cls, label } = numInfo(n);
  return `<span class="${cls}" aria-label="${n} — ${label}">${n}</span>`;
}

/* ── Main ────────────────────────────────────────────────────── */
async function main() {
  let data;
  try {
    const res = await fetch('./benchmarks/benchmark_stats.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    data = await res.json();
  } catch (e) {
    $('#loading').style.display = 'none';
    const err = document.createElement('div');
    err.className = 'empty';
    err.setAttribute('role', 'status');
    err.innerHTML =
      `<div class="empty-icon" aria-hidden="true">📭</div>
       <p>Could not load benchmark_stats.json.<br>Run the GitHub Actions workflow to generate stats.</p>`;
    $('#loading').insertAdjacentElement('afterend', err);
    return;
  }

  $('#loading').style.display = 'none';
  $('#app').removeAttribute('hidden');
  $('#app').style.display = 'block';

  renderHeader(data);
  renderKPIs(data);
  renderLeaderboard(data.leaderboard);
  renderRunHistory(data.runs_by_model ?? []);
  renderErrorBreakdown(data.error_breakdown);
  renderCoverageCharts(data.tag_coverage_by_model);
  renderMissingTagsHeatmap(data.missing_tags_frequency, data.total_runs);
  renderProgressSection(data.model_progress);
}

/* ── Header ──────────────────────────────────────────────────── */
function renderHeader(data) {
  $('#generated-at').textContent = fmtDate(data.generated_at);
  $('#footer-meta').textContent =
    `${data.total_runs} run(s) across ${data.total_models} model(s)`;
}

/* ── KPIs ────────────────────────────────────────────────────── */
function renderKPIs(data) {
  $('#kpi-models').textContent = data.total_models;
  $('#kpi-runs').textContent = data.total_runs;
  $('#kpi-tags').textContent = data.total_tags;

  const passes = (data.leaderboard ?? []).filter(r => r.status === 'pass').length;
  $('#kpi-passes').textContent = passes;

  const pa11yZero = (data.leaderboard ?? []).filter(r => (r.pa11y_issues ?? 0) === 0).length;
  $('#kpi-pa11y-zero').textContent = pa11yZero;

  const best = Math.max(...(data.leaderboard ?? []).map(r => r.score ?? 0));
  $('#kpi-best-score').textContent = isFinite(best) ? best.toFixed(1) : '—';
}

/* ── Leaderboard ─────────────────────────────────────────────── */
let lbData = [];
let lbSort = { col: 'rank', dir: 1 };
let lbShowBestOnly = false;

function renderLeaderboard(rows) {
  lbData = rows ?? [];
  drawLeaderboard();
  setupLeaderboardSort();
  setupLeaderboardFilter();
}

function setupLeaderboardFilter() {
  const checkbox = $('#best-only-checkbox');
  if (!checkbox) return;

  checkbox.addEventListener('change', () => {
    lbShowBestOnly = checkbox.checked;
    lbSort = { col: 'rank', dir: 1 };
    document.querySelectorAll('#leaderboard thead .sort-btn').forEach(b => {
      b.removeAttribute('aria-sort');
    });
    drawLeaderboard();
  });
}

function drawLeaderboard() {
  const tbody = $('#leaderboard-body');
  let dataToDisplay = lbData;

  if (lbShowBestOnly) {
    const bestPerModel = {};
    for (const row of lbData) {
      if (!bestPerModel[row.model] || row.score > bestPerModel[row.model].score) {
        bestPerModel[row.model] = row;
      }
    }
    dataToDisplay = Object.values(bestPerModel);
  }

  if (dataToDisplay.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty">No data yet.</td></tr>`;
    return;
  }

  const sorted = [...dataToDisplay].sort((a, b) => {
    const av = a[lbSort.col] ?? 0, bv = b[lbSort.col] ?? 0;
    return typeof av === 'string'
      ? av.localeCompare(bv) * lbSort.dir
      : (av - bv) * lbSort.dir;
  });

  tbody.innerHTML = sorted.map(r => {
    const rankCls = r.rank <= 3 ? `rank-${r.rank}` : 'rank-n';
    const status = r.status === 'pass'
      ? `<span class="pill pill-pass">PASS</span>`
      : `<span class="pill pill-fail">FAIL</span>`;
    const covPct = r.tag_coverage_pct ?? 0;
    const covBar = `
      <div class="cov-bar-wrap">
        <div class="cov-bar" role="img" aria-label="Tag coverage ${covPct}%">
          <div class="cov-bar-fill" style="width:${covPct}%"></div>
        </div>
        <span class="cov-pct" aria-hidden="true">${covPct}%</span>
      </div>`;
    const iterCls = r.iterations_used <= 5 ? 'num-good'
      : r.iterations_used <= 12 ? 'num-warn' : 'num-bad';
    return `<tr>
      <td><span class="rank-badge ${rankCls}" aria-label="Rank ${r.rank}">${r.rank}</span></td>
      <td><span class="model-name">${esc(r.model)}</span></td>
      <td><span class="score-val" aria-label="Score ${(r.score ?? 0).toFixed(1)}">${(r.score ?? 0).toFixed(1)}</span></td>
      <td>${status}</td>
      <td>${covBar}</td>
      <td>${numCell(r.html_tag_errors)}</td>
      <td>${numCell(r.w3c_errors)}</td>
      <td>${numCell(r.axe_violations)}</td>
      <td>${numCell(r.pa11y_issues ?? 0)}</td>
      <td>${numCell(r.qualweb_issues ?? 0)}</td>
      <td><span class="${iterCls}" aria-label="${r.iterations_used} iterations">${r.iterations_used}</span></td>
      <td>${r.benchmark_url
        ? `<a class="run-id" href="${esc(r.benchmark_url)}" target="_blank" rel="noopener" aria-label="Open benchmark page for run ${esc(r.run_id)}">${esc(r.run_id)}</a>`
        : `<span class="run-id">${esc(r.run_id)}</span>`}</td>
    </tr>`;
  }).join('');
}

function setupLeaderboardSort() {
  document.querySelectorAll('#leaderboard thead .sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.dataset.col;
      if (lbSort.col === col) {
        lbSort.dir *= -1;
      } else {
        lbSort.col = col;
        lbSort.dir = col === 'rank' ? 1 : -1;
      }
      document.querySelectorAll('#leaderboard thead .sort-btn').forEach(b => {
        b.removeAttribute('aria-sort');
      });
      btn.setAttribute('aria-sort', lbSort.dir === 1 ? 'ascending' : 'descending');
      drawLeaderboard();
    });
  });
}

/* ── Run history ─────────────────────────────────────────────── */
function renderRunHistory(runs) {
  const tbody = $('#run-history-body');
  if (!runs || runs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="11" class="empty">No run history yet.</td></tr>`;
    return;
  }
  tbody.innerHTML = runs.map(r => {
    const status = r.status === 'pass'
      ? `<span class="pill pill-pass">PASS</span>`
      : `<span class="pill pill-fail">FAIL</span>`;
    return `<tr>
      <td><span class="model-name">${esc(r.model)}</span></td>
      <td>${r.benchmark_url
        ? `<a class="run-id" href="${esc(r.benchmark_url)}" target="_blank" rel="noopener" aria-label="Open benchmark page for run ${esc(r.run_id)}">${esc(r.run_id)}</a>`
        : `<span class="run-id">${esc(r.run_id)}</span>`}</td>
      <td><span class="score-val" style="font-size:20px">${(r.final_score ?? 0).toFixed(1)}</span></td>
      <td>${status}</td>
      <td><span class="num-zero" style="font-family:var(--mono)">${r.total_iterations}</span></td>
      <td>${numCell(r.final_html_errors)}</td>
      <td>${numCell(r.final_w3c_errors)}</td>
      <td>${numCell(r.final_axe_violations)}</td>
      <td>${numCell(r.final_pa11y_issues ?? 0)}</td>
      <td>${numCell(r.final_qualweb_issues ?? 0)}</td>
      <td style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${fmtDate(r.timestamp)}</td>
    </tr>`;
  }).join('');
}

/* ── Error breakdown ─────────────────────────────────────────── */
function renderErrorBreakdown(rows) {
  if (!rows?.length) return;
  const labels = rows.map(r => r.model);

  new Chart($('#chart-errors-stacked'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Missing HTML tags', data: rows.map(r => r.html_tag_errors), backgroundColor: 'rgba(255,112,112,0.75)', borderColor: C.accent3, borderWidth: 1 },
        { label: 'W3C errors', data: rows.map(r => r.w3c_errors), backgroundColor: 'rgba(251,191,36,0.75)', borderColor: C.warn, borderWidth: 1 },
        { label: 'Axe violations', data: rows.map(r => r.axe_violations), backgroundColor: 'rgba(192,132,252,0.75)', borderColor: C.accent4, borderWidth: 1 },
        { label: 'Pa11y issues', data: rows.map(r => r.pa11y_issues ?? 0), backgroundColor: 'rgba(71,212,255,0.75)', borderColor: C.accent2, borderWidth: 1 },
        { label: 'QualWeb issues', data: rows.map(r => r.qualweb_issues ?? 0), backgroundColor: 'rgba(244,114,182,0.75)', borderColor: '#f472b6', borderWidth: 1 },
      ],
    },
    options: mergeCD({
      scales: {
        x: { stacked: true, ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } }, grid: { color: C.border } },
        y: { stacked: true, ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } }, grid: { color: C.border } },
      },
    }),
  });

  new Chart($('#chart-scores'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Score (APS)',
        data: rows.map(r => r.score ?? 0),
        backgroundColor: rows.map((_, i) => modelColor(i) + 'cc'),
        borderColor: rows.map((_, i) => modelColor(i)),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: mergeCD({
      plugins: { ...CD.plugins, legend: { display: false } },
      scales: {
        x: { ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } }, grid: { color: C.border } },
        y: { min: 0, ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } }, grid: { color: C.border } },
      },
    }),
  });
}

/* ── Tag coverage charts ─────────────────────────────────────── */
function renderCoverageCharts(rows) {
  if (!rows?.length) return;
  const labels = rows.map(r => r.model);

  new Chart($('#chart-coverage-stacked'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Tags used', data: rows.map(r => r.used_count), backgroundColor: 'rgba(71,212,255,0.7)', borderColor: C.accent2, borderWidth: 1 },
        { label: 'Tags missing', data: rows.map(r => r.missing_count), backgroundColor: 'rgba(255,112,112,0.4)', borderColor: C.accent3, borderWidth: 1 },
      ],
    },
    options: mergeCD({
      scales: {
        x: { stacked: true, ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } }, grid: { color: C.border } },
        y: { stacked: true, ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } }, grid: { color: C.border } },
      },
    }),
  });

  new Chart($('#chart-coverage-pct'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Coverage %',
        data: rows.map(r => r.coverage_pct),
        backgroundColor: rows.map((_, i) => modelColor(i) + 'bb'),
        borderColor: rows.map((_, i) => modelColor(i)),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: mergeCD({
      indexAxis: 'y',
      plugins: { ...CD.plugins, legend: { display: false } },
      scales: {
        x: {
          min: 0, max: 100,
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 }, callback: v => v + '%' },
          grid: { color: C.border },
        },
        y: { ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } }, grid: { color: C.border } },
      },
    }),
  });
}

/* ── Missing tags heatmap ────────────────────────────────────── */
function renderMissingTagsHeatmap(tags, totalRuns) {
  const grid = $('#tag-grid');
  if (!tags?.length) { grid.innerHTML = '<p class="empty">No data.</p>'; return; }

  const alpha = [...tags].sort((a, b) => a.tag.localeCompare(b.tag));
  const maxMiss = Math.max(...tags.map(t => t.miss_count), 1);

  grid.innerHTML = alpha.map(t => {
    const heat = Math.round((t.miss_count / maxMiss) * 100);
    const labelColor = t.miss_count === 0 ? 'var(--pass)'
      : t.miss_pct >= 75 ? 'var(--accent3)'
        : t.miss_pct >= 40 ? 'var(--warn)'
          : 'var(--text)';
    const ariaLabel = `${t.tag}: missing in ${t.miss_count} of ${totalRuns} run${totalRuns !== 1 ? 's' : ''} (${t.miss_pct}%)`;
    return `
      <div class="tag-cell"
           role="listitem"
           style="--heat:${heat}%"
           tabindex="0"
           title="${ariaLabel}"
           aria-label="${ariaLabel}">
        <div class="tag-name" style="color:${labelColor}" aria-hidden="true">&lt;${esc(t.tag)}&gt;</div>
        <div class="tag-pct" aria-hidden="true">${t.miss_pct}%</div>
      </div>`;
  }).join('');
}

/* ── Iteration progress ──────────────────────────────────────── */
let progChartScore = null;
let progChartErrors = null;

function renderProgressSection(modelProgress) {
  const models = Object.keys(modelProgress ?? {});
  const tabsEl = $('#model-tabs');

  if (!models.length) {
    tabsEl.innerHTML = '<p style="font-size:14px;color:var(--text-muted)">No iteration data available.</p>';
    return;
  }

  tabsEl.innerHTML = models.map((m, i) =>
    `<button
       class="model-tab"
       role="tab"
       type="button"
       id="tab-${i}"
       aria-selected="${i === 0 ? 'true' : 'false'}"
       aria-controls="progress-panel"
       data-model="${esc(m)}"
     >${esc(m)}</button>`
  ).join('');

  tabsEl.querySelectorAll('.model-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      tabsEl.querySelectorAll('.model-tab').forEach(b => b.setAttribute('aria-selected', 'false'));
      btn.setAttribute('aria-selected', 'true');
      renderProgressCharts(modelProgress[btn.dataset.model], btn.dataset.model);
    });
    btn.addEventListener('keydown', (e) => {
      const tabs = [...tabsEl.querySelectorAll('.model-tab')];
      const idx = tabs.indexOf(btn);
      if (e.key === 'ArrowRight') { e.preventDefault(); tabs[(idx + 1) % tabs.length].focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); tabs[(idx - 1 + tabs.length) % tabs.length].focus(); }
    });
  });

  const progressPanel = document.createElement('div');
  progressPanel.id = 'progress-panel';
  progressPanel.setAttribute('role', 'tabpanel');
  progressPanel.setAttribute('aria-labelledby', 'tab-0');
  document.querySelector('#progress').appendChild(progressPanel);

  renderProgressCharts(modelProgress[models[0]], models[0]);
}

function renderProgressCharts(runs, modelName) {
  const byIter = {};
  for (const run of runs) {
    for (const it of run.iterations) {
      const n = it.iteration;
      if (!byIter[n]) byIter[n] = { scores: [], html: [], w3c: [], axe: [], pa11y: [] };
      byIter[n].scores.push(it.score ?? 0);
      byIter[n].html.push(it.html_tag_errors ?? 0);
      byIter[n].w3c.push(it.w3c_errors ?? 0);
      byIter[n].axe.push(it.axe_violations ?? 0);
      byIter[n].pa11y.push(it.pa11y_issues ?? 0);
    }
  }

  const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
  const iterNums = Object.keys(byIter).map(Number).sort((a, b) => a - b);
  const labels = iterNums.map(n => `Iter ${n}`);

  const scoreData = iterNums.map(n => +avg(byIter[n].scores).toFixed(2));
  const htmlData = iterNums.map(n => +avg(byIter[n].html).toFixed(1));
  const w3cData = iterNums.map(n => +avg(byIter[n].w3c).toFixed(1));
  const axeData = iterNums.map(n => +avg(byIter[n].axe).toFixed(1));
  const pa11yData = iterNums.map(n => +avg(byIter[n].pa11y).toFixed(1));

  const runsLabel = `${modelName} — ${runs.length} run${runs.length !== 1 ? 's' : ''} averaged`;

  if (progChartScore) progChartScore.destroy();
  progChartScore = new Chart($('#chart-progress-score'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: runsLabel,
        data: scoreData,
        borderColor: C.accent,
        backgroundColor: 'rgba(232,255,71,0.08)',
        borderWidth: 2,
        pointBackgroundColor: C.accent,
        pointRadius: 4,
        tension: 0.3,
        fill: true,
      }],
    },
    options: mergeCD({}),
  });

  if (progChartErrors) progChartErrors.destroy();
  progChartErrors = new Chart($('#chart-progress-errors'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Missing tags', data: htmlData, borderColor: C.accent3, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.3 },
        { label: 'W3C errors', data: w3cData, borderColor: C.warn, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.3 },
        { label: 'Axe violations', data: axeData, borderColor: C.accent4, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.3 },
        { label: 'Pa11y issues', data: pa11yData, borderColor: C.accent2, backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.3 },
      ],
    },
    options: mergeCD({}),
  });
}

main();
