import type { BetaRunnableTool } from '@anthropic-ai/sdk/lib/tools/BetaRunnableTool'
import { buildMemoryTools } from './memoryTools'
import { buildReportTools } from './reportTools'
import { buildTransactionTools } from './transactionTools'

/** Một lần tool THỰC SỰ chạy trong lượt hiện tại (do code ghi lại, không phải lời model nói). */
export interface ToolCallRecord {
  name: string
  ok: boolean
  /** Với create_transaction: id giao dịch đã tạo; với remember_fact: id điều đã nhớ. */
  refId?: string
}

/**
 * Ngữ cảnh mà server (không phải model) cung cấp cho tool.
 * authUserId được xác định qua bảng zalo_links → đây là ranh giới bảo mật.
 */
export interface ToolContext {
  authUserId: string
  /** Nếu có, mỗi lần tool chạy xong (thành công hoặc lỗi) sẽ được ghi vào đây. */
  callLog?: ToolCallRecord[]
}

function extractRefId(result: unknown): string | undefined {
  if (typeof result !== 'string') return undefined
  try {
    const parsed = JSON.parse(result) as { transactionId?: unknown; factId?: unknown }
    const id = parsed.transactionId ?? parsed.factId
    return typeof id === 'string' ? id : undefined
  } catch {
    return undefined
  }
}

/**
 * Bọc tool để ghi nhật ký mỗi lần chạy. Nhờ vậy agent biết chắc tool nào đã chạy thật,
 * thay vì tin vào câu chữ của model ("Đã ghi…").
 */
function withCallLog<T extends BetaRunnableTool<any>>(tool: T, log: ToolCallRecord[] | undefined): T {
  if (!log) return tool
  return {
    ...tool,
    run: async (input: unknown, context?: unknown) => {
      try {
        const result = await tool.run(input as never, context as never)
        log.push({ name: tool.name, ok: true, refId: extractRefId(result) })
        return result
      } catch (error) {
        log.push({ name: tool.name, ok: false })
        throw error
      }
    },
  }
}

/**
 * Tạo bộ tool cho một người dùng.
 *
 * Tool được tạo lại mỗi request để "đóng gói" authUserId, nhưng phần định nghĩa
 * (name/description/schema) gửi lên API luôn giống hệt nhau → prompt cache vẫn trúng.
 * Thứ tự tool phải cố định, vì đổi thứ tự cũng làm hỏng cache.
 */
export function buildTools(ctx: ToolContext) {
  return [...buildTransactionTools(ctx), ...buildReportTools(ctx), ...buildMemoryTools(ctx)].map((tool) => withCallLog(tool, ctx.callLog))
}
