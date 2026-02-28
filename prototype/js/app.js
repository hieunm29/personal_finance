/* ═══════════════════════════════════════════════════════════
   Personal Finance — App Logic (Navigation, Modals, Theme)
   ═══════════════════════════════════════════════════════════ */

/* ─── PAGE TITLES ─────────────────────────────────────────── */
const pageTitles = {
  dashboard:    'Dashboard',
  transactions: 'Giao dịch',
  categories:   'Danh mục',
  budget:       'Ngân sách',
  assets:       'Tài sản',
  reports:      'Báo cáo',
  settings:     'Cài đặt',
};

/* ─── NAVIGATION ──────────────────────────────────────────── */
function navigate(page) {
  // Ẩn tất cả page
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Deactivate nav items
  document.querySelectorAll('.nav-item, .bnav-item').forEach(n => n.classList.remove('active'));
  // Hiển thị page được chọn
  document.getElementById('page-' + page).classList.add('active');
  // Activate nav items
  document.querySelectorAll(`[data-page="${page}"]`).forEach(n => n.classList.add('active'));
  // Update page title
  document.getElementById('pageTitle').textContent = pageTitles[page] || page;

  // Khởi tạo dữ liệu/biểu đồ cho từng trang
  switch (page) {
    case 'budget':       renderBudget();    setTimeout(initBudgetChart,  50); break;
    case 'assets':       renderAssets();    setTimeout(initAssetCharts,  50); break;
    case 'categories':   renderCategories('expense'); break;
    case 'reports':                         setTimeout(initReportCharts, 50); break;
    case 'settings':     renderSettings();  break;
  }
}

// Bind sidebar nav
document.querySelectorAll('.nav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

// Bind bottom nav
document.querySelectorAll('.bnav-item[data-page]').forEach(item => {
  item.addEventListener('click', () => navigate(item.dataset.page));
});

/* ─── DARK MODE ───────────────────────────────────────────── */
function toggleDark() {
  const html   = document.documentElement;
  const isDark = html.getAttribute('data-theme') === 'dark';
  html.setAttribute('data-theme', isDark ? '' : 'dark');
  const cb = document.getElementById('darkCheckbox');
  if (cb) cb.checked = !isDark;
}

function toggleDarkFromCheckbox(cb) {
  document.documentElement.setAttribute('data-theme', cb.checked ? 'dark' : '');
}

/* ─── MODALS ──────────────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'addTxModal') {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('txDate').value = today;
  }
}

function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}

// Đóng modal khi click ra ngoài
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});

// Đóng modal bằng phím Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-overlay.open').forEach(o => o.classList.remove('open'));
  }
});

/* ─── TRANSACTION FORM ────────────────────────────────────── */
let currentTxType = 'expense';

function setTxType(type, el) {
  currentTxType = type;
  const parent = el.closest('.type-toggle');
  parent.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function saveTx() {
  const amount = document.getElementById('txAmount').value;
  const cat    = document.getElementById('txCat').value;
  const date   = document.getElementById('txDate').value;
  if (!amount || amount <= 0) { alert('Vui lòng nhập số tiền hợp lệ.'); return; }
  closeModal('addTxModal');
  alert(`✅ Đã lưu giao dịch:\nLoại: ${currentTxType === 'income' ? 'Thu nhập' : 'Chi tiêu'}\nDanh mục: ${cat}\nSố tiền: ${fmt(Number(amount))}\nNgày: ${date}`);
}

/* ─── INIT ────────────────────────────────────────────────── */
(function init() {
  // Default date
  const today     = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('txDate');
  if (dateInput) dateInput.value = today;

  // Transactions page (default filter: tháng 2)
  filterTransactions();

  // Dashboard là trang đầu
  initDashboardCharts();
})();
