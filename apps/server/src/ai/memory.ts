import { desc, eq, sql } from 'drizzle-orm'
import type Anthropic from '@anthropic-ai/sdk'
import { db } from '../db'
import { aiMessages } from '../db/schema'

/**
 * "Trí nhớ" ngắn hạn của chatbot.
 *
 * API Claude là stateless: mỗi lần gọi, model chỉ biết những gì ta gửi lên.
 * Để bot hiểu "còn tháng trước thì sao?" ta lưu từng lượt chat vào DB và gửi lại
 * N tin gần nhất. Chỉ lưu TEXT cuối cùng (không lưu tool_use/tool_result) cho gọn.
 */
export function loadHistory(profileId: string, limit: number): Anthropic.Beta.BetaMessageParam[] {
  const rows = db.select({ role: aiMessages.role, content: aiMessages.content })
    .from(aiMessages)
    .where(eq(aiMessages.userId, profileId))
    // rowid = thứ tự chèn; created_at chỉ chính xác tới giây nên không đủ để sắp xếp.
    .orderBy(desc(sql`rowid`))
    .limit(limit)
    .all()
    .reverse()

  // Tin đầu tiên gửi lên API phải là của user.
  while (rows.length > 0 && rows[0].role !== 'user') rows.shift()

  return rows.map((row) => ({ role: row.role as 'user' | 'assistant', content: row.content }))
}

export function saveTurn(profileId: string, userText: string, assistantText: string, channel = 'zalo'): void {
  db.transaction((tx) => {
    tx.insert(aiMessages).values({ userId: profileId, role: 'user', content: userText, channel }).run()
    tx.insert(aiMessages).values({ userId: profileId, role: 'assistant', content: assistantText, channel }).run()
  })
}

export function clearHistory(profileId: string): void {
  db.delete(aiMessages).where(eq(aiMessages.userId, profileId)).run()
}
