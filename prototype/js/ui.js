/* ═══════════════════════════════════════════════════════════
   Personal Finance — UI Rendering Functions
   ═══════════════════════════════════════════════════════════ */

/* ─── TRANSACTIONS ────────────────────────────────────────── */
function renderTransactions(txs) {
  const wrap = document.getElementById('txListWrap');
  if (!txs.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Không tìm thấy giao dịch nào</p></div>';
    return;
  }
  // Nhóm theo ngày
  const grouped = {};
  txs.forEach(t => { (grouped[t.date] = grouped[t.date] || []).push(t); });

  wrap.innerHTML = Object.entries(grouped)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, items]) => {
      const d       = new Date(date + 'T00:00:00');
      const dayStr  = d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
      const daily   = items.reduce((s, t) => s + (t.type === 'income' ? t.amount : -t.amount), 0);
      return `
        <div class="tx-group-date" style="display:flex;justify-content:space-between">
          <span>${dayStr}</span>
          <span style="color:${daily >= 0 ? 'var(--success)' : 'var(--danger)'}">
            ${daily >= 0 ? '+' : '-'}${fmt(daily)}
          </span>
        </div>
        ${items.map(t => `
          <div class="tx-item" onclick="openEditTxModal(${t.id})">
            <div class="tx-cat-icon" style="background:${t.color}22">${t.icon}</div>
            <div class="tx-info">
              <div class="tx-name">${t.cat}</div>
              <div class="tx-note">${t.note}</div>
            </div>
            <div style="text-align:right">
              <div class="tx-amount" style="color:${t.type === 'income' ? 'var(--success)' : 'var(--danger)'}">
                ${t.type === 'income' ? '+' : '-'}${fmt(t.amount)}
              </div>
              <div style="font-size:11px;color:var(--text3)">${t.type === 'income' ? 'Thu nhập' : 'Chi tiêu'}</div>
            </div>
          </div>`).join('')}`;
    }).join('');
}

function filterTransactions() {
  const q     = (document.getElementById('txSearch').value || '').toLowerCase();
  const type  = document.getElementById('txTypeFilter').value;
  const cat   = document.getElementById('txCatFilter').value;
  const month = document.getElementById('txMonthFilter').value;

  renderTransactions(TRANSACTIONS.filter(t =>
    (!q     || t.note.toLowerCase().includes(q) || t.cat.toLowerCase().includes(q)) &&
    (!type  || t.type === type) &&
    (!cat   || t.cat === cat) &&
    (!month || t.month === parseInt(month))
  ));
}

/* ─── CATEGORIES ──────────────────────────────────────────── */
let currentCatTab = 'expense';

function switchCatTab(type, el) {
  currentCatTab = type;
  document.querySelectorAll('#catTabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderCategories(type);
}

function renderCategories(type) {
  const groups = CATEGORIES[type];
  const wrap   = document.getElementById('catListWrap');
  wrap.innerHTML = Object.entries(groups).map(([group, cats]) => `
    <div class="cat-group-title">${group}</div>
    ${cats.map(c => `
      <div class="cat-item">
        <div class="cat-color-dot" style="background:${c.color}"></div>
        <span style="font-size:20px">${c.icon}</span>
        <div class="cat-label">${c.name}</div>
        <div class="cat-actions">
          <button class="btn-icon btn-sm" title="Sửa" onclick="alert('Sửa: ${c.name}')">✏️</button>
          <button class="btn-icon btn-sm" title="Ẩn/Hiện" onclick="this.style.opacity=this.style.opacity==='0.4'?'1':'0.4'">👁️</button>
          <button class="btn-icon btn-sm" title="Xóa" onclick="if(confirm('Xóa danh mục \\'${c.name}\\'?'))this.closest('.cat-item').remove()">🗑️</button>
        </div>
      </div>`).join('')}`).join('');
}

/* ─── BUDGET ──────────────────────────────────────────────── */
function renderBudget() {
  const wrap = document.getElementById('budgetList');
  wrap.innerHTML = BUDGETS.map(b => {
    const pct = Math.round(b.spent / b.limit * 100);
    const cls = pct >= 100 ? 'over' : pct >= 80 ? 'warn' : 'safe';
    return `
      <div class="budget-item">
        <div class="budget-header">
          <span>${b.icon} ${b.cat}</span>
          <div>
            <span style="color:${b.spent >= b.limit ? 'var(--danger)' : 'var(--text)'}">${fmt(b.spent)}</span>
            <span class="text-muted"> / ${fmt(b.limit)}</span>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar ${cls}" style="width:${Math.min(pct, 100)}%"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:3px">
          <span class="budget-numbers">Còn lại: ${fmt(Math.max(0, b.limit - b.spent))}</span>
          <span class="budget-numbers ${pct >= 100 ? 'text-danger' : pct >= 80 ? 'text-warning' : 'text-success'}">${pct}%</span>
        </div>
      </div>`;
  }).join('');
}

/* ─── ASSETS ──────────────────────────────────────────────── */
let currentAssetTab = 'cash';

function switchAssetTab(type, el) {
  currentAssetTab = type;
  document.querySelectorAll('#assetTabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  renderAssetList(type);
}

function renderAssets() { renderAssetList('cash'); }

function renderAssetList(type) {
  const items = ASSETS[type] || [];
  const wrap  = document.getElementById('assetListWrap');
  if (!items.length) {
    wrap.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><p>Chưa có tài sản nào</p></div>';
    return;
  }
  wrap.innerHTML = items.map(a => `
    <div class="asset-item">
      <div class="asset-icon" style="background:${a.bg}">${a.icon}</div>
      <div class="asset-info">
        <div class="asset-name">${a.name}</div>
        <div class="asset-sub">${a.note}</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:15px;font-weight:700;color:${a.isDebt ? 'var(--danger)' : 'var(--text)'}">
          ${a.isDebt ? '-' : ''}${fmt(a.value)}
        </div>
        <div style="display:flex;gap:4px;justify-content:flex-end;margin-top:4px">
          <button class="btn-icon btn-sm" title="Cập nhật giá" onclick="alert('Cập nhật giá: ${a.name}')">🔄</button>
          <button class="btn-icon btn-sm" title="Sửa"          onclick="alert('Sửa: ${a.name}')">✏️</button>
        </div>
      </div>
    </div>`).join('');
}

/* ─── SETTINGS ────────────────────────────────────────────── */
function renderSettings() {
  const wrap = document.getElementById('walletList');
  wrap.innerHTML = WALLETS.map(w => `
    <div class="wallet-item">
      <div class="wallet-icon" style="background:${w.bg}">${w.icon}</div>
      <div class="wallet-info">
        <div class="wallet-name">
          ${w.name}
          ${w.isDefault ? '<span class="wallet-default">✓ Mặc định</span>' : ''}
        </div>
        <div class="wallet-balance">${fmt(w.balance)}</div>
      </div>
      <div style="display:flex;gap:4px">
        <button class="btn-icon btn-sm" title="Sửa"  onclick="alert('Sửa ví: ${w.name}')">✏️</button>
        <button class="btn-icon btn-sm" title="Xóa"  onclick="if(confirm('Xóa ví \\'${w.name}\\'?'))this.closest('.wallet-item').remove()">🗑️</button>
      </div>
    </div>`).join('');
}

/* ─── REPORT TABS ─────────────────────────────────────────── */
function switchReportTab(tab, el) {
  document.querySelectorAll('#reportTabs .tab').forEach(t => t.classList.remove('active'));
  el.classList.add('active');
  ['overview', 'category', 'trend', 'annual'].forEach(t => {
    document.getElementById('report-' + t).style.display = (t === tab) ? '' : 'none';
  });
}

function setPeriod(el) {
  // Chỉ xử lý trong cùng nhóm period-btns
  el.closest('.period-btns').querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

/* ─── EDIT TRANSACTION (stub) ─────────────────────────────── */
function openEditTxModal(id) {
  const tx = TRANSACTIONS.find(t => t.id === id);
  if (!tx) return;
  alert(`Chi tiết giao dịch #${tx.id}:\n${tx.cat} — ${tx.note}\nSố tiền: ${fmt(tx.amount)}\nNgày: ${tx.date}`);
}
