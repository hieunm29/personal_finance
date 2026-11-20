import { describe, expect, test } from 'bun:test'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const CHILD_FLAG = 'PF_AUTH_ROUTING_CHILD'

async function runChild() {
  const directory = mkdtempSync(join(tmpdir(), 'personal-finance-auth-route-'))
  const databasePath = join(directory, 'app.db')
  try {
    process.env.DATABASE_URL = `file:${databasePath}`
    process.env.BETTER_AUTH_SECRET = 'test-secret-long-enough-1234567890'
    process.env.BETTER_AUTH_URL = 'http://localhost:3101'
    process.env.FRONTEND_URL = 'http://localhost:5174'
    process.env.DISABLE_RECURRING_JOB = '1'
    const { runMigrations } = await import('./db/migrate')
    runMigrations(databasePath)
    const { app } = await import('./index')

    const health = await app.request('/api/health')
    expect(health.status).toBe(200)
    const protectedResponse = await app.request('/api/transactions')
    expect(protectedResponse.status).toBe(401)

    const session = await app.request('/api/auth/get-session')
    expect(session.status).toBe(200)
    expect(await session.text()).toBe('null')

    const signUp = await app.request('/api/auth/sign-up/email', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://localhost:5174' },
      body: JSON.stringify({ name: 'Route Test', email: 'route-test@example.com', password: 'Password123!' }),
    })
    expect(signUp.status).toBe(200)
    expect((await signUp.json()).user.email).toBe('route-test@example.com')
  } finally {
    rmSync(directory, { recursive: true, force: true })
  }
}

if (process.env[CHILD_FLAG] === '1') {
  await runChild()
} else {
  describe('auth routing in isolated SQLite', () => {
    test('leaves auth endpoints outside the protected API middleware', () => {
      const result = Bun.spawnSync({
        cmd: ['bun', 'run', import.meta.path],
        env: { ...process.env, [CHILD_FLAG]: '1' },
        stdout: 'pipe',
        stderr: 'pipe',
      })
      expect(result.exitCode).toBe(0)
      if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr))
    })
  })
}
