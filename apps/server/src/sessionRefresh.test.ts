import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CHILD_FLAG = 'PF_SESSION_REFRESH_CHILD'
const DAY = 24 * 60 * 60
const THIRTY_DAYS = 30 * DAY

/**
 * Phiên chỉ được gia hạn ở /api/auth/get-session (nơi Set-Cookie thật sự về trình duyệt).
 * Middleware /api/* gọi auth.api.getSession phía server và vứt Set-Cookie, nên phải tắt gia hạn ở đó
 * (`query: { disableRefresh: true }`); nếu không DB sẽ lùi hạn lên 30 ngày mà cookie vẫn hết hạn sớm.
 */
async function runChild() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-session-refresh-'))
  const databasePath = join(directory, 'app.db')
  try {
    process.env.DATABASE_URL = `file:${databasePath}`
    process.env.BETTER_AUTH_SECRET = 'test-secret-long-enough-1234567890'
    process.env.BETTER_AUTH_URL = 'http://localhost:3101'
    process.env.FRONTEND_URL = 'http://localhost:5174'
    process.env.DISABLE_JOBS = '1'
    const { runMigrations } = await import('./db/migrate')
    runMigrations(databasePath)
    const { app } = await import('./index')
    const { sqlite } = await import('./db')

    const signUp = await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5174' },
      body: JSON.stringify({ name: 'Refresh Test', email: 'refresh-test@example.com', password: 'Password123!' }),
    })
    expect(signUp.status).toBe(200)

    // Chỉ gửi cookie phiên, không gửi session_data, để chắc chắn đi qua DB chứ không qua cookie cache.
    const sessionCookie = signUp.headers
      .getSetCookie()
      .map((cookie) => cookie.split(';')[0])
      .find((cookie) => cookie.startsWith('better-auth.session_token='))
    expect(sessionCookie).toBeDefined()
    const headers = { cookie: sessionCookie! }

    const readExpiresAt = () => (sqlite.query('SELECT expires_at FROM session').get() as { expires_at: number }).expires_at
    const nowSeconds = () => Math.floor(Date.now() / 1000)

    // Phiên mới tạo có hạn 30 ngày.
    expect(readExpiresAt() - nowSeconds()).toBeGreaterThan(THIRTY_DAYS - 60)

    // Còn 20 ngày (< 29 ngày) nên đủ điều kiện gia hạn (updateAge = 1 ngày).
    const staleExpiresAt = nowSeconds() + 20 * DAY
    sqlite.run('UPDATE session SET expires_at = ?', [staleExpiresAt])

    // 1) Đi qua middleware /api/*: được xác thực nhưng KHÔNG đổi expires_at.
    const protectedResponse = await app.request('/api/transactions', { headers })
    expect(protectedResponse.status).toBe(200)
    expect(readExpiresAt()).toBe(staleExpiresAt)

    // 2) /api/auth/get-session: gia hạn DB và trả Set-Cookie với Max-Age đúng 30 ngày.
    const refreshed = await app.request('/api/auth/get-session', { headers })
    expect(refreshed.status).toBe(200)
    expect(readExpiresAt() - nowSeconds()).toBeGreaterThan(THIRTY_DAYS - 60)
    const refreshedCookie = refreshed.headers
      .getSetCookie()
      .find((cookie) => cookie.startsWith('better-auth.session_token='))
    expect(refreshedCookie).toBeDefined()
    const maxAge = Number(/Max-Age=(\d+)/i.exec(refreshedCookie!)?.[1])
    expect(maxAge).toBeGreaterThan(THIRTY_DAYS - 60)
    expect(maxAge).toBeLessThanOrEqual(THIRTY_DAYS)
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (process.env[CHILD_FLAG] === '1') {
  await runChild()
} else {
  describe('session refresh in isolated SQLite', () => {
    test('chỉ /api/auth/get-session gia hạn phiên, middleware /api/* thì không', () => {
      const result = Bun.spawnSync({
        cmd: ['bun', 'run', import.meta.path],
        env: { ...process.env, [CHILD_FLAG]: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      const output = new TextDecoder().decode(result.stderr) + new TextDecoder().decode(result.stdout)
      if (result.exitCode !== 0) throw new Error(output)
      expect(result.exitCode).toBe(0)
    })
  })
}
