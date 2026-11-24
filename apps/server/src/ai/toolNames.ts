/**
 * Tên các tool, tách riêng để guard.ts và tools/index.ts dùng chung mà không kéo theo DB.
 * Thêm tool mới thì thêm tên vào đúng nhóm: tool GHI (đổi dữ liệu) bị bỏ khỏi các lượt chỉ-đề-xuất.
 */
export const READ_TOOL_NAMES = new Set(['search_transactions', 'get_monthly_summary', 'get_budget_status', 'get_net_worth'])

export const WRITE_TOOL_NAMES = new Set(['create_transaction', 'create_transfer', 'undo_last_action', 'remember_fact', 'forget_fact'])
