/**
 * Chat thử với trợ lý AI ngay trên terminal, KHÔNG cần Zalo.
 *   bun run ai:chat <email> "mua cà phê 45k"
 * Gọi Claude thật (tốn phí theo token) và GHI vào DB thật của bạn.
 */
import { eq } from 'drizzle-orm'
import { runAgent } from '../src/ai/agent'
import { db } from '../src/db'
import { user } from '../src/db/schema'

const [email, ...words] = process.argv.slice(2)
const text = words.join(' ')
if (!email || !text) {
  console.error('Cách dùng: bun run ai:chat <email> "<tin nhắn>"')
  process.exit(1)
}

const account = db.select({ id: user.id }).from(user).where(eq(user.email, email)).get()
if (!account) {
  console.error(`Không tìm thấy user ${email}`)
  process.exit(1)
}

console.log(await runAgent({ authUserId: account.id, text, channel: 'cli' }))
