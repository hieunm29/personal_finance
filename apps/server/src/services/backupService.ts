/**
 * Sao lưu SQLite: bản chụp nhất quán (VACUUM INTO, an toàn khi DB đang ở chế độ WAL và đang chạy),
 * kiểm tra toàn vẹn, nén gzip, giữ N bản gần nhất trên máy chủ và (tùy chọn) đẩy lên Cloudflare R2.
 *
 * Module này không import singleton `db` — nhận `database` qua tham số để test bằng DB tạm.
 */
import { Database } from 'bun:sqlite'
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { vnClock } from '../lib/vnTime'

export const BACKUP_KEEP = 14
const BACKUP_FILE = /^app-\d{8}\.db\.gz$/

export type Uploader = (key: string, data: Uint8Array) => Promise<void>

export interface BackupOptions {
  database: Database
  dir: string
  now?: Date
  /** Số bản giữ lại trên máy chủ. */
  keep?: number
  upload?: Uploader
}

export interface BackupResult {
  file: string
  key: string
  uploaded: boolean
  /** Tên các bản cũ vừa bị xóa khỏi máy chủ. */
  removed: string[]
}

function verifyIntegrity(path: string): void {
  const copy = new Database(path, { readonly: true })
  try {
    const row = copy.query('PRAGMA integrity_check').get() as { integrity_check: string } | null
    if (row?.integrity_check !== 'ok') {
      throw new Error(`Bản sao lưu hỏng: ${row?.integrity_check ?? 'không đọc được'}`)
    }
  } finally {
    copy.close()
  }
}

function pruneOld(dir: string, keep: number): string[] {
  const files = readdirSync(dir).filter((name) => BACKUP_FILE.test(name)).sort().reverse()
  const stale = files.slice(Math.max(keep, 1))
  for (const name of stale) rmSync(join(dir, name), { force: true })
  return stale
}

/**
 * Idempotent theo ngày: nếu bản của hôm nay đã có thì không chụp lại, chỉ thử upload tiếp.
 * Nhờ vậy upload lỗi (mất mạng, sai key) được thử lại ở tick sau mà không tốn công chụp lại DB.
 */
export async function runBackup(options: BackupOptions): Promise<BackupResult> {
  const { database, dir, upload } = options
  const keep = options.keep ?? BACKUP_KEEP
  const stamp = vnClock(options.now).date.replaceAll('-', '')
  const key = `app-${stamp}.db.gz`
  const file = join(dir, key)

  mkdirSync(dir, { recursive: true })

  if (!existsSync(file)) {
    const snapshot = join(dir, `.app-${stamp}.db.tmp`)
    rmSync(snapshot, { force: true }) // VACUUM INTO không ghi đè file có sẵn
    try {
      database.query('VACUUM INTO ?').run(snapshot)
      verifyIntegrity(snapshot)
      const compressed = Bun.gzipSync(readFileSync(snapshot))
      const partial = `${file}.tmp`
      writeFileSync(partial, compressed)
      renameSync(partial, file) // đổi tên nguyên tử: không bao giờ để lại file .gz ghi dở
    } finally {
      rmSync(snapshot, { force: true })
    }
  }

  const removed = pruneOld(dir, keep) // dọn trước khi upload để upload lỗi cũng không làm đầy đĩa

  let uploaded = false
  if (upload) {
    await upload(key, readFileSync(file))
    uploaded = true
  }
  return { file, key, uploaded, removed }
}

/** undefined nếu thiếu cấu hình R2_* → chỉ lưu trên máy chủ. */
export function createR2Uploader(env: Record<string, string | undefined> = process.env): Uploader | undefined {
  const { R2_ACCOUNT_ID: account, R2_ACCESS_KEY_ID: accessKeyId, R2_SECRET_ACCESS_KEY: secretAccessKey, R2_BUCKET: bucket } = env
  if (!account || !accessKeyId || !secretAccessKey || !bucket) return undefined
  const client = new Bun.S3Client({
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint: `https://${account}.r2.cloudflarestorage.com`,
    region: 'auto',
  })
  return async (key, data) => {
    await client.write(`backups/${key}`, data, { type: 'application/gzip' })
  }
}
