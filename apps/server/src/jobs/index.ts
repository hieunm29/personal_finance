/**
 * Nối các job nền với DB thật. Logic lập lịch nằm ở scheduler.ts (thuần, có test);
 * file này chỉ lắp ráp: task nào chạy, dùng store nào, cấu hình từ env nào.
 */
import { dirname, resolve } from 'node:path'
import { sqlite } from '../db'
import { createR2Uploader, runBackup } from '../services/backupService'
import { generateDueTransactionsForAllUsers } from '../services/recurringService'
import { dailyTask, intervalTask, startScheduler, type JobStore, type Task } from './scheduler'

const store: JobStore = {
  get(name) {
    const row = sqlite.query('SELECT last_key FROM job_runs WHERE name = ?').get(name) as { last_key: string } | null
    return row?.last_key ?? null
  },
  set(name, key) {
    sqlite
      .query('INSERT INTO job_runs (name, last_key) VALUES (?, ?) ON CONFLICT(name) DO UPDATE SET last_key = excluded.last_key')
      .run(name, key)
  },
}

/** Mặc định chỉ bật ở production để dev không sinh file sao lưu hay đẩy lên R2 ngoài ý muốn. */
function backupEnabled(): boolean {
  if (process.env.BACKUP_ENABLED === '1') return true
  return process.env.NODE_ENV === 'production' && process.env.BACKUP_ENABLED !== '0'
}

export function startJobs() {
  if (process.env.NODE_ENV === 'test' || process.env.DISABLE_JOBS === '1') return null

  const tasks: Task[] = []

  // Sinh giao dịch định kỳ đến hạn: mỗi giờ (và ngay lúc khởi động).
  // POST /api/recurring/generate vẫn có để người dùng tạo ngay.
  if (process.env.DISABLE_RECURRING_JOB !== '1') {
    tasks.push(intervalTask('recurring', 60 * 60 * 1000, () => {
      generateDueTransactionsForAllUsers()
    }))
  }

  // Sao lưu hằng ngày từ 02:00 giờ VN.
  if (backupEnabled()) {
    const upload = createR2Uploader()
    if (!upload) console.warn('[backup] chưa cấu hình R2_* — bản sao lưu chỉ nằm trên máy chủ')
    const dir = process.env.BACKUP_DIR || resolve(dirname(sqlite.filename), '../backups')
    tasks.push(dailyTask('backup', 2, async () => {
      const result = await runBackup({ database: sqlite, dir, upload })
      console.log(`[backup] ${result.key} ${result.uploaded ? '(đã đẩy lên R2)' : '(chỉ lưu trên máy chủ)'}`)
    }, store))
  }

  return tasks.length > 0 ? startScheduler(tasks) : null
}
