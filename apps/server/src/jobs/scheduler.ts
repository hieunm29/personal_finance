/**
 * Bộ lập lịch tối giản cho các job nền. Một tick (mặc định 10 phút) duyệt qua danh sách task;
 * mỗi task tự quyết định có đến lúc chạy chưa. Module này KHÔNG chạm DB hay timer thật
 * (store được truyền vào) nên test được bằng đồng hồ giả.
 */
import { vnClock } from '../lib/vnTime'

/** Nơi nhớ "job hằng ngày đã chạy cho ngày nào", để khởi động lại không chạy lại hay bỏ sót. */
export interface JobStore {
  get(name: string): string | null
  set(name: string, key: string): void
}

export interface Task {
  name: string
  run(now: Date): void | Promise<void>
}

/**
 * Chạy đúng 1 lần mỗi ngày (giờ VN), từ `hour` giờ trở đi. Nếu server tắt đúng giờ đó thì bù
 * ngay khi bật lại trong ngày. Chỉ ghi "đã chạy" khi `fn` thành công → lỗi sẽ được thử lại ở tick sau.
 */
export function dailyTask(
  name: string,
  hour: number,
  fn: (date: string) => void | Promise<void>,
  store: JobStore,
): Task {
  return {
    name,
    async run(now) {
      const clock = vnClock(now)
      if (clock.hour < hour) return
      if (store.get(name) === clock.date) return
      await fn(clock.date)
      store.set(name, clock.date)
    },
  }
}

/** Chạy ở tick đầu tiên rồi tối đa mỗi `everyMs` (trạng thái nằm trong bộ nhớ). */
export function intervalTask(name: string, everyMs: number, fn: () => void | Promise<void>): Task {
  let last = -Infinity
  return {
    name,
    async run(now) {
      if (now.getTime() - last < everyMs) return
      last = now.getTime()
      await fn()
    },
  }
}

export interface SchedulerOptions {
  now?: () => Date
}

/** `tick()` chạy lần lượt các task; một task lỗi chỉ bị log, không chặn các task còn lại. */
export function createScheduler(tasks: Task[], options: SchedulerOptions = {}) {
  const now = options.now ?? (() => new Date())
  let running = false

  async function tick(): Promise<void> {
    if (running) return // tick trước chưa xong (ví dụ đang upload) thì bỏ qua, không chồng nhau
    running = true
    try {
      for (const task of tasks) {
        try {
          await task.run(now())
        } catch (error) {
          console.error(`[jobs] ${task.name} lỗi:`, error instanceof Error ? error.message : error)
        }
      }
    } finally {
      running = false
    }
  }

  return { tick }
}

export function startScheduler(tasks: Task[], options: SchedulerOptions & { tickMs?: number } = {}) {
  const scheduler = createScheduler(tasks, options)
  void scheduler.tick() // chạy ngay lúc khởi động, không chờ tick đầu tiên
  const timer = setInterval(() => void scheduler.tick(), options.tickMs ?? 10 * 60 * 1000)
  timer.unref?.() // không giữ tiến trình sống chỉ vì job nền
  return { tick: scheduler.tick, stop: () => clearInterval(timer) }
}
