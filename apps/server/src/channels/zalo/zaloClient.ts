/**
 * Client tối giản cho Zalo Bot Platform API.
 * Tài liệu: https://bot.zapps.me/docs — URL dạng https://bot-api.zaloplatforms.com/bot<TOKEN>/<method>
 */
const MAX_TEXT_LENGTH = 2000 // giới hạn của sendMessage

function apiUrl(method: string): string {
  const token = process.env.ZALO_BOT_TOKEN
  if (!token) throw new Error('ZALO_BOT_TOKEN chưa được cấu hình')
  const base = process.env.ZALO_API_BASE || 'https://bot-api.zaloplatforms.com'
  return `${base}/bot${token}/${method}`
}

async function callApi<T = unknown>(method: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(apiUrl(method), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => null)) as { ok?: boolean; result?: T; description?: string } | null
  if (!response.ok || !data?.ok) {
    throw new Error(`Zalo API ${method} lỗi: HTTP ${response.status} ${data?.description ?? ''}`.trim())
  }
  return data.result as T
}

/** Cắt tin dài thành nhiều phần ≤ 2000 ký tự, ưu tiên cắt ở xuống dòng. */
export function splitMessage(text: string, max = MAX_TEXT_LENGTH): string[] {
  const parts: string[] = []
  let rest = text.trim()
  while (rest.length > max) {
    const cut = rest.lastIndexOf('\n', max)
    const index = cut > max / 2 ? cut : max
    parts.push(rest.slice(0, index).trim())
    rest = rest.slice(index).trim()
  }
  if (rest) parts.push(rest)
  return parts
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  for (const part of splitMessage(text)) {
    await callApi('sendMessage', { chat_id: chatId, text: part })
  }
}

/** Hiện trạng thái "đang soạn tin..." trong lúc AI xử lý. Lỗi ở đây không quan trọng. */
export async function sendTyping(chatId: string): Promise<void> {
  await callApi('sendChatAction', { chat_id: chatId, action: 'typing' }).catch(() => undefined)
}

export async function setWebhook(url: string, secretToken: string): Promise<unknown> {
  return callApi('setWebhook', { url, secret_token: secretToken })
}

export async function getMe(): Promise<unknown> {
  return callApi('getMe', {})
}
