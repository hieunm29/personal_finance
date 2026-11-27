import type { Context, Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { relative } from 'node:path'

/** File Vite đặt tên theo hash nội dung: đổi nội dung là đổi URL nên cache vĩnh viễn được. */
const IMMUTABLE = 'public, max-age=31536000, immutable'
/** Vẫn lưu cache nhưng luôn hỏi lại server trước khi dùng, để bản deploy mới có hiệu lực ngay. */
const REVALIDATE = 'no-cache'
const ASSETS_PREFIX = '/assets/'

/**
 * Cache-Control cho một file trong thư mục build của web (apps/web/dist).
 * `relativePath` tính từ gốc dist, vd. `assets/index-abc123.js`.
 * Trả về undefined khi không cần đặt header (các file còn lại: icon, favicon…).
 *
 * Mọi thứ dưới dist/assets/ đều bị coi là file có hash nên cache vĩnh viễn: đừng đặt file
 * không có hash vào apps/web/public/assets/ (nó sẽ được copy vào dist/assets/ và không bao giờ cập nhật).
 */
export function staticCacheControl(relativePath: string): string | undefined {
  const path = relativePath.replaceAll('\\', '/').replace(/^(\.\/|\/)+/, '')
  if (path.startsWith('assets/')) return IMMUTABLE
  // index.html cũng là bản trả về của SPA fallback (/transactions/new, /login…).
  if (path === 'index.html' || path === 'manifest.webmanifest') return REVALIDATE
  return undefined
}

/**
 * Phục vụ web đã build + SPA fallback, kèm Cache-Control theo staticCacheControl().
 * Phải gọi SAU khi đã đăng ký mọi route /api và /webhooks: handler bên dưới bắt mọi đường dẫn.
 */
export function mountWebDist(app: Hono<any>, root: string) {
  const onFound = (path: string, c: Context) => {
    const value = staticCacheControl(relative(root, path))
    if (value) c.header('Cache-Control', value)
  }
  app.use('/*', serveStatic({ root, onFound }))
  // File có hash không còn (sau khi deploy bản mới) phải 404, không được trả index.html như một file JS/CSS.
  // Riêng /assets (và /assets/) là route "Tài sản" của SPA, không phải file: để rơi xuống fallback.
  app.all('/assets/*', (c, next) =>
    c.req.path.length > ASSETS_PREFIX.length && c.req.path.startsWith(ASSETS_PREFIX) ? c.notFound() : next(),
  )
  app.get('*', serveStatic({ path: `${root}/index.html`, onFound }))
}
