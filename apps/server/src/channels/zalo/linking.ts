import { and, eq, gt, lt } from 'drizzle-orm'
import { db } from '../../db'
import { zaloLinkCodes, zaloLinks } from '../../db/schema'
import { getAuthUserIdByProfile, getProfileIdByAuthUser } from '../../ai/userContext'

const CODE_TTL_MS = 10 * 60 * 1000
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // bỏ ký tự dễ nhầm: 0/O, 1/I

function randomCode(length = 6): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
}

/** Web app gọi để lấy mã; người dùng gửi `/link <mã>` cho bot Zalo. */
export function createLinkCode(authUserId: string): { code: string; expiresAt: string } {
  const profileId = getProfileIdByAuthUser(authUserId)
  const now = new Date()
  // Mỗi user chỉ giữ 1 mã còn hiệu lực; dọn mã đã hết hạn của mọi người.
  db.delete(zaloLinkCodes).where(eq(zaloLinkCodes.userId, profileId)).run()
  db.delete(zaloLinkCodes).where(lt(zaloLinkCodes.expiresAt, now.toISOString())).run()
  const code = randomCode()
  const expiresAt = new Date(now.getTime() + CODE_TTL_MS).toISOString()
  db.insert(zaloLinkCodes).values({ code, userId: profileId, expiresAt }).run()
  return { code, expiresAt }
}

export type LinkResult = { ok: true } | { ok: false; reason: 'invalid_code' | 'already_linked_other' }

/** Webhook gọi khi nhận `/link <mã>`. */
export function consumeLinkCode(code: string, zaloUserId: string, displayName?: string): LinkResult {
  const row = db.select().from(zaloLinkCodes)
    .where(and(eq(zaloLinkCodes.code, code.trim().toUpperCase()), gt(zaloLinkCodes.expiresAt, new Date().toISOString())))
    .get()
  if (!row) return { ok: false, reason: 'invalid_code' }

  const existing = db.select().from(zaloLinks).where(eq(zaloLinks.zaloUserId, zaloUserId)).get()
  if (existing && existing.userId !== row.userId) return { ok: false, reason: 'already_linked_other' }

  db.transaction((tx) => {
    // Một hồ sơ app ↔ một tài khoản Zalo: xóa liên kết cũ của hồ sơ này (nếu có).
    tx.delete(zaloLinks).where(eq(zaloLinks.userId, row.userId)).run()
    tx.insert(zaloLinks).values({ userId: row.userId, zaloUserId, displayName: displayName ?? null }).run()
    tx.delete(zaloLinkCodes).where(eq(zaloLinkCodes.code, row.code)).run()
  })
  return { ok: true }
}

/** Tra authUserId từ Zalo user id. null = chưa liên kết. */
export function findAuthUserByZaloId(zaloUserId: string): string | null {
  const link = db.select({ userId: zaloLinks.userId }).from(zaloLinks).where(eq(zaloLinks.zaloUserId, zaloUserId)).get()
  return link ? getAuthUserIdByProfile(link.userId) : null
}

export function getLinkStatus(authUserId: string) {
  const profileId = getProfileIdByAuthUser(authUserId)
  const link = db.select({ displayName: zaloLinks.displayName, createdAt: zaloLinks.createdAt })
    .from(zaloLinks).where(eq(zaloLinks.userId, profileId)).get()
  return link ? { linked: true as const, ...link } : { linked: false as const }
}

export function unlink(authUserId: string): void {
  db.delete(zaloLinks).where(eq(zaloLinks.userId, getProfileIdByAuthUser(authUserId))).run()
}

export function unlinkByZaloId(zaloUserId: string): void {
  db.delete(zaloLinks).where(eq(zaloLinks.zaloUserId, zaloUserId)).run()
}
