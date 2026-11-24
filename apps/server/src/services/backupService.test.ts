import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Database } from 'bun:sqlite'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createR2Uploader, runBackup } from './backupService'

let dir: string
let backups: string
let source: Database

// 10:00 giờ VN của ngày d tháng 11/2026
const day = (d: number) => new Date(Date.UTC(2026, 10, d, 3))

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'pf-backup-'))
  backups = join(dir, 'backups')
  source = new Database(join(dir, 'app.db'))
  source.run('PRAGMA journal_mode = WAL')
  source.run('PRAGMA wal_autocheckpoint = 0') // giữ dữ liệu nằm trong WAL, giống server đang chạy
  source.run('CREATE TABLE note (id INTEGER PRIMARY KEY, text TEXT)')
  source.run("INSERT INTO note (text) VALUES ('một'), ('hai')")
})

afterEach(() => {
  source.close()
  rmSync(dir, { recursive: true, force: true })
})

/** Giải nén bản sao lưu và đọc lại bằng một kết nối SQLite mới. */
function notesIn(file: string): string[] {
  const restored = join(dir, 'restored.db')
  writeFileSync(restored, Bun.gunzipSync(readFileSync(file)))
  const database = new Database(restored, { readonly: true })
  try {
    return (database.query('SELECT text FROM note ORDER BY id').all() as { text: string }[]).map((row) => row.text)
  } finally {
    database.close()
  }
}

describe('runBackup', () => {
  test('chụp cả dữ liệu còn nằm trong WAL; bản nén mở lại được và không để lại file tạm', async () => {
    expect(statSync(join(dir, 'app.db-wal')).size).toBeGreaterThan(0) // dữ liệu chưa checkpoint

    const result = await runBackup({ database: source, dir: backups, now: day(21) })

    expect(result.key).toBe('app-20261121.db.gz')
    expect(result.uploaded).toBe(false)
    expect(notesIn(result.file)).toEqual(['một', 'hai'])
    expect(readdirSync(backups)).toEqual(['app-20261121.db.gz'])
  })

  test('chỉ giữ N bản mới nhất trên máy chủ', async () => {
    for (let d = 1; d <= 5; d++) await runBackup({ database: source, dir: backups, now: day(d), keep: 3 })
    expect(readdirSync(backups).sort()).toEqual(['app-20261103.db.gz', 'app-20261104.db.gz', 'app-20261105.db.gz'])
  })

  test('báo lại danh sách bản cũ vừa xóa', async () => {
    await runBackup({ database: source, dir: backups, now: day(1), keep: 1 })
    const result = await runBackup({ database: source, dir: backups, now: day(2), keep: 1 })
    expect(result.removed).toEqual(['app-20261101.db.gz'])
  })

  test('gọi uploader đúng khóa với nội dung gzip', async () => {
    const calls: { key: string; data: Uint8Array }[] = []
    const result = await runBackup({
      database: source,
      dir: backups,
      now: day(21),
      upload: async (key, data) => void calls.push({ key, data }),
    })
    expect(result.uploaded).toBe(true)
    expect(calls).toHaveLength(1)
    expect(calls[0].key).toBe('app-20261121.db.gz')
    expect([calls[0].data[0], calls[0].data[1]]).toEqual([0x1f, 0x8b]) // magic của gzip
  })

  test('upload lỗi: bản cục bộ vẫn còn; lần sau chỉ upload lại, không chụp lại DB', async () => {
    await expect(runBackup({
      database: source, dir: backups, now: day(21),
      upload: async () => { throw new Error('R2 từ chối') },
    })).rejects.toThrow('R2 từ chối')
    expect(readdirSync(backups)).toEqual(['app-20261121.db.gz'])

    source.run("INSERT INTO note (text) VALUES ('ba')") // dữ liệu mới sau lần chụp đầu
    const uploaded: string[] = []
    const retry = await runBackup({
      database: source, dir: backups, now: day(21),
      upload: async (key) => void uploaded.push(key),
    })
    expect(retry.uploaded).toBe(true)
    expect(uploaded).toEqual(['app-20261121.db.gz'])
    expect(notesIn(retry.file)).toEqual(['một', 'hai']) // vẫn là bản chụp đầu → chưa chụp lại
  })

  test('chụp lỗi (DB đã đóng) thì không để lại file nào', async () => {
    const closed = new Database(':memory:')
    closed.close()
    await expect(runBackup({ database: closed, dir: backups, now: day(21) })).rejects.toThrow()
    expect(readdirSync(backups)).toEqual([])
  })
})

describe('createR2Uploader', () => {
  const full = { R2_ACCOUNT_ID: 'acc', R2_ACCESS_KEY_ID: 'id', R2_SECRET_ACCESS_KEY: 'secret', R2_BUCKET: 'bucket' }

  test('đủ 4 biến R2_* thì có uploader', () => {
    expect(typeof createR2Uploader(full)).toBe('function')
  })

  test('thiếu bất kỳ biến nào thì không có uploader (chỉ lưu trên máy chủ)', () => {
    for (const missing of Object.keys(full)) {
      expect(createR2Uploader({ ...full, [missing]: '' })).toBeUndefined()
    }
    expect(createR2Uploader({})).toBeUndefined()
  })
})
