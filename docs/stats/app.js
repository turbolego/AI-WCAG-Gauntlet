'use strict';

/* ── Theme toggle ────────────────────────────────────────────── */
function initTheme() {
  const btn = document.querySelector('#theme-toggle');
  if (!btn) return;
  const icon = btn.querySelector('.theme-icon');
  const html = document.documentElement;

  function apply(theme) {
    if (theme === 'light') {
      html.setAttribute('data-theme', 'light');
      btn.setAttribute('aria-label', 'Switch to dark theme');
      if (icon) icon.textContent = '🌙';
    } else {
      html.removeAttribute('data-theme');
      btn.setAttribute('aria-label', 'Switch to light theme');
      if (icon) icon.textContent = '☀️';
    }
  }

  const saved = localStorage.getItem('gauntlet-theme');
  apply(saved || 'dark');

  btn.addEventListener('click', () => {
    const current = html.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    localStorage.setItem('gauntlet-theme', next);
    apply(next);
  });
}

/* ── URL hash state (permalink filters) ──────────────────────── */
function readHashState() {
  const hash = location.hash.replace('#', '');
  const params = new URLSearchParams(hash.includes('?') ? hash.split('?')[1] : '');
  return {
    section: hash.split('?')[0] || '',
    model: params.get('model') || '',
    source: params.get('source') || '',
  };
}

function writeHashState(section, filters) {
  const params = new URLSearchParams();
  if (filters.model) params.set('model', filters.model);
  if (filters.source) params.set('source', filters.source);
  const qs = params.toString();
  const newHash = section + (qs ? '?' + qs : '');
  history.replaceState(null, '', '#' + newHash);
}

/* ── CSV export ──────────────────────────────────────────────── */
function downloadCSV(filename, headers, rows) {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => {
      const s = String(cell ?? '');
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? '"' + s.replace(/"/g, '""') + '"'
        : s;
    }).join(','))
  ].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ── Sparkline SVG generator ─────────────────────────────────── */
function sparklineSVG(scores, width = 60, height = 18) {
  if (!scores || scores.length < 2) return '';
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const points = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * width;
    const y = height - ((s - min) / range) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return `<svg class="sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" aria-hidden="true"><polyline points="${points}" fill="none" stroke="var(--accent2)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

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

/* ── Case-insensitive model name normalization ────────────── */
function normalizeModelName(name) {
  return String(name ?? '').toLowerCase();
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
  initTheme();

  let data;
  try {
    const res = await fetch('./benchmark_stats.json');
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

  // Store model_progress globally for sparklines
  window._modelProgress = data.model_progress ?? {};

  renderHeader(data);
  renderKPIs(data);
  renderLeaderboard(data.leaderboard);
  window._runHistoryData = data.runs_by_model ?? [];
  populateFilterOptions('rh', window._runHistoryData);
  renderRunHistory(window._runHistoryData);
  setupRunHistorySort();
  renderTimeline(data.runs_by_model);
  renderErrorBreakdown(data.error_breakdown);
  renderStrategyCharts(data.model_progress, data.runs_by_model);
  renderCoverageCharts(data.tag_coverage_by_model);
  renderHardestTags(data.hardest_tags);
  renderMissingTagsHeatmap(data.missing_tags_frequency, data.total_runs);
  renderProgressSection(data.model_progress);

  // Apply URL hash state
  applyHashState();
  setupExportButtons();
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

  const best = Math.max(...(data.leaderboard ?? []).map(r => r.score ?? 0));
  $('#kpi-best-score').textContent = isFinite(best) ? best.toFixed(1) : '—';
}

/* ── Leaderboard ─────────────────────────────────────────────── */
let lbData = [];
let lbSort = { col: 'rank', dir: 1 };
let lbShowBestOnly = true;
let lbShowAll = false;
let lbFilterModel = '';
let lbFilterSource = '';
const LB_PAGE_SIZE = 10;

function renderLeaderboard(rows) {
  lbData = rows ?? [];
  populateFilterOptions('lb', lbData);
  drawLeaderboard();
  setupLeaderboardSort();
  setupLeaderboardFilter();
  setupLeaderboardPagination();
}

function populateFilterOptions(prefix, data) {
  const models = [...new Set(data.map(r => r.model))].sort();
  const sources = [...new Set(data.map(r => r.providerLabel || r.source || '').filter(Boolean))].sort();

  const modelSelect = $(`#${prefix}-filter-model`);
  const sourceSelect = $(`#${prefix}-filter-source`);
  if (modelSelect) {
    modelSelect.innerHTML = '<option value="">All models</option>' +
      models.map(m => `<option value="${esc(m)}">${esc(m)}</option>`).join('');
  }
  if (sourceSelect) {
    sourceSelect.innerHTML = '<option value="">All sources</option>' +
      sources.map(s => `<option value="${esc(s)}">${esc(s)}</option>`).join('');
  }
}

function setupLeaderboardFilter() {
  const checkbox = $('#best-only-checkbox');
  if (checkbox) {
    checkbox.addEventListener('change', () => {
      lbShowBestOnly = checkbox.checked;
      lbSort = { col: 'rank', dir: 1 };
      lbShowAll = false;
      document.querySelectorAll('#leaderboard thead .sort-btn').forEach(b => {
        b.removeAttribute('aria-sort');
      });
      drawLeaderboard();
    });
  }

  const modelSelect = $('#lb-filter-model');
  const sourceSelect = $('#lb-filter-source');
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      lbFilterModel = modelSelect.value;
      lbShowAll = false;
      writeHashState('leaderboard', { model: lbFilterModel, source: lbFilterSource });
      drawLeaderboard();
    });
  }
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      lbFilterSource = sourceSelect.value;
      lbShowAll = false;
      writeHashState('leaderboard', { model: lbFilterModel, source: lbFilterSource });
      drawLeaderboard();
    });
  }
}

function setupLeaderboardPagination() {
  const btn = $('#lb-show-all');
  if (btn) {
    btn.addEventListener('click', () => {
      lbShowAll = !lbShowAll;
      btn.textContent = lbShowAll ? 'Show top 10' : 'Show all';
      drawLeaderboard();
    });
  }
}

function drawLeaderboard() {
  const tbody = $('#leaderboard-body');
  let dataToDisplay = lbData;

  // Filter to best run per model if checkbox is checked (case-insensitive grouping)
  if (lbShowBestOnly) {
    const bestPerModel = {};
    for (const row of lbData) {
      const normalizedModel = normalizeModelName(row.model);
      if (!bestPerModel[normalizedModel] || row.score > bestPerModel[normalizedModel].score) {
        bestPerModel[normalizedModel] = row;
      }
    }
    dataToDisplay = Object.values(bestPerModel);
  }

  // Apply model/source filters
  if (lbFilterModel) {
    dataToDisplay = dataToDisplay.filter(r => r.model === lbFilterModel);
  }
  if (lbFilterSource) {
    dataToDisplay = dataToDisplay.filter(r => (r.providerLabel || r.source || '') === lbFilterSource);
  }

  if (dataToDisplay.length === 0) {
    tbody.innerHTML = `<tr><td colspan="14" class="empty">No data matches the current filters.</td></tr>`;
    $('#lb-showing').textContent = '';
    $('#lb-show-all').style.display = 'none';
    return;
  }

  const sorted = [...dataToDisplay].sort((a, b) => {
    const av = a[lbSort.col] ?? 0, bv = b[lbSort.col] ?? 0;
    return typeof av === 'string'
      ? av.localeCompare(bv) * lbSort.dir
      : (av - bv) * lbSort.dir;
  });

  const total = sorted.length;
  const display = lbShowAll ? sorted : sorted.slice(0, LB_PAGE_SIZE);

  tbody.innerHTML = display.map(r => {
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
    // Cheat-detection: similarity to the closest older page from another model
    let simCell = '<span class="sim-na" aria-label="No older page from another model to compare">—</span>';
    if (r.similarity_pct != null) {
      const sim = Number(r.similarity_pct);
      const simCls = sim >= 90 ? 'sim-bad' : sim >= 70 ? 'sim-warn' : 'sim-ok';
      const simLabel = sim >= 90 ? 'likely copy'
        : sim >= 70 ? 'very similar' : 'normal';
      const simTarget = (r.similar_to_model && r.similar_to_run)
        ? ` to ${esc(r.similar_to_model)} / ${esc(r.similar_to_run)}` : '';
      simCell = `<span class="${simCls}" title="${sim.toFixed(1)}% similar${simTarget}" aria-label="Similarity ${sim.toFixed(1)}% — ${simLabel}${simTarget}">${sim.toFixed(1)}%${sim >= 90 ? ' ⚠' : ''}</span>`;
    }
    // Generate sparkline from model_progress data for this run
    let spark = '';
    const mp = window._modelProgress[r.model];
    if (mp) {
      const run = mp.find(rr => rr.run_id === r.run_id);
      if (run && run.iterations.length >= 2) {
        spark = sparklineSVG(run.iterations.map(it => it.score ?? 0));
      }
    }
    return `<tr>
      <td data-label="Rank"><span class="rank-badge ${rankCls}" aria-label="Rank ${r.rank}">${r.rank}</span></td>
      <td data-label="Model"><span class="model-name">${esc(r.model)}</span></td>
      <td data-label="Source"><span class="source-badge source-${r.source}" data-provider="${esc(r.provider || '')}" title="${esc(r.providerLabel || r.source || '')}"><span class="source-provider">${esc(r.providerLabel || (r.source === 'api' ? 'API' : 'Local'))}</span></span></td>
      <td data-label="Score"><span class="score-val" aria-label="Score ${(r.score ?? 0).toFixed(1)}">${(r.score ?? 0).toFixed(1)}</span></td>
      <td data-label="Status">${status}</td>
      <td data-label="Coverage">${covBar}</td>
      <td data-label="Missing tags">${numCell(r.html_tag_errors)}</td>
      <td data-label="W3C">${numCell(r.w3c_errors)}</td>
      <td data-label="Axe">${numCell(r.axe_violations)}</td>
      <td data-label="Pa11y">${numCell(r.pa11y_issues ?? 0)}</td>
      <td data-label="QualWeb">${numCell(r.qualweb_issues ?? 0)}</td>
      <td data-label="Similarity">${simCell}</td>
      <td data-label="Iterations"><span class="${iterCls}" aria-label="${r.iterations_used} iterations">${r.iterations_used}</span>${spark}</td>
      <td data-label="Run ID">${r.benchmark_url
        ? `<a class="run-id" href="${esc(r.benchmark_url)}" target="_blank" rel="noopener" aria-label="Open benchmark page for run ${esc(r.run_id)}">${esc(r.run_id)}</a>`
        : `<span class="run-id">${esc(r.run_id)}</span>`}</td>
    </tr>`;
  }).join('');

  // Update count and show-all button
  const showingEl = $('#lb-showing');
  const showAllBtn = $('#lb-show-all');
  if (total > LB_PAGE_SIZE) {
    showingEl.textContent = lbShowAll ? `Showing all ${total}` : `Showing ${display.length} of ${total}`;
    showAllBtn.style.display = '';
    showAllBtn.textContent = lbShowAll ? 'Show top 10' : 'Show all';
  } else {
    showingEl.textContent = `${total} result${total !== 1 ? 's' : ''}`;
    showAllBtn.style.display = 'none';
  }
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
      // Update aria-sort
      document.querySelectorAll('#leaderboard thead .sort-btn').forEach(b => {
        b.removeAttribute('aria-sort');
      });
      btn.setAttribute('aria-sort', lbSort.dir === 1 ? 'ascending' : 'descending');
      drawLeaderboard();
    });
  });
}

/* ── Run history ─────────────────────────────────────────────── */

let rhSort = { col: 'timestamp', dir: -1 };
let rhShowAll = false;
let rhFilterModel = '';
let rhFilterSource = '';
const RH_PAGE_SIZE = 10;

function renderRunHistory(runs) {
  const tbody = $('#run-history-body');
  if (!runs || runs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty">No run history yet.</td></tr>`;
    return;
  }

  // Apply filters
  let filtered = runs;
  if (rhFilterModel) {
    filtered = filtered.filter(r => r.model === rhFilterModel);
  }
  if (rhFilterSource) {
    filtered = filtered.filter(r => (r.providerLabel || r.source || '') === rhFilterSource);
  }

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="empty">No runs match the current filters.</td></tr>`;
    $('#rh-showing').textContent = '';
    $('#rh-show-all').style.display = 'none';
    return;
  }

  // Sort runs
  const sorted = [...filtered].sort((a, b) => {
    let av = a[rhSort.col], bv = b[rhSort.col];
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (rhSort.col === 'timestamp') {
      return (new Date(av) - new Date(bv)) * rhSort.dir;
    }
    if ([
      'final_score', 'total_iterations', 'final_html_errors', 'final_w3c_errors', 'final_axe_violations', 'final_pa11y_issues', 'final_qualweb_issues'
    ].includes(rhSort.col)) {
      return (parseFloat(av) - parseFloat(bv)) * rhSort.dir;
    }
    if (rhSort.col === 'status') {
      return (String(av).localeCompare(String(bv))) * rhSort.dir;
    }
    return String(av).localeCompare(String(bv)) * rhSort.dir;
  });

  const total = sorted.length;
  const display = rhShowAll ? sorted : sorted.slice(0, RH_PAGE_SIZE);

  tbody.innerHTML = display.map(r => {
    const status = r.status === 'pass'
      ? `<span class="pill pill-pass">PASS</span>`
      : `<span class="pill pill-fail">FAIL</span>`;
    return `<tr>
      <td data-label="Model"><span class="model-name">${esc(r.model)}</span></td>
      <td data-label="Source"><span class="source-badge source-${r.source}" data-provider="${esc(r.provider || '')}" title="${esc(r.providerLabel || r.source || '')}"><span class="source-provider">${esc(r.providerLabel || (r.source === 'api' ? 'API' : 'Local'))}</span></span></td>
      <td data-label="Run ID">${r.benchmark_url
        ? `<a class="run-id" href="${esc(r.benchmark_url)}" target="_blank" rel="noopener" aria-label="Open benchmark page for run ${esc(r.run_id)}">${esc(r.run_id)}</a>`
        : `<span class="run-id">${esc(r.run_id)}</span>`}</td>
      <td data-label="Score"><span class="score-val" style="font-size:20px">${(r.final_score ?? 0).toFixed(1)}</span></td>
      <td data-label="Status">${status}</td>
      <td data-label="Iterations"><span class="num-zero" style="font-family:var(--mono)">${r.total_iterations}</span></td>
      <td data-label="Missing tags">${numCell(r.final_html_errors)}</td>
      <td data-label="W3C">${numCell(r.final_w3c_errors)}</td>
      <td data-label="Axe">${numCell(r.final_axe_violations)}</td>
      <td data-label="Pa11y">${numCell(r.final_pa11y_issues ?? 0)}</td>
      <td data-label="QualWeb">${numCell(r.final_qualweb_issues ?? 0)}</td>
      <td data-label="Timestamp" style="font-family:var(--mono);font-size:12px;color:var(--text-muted)">${fmtDate(r.timestamp)}</td>
    </tr>`;
  }).join('');

  // Update count and show-all button
  const showingEl = $('#rh-showing');
  const showAllBtn = $('#rh-show-all');
  if (total > RH_PAGE_SIZE) {
    showingEl.textContent = rhShowAll ? `Showing all ${total}` : `Showing ${display.length} of ${total}`;
    showAllBtn.style.display = '';
    showAllBtn.textContent = rhShowAll ? 'Show last 10' : 'Show all';
  } else {
    showingEl.textContent = `${total} result${total !== 1 ? 's' : ''}`;
    showAllBtn.style.display = 'none';
  }
}

function setupRunHistorySort() {
  document.querySelectorAll('#run-history thead .sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const col = btn.getAttribute('data-col');
      if (rhSort.col === col) {
        rhSort.dir *= -1;
      } else {
        rhSort.col = col;
        rhSort.dir = col === 'timestamp' ? -1 : 1;
      }
      document.querySelectorAll('#run-history thead .sort-btn').forEach(b => {
        b.removeAttribute('aria-sort');
      });
      btn.setAttribute('aria-sort', rhSort.dir === 1 ? 'ascending' : 'descending');
      renderRunHistory(window._runHistoryData || []);
    });
  });

  // Filters
  const modelSelect = $('#rh-filter-model');
  const sourceSelect = $('#rh-filter-source');
  if (modelSelect) {
    modelSelect.addEventListener('change', () => {
      rhFilterModel = modelSelect.value;
      rhShowAll = false;
      renderRunHistory(window._runHistoryData || []);
    });
  }
  if (sourceSelect) {
    sourceSelect.addEventListener('change', () => {
      rhFilterSource = sourceSelect.value;
      rhShowAll = false;
      renderRunHistory(window._runHistoryData || []);
    });
  }

  // Show-all toggle
  const showAllBtn = $('#rh-show-all');
  if (showAllBtn) {
    showAllBtn.addEventListener('click', () => {
      rhShowAll = !rhShowAll;
      renderRunHistory(window._runHistoryData || []);
    });
  }
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

/* ── Hardest Tags Highscore ──────────────────────────────────── */
function renderHardestTags(hardestTags) {
  const tbody = document.querySelector('#hardest-tags-table tbody');
  if (!hardestTags?.length) { tbody.innerHTML = '<tr><td colspan="7">No data.</td></tr>'; return; }

  const PAGE_SIZE = 20;
  let showAll = false;

  function render() {
    const visible = showAll ? hardestTags : hardestTags.slice(0, PAGE_SIZE);
    tbody.innerHTML = visible.map(t => {
      const pctBar = `<span class="difficulty-bar" style="--pct:${t.miss_pct}%" title="${t.miss_pct}% miss rate"></span>`;
      const missLabel = `${t.miss_count} / ${t.total_runs}`;
      const failedLabel = `${t.models_failed} / ${t.models_attempted}`;
      const hardestFor = t.models_never.length
        ? t.models_never.slice(0, 3).map(m => `<span class="tag-model tag-model--fail">${esc(m)}</span>`).join(' ')
          + (t.models_never.length > 3 ? ` <span class="tag-model-more">+${t.models_never.length - 3}</span>` : '')
        : '<span class="tag-model tag-model--none">—</span>';
      const easiestFor = t.models_always.length
        ? t.models_always.slice(0, 3).map(m => `<span class="tag-model tag-model--pass">${esc(m)}</span>`).join(' ')
          + (t.models_always.length > 3 ? ` <span class="tag-model-more">+${t.models_always.length - 3}</span>` : '')
        : '<span class="tag-model tag-model--none">—</span>';

      return `<tr>
        <td data-label="#">${t.rank}</td>
        <td data-label="Tag"><code class="tag-code">&lt;${esc(t.tag)}&gt;</code></td>
        <td data-label="Miss Rate">${pctBar} ${t.miss_pct}%</td>
        <td data-label="Runs Missed">${missLabel}</td>
        <td data-label="Models Failed">${failedLabel} (${t.fail_rate}%)</td>
        <td data-label="Hardest For">${hardestFor}</td>
        <td data-label="Easiest For">${easiestFor}</td>
      </tr>`;
    }).join('');

    const countEl = $('#hardest-tags-count');
    countEl.textContent = showAll
      ? `Showing all ${hardestTags.length} tags`
      : `Showing top ${Math.min(PAGE_SIZE, hardestTags.length)} of ${hardestTags.length} tags`;
  }

  render();

  const btn = $('#hardest-tags-show-all');
  btn.addEventListener('click', () => {
    showAll = !showAll;
    btn.textContent = showAll ? 'Show top 20' : 'Show all';
    render();
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

/* ── Model Strategy charts ────────────────────────────────────── */
function renderStrategyCharts(modelProgress, runsByModel) {
  const models = Object.keys(modelProgress ?? {});
  if (!models.length) return;

  renderStrategyCompare(modelProgress, models);
  renderStrategyEfficiency(runsByModel);
  renderStrategyVelocity(modelProgress, models);
  renderStrategyResolution(modelProgress, models);
  renderConsistencyChart(runsByModel);
  renderFirstIterChart(modelProgress, models);
  renderConvergenceChart(modelProgress, models);
}

/** All models on one line chart — average score per iteration */
function renderStrategyCompare(modelProgress, models) {
  const maxIter = Math.max(...models.map(m =>
    Math.max(...modelProgress[m].flatMap(r => r.iterations.map(it => it.iteration)))
  ));

  const datasets = models.map((model, i) => {
    const byIter = {};
    for (const run of modelProgress[model]) {
      for (const it of run.iterations) {
        if (!byIter[it.iteration]) byIter[it.iteration] = [];
        byIter[it.iteration].push(it.score ?? 0);
      }
    }
    const avg = arr => arr.reduce((a, b) => a + b, 0) / arr.length;
    const data = [];
    for (let n = 1; n <= maxIter; n++) {
      data.push(byIter[n] ? +avg(byIter[n]).toFixed(2) : null);
    }
    return {
      label: model,
      data,
      borderColor: modelColor(i),
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: modelColor(i),
      tension: 0.3,
      spanGaps: true,
    };
  });

  const labels = Array.from({ length: maxIter }, (_, i) => `${i + 1}`);

  new Chart($('#chart-strategy-compare'), {
    type: 'line',
    data: { labels, datasets },
    options: mergeCD({
      scales: {
        x: {
          title: { display: true, text: 'Iteration', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
        },
        y: {
          title: { display: true, text: 'Score (APS)', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
        },
      },
      plugins: {
        ...CD.plugins,
        legend: {
          ...CD.plugins.legend,
          position: 'bottom',
        },
      },
    }),
  });
}

/** Scatter: X = iterations used, Y = final score — each dot is a run */
function renderStrategyEfficiency(runsByModel) {
  if (!runsByModel?.length) return;

  // Group runs by model
  const byModel = {};
  for (const run of runsByModel) {
    if (!byModel[run.model]) byModel[run.model] = [];
    byModel[run.model].push(run);
  }

  const models = Object.keys(byModel);
  const datasets = models.map((model, i) => ({
    label: model,
    data: byModel[model].map(r => ({
      x: r.total_iterations,
      y: r.final_score,
    })),
    backgroundColor: modelColor(i) + 'cc',
    borderColor: modelColor(i),
    borderWidth: 1,
    pointRadius: 6,
    pointHoverRadius: 9,
  }));

  new Chart($('#chart-strategy-efficiency'), {
    type: 'scatter',
    data: { datasets },
    options: mergeCD({
      scales: {
        x: {
          title: { display: true, text: 'Iterations used', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
          min: 0,
        },
        y: {
          title: { display: true, text: 'Final score (APS)', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
          min: 0,
        },
      },
      plugins: {
        ...CD.plugins,
        legend: {
          ...CD.plugins.legend,
          position: 'bottom',
        },
        tooltip: {
          ...CD.plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} APS in ${ctx.parsed.x} iter`,
          },
        },
      },
    }),
  });
}

/** Bar chart: average score gained per iteration (best run per model) */
function renderStrategyVelocity(modelProgress, models) {
  const velocities = models.map(model => {
    // Find best run (highest final score)
    let bestRun = null;
    let bestScore = -1;
    for (const run of modelProgress[model]) {
      const finalIt = run.iterations[run.iterations.length - 1];
      if ((finalIt?.score ?? 0) > bestScore) {
        bestScore = finalIt.score;
        bestRun = run;
      }
    }
    if (!bestRun || bestRun.iterations.length === 0) return 0;
    const iters = bestRun.iterations;
    const firstScore = iters[0]?.score ?? 0;
    const lastScore = iters[iters.length - 1]?.score ?? 0;
    const numIters = iters.length;
    return numIters > 1 ? +((lastScore - firstScore) / (numIters - 1)).toFixed(2) : 0;
  });

  new Chart($('#chart-strategy-velocity'), {
    type: 'bar',
    data: {
      labels: models,
      datasets: [{
        label: 'Avg points/iteration',
        data: velocities,
        backgroundColor: models.map((_, i) => modelColor(i) + 'bb'),
        borderColor: models.map((_, i) => modelColor(i)),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: mergeCD({
      plugins: { ...CD.plugins, legend: { display: false } },
      scales: {
        x: { ticks: { color: C.muted, font: { family: 'DM Mono', size: 10 }, maxRotation: 45, minRotation: 25 }, grid: { color: C.border } },
        y: {
          title: { display: true, text: 'Points gained per iteration', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
        },
      },
    }),
  });
}

/** Grouped bar: % of each error type resolved between iter 1 and final (best run per model) */
function renderStrategyResolution(modelProgress, models) {
  const resolutions = models.map(model => {
    // Find best run
    let bestRun = null;
    let bestScore = -1;
    for (const run of modelProgress[model]) {
      const finalIt = run.iterations[run.iterations.length - 1];
      if ((finalIt?.score ?? 0) > bestScore) {
        bestScore = finalIt.score;
        bestRun = run;
      }
    }
    if (!bestRun || bestRun.iterations.length < 2) {
      return { html: 0, w3c: 0, axe: 0, pa11y: 0, qualweb: 0 };
    }
    const first = bestRun.iterations[0];
    const last = bestRun.iterations[bestRun.iterations.length - 1];

    const pctResolved = (startVal, endVal) => {
      if (startVal === 0) return endVal === 0 ? 100 : 0;
      return Math.max(0, Math.round(((startVal - endVal) / startVal) * 100));
    };

    return {
      html: pctResolved(first.html_tag_errors ?? 0, last.html_tag_errors ?? 0),
      w3c: pctResolved(first.w3c_errors ?? 0, last.w3c_errors ?? 0),
      axe: pctResolved(first.axe_violations ?? 0, last.axe_violations ?? 0),
      pa11y: pctResolved(first.pa11y_issues ?? 0, last.pa11y_issues ?? 0),
      qualweb: pctResolved(first.qualweb_issues ?? 0, last.qualweb_issues ?? 0),
    };
  });

  new Chart($('#chart-strategy-resolution'), {
    type: 'bar',
    data: {
      labels: models,
      datasets: [
        { label: 'Missing tags resolved %', data: resolutions.map(r => r.html), backgroundColor: 'rgba(255,112,112,0.75)', borderColor: C.accent3, borderWidth: 1 },
        { label: 'W3C errors resolved %', data: resolutions.map(r => r.w3c), backgroundColor: 'rgba(251,191,36,0.75)', borderColor: C.warn, borderWidth: 1 },
        { label: 'Axe violations resolved %', data: resolutions.map(r => r.axe), backgroundColor: 'rgba(192,132,252,0.75)', borderColor: C.accent4, borderWidth: 1 },
        { label: 'Pa11y issues resolved %', data: resolutions.map(r => r.pa11y), backgroundColor: 'rgba(71,212,255,0.75)', borderColor: C.accent2, borderWidth: 1 },
        { label: 'QualWeb issues resolved %', data: resolutions.map(r => r.qualweb), backgroundColor: 'rgba(244,114,182,0.75)', borderColor: '#f472b6', borderWidth: 1 },
      ],
    },
    options: mergeCD({
      scales: {
        x: { ticks: { color: C.muted, font: { family: 'DM Mono', size: 10 }, maxRotation: 45, minRotation: 25 }, grid: { color: C.border } },
        y: {
          title: { display: true, text: '% resolved', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
          min: 0,
          max: 100,
        },
      },
      plugins: {
        ...CD.plugins,
        legend: {
          ...CD.plugins.legend,
          position: 'bottom',
        },
      },
    }),
  });
}

/** Box-plot style: min / median / max score per model (floating bar chart) */
function renderConsistencyChart(runsByModel) {
  if (!runsByModel?.length) return;

  // Group final scores by model
  const byModel = {};
  for (const run of runsByModel) {
    if (!byModel[run.model]) byModel[run.model] = [];
    byModel[run.model].push(run.final_score);
  }

  // Only show models with 2+ runs
  const models = Object.keys(byModel).filter(m => byModel[m].length >= 2);
  if (!models.length) return;

  // Sort by median descending
  models.sort((a, b) => {
    const medA = median(byModel[a]);
    const medB = median(byModel[b]);
    return medB - medA;
  });

  function median(arr) {
    const s = [...arr].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  const mins = models.map(m => Math.min(...byModel[m]));
  const maxs = models.map(m => Math.max(...byModel[m]));
  const medians = models.map(m => median(byModel[m]));

  new Chart($('#chart-consistency'), {
    type: 'bar',
    data: {
      labels: models,
      datasets: [
        {
          label: 'Score range (min → max)',
          data: models.map((m, i) => [mins[i], maxs[i]]),
          backgroundColor: models.map((_, i) => modelColor(i) + '44'),
          borderColor: models.map((_, i) => modelColor(i)),
          borderWidth: 2,
          borderRadius: 3,
          borderSkipped: false,
        },
        {
          label: 'Median score',
          type: 'line',
          data: medians,
          borderColor: C.text,
          backgroundColor: C.text,
          pointRadius: 6,
          pointStyle: 'rectRot',
          borderWidth: 0,
          showLine: false,
        },
      ],
    },
    options: mergeCD({
      scales: {
        x: { ticks: { color: C.muted, font: { family: 'DM Mono', size: 10 }, maxRotation: 45, minRotation: 25 }, grid: { color: C.border } },
        y: {
          title: { display: true, text: 'Final score (APS)', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
          min: 0,
        },
      },
      plugins: {
        ...CD.plugins,
        legend: { ...CD.plugins.legend, position: 'bottom' },
        tooltip: {
          ...CD.plugins.tooltip,
          callbacks: {
            label: (ctx) => {
              if (ctx.datasetIndex === 0) {
                const [lo, hi] = ctx.raw;
                return `${ctx.dataset.label}: ${lo.toFixed(1)} – ${hi.toFixed(1)} (range: ${(hi - lo).toFixed(1)})`;
              }
              return `Median: ${ctx.parsed.y.toFixed(1)}`;
            },
          },
        },
      },
    }),
  });
}

/** Bar chart: average first-iteration score per model */
function renderFirstIterChart(modelProgress, models) {
  const firstScores = models.map(model => {
    const scores = [];
    for (const run of modelProgress[model]) {
      const first = run.iterations.find(it => it.iteration === 1);
      if (first) scores.push(first.score ?? 0);
    }
    return scores.length ? +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(2) : 0;
  });

  // Sort by first-iteration score descending
  const indices = models.map((_, i) => i).sort((a, b) => firstScores[b] - firstScores[a]);
  const sortedModels = indices.map(i => models[i]);
  const sortedScores = indices.map(i => firstScores[i]);

  new Chart($('#chart-first-iter'), {
    type: 'bar',
    data: {
      labels: sortedModels,
      datasets: [{
        label: 'Avg first-iteration score',
        data: sortedScores,
        backgroundColor: sortedModels.map((_, i) => modelColor(i) + 'bb'),
        borderColor: sortedModels.map((_, i) => modelColor(i)),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: mergeCD({
      plugins: { ...CD.plugins, legend: { display: false } },
      scales: {
        x: { ticks: { color: C.muted, font: { family: 'DM Mono', size: 10 }, maxRotation: 45, minRotation: 25 }, grid: { color: C.border } },
        y: {
          title: { display: true, text: 'Score at iteration 1', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
          min: 0,
        },
      },
    }),
  });
}

/** Bar chart: iterations to reach 90% of final score (best run per model) */
function renderConvergenceChart(modelProgress, models) {
  const convergence = models.map(model => {
    // Find best run
    let bestRun = null;
    let bestScore = -1;
    for (const run of modelProgress[model]) {
      const finalIt = run.iterations[run.iterations.length - 1];
      if ((finalIt?.score ?? 0) > bestScore) {
        bestScore = finalIt.score;
        bestRun = run;
      }
    }
    if (!bestRun || bestRun.iterations.length === 0) return 0;

    const finalScore = bestRun.iterations[bestRun.iterations.length - 1]?.score ?? 0;
    const threshold = finalScore * 0.9;

    // Find first iteration that reaches 90% of final
    const sorted = [...bestRun.iterations].sort((a, b) => a.iteration - b.iteration);
    for (const it of sorted) {
      if ((it.score ?? 0) >= threshold) return it.iteration;
    }
    return sorted[sorted.length - 1]?.iteration ?? 0;
  });

  new Chart($('#chart-convergence'), {
    type: 'bar',
    data: {
      labels: models,
      datasets: [{
        label: 'Iterations to 90% of final score',
        data: convergence,
        backgroundColor: models.map((_, i) => modelColor(i) + 'bb'),
        borderColor: models.map((_, i) => modelColor(i)),
        borderWidth: 1,
        borderRadius: 3,
      }],
    },
    options: mergeCD({
      plugins: { ...CD.plugins, legend: { display: false } },
      scales: {
        x: { ticks: { color: C.muted, font: { family: 'DM Mono', size: 10 }, maxRotation: 45, minRotation: 25 }, grid: { color: C.border } },
        y: {
          title: { display: true, text: 'Iterations needed', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 }, stepSize: 1 },
          grid: { color: C.border },
          min: 0,
        },
      },
    }),
  });
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
    /* Keyboard: arrow keys navigate tabs (AAA: 2.1.1) */
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
  /* Aggregate across all runs of this model by iteration number */
  const byIter = {};
  for (const run of runs) {
    for (const it of run.iterations) {
      const n = it.iteration;
      if (!byIter[n]) byIter[n] = { scores: [], html: [], w3c: [], axe: [], pa11y: [], qualweb: [] };
      byIter[n].scores.push(it.score ?? 0);
      byIter[n].html.push(it.html_tag_errors ?? 0);
      byIter[n].w3c.push(it.w3c_errors ?? 0);
      byIter[n].axe.push(it.axe_violations ?? 0);
      byIter[n].pa11y.push(it.pa11y_issues ?? 0);
      byIter[n].qualweb.push(it.qualweb_issues ?? 0);
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
  const qualwebData = iterNums.map(n => +avg(byIter[n].qualweb).toFixed(1));

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
        { label: 'QualWeb issues', data: qualwebData, borderColor: '#f472b6', backgroundColor: 'transparent', borderWidth: 2, pointRadius: 3, tension: 0.3 },
      ],
    },
    options: mergeCD({}),
  });
}

/* ── Timeline chart (scores over calendar time) ──────────────── */
function renderTimeline(runsByModel) {
  if (!runsByModel?.length) return;
  const canvas = $('#chart-timeline');
  if (!canvas) return;

  const byModel = {};
  for (const run of runsByModel) {
    if (!byModel[run.model]) byModel[run.model] = [];
    byModel[run.model].push(run);
  }

  const models = Object.keys(byModel);
  const datasets = models.map((model, i) => ({
    label: model,
    data: byModel[model]
      .filter(r => r.timestamp)
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .map(r => ({ x: r.timestamp, y: r.final_score })),
    borderColor: modelColor(i),
    backgroundColor: modelColor(i) + '44',
    borderWidth: 2,
    pointRadius: 5,
    pointHoverRadius: 8,
    showLine: true,
    tension: 0.2,
  }));

  new Chart(canvas, {
    type: 'scatter',
    data: { datasets },
    options: mergeCD({
      scales: {
        x: {
          type: 'time',
          time: { unit: 'day', tooltipFormat: 'dd MMM yyyy HH:mm' },
          title: { display: true, text: 'Date', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 10 } },
          grid: { color: C.border },
        },
        y: {
          title: { display: true, text: 'Final score (APS)', color: C.muted, font: { family: 'DM Mono', size: 11 } },
          ticks: { color: C.muted, font: { family: 'DM Mono', size: 11 } },
          grid: { color: C.border },
          min: 0,
        },
      },
      plugins: {
        ...CD.plugins,
        legend: { ...CD.plugins.legend, position: 'bottom' },
        tooltip: {
          ...CD.plugins.tooltip,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)} APS`,
          },
        },
      },
    }),
  });
}

/* ── Apply URL hash state to filters ─────────────────────────── */
function applyHashState() {
  const state = readHashState();
  if (state.model) {
    const lbModel = $('#lb-filter-model');
    const rhModel = $('#rh-filter-model');
    if (lbModel) { lbModel.value = state.model; lbFilterModel = state.model; }
    if (rhModel) { rhModel.value = state.model; rhFilterModel = state.model; }
  }
  if (state.source) {
    const lbSource = $('#lb-filter-source');
    const rhSource = $('#rh-filter-source');
    if (lbSource) { lbSource.value = state.source; lbFilterSource = state.source; }
    if (rhSource) { rhSource.value = state.source; rhFilterSource = state.source; }
  }
  if (state.model || state.source) {
    drawLeaderboard();
    renderRunHistory(window._runHistoryData || []);
  }
}

/* ── Export buttons ──────────────────────────────────────────── */
function setupExportButtons() {
  const lbBtn = $('#lb-export-csv');
  if (lbBtn) {
    lbBtn.addEventListener('click', () => {
      const headers = ['Rank', 'Model', 'Source', 'Score', 'Status', 'Tag Coverage %', 'Missing Tags', 'W3C Errors', 'Axe Violations', 'Pa11y Issues', 'QualWeb Issues', 'Similarity %', 'Similar To', 'Iterations', 'Run ID', 'Timestamp'];
      const rows = lbData.map(r => [
        r.rank, r.model, r.providerLabel || r.source, (r.score ?? 0).toFixed(1),
        r.status, r.tag_coverage_pct, r.html_tag_errors, r.w3c_errors,
        r.axe_violations, r.pa11y_issues ?? 0, r.qualweb_issues ?? 0,
        r.similarity_pct ?? '', r.similar_to_run ? `${r.similar_to_model} / ${r.similar_to_run}` : '',
        r.iterations_used, r.run_id, r.timestamp || ''
      ]);
      downloadCSV('leaderboard.csv', headers, rows);
    });
  }

  const rhBtn = $('#rh-export-csv');
  if (rhBtn) {
    rhBtn.addEventListener('click', () => {
      const headers = ['Model', 'Source', 'Run ID', 'Score', 'Status', 'Iterations', 'Missing Tags', 'W3C Errors', 'Axe Violations', 'Pa11y Issues', 'QualWeb Issues', 'Timestamp'];
      const rows = (window._runHistoryData || []).map(r => [
        r.model, r.providerLabel || r.source, r.run_id, (r.final_score ?? 0).toFixed(1),
        r.status, r.total_iterations, r.final_html_errors, r.final_w3c_errors,
        r.final_axe_violations, r.final_pa11y_issues ?? 0, r.final_qualweb_issues ?? 0,
        r.timestamp || ''
      ]);
      downloadCSV('run_history.csv', headers, rows);
    });
  }
}

document.addEventListener('DOMContentLoaded', main);