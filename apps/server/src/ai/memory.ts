import { and, desc, eq, sql } from 'drizzle-orm'
import type Anthropic from '@anthropic-ai/sdk'
import { db } from '../db'
import { aiMessages, aiUserFacts } from '../db/schema'

/**
 * "Trí nhớ" NGẮN HẠN của chatbot (lịch sử hội thoại). Trí nhớ dài hạn ở cuối file.
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

// ═══════════════════════════════════════════════════════════
// Trí nhớ DÀI HẠN — những điều người dùng dặn "nhớ là…"
// ═══════════════════════════════════════════════════════════

/** Giới hạn để phần "điều cần nhớ" trong system prompt luôn nhỏ gọn. */
export const MAX_FACTS_PER_USER = 50
export const MAX_FACT_LENGTH = 300

export interface UserFact {
  id: string
  content: string
}

export function loadFacts(profileId: string): UserFact[] {
  return db.select({ id: aiUserFacts.id, content: aiUserFacts.content })
    .from(aiUserFacts)
    .where(eq(aiUserFacts.userId, profileId))
    .orderBy(sql`rowid`)
    .all()
}

export function countFacts(profileId: string): number {
  return db.select({ count: sql<number>`count(*)` }).from(aiUserFacts)
    .where(eq(aiUserFacts.userId, profileId)).get()?.count ?? 0
}

export function addFact(profileId: string, content: string): UserFact {
  return db.insert(aiUserFacts).values({ userId: profileId, content })
    .returning({ id: aiUserFacts.id, content: aiUserFacts.content }).get()
}

/** Xóa 1 điều đã nhớ — luôn lọc theo userId để không xóa nhầm của người khác. */
export function deleteFact(profileId: string, factId: string): UserFact | null {
  return db.delete(aiUserFacts)
    .where(and(eq(aiUserFacts.userId, profileId), eq(aiUserFacts.id, factId)))
    .returning({ id: aiUserFacts.id, content: aiUserFacts.content }).get() ?? null
}
