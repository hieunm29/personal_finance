/**
 * Tiêu đề hiển thị của một ghi chú = dòng đầu tiên có nội dung.
 * Ghi chú hóa đơn do trợ lý AI ghi có dạng "Cửa hàng\nMón 1: 60.000\nMón 2: …" → tiêu đề chỉ là
 * tên cửa hàng; toàn bộ danh sách món vẫn xem được ở ô Ghi chú trong chi tiết giao dịch.
 */
export function noteTitle(note: string | null | undefined): string {
  if (!note) return ''
  return note.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? ''
}
