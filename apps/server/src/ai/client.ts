import Anthropic from '@anthropic-ai/sdk'
import { aiConfig } from './config'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api'

let client: Anthropic | null = null

/**
 * Tạo client một lần (lazy) để server và test vẫn khởi động khi chưa cấu hình key.
 *
 * - anthropic:  đọc ANTHROPIC_API_KEY, gửi header `x-api-key`.
 * - openrouter: vẫn dùng Anthropic SDK nhưng đổi baseURL sang OpenRouter và gửi
 *   OPENROUTER_API_KEY qua `Authorization: Bearer`. apiKey phải là null, nếu không SDK
 *   sẽ gửi kèm ANTHROPIC_API_KEY (nếu có) dưới header x-api-key.
 */
export function getAnthropicClient(): Anthropic {
  if (client) return client
  if (aiConfig.provider === 'openrouter') {
    const authToken = process.env.OPENROUTER_API_KEY
    if (!authToken) throw new Error('OPENROUTER_API_KEY chưa được cấu hình')
    client = new Anthropic({ baseURL: process.env.AI_BASE_URL || OPENROUTER_BASE_URL, authToken, apiKey: null })
  } else {
    client = new Anthropic()
  }
  return client
}
