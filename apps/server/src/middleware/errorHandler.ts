import type { ErrorHandler } from 'hono'
import { ZodError } from 'zod'

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof ZodError) {
    return c.json(
      {
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dữ liệu không hợp lệ',
          details: err.errors.map((e) => ({
            field: e.path.join('.'),
            message: e.message,
          })),
        },
      },
      400,
    )
  }

  if (err.message?.toLowerCase().includes('not found')) {
    return c.json(
      { error: { code: 'NOT_FOUND', message: 'Không tìm thấy' } },
      404,
    )
  }

  console.error('Unhandled error:', err)
  return c.json(
    { error: { code: 'INTERNAL_ERROR', message: 'Lỗi hệ thống' } },
    500,
  )
}
