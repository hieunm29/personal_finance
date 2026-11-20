import Anthropic from '@anthropic-ai/sdk'
import { aiConfig } from './config'
import { getAnthropicClient } from './client'
import { loadHistory, saveTurn } from './memory'
import { BASE_SYSTEM_PROMPT, buildUserContextPrompt, withDateHeader } from './prompts/systemPrompt'
import { checkReply, finalizeReply, buildActionNote, stripActionNotes } from './guard'
import { buildTools, type ToolCallRecord } from './tools'
import { todayVN } from './tools/helpers'
import { getProfileIdByAuthUser, getUserFinanceContext } from './userContext'

export interface AgentInput {
  authUserId: string
  text: string
  channel?: string
}

/**
 * Trái tim của trợ lý: nhận 1 tin nhắn, trả về 1 câu trả lời.
 *
 * Luồng xử lý:
 *  1. Dựng system prompt = phần cố định + danh mục/ví của user
 *  2. Ghép lịch sử chat + tin nhắn mới (gắn ngày hôm nay)
 *  3. Tool Runner gọi Claude; nếu Claude muốn dùng tool, runner chạy `run` của tool,
 *     gửi kết quả lại và gọi Claude tiếp — lặp đến khi Claude trả lời bằng văn bản
 *  4. Guard: đối chiếu câu trả lời với nhật ký tool đã chạy thật; nói "đã ghi" mà không ghi → làm lại / chặn
 *  5. Lưu lượt chat (kèm ghi chú hành động thật) vào DB làm "trí nhớ"
 *
 * Hàm này KHÔNG biết gì về Zalo → có thể dùng lại cho Telegram, web chat, CLI test.
 */
export async function runAgent({ authUserId, text, channel = 'zalo' }: AgentInput): Promise<string> {
  if (!aiConfig.enabled) return 'Trợ lý AI đang tạm tắt.'

  const profileId = getProfileIdByAuthUser(authUserId)
  const userContext = getUserFinanceContext(authUserId)

  const system: Anthropic.Beta.BetaTextBlockParam[] = [
    // cache_control đánh dấu "điểm cắt" cho prompt cache: mọi thứ TỪ ĐẦU đến đây được cache.
    { type: 'text', text: BASE_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: buildUserContextPrompt(userContext), cache_control: { type: 'ephemeral' } },
  ]

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    ...loadHistory(profileId, aiConfig.historyLimit),
    { role: 'user', content: withDateHeader(text, todayVN()) },
  ]

  // Nhật ký tool THỰC SỰ chạy trong lượt này — nguồn sự thật để kiểm tra lời model.
  const callLog: ToolCallRecord[] = []
  const callModel = (conversation: Anthropic.Beta.BetaMessageParam[]) =>
    getAnthropicClient().beta.messages.toolRunner({
      model: aiConfig.model,
      max_tokens: aiConfig.maxTokens,
      max_iterations: aiConfig.maxIterations,
      system,
      messages: conversation,
      tools: buildTools({ authUserId, callLog }),
      ...(aiConfig.anthropicExtras
        ? {
            output_config: { effort: aiConfig.effort },
            // Nếu model từ chối do bộ lọc an toàn, API tự chạy lại trên model dự phòng phù hợp.
            betas: ['server-side-fallback-2026-07-01'],
            fallbacks: 'default' as const,
          }
        : {
            // Tool Runner mặc định dùng "message threads" (tính năng beta của Anthropic, chỉ gửi
            // phần tin mới mỗi vòng). Proxy không hỗ trợ → gửi lại toàn bộ hội thoại mỗi vòng.
            thread: false as const,
          }),
    })

  let reply: string
  try {
    reply = stripActionNotes(extractReply(await callModel(messages)))

    // Guard: câu trả lời có khớp với những gì tool thật sự đã làm không? Nếu không → cho làm lại 1 lần.
    const verdict = checkReply(reply, callLog)
    if (verdict.action === 'retry') {
      console.warn('[ai] guard retry:', verdict.nudge.slice(0, 60), '| reply:', reply.slice(0, 80))
      reply = stripActionNotes(extractReply(await callModel([
        ...messages,
        { role: 'assistant', content: reply },
        { role: 'user', content: `[Hệ thống kiểm tra] ${verdict.nudge}` },
      ])))
    }
    // Lần cuối: chặn cứng mọi câu "đã ghi / đã hoàn tác" không có thật.
    reply = finalizeReply(reply, callLog)
  } catch (error) {
    console.error('[ai] agent error', error)
    reply = friendlyError(error)
    // Không lưu lượt lỗi vào lịch sử để lần sau model không bị "nhiễu".
    return reply
  }

  // Lưu kèm ghi chú hành động thật để lần sau model thấy "nói đã ghi" luôn đi cùng "gọi tool".
  saveTurn(profileId, text, `${reply}\n${buildActionNote(callLog)}`, channel)
  return reply
}

function extractReply(message: Anthropic.Beta.BetaMessage): string {
  // Luôn kiểm tra stop_reason trước khi đọc nội dung.
  if (message.stop_reason === 'refusal') {
    return 'Xin lỗi, mình không thể hỗ trợ yêu cầu này.'
  }
  const text = message.content
    .filter((block): block is Anthropic.Beta.BetaTextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
  if (text) return text
  if (message.stop_reason === 'tool_use') {
    // Hết max_iterations mà model vẫn muốn gọi tool.
    return 'Yêu cầu hơi phức tạp, bạn thử chia nhỏ câu hỏi giúp mình nhé.'
  }
  return 'Mình chưa hiểu ý bạn, bạn nói rõ hơn được không?'
}

function friendlyError(error: unknown): string {
  // Dùng class lỗi có kiểu của SDK, không so khớp chuỗi.
  if (error instanceof Anthropic.RateLimitError) return 'Trợ lý đang quá tải, bạn thử lại sau ít phút nhé.'
  if (error instanceof Anthropic.AuthenticationError) return 'Trợ lý chưa được cấu hình đúng (API key). Hãy báo quản trị viên.'
  if (error instanceof Anthropic.APIConnectionError) return 'Không kết nối được tới dịch vụ AI, bạn thử lại sau nhé.'
  if (error instanceof Anthropic.APIError) return 'Dịch vụ AI đang gặp sự cố, bạn thử lại sau nhé.'
  return 'Có lỗi xảy ra khi xử lý tin nhắn, bạn thử lại nhé.'
}
