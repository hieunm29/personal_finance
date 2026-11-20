import { Hono } from 'hono'
import { timingSafeEqual } from 'node:crypto'
import { db } from '../../db'
import { zaloProcessedMessages } from '../../db/schema'
import { runAgent as defaultRunAgent } from '../../ai/agent'
import { clearHistory } from '../../ai/memory'
import { getProfileIdByAuthUser } from '../../ai/userContext'
import { consumeLinkCode, findAuthUserByZaloId, unlinkByZaloId } from './linking'
import { sendMessage as defaultSendMessage, sendTyping as defaultSendTyping } from './zaloClient'

/** Payload Zalo gửi tới webhook (chỉ các trường ta dùng). */
interface ZaloUpdate {
  event_name?: string
  message?: {
    message_id?: string
    text?: string
    from?: { id?: string; display_name?: string; is_bot?: boolean }
    chat?: { id?: string; chat_type?: string }
  }
}

export interface ZaloWebhookDeps {
  runAgent: (input: { authUserId: string; text: string; channel?: string }) => Promise<string>
  sendMessage: (chatId: string, text: string) => Promise<void>
  sendTyping: (chatId: string) => Promise<void>
  secret: () => string | undefined
}

const HELP_TEXT = [
  'Chào bạn! Mình là trợ lý tài chính 💰',
  'Bạn có thể nhắn như:',
  '• "mua cà phê 45k"',
  '• "nhận lương 20 triệu"',
  '• "tháng này tiêu bao nhiêu?"',
  '• "tổng tài sản của tôi"',
  '• "hoàn tác" để xóa giao dịch vừa ghi',
  '',
  'Lệnh: /reset xóa trí nhớ hội thoại, /unlink hủy liên kết.',
].join('\n')

const NOT_LINKED_TEXT = [
  'Tài khoản Zalo này chưa liên kết với ứng dụng.',
  'Vào web → Cài đặt → Liên kết Zalo để lấy mã, rồi gửi: /link MÃ_CỦA_BẠN',
].join('\n')

function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a)
  const right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}

/** Trả true nếu message_id này CHƯA từng xử lý (và đánh dấu đã xử lý). */
function markProcessed(messageId: string): boolean {
  try {
    db.insert(zaloProcessedMessages).values({ messageId }).run()
    return true
  } catch {
    return false // trùng khóa chính → Zalo gửi lại webhook cũ
  }
}

export function createZaloWebhook(overrides: Partial<ZaloWebhookDeps> = {}) {
  const deps: ZaloWebhookDeps = {
    runAgent: defaultRunAgent,
    sendMessage: defaultSendMessage,
    sendTyping: defaultSendTyping,
    secret: () => process.env.ZALO_WEBHOOK_SECRET,
    ...overrides,
  }

  // Hàng đợi tuần tự theo từng người gửi: tin sau chờ tin trước xử lý xong.
  const queues = new Map<string, Promise<void>>()
  const enqueue = (key: string, job: () => Promise<void>) => {
    const next = (queues.get(key) ?? Promise.resolve()).then(job).catch((error) => {
      console.error('[zalo] xử lý tin nhắn lỗi', error)
    })
    queues.set(key, next)
    void next.finally(() => {
      if (queues.get(key) === next) queues.delete(key)
    })
  }

  async function handleText(zaloUserId: string, chatId: string, displayName: string | undefined, rawText: string) {
    const text = rawText.trim()
    const [command, ...args] = text.split(/\s+/)
    const lowerCommand = command.toLowerCase()

    if (lowerCommand === '/link') {
      const result = consumeLinkCode(args[0] ?? '', zaloUserId, displayName)
      const reply = result.ok
        ? 'Liên kết thành công! 🎉\n\n' + HELP_TEXT
        : result.reason === 'invalid_code'
          ? 'Mã không đúng hoặc đã hết hạn (10 phút). Hãy lấy mã mới trên web.'
          : 'Tài khoản Zalo này đang liên kết với người dùng khác. Gửi /unlink trước nếu muốn đổi.'
      return deps.sendMessage(chatId, reply)
    }

    const authUserId = findAuthUserByZaloId(zaloUserId)
    if (!authUserId) return deps.sendMessage(chatId, NOT_LINKED_TEXT)

    if (lowerCommand === '/start' || lowerCommand === '/help') return deps.sendMessage(chatId, HELP_TEXT)
    if (lowerCommand === '/unlink') {
      unlinkByZaloId(zaloUserId)
      return deps.sendMessage(chatId, 'Đã hủy liên kết. Dữ liệu trên web vẫn được giữ nguyên.')
    }
    if (lowerCommand === '/reset') {
      clearHistory(getProfileIdByAuthUser(authUserId))
      return deps.sendMessage(chatId, 'Đã xóa trí nhớ hội thoại.')
    }

    await deps.sendTyping(chatId)
    const reply = await deps.runAgent({ authUserId, text, channel: 'zalo' })
    await deps.sendMessage(chatId, reply)
  }

  const route = new Hono()

  route.post('/', async (c) => {
    // 1. Xác thực: chỉ Zalo (biết secret) mới gọi được webhook này.
    const expected = deps.secret()
    const received = c.req.header('x-bot-api-secret-token') ?? ''
    if (!expected || !safeEqual(received, expected)) return c.json({ ok: false }, 401)

    const update = (await c.req.json().catch(() => null)) as ZaloUpdate | null
    const message = update?.message
    const zaloUserId = message?.from?.id
    const chatId = message?.chat?.id ?? zaloUserId
    if (!message || !zaloUserId || !chatId || message.from?.is_bot) return c.json({ ok: true })

    // 2. Chống trùng: Zalo có thể gửi lại cùng 1 tin nếu lần trước phản hồi chậm.
    if (message.message_id && !markProcessed(message.message_id)) return c.json({ ok: true, duplicate: true })

    // 3. Xử lý NỀN rồi trả 200 ngay — gọi AI mất vài giây, không để Zalo phải chờ.
    if (update?.event_name === 'message.text.received' && message.text) {
      enqueue(zaloUserId, () => handleText(zaloUserId, chatId, message.from?.display_name, message.text!))
    } else {
      enqueue(zaloUserId, () => deps.sendMessage(chatId, 'Hiện mình chỉ hiểu tin nhắn văn bản thôi 🙏'))
    }
    return c.json({ ok: true })
  })

  /** Dùng trong test: chờ mọi tin nhắn đang xếp hàng xử lý xong. */
  const waitIdle = async () => {
    while (queues.size > 0) await Promise.all([...queues.values()])
  }

  return { route, waitIdle }
}
