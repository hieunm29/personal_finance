import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { Hono } from 'hono'
import { mountWebDist, staticCacheControl } from './staticCache'

const IMMUTABLE = 'public, max-age=31536000, immutable'

describe('staticCacheControl', () => {
  test('file có hash trong assets/ cache một năm và immutable', () => {
    expect(staticCacheControl('assets/index-DxK3a9Lm.js')).toBe(IMMUTABLE)
    expect(staticCacheControl('assets/index-B7q1.css')).toBe(IMMUTABLE)
    expect(staticCacheControl('assets/fonts/inter-abc.woff2')).toBe(IMMUTABLE)
  })

  test('index.html và manifest.webmanifest luôn phải hỏi lại', () => {
    expect(staticCacheControl('index.html')).toBe('no-cache')
    expect(staticCacheControl('manifest.webmanifest')).toBe('no-cache')
  })

  test('chấp nhận đường dẫn có ./ hoặc / ở đầu', () => {
    expect(staticCacheControl('./index.html')).toBe('no-cache')
    expect(staticCacheControl('/manifest.webmanifest')).toBe('no-cache')
    expect(staticCacheControl('/assets/app-1.js')).toBe(IMMUTABLE)
  })

  test('file khác không bị đặt header', () => {
    expect(staticCacheControl('icon-192.png')).toBeUndefined()
    expect(staticCacheControl('icon.svg')).toBeUndefined()
    expect(staticCacheControl('apple-touch-icon.png')).toBeUndefined()
  })

  test('chỉ thư mục assets/ ở gốc mới được immutable', () => {
    expect(staticCacheControl('other/assets/app.js')).toBeUndefined()
    expect(staticCacheControl('assetsfoo/app.js')).toBeUndefined()
    expect(staticCacheControl('sub/index.html')).toBeUndefined()
  })
})

describe('mountWebDist', () => {
  let dir = ''
  let app: Hono

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'personal-finance-dist-'))
    mkdirSync(join(dir, 'assets'))
    writeFileSync(join(dir, 'index.html'), '<!doctype html><title>spa</title>')
    writeFileSync(join(dir, 'manifest.webmanifest'), '{"name":"Test"}')
    writeFileSync(join(dir, 'icon-192.png'), 'png')
    writeFileSync(join(dir, 'assets', 'index-abc123.js'), 'console.log(1)')
    app = new Hono()
    // serveStatic phân giải đường dẫn theo cwd, nên dùng root tương đối như production.
    mountWebDist(app, relative(process.cwd(), dir))
  })

  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  test('/assets/* trả immutable', async () => {
    const response = await app.request('/assets/index-abc123.js')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe(IMMUTABLE)
    expect(response.headers.get('content-type')).toContain('javascript')
  })

  test('/ và index.html trả no-cache', async () => {
    for (const path of ['/', '/index.html']) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-cache')
      expect(response.headers.get('content-type')).toContain('text/html')
    }
  })

  test('SPA fallback (route không có file) trả index.html với no-cache', async () => {
    const response = await app.request('/transactions/new')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(await response.text()).toContain('<title>spa</title>')
  })

  test('file trong /assets/ không còn (hash cũ sau khi deploy) trả 404, không phải index.html', async () => {
    for (const path of ['/assets/index-old000.js', '/assets/nope/deep.css']) {
      const response = await app.request(path)
      expect(response.status).toBe(404)
      expect(response.headers.get('cache-control') ?? '').not.toContain('immutable')
      expect(response.headers.get('content-type') ?? '').not.toContain('text/html')
      expect(await response.text()).not.toContain('<title>spa</title>')
    }
  })

  test('/assets và /assets/ là route của SPA, không bị 404', async () => {
    for (const path of ['/assets', '/assets/']) {
      const response = await app.request(path)
      expect(response.status).toBe(200)
      expect(response.headers.get('cache-control')).toBe('no-cache')
      expect(await response.text()).toContain('<title>spa</title>')
    }
  })

  test('manifest.webmanifest trả no-cache và đúng content-type', async () => {
    const response = await app.request('/manifest.webmanifest')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('no-cache')
    expect(response.headers.get('content-type')).toContain('application/manifest+json')
  })

  test('file tĩnh khác không có Cache-Control', async () => {
    const response = await app.request('/icon-192.png')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBeNull()
  })

  test('route /api và /webhooks đăng ký trước mountWebDist vẫn được ưu tiên, không bị index.html nuốt', async () => {
    const api = new Hono()
    api.get('/api/ping', (c) => c.json({ pong: true }))
    api.post('/webhooks/test', (c) => c.json({ hook: true }))
    mountWebDist(api, relative(process.cwd(), dir))

    const ping = await api.request('/api/ping')
    expect(ping.status).toBe(200)
    expect(ping.headers.get('content-type')).toContain('application/json')
    expect(await ping.json()).toEqual({ pong: true })

    const hook = await api.request('/webhooks/test', { method: 'POST' })
    expect(hook.status).toBe(200)
    expect(await hook.json()).toEqual({ hook: true })

    // Route SPA vẫn rơi xuống fallback.
    expect(await (await api.request('/transactions')).text()).toContain('<title>spa</title>')
  })
})
