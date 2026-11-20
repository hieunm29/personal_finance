import { betaTool } from '@anthropic-ai/sdk/helpers/beta/json-schema'
import { addFact, countFacts, deleteFact, MAX_FACT_LENGTH, MAX_FACTS_PER_USER } from '../memory'
import { getProfileIdByAuthUser } from '../userContext'
import { json, toolFail } from './helpers'
import type { ToolContext } from './index'

/**
 * Tool cho trí nhớ DÀI HẠN.
 *
 * Danh sách điều đã nhớ được chèn sẵn vào system prompt (kèm id), nên không cần tool "liệt kê":
 * model đã thấy toàn bộ, chỉ cần tool để THÊM và XÓA.
 */
export function buildMemoryTools(ctx: ToolContext) {
  const rememberFactTool = betaTool({
    name: 'remember_fact',
    description:
      'Ghi nhớ lâu dài một sở thích, thói quen hoặc quy ước của người dùng, để áp dụng cho các lần chat sau. ' +
      'Chỉ dùng khi người dùng YÊU CẦU nhớ (ví dụ "nhớ là cà phê luôn ghi vào ví Momo", "từ nay gọi tôi là anh Hiếu", ' +
      '"lương tôi về ngày 5 hằng tháng"). KHÔNG dùng để lưu giao dịch — giao dịch dùng create_transaction. ' +
      'Viết lại thành 1 câu ngắn, rõ nghĩa, đứng độc lập (không dùng "cái này", "như trên").',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: `Điều cần nhớ, tối đa ${MAX_FACT_LENGTH} ký tự` },
      },
      required: ['content'],
      additionalProperties: false,
    },
    run: async (input) => {
      const content = input.content.trim()
      if (!content) toolFail('Nội dung cần nhớ đang trống.')
      if (content.length > MAX_FACT_LENGTH) toolFail(`Nội dung quá dài (tối đa ${MAX_FACT_LENGTH} ký tự). Hãy rút gọn.`)
      const profileId = getProfileIdByAuthUser(ctx.authUserId)
      if (countFacts(profileId) >= MAX_FACTS_PER_USER) {
        toolFail(`Đã đủ ${MAX_FACTS_PER_USER} điều ghi nhớ. Hãy đề nghị người dùng chọn điều cũ để quên (forget_fact) trước.`)
      }
      const fact = addFact(profileId, content)
      return json({ ok: true, factId: fact.id, remembered: fact.content })
    },
  })

  const forgetFactTool = betaTool({
    name: 'forget_fact',
    description:
      'Xóa một điều đã ghi nhớ khi người dùng bảo quên/bỏ/không còn đúng nữa, hoặc khi cần thay bằng thông tin mới ' +
      '(xóa điều cũ rồi remember_fact điều mới). factId lấy từ mục "Điều cần nhớ" trong system prompt.',
    inputSchema: {
      type: 'object',
      properties: {
        factId: { type: 'string', description: 'id của điều cần quên' },
      },
      required: ['factId'],
      additionalProperties: false,
    },
    run: async (input) => {
      const removed = deleteFact(getProfileIdByAuthUser(ctx.authUserId), input.factId)
      if (!removed) toolFail(`Không tìm thấy điều ghi nhớ có id "${input.factId}".`)
      return json({ ok: true, forgotten: removed.content })
    },
  })

  return [rememberFactTool, forgetFactTool]
}
