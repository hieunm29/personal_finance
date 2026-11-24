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

export type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

export interface DownloadedImage {
  mediaType: ImageMediaType
  base64: string
}

const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // Claude nhận tối đa ~5 MB mỗi ảnh
const IMAGE_DOWNLOAD_TIMEOUT_MS = 15_000

/** Nhận diện định dạng bằng "magic bytes" — không tin Content-Type do máy chủ ảnh tự khai. */
export function sniffImageType(bytes: Uint8Array): ImageMediaType | null {
  const startsWith = (...signature: number[]) => signature.every((byte, index) => bytes[index] === byte)
  if (startsWith(0xff, 0xd8, 0xff)) return 'image/jpeg'
  if (startsWith(0x89, 0x50, 0x4e, 0x47)) return 'image/png'
  if (startsWith(0x47, 0x49, 0x46, 0x38)) return 'image/gif'
  // WebP = "RIFF" + 4 byte độ dài + "WEBP" (cùng "RIFF" với wav/avi nên phải kiểm tra thêm)
  if (startsWith(0x52, 0x49, 0x46, 0x46) && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return 'image/webp'
  return null
}

/** Đọc thân phản hồi nhưng dừng ngay khi vượt `max` (không phụ thuộc Content-Length do máy chủ khai). */
async function readCapped(response: Response, max: number): Promise<Uint8Array> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('Ảnh không có nội dung')
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.length
    if (total > max) {
      await reader.cancel()
      throw new Error('Ảnh quá lớn')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return bytes
}

/**
 * Tải ảnh người dùng gửi qua Zalo (`photo_url` trong webhook). Phải tải NGAY khi nhận sự kiện:
 * theo tài liệu Zalo, link tệp không đảm bảo còn hiệu lực lâu. Chỉ nhận https, tối đa 5 MB, đúng
 * jpeg/png/gif/webp. Địa chỉ ảnh đến từ webhook đã xác thực bằng secret nên chỉ Zalo tạo được.
 */
export async function downloadImage(url: string, fetchImpl: typeof fetch = fetch): Promise<DownloadedImage> {
  const parsed = new URL(url)
  if (parsed.protocol !== 'https:') throw new Error('Địa chỉ ảnh phải là https')
  const response = await fetchImpl(parsed, { signal: AbortSignal.timeout(IMAGE_DOWNLOAD_TIMEOUT_MS) })
  if (!response.ok) throw new Error(`Tải ảnh lỗi: HTTP ${response.status}`)
  if (Number(response.headers.get('content-length') ?? 0) > MAX_IMAGE_BYTES) throw new Error('Ảnh quá lớn')
  const bytes = await readCapped(response, MAX_IMAGE_BYTES)
  const mediaType = sniffImageType(bytes)
  if (!mediaType) throw new Error('Không phải định dạng ảnh được hỗ trợ (jpg, png, gif, webp)')
  return { mediaType, base64: Buffer.from(bytes).toString('base64') }
}

export async function setWebhook(url: string, secretToken: string): Promise<unknown> {
  return callApi('setWebhook', { url, secret_token: secretToken })
}

export async function getMe(): Promise<unknown> {
  return callApi('getMe', {})
}
