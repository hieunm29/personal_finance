/**
 * Đăng ký URL webhook với Zalo Bot Platform (chạy 1 lần, hoặc mỗi khi URL tunnel đổi).
 *   bun run zalo:webhook
 * Cần: ZALO_BOT_TOKEN, ZALO_WEBHOOK_SECRET, PUBLIC_BASE_URL trong .env
 */
import { getMe, setWebhook } from '../src/channels/zalo/zaloClient'

const base = process.env.PUBLIC_BASE_URL
const secret = process.env.ZALO_WEBHOOK_SECRET
if (!base || !secret) {
  console.error('Thiếu PUBLIC_BASE_URL hoặc ZALO_WEBHOOK_SECRET')
  process.exit(1)
}

const url = `${base.replace(/\/$/, '')}/webhooks/zalo`
console.log('Bot:', await getMe())
console.log('setWebhook →', url, await setWebhook(url, secret))
