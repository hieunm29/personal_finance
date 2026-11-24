/**
 * Thử gửi tin Zalo CHỦ ĐỘNG (không phải trả lời) tới một người dùng đã liên kết.
 * Dùng để kiểm tra Zalo Bot có cho gửi khi người dùng không vừa nhắn hay không.
 *
 *   bun run zalo:send-test <email> ["nội dung"]
 *
 * Nên chạy sau khi đã ≥ 24 giờ không nhắn bot. Cần ZALO_BOT_TOKEN trong .env.
 */
import { eq } from 'drizzle-orm'
import { db } from '../src/db'
import { user, userProfiles, zaloLinks } from '../src/db/schema'
import { sendMessage } from '../src/channels/zalo/zaloClient'

const [email, ...rest] = process.argv.slice(2)
if (!email) {
  console.error('Cách dùng: bun run zalo:send-test <email> ["nội dung"]')
  process.exit(1)
}

const row = db
  .select({ zaloUserId: zaloLinks.zaloUserId, displayName: zaloLinks.displayName })
  .from(user)
  .innerJoin(userProfiles, eq(userProfiles.authUserId, user.id))
  .innerJoin(zaloLinks, eq(zaloLinks.userId, userProfiles.id))
  .where(eq(user.email, email))
  .get()

if (!row) {
  console.error(`Không thấy liên kết Zalo nào cho ${email} (đã liên kết ở trang Cài đặt chưa?)`)
  process.exit(1)
}

const text = rest.join(' ') || 'Tin thử từ Personal Finance: nếu bạn đọc được dòng này thì bot gửi chủ động được 👍'
console.log(`Gửi tới ${row.displayName ?? row.zaloUserId} (chat_id=${row.zaloUserId})…`)
try {
  await sendMessage(row.zaloUserId, text)
  console.log('✅ Gửi được. Zalo cho phép gửi tin chủ động.')
} catch (error) {
  console.error('❌ Gửi lỗi — Zalo có thể không cho gửi chủ động:', error instanceof Error ? error.message : error)
  process.exit(2)
}
