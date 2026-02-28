/* ═══════════════════════════════════════════════════════════
   Personal Finance — Chart Initializers (Chart.js 4)
   ═══════════════════════════════════════════════════════════ */

const chartInstances = {};

/** Tạo hoặc tái tạo một biểu đồ Chart.js */
function safeChart(id, config) {
  if (chartInstances[id]) chartInstances[id].destroy();
  const ctx = document.getElementById(id);
  if (!ctx) return;
  chartInstances[id] = new Chart(ctx, config);
}

/* ─── DASHBOARD ───────────────────────────────────────────── */
function initDashboardCharts() {
  // Biểu đồ bar: thu chi 6 tháng
  safeChart('dashChart', {
    type: 'bar',
    data: {
      labels: MONTHS_6,
      datasets: [
        { label: 'Thu nhập', data: INCOME_6,  backgroundColor: 'rgba(22,163,74,.8)', borderRadius: 4 },
        { label: 'Chi tiêu', data: EXPENSE_6, backgroundColor: 'rgba(220,38,38,.7)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => (v / 1000000) + 'M' }, grid: { color: 'rgba(0,0,0,.05)' } },
      },
    },
  });

  // Mini line chart: Net Worth
  safeChart('networthMiniChart', {
    type: 'line',
    data: {
      labels: MONTHS_6,
      datasets: [{
        data: NETWORTH_6,
        borderColor: '#ffffff', backgroundColor: 'rgba(255,255,255,.15)',
        fill: true, tension: .4, pointRadius: 0,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } },
    },
  });

  // Giao dịch gần đây (5 cái tháng 2)
  const rec = TRANSACTIONS.filter(t => t.month === 2).slice(0, 5);
  document.getElementById('recentTxList').innerHTML = rec.map(t => `
    <div class="tx-item">
      <div class="tx-cat-icon" style="background:${t.color}22">${t.icon}</div>
      <div class="tx-info">
        <div class="tx-name">${t.cat}</div>
        <div class="tx-note">${t.note}</div>
      </div>
      <div class="tx-amount" style="color:${t.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
        ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
      </div>
    </div>`).join('');

  // Top 5 khoản chi lớn nhất
  const expenses  = TRANSACTIONS.filter(t => t.type === 'expense' && t.month === 2)
                                .sort((a, b) => b.amount - a.amount).slice(0, 5);
  const totalExp  = expenses.reduce((s, t) => s + t.amount, 0);
  document.getElementById('topExpList').innerHTML = expenses.map((t, i) => `
    <div class="top-tx-item">
      <div class="top-tx-rank">${i + 1}</div>
      <div class="top-tx-info">
        <div class="top-tx-name">${t.icon} ${t.note}</div>
        <div class="top-tx-cat">${t.cat}</div>
      </div>
      <div>
        <div class="top-tx-amount">${fmt(t.amount)}</div>
        <div style="font-size:10px;color:var(--text2);text-align:right">${Math.round(t.amount / totalExp * 100)}%</div>
      </div>
    </div>`).join('');

  // Budget mini list trên Dashboard
  const dashBudget = document.getElementById('dashBudgetList');
  dashBudget.innerHTML = BUDGETS.slice(0, 4).map(b => {
    const pct = Math.round(b.spent / b.limit * 100);
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'safe';
    return `
      <div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px">
          <span>${b.icon} ${b.cat}</span>
          <span class="${pct >= 100 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-success'}">${pct}%</span>
        </div>
        <div class="progress-wrap"><div class="progress-bar ${cls}" style="width:${Math.min(pct, 100)}%"></div></div>
      </div>`;
  }).join('');
}

/* ─── BUDGET PAGE ─────────────────────────────────────────── */
function initBudgetChart() {
  safeChart('budgetChart', {
    type: 'bar',
    data: {
      labels: BUDGETS.map(b => b.cat),
      datasets: [
        { label: 'Ngân sách', data: BUDGETS.map(b => b.limit), backgroundColor: 'rgba(79,70,229,.3)', borderRadius: 4 },
        {
          label: 'Thực tế',
          data: BUDGETS.map(b => b.spent),
          backgroundColor: BUDGETS.map(b => b.spent >= b.limit ? 'rgba(220,38,38,.8)' : 'rgba(22,163,74,.8)'),
          borderRadius: 4,
        },
      ],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 12 } } },
      scales: {
        x: { ticks: { callback: v => (v / 1000000) + 'M' } },
        y: { grid: { display: false } },
      },
    },
  });
}

/* ─── ASSETS PAGE ─────────────────────────────────────────── */
function initAssetCharts() {
  const assetTypes = ['Tiền mặt', 'Vàng', 'Cổ phiếu', 'Tiết kiệm'];
  const assetVals  = [53850000, 145000000, 195000000, 700000000];

  safeChart('assetPieChart', {
    type: 'doughnut',
    data: {
      labels: assetTypes,
      datasets: [{ data: assetVals, backgroundColor: ['#3b82f6', '#eab308', '#22c55e', '#8b5cf6'], borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 12 } } },
    },
  });

  safeChart('networthChart', {
    type: 'line',
    data: {
      labels: MONTHS_6,
      datasets: [{
        label: 'Net Worth',
        data: NETWORTH_6,
        borderColor: '#4f46e5', backgroundColor: 'rgba(79,70,229,.1)',
        fill: true, tension: .4, pointRadius: 3, pointBackgroundColor: '#4f46e5',
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => (v / 1000000000).toFixed(1) + 'B' } },
      },
    },
  });
}

/* ─── REPORTS PAGE ────────────────────────────────────────── */
function initReportCharts() {
  // Bar: tổng quan thu chi
  safeChart('reportBarChart', {
    type: 'bar',
    data: {
      labels: MONTHS_6,
      datasets: [
        { label: 'Thu nhập', data: INCOME_6,  backgroundColor: 'rgba(22,163,74,.8)', borderRadius: 4 },
        { label: 'Chi tiêu', data: EXPENSE_6, backgroundColor: 'rgba(220,38,38,.7)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => (v / 1000000) + 'M' } },
      },
    },
  });

  // Donut: chi tiêu theo danh mục
  const catLabels = ['Nhà ở', 'Ăn uống', 'Mua sắm', 'Di chuyển', 'Giải trí', 'Khác'];
  const catVals   = [5000000, 2030000, 1950000, 470000, 500000, 500000];
  const catColors = ['#eab308', '#ef4444', '#3b82f6', '#f97316', '#ec4899', '#94a3b8'];

  safeChart('reportPieChart', {
    type: 'doughnut',
    data: {
      labels: catLabels,
      datasets: [{ data: catVals, backgroundColor: catColors, borderWidth: 0, hoverOffset: 8 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 12 } } },
    },
  });

  const total = catVals.reduce((a, b) => a + b, 0);
  document.getElementById('catReportTable').innerHTML = catLabels.map((c, i) => `
    <tr>
      <td><span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${catColors[i]};margin-right:6px"></span>${c}</td>
      <td>${fmt(catVals[i])}</td>
      <td>${Math.round(catVals[i] / total * 100)}%</td>
    </tr>`).join('');

  // Line: xu hướng thu chi
  safeChart('trendChart', {
    type: 'line',
    data: {
      labels: MONTHS_6,
      datasets: [
        { label: 'Thu nhập', data: INCOME_6,  borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,.1)',  fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#16a34a' },
        { label: 'Chi tiêu', data: EXPENSE_6, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,.05)', fill: true, tension: .4, pointRadius: 4, pointBackgroundColor: '#dc2626' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => (v / 1000000) + 'M' } },
      },
    },
  });

  // Top transactions table
  const tops = TRANSACTIONS.filter(t => t.type === 'expense')
                           .sort((a, b) => b.amount - a.amount).slice(0, 10);
  document.getElementById('topTxTable').innerHTML = tops.map((t, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${t.icon} ${t.cat}</td>
      <td>${t.note}</td>
      <td>${t.date}</td>
      <td class="text-danger">-${fmt(t.amount)}</td>
    </tr>`).join('');

  // Bar: báo cáo năm
  safeChart('annualChart', {
    type: 'bar',
    data: {
      labels: MONTHS_12,
      datasets: [
        { label: 'Thu nhập', data: ANNUAL_INC, backgroundColor: 'rgba(22,163,74,.8)', borderRadius: 4 },
        { label: 'Chi tiêu', data: ANNUAL_EXP, backgroundColor: 'rgba(220,38,38,.7)', borderRadius: 4 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { font: { size: 12 }, boxWidth: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { ticks: { callback: v => (v / 1000000) + 'M' } },
      },
    },
  });

  // Annual summary table
  const annualRows = [
    { m: 'Tháng 1', inc: 14500000, exp: 9300000 },
    { m: 'Tháng 2', inc: 18000000, exp: 10450000 },
  ];
  document.getElementById('annualTable').innerHTML = annualRows.map(r => {
    const diff = r.inc - r.exp;
    return `
      <tr>
        <td>${r.m}</td>
        <td class="text-success">+${fmt(r.inc)}</td>
        <td class="text-danger">-${fmt(r.exp)}</td>
        <td style="color:${diff >= 0 ? 'var(--success)' : 'var(--danger)'};font-weight:600">${diff >= 0 ? '+' : '-'}${fmt(diff)}</td>
      </tr>`;
  }).join('');
}
