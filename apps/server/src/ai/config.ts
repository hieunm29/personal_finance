/**
 * Cấu hình AI đọc từ biến môi trường.
 *
 * Hỗ trợ 2 nhà cung cấp, cùng dùng định dạng Anthropic Messages API:
 *   AI_PROVIDER=anthropic   → gọi thẳng Anthropic (ANTHROPIC_API_KEY)
 *   AI_PROVIDER=openrouter  → gọi qua OpenRouter (OPENROUTER_API_KEY), endpoint tương thích Anthropic
 *
 * Đổi model / mức "suy nghĩ" không cần sửa code:
 *   AI_MODEL=...            → tên model theo đúng quy ước của provider
 *   AI_EFFORT=medium        → suy luận kỹ hơn (chỉ áp dụng với provider anthropic)
 */
export type AiEffort = 'low' | 'medium' | 'high'
export type AiProvider = 'anthropic' | 'openrouter'

function readEffort(value: string | undefined): AiEffort {
  return value === 'medium' || value === 'high' ? value : 'low'
}

function readProvider(value: string | undefined): AiProvider {
  return value === 'openrouter' ? 'openrouter' : 'anthropic'
}

const provider = readProvider(process.env.AI_PROVIDER)

/** Tên model mặc định khác nhau theo provider: OpenRouter dùng dạng `vendor/model` với dấu chấm. */
const DEFAULT_MODEL: Record<AiProvider, string> = {
  anthropic: 'claude-opus-5-5',
  openrouter: 'anthropic/claude-opus-5.5',
}

export const aiConfig = {
  enabled: process.env.AI_ENABLED !== '0',
  provider,
  model: process.env.AI_MODEL || DEFAULT_MODEL[provider],
  effort: readEffort(process.env.AI_EFFORT),
  /**
   * Các tính năng riêng của API Anthropic (effort, server-side fallbacks + beta header).
   * Proxy như OpenRouter có thể không hỗ trợ → mặc định tắt khi dùng openrouter.
   */
  anthropicExtras: provider === 'anthropic',
  /** Số tin nhắn (user + assistant) gần nhất gửi lại làm ngữ cảnh. */
  historyLimit: Number(process.env.AI_HISTORY_LIMIT ?? 20),
  /** Giới hạn số vòng "gọi model → chạy tool" cho 1 tin nhắn, tránh vòng lặp vô hạn. */
  maxIterations: 6,
  maxTokens: 4096,
  timeZone: 'Asia/Ho_Chi_Minh',
}
