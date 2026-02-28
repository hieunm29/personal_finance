/* ═══════════════════════════════════════════════════════════
   Personal Finance — Sample Data
   ═══════════════════════════════════════════════════════════ */

/* ─── FORMAT HELPER ───────────────────────────────────────── */
const fmt = n => new Intl.NumberFormat('vi-VN').format(Math.abs(n)) + ' đ';

/* ─── CATEGORIES ──────────────────────────────────────────── */
const CATEGORIES = {
  expense: {
    'Thiết yếu': [
      { id: 'food',    name: 'Ăn uống',            icon: '🍜', color: '#ef4444' },
      { id: 'move',    name: 'Di chuyển',           icon: '🚗', color: '#f97316' },
      { id: 'home',    name: 'Nhà ở',               icon: '🏠', color: '#eab308' },
      { id: 'util',    name: 'Điện nước',           icon: '⚡', color: '#84cc16' },
      { id: 'health',  name: 'Y tế',                icon: '💊', color: '#22c55e' },
      { id: 'insure',  name: 'Bảo hiểm',            icon: '🛡️', color: '#06b6d4' },
    ],
    'Sinh hoạt': [
      { id: 'shop',    name: 'Mua sắm',             icon: '👕', color: '#3b82f6' },
      { id: 'edu',     name: 'Giáo dục',            icon: '📚', color: '#8b5cf6' },
      { id: 'personal',name: 'Chăm sóc cá nhân',   icon: '💆', color: '#d946ef' },
    ],
    'Giải trí': [
      { id: 'cafe',    name: 'Cafe/Ăn ngoài',       icon: '☕', color: '#f43f5e' },
      { id: 'entertain', name: 'Giải trí',          icon: '🎮', color: '#ec4899' },
      { id: 'travel',  name: 'Du lịch',             icon: '✈️', color: '#14b8a6' },
      { id: 'sport',   name: 'Thể thao',            icon: '⚽', color: '#10b981' },
    ],
    'Xã hội': [
      { id: 'gift',    name: 'Quà tặng',            icon: '🎁', color: '#f59e0b' },
      { id: 'charity', name: 'Từ thiện',            icon: '🤝', color: '#6366f1' },
    ],
  },
  income: {
    'Thu nhập chính': [
      { id: 'salary',     name: 'Lương',            icon: '💼', color: '#16a34a' },
      { id: 'bonus',      name: 'Thưởng',           icon: '🎉', color: '#15803d' },
      { id: 'allowance',  name: 'Phụ cấp',          icon: '📋', color: '#4ade80' },
    ],
    'Thu nhập phụ': [
      { id: 'freelance',  name: 'Freelance',        icon: '💻', color: '#0ea5e9' },
      { id: 'rental',     name: 'Cho thuê',         icon: '🏘️', color: '#38bdf8' },
    ],
    'Đầu tư': [
      { id: 'interest',   name: 'Lãi tiết kiệm',   icon: '🏛️', color: '#a78bfa' },
      { id: 'dividend',   name: 'Cổ tức',           icon: '📈', color: '#7c3aed' },
      { id: 'stock_profit', name: 'Lãi cổ phiếu',  icon: '💹', color: '#6d28d9' },
    ],
    'Khác': [
      { id: 'gift_in',    name: 'Được tặng',        icon: '🎀', color: '#f472b6' },
      { id: 'cashback',   name: 'Hoàn tiền',        icon: '💸', color: '#fb923c' },
    ],
  },
};

// Flat map: tên → category object
const catMap = {};
Object.values(CATEGORIES).forEach(groups =>
  Object.values(groups).forEach(cats =>
    cats.forEach(c => { catMap[c.name] = c; })
  )
);

/* ─── TRANSACTIONS (24 mẫu) ──────────────────────────────── */
const TRANSACTIONS = [
  // Tháng 2/2026
  { id:  1, type: 'income',  cat: 'Lương',          icon: '💼', color: '#16a34a', amount: 15000000, note: 'Lương tháng 2',     date: '2026-02-01', month: 2 },
  { id:  2, type: 'expense', cat: 'Nhà ở',           icon: '🏠', color: '#eab308', amount:  5000000, note: 'Tiền thuê nhà',    date: '2026-02-02', month: 2 },
  { id:  3, type: 'expense', cat: 'Ăn uống',         icon: '🍜', color: '#ef4444', amount:  1200000, note: 'Siêu thị',         date: '2026-02-03', month: 2 },
  { id:  4, type: 'income',  cat: 'Thưởng',          icon: '🎉', color: '#15803d', amount:  3000000, note: 'Thưởng dự án',     date: '2026-02-05', month: 2 },
  { id:  5, type: 'expense', cat: 'Di chuyển',       icon: '🚗', color: '#f97316', amount:   350000, note: 'Xăng xe',          date: '2026-02-06', month: 2 },
  { id:  6, type: 'expense', cat: 'Cafe/Ăn ngoài',   icon: '☕', color: '#f43f5e', amount:   280000, note: 'Cafe với bạn',     date: '2026-02-08', month: 2 },
  { id:  7, type: 'expense', cat: 'Mua sắm',         icon: '👕', color: '#3b82f6', amount:   750000, note: 'Quần áo',          date: '2026-02-10', month: 2 },
  { id:  8, type: 'expense', cat: 'Giải trí',        icon: '🎮', color: '#ec4899', amount:   200000, note: 'Game Steam',       date: '2026-02-11', month: 2 },
  { id:  9, type: 'expense', cat: 'Ăn uống',         icon: '🍜', color: '#ef4444', amount:   450000, note: 'Đặt đồ ăn',       date: '2026-02-13', month: 2 },
  { id: 10, type: 'income',  cat: 'Freelance',       icon: '💻', color: '#0ea5e9', amount:  2500000, note: 'Website project',  date: '2026-02-14', month: 2 },
  { id: 11, type: 'expense', cat: 'Y tế',            icon: '💊', color: '#22c55e', amount:   300000, note: 'Khám sức khỏe',   date: '2026-02-15', month: 2 },
  { id: 12, type: 'expense', cat: 'Giáo dục',        icon: '📚', color: '#8b5cf6', amount:   500000, note: 'Khóa học online',  date: '2026-02-16', month: 2 },
  { id: 13, type: 'expense', cat: 'Di chuyển',       icon: '🚗', color: '#f97316', amount:   120000, note: 'Grab',             date: '2026-02-18', month: 2 },
  { id: 14, type: 'expense', cat: 'Ăn uống',         icon: '🍜', color: '#ef4444', amount:   380000, note: 'Ăn tối gia đình', date: '2026-02-19', month: 2 },
  { id: 15, type: 'income',  cat: 'Lãi tiết kiệm',  icon: '🏛️', color: '#a78bfa', amount:   250000, note: 'Lãi TCB',         date: '2026-02-20', month: 2 },
  { id: 16, type: 'expense', cat: 'Quà tặng',        icon: '🎁', color: '#f59e0b', amount:   500000, note: 'Sinh nhật bạn',   date: '2026-02-21', month: 2 },
  { id: 17, type: 'expense', cat: 'Cafe/Ăn ngoài',   icon: '☕', color: '#f43f5e', amount:   220000, note: 'Lunch meeting',    date: '2026-02-23', month: 2 },
  { id: 18, type: 'expense', cat: 'Mua sắm',         icon: '👕', color: '#3b82f6', amount:  1200000, note: 'Giày mới',         date: '2026-02-25', month: 2 },
  { id: 19, type: 'expense', cat: 'Điện nước',       icon: '⚡', color: '#84cc16', amount:   400000, note: 'Điện tháng 2',    date: '2026-02-26', month: 2 },
  { id: 20, type: 'expense', cat: 'Thể thao',        icon: '⚽', color: '#10b981', amount:   300000, note: 'Phí gym tháng 2', date: '2026-02-27', month: 2 },
  // Tháng 1/2026
  { id: 21, type: 'income',  cat: 'Lương',           icon: '💼', color: '#16a34a', amount: 14500000, note: 'Lương tháng 1',   date: '2026-01-01', month: 1 },
  { id: 22, type: 'expense', cat: 'Nhà ở',           icon: '🏠', color: '#eab308', amount:  5000000, note: 'Tiền thuê nhà',   date: '2026-01-02', month: 1 },
  { id: 23, type: 'expense', cat: 'Ăn uống',         icon: '🍜', color: '#ef4444', amount:  1500000, note: 'Siêu thị Tết',    date: '2026-01-05', month: 1 },
  { id: 24, type: 'expense', cat: 'Du lịch',         icon: '✈️', color: '#14b8a6', amount:  3500000, note: 'Du lịch Tết',     date: '2026-01-10', month: 1 },
];

/* ─── BUDGETS ─────────────────────────────────────────────── */
const BUDGETS = [
  { cat: 'Ăn uống',    icon: '🍜', color: '#ef4444', limit: 3000000, spent: 2030000 },
  { cat: 'Di chuyển',  icon: '🚗', color: '#f97316', limit: 1500000, spent:  470000 },
  { cat: 'Giải trí',   icon: '🎮', color: '#ec4899', limit: 1000000, spent:  500000 },
  { cat: 'Mua sắm',    icon: '👕', color: '#3b82f6', limit: 2000000, spent: 1950000 },
  { cat: 'Nhà ở',      icon: '🏠', color: '#eab308', limit: 5000000, spent: 5000000 },
  { cat: 'Y tế',       icon: '💊', color: '#22c55e', limit:  500000, spent:  300000 },
];

/* ─── ASSETS ──────────────────────────────────────────────── */
const ASSETS = {
  cash: [
    { name: 'Tiền mặt',    icon: '💵', bg: '#dcfce7', value:  5350000, note: 'Ví cá nhân' },
    { name: 'Techcombank', icon: '🏦', bg: '#dbeafe', value: 47000000, note: 'Tài khoản thanh toán' },
    { name: 'MoMo',        icon: '📱', bg: '#fce7f3', value:  1500000, note: 'Ví điện tử' },
  ],
  gold: [
    { name: 'Vàng SJC',   icon: '🥇', bg: '#fef9c3', value: 120000000, note: '2 lượng · mua 59.5tr/lượng' },
    { name: 'Nhẫn vàng',  icon: '💍', bg: '#fef9c3', value:  25000000, note: '0.5 lượng' },
  ],
  stock: [
    { name: 'VNM', icon: '📈', bg: '#dcfce7', value:  45000000, note: '200 CP · giá TB 180.000đ' },
    { name: 'FPT', icon: '📈', bg: '#dbeafe', value: 120000000, note: '150 CP · giá TB 140.000đ' },
    { name: 'HPG', icon: '📈', bg: '#fee2e2', value:  30000000, note: '500 CP · giá TB 22.500đ' },
  ],
  savings: [
    { name: 'Tiết kiệm TCB', icon: '🏛️', bg: '#ede9fe', value: 500000000, note: '500tr · 7%/năm · đáo hạn 06/2026' },
    { name: 'Tiết kiệm VCB', icon: '🏛️', bg: '#dbeafe', value: 200000000, note: '200tr · 5.5%/năm · đáo hạn 12/2026' },
  ],
  debt: [
    { name: 'Vay mua xe', icon: '💳', bg: '#fee2e2', value: -200000000, note: 'Vay 250tr · đã trả 50tr · 7.5%/năm', isDebt: true },
  ],
};

/* ─── WALLETS ─────────────────────────────────────────────── */
const WALLETS = [
  { name: 'Tiền mặt',    icon: '💵', bg: '#dcfce7', balance:  5350000, isDefault: true  },
  { name: 'Techcombank', icon: '🏦', bg: '#dbeafe', balance: 47000000, isDefault: false },
  { name: 'MoMo',        icon: '📱', bg: '#fce7f3', balance:  1500000, isDefault: false },
];

/* ─── CHART SEED DATA ─────────────────────────────────────── */
const MONTHS_6     = ['T9', 'T10', 'T11', 'T12', 'T1', 'T2'];
const INCOME_6     = [12500000, 14000000, 14000000, 16000000, 17000000, 18000000];
const EXPENSE_6    = [ 8000000,  9500000, 11000000,  9000000,  9300000, 10450000];
const NETWORTH_6   = [1540000000, 1620000000, 1680000000, 1720000000, 1790000000, 1823500000];
const MONTHS_12    = ['T1','T2','T3','T4','T5','T6','T7','T8','T9','T10','T11','T12'];
const ANNUAL_INC   = [14500000, 18000000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const ANNUAL_EXP   = [ 9300000, 10450000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
