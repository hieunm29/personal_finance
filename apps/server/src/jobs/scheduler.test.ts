import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test'
import { createScheduler, dailyTask, intervalTask, type JobStore } from './scheduler'

function memoryStore(): JobStore {
  const data = new Map<string, string>()
  return { get: (name) => data.get(name) ?? null, set: (name, key) => void data.set(name, key) }
}

// 02:00 giờ VN ngày 21/11 = 19:00 UTC ngày 20/11
const BEFORE_2AM = new Date('2026-11-20T18:59:00Z') // 01:59 VN
const AT_2AM = new Date('2026-11-20T19:00:00Z') // 02:00 VN
const LATER_SAME_DAY = new Date('2026-11-21T03:00:00Z') // 10:00 VN, vẫn là 21/11
const NEXT_DAY = new Date('2026-11-21T19:00:00Z') // 02:00 VN ngày 22/11

let errorSpy: ReturnType<typeof spyOn>
beforeEach(() => {
  errorSpy = spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => errorSpy.mockRestore())

describe('dailyTask', () => {
  test('không chạy trước giờ đã đặt (tính theo giờ VN, không phải UTC)', async () => {
    const runs: string[] = []
    const task = dailyTask('backup', 2, (date) => void runs.push(date), memoryStore())
    await task.run(BEFORE_2AM)
    expect(runs).toEqual([])
  })

  test('chạy đúng 1 lần mỗi ngày, các tick sau cùng ngày bị bỏ qua', async () => {
    const runs: string[] = []
    const task = dailyTask('backup', 2, (date) => void runs.push(date), memoryStore())
    await task.run(AT_2AM)
    await task.run(LATER_SAME_DAY)
    expect(runs).toEqual(['2026-11-21'])
  })

  test('sang ngày mới thì chạy lại', async () => {
    const runs: string[] = []
    const task = dailyTask('backup', 2, (date) => void runs.push(date), memoryStore())
    await task.run(AT_2AM)
    await task.run(NEXT_DAY)
    expect(runs).toEqual(['2026-11-21', '2026-11-22'])
  })

  test('server tắt đúng 02:00, bật lại lúc 10:00 vẫn được bù', async () => {
    const runs: string[] = []
    const task = dailyTask('backup', 2, (date) => void runs.push(date), memoryStore())
    await task.run(LATER_SAME_DAY)
    expect(runs).toEqual(['2026-11-21'])
  })

  test('khởi động lại (store còn nguyên) không chạy lại việc đã làm trong ngày', async () => {
    const store = memoryStore()
    const runs: string[] = []
    await dailyTask('backup', 2, (date) => void runs.push(date), store).run(AT_2AM)
    await dailyTask('backup', 2, (date) => void runs.push(date), store).run(LATER_SAME_DAY) // instance mới = process mới
    expect(runs).toEqual(['2026-11-21'])
  })

  test('lỗi thì không ghi "đã chạy" nên tick sau thử lại', async () => {
    let attempts = 0
    const task = dailyTask('backup', 2, () => {
      attempts += 1
      if (attempts === 1) throw new Error('mất mạng')
    }, memoryStore())
    await expect(task.run(AT_2AM)).rejects.toThrow('mất mạng')
    await task.run(LATER_SAME_DAY)
    expect(attempts).toBe(2)
    await task.run(LATER_SAME_DAY)
    expect(attempts).toBe(2)
  })
})

describe('intervalTask', () => {
  test('chạy ở tick đầu, rồi tối đa mỗi khoảng đã đặt', async () => {
    let runs = 0
    const task = intervalTask('recurring', 60 * 60 * 1000, () => void (runs += 1))
    await task.run(new Date('2026-11-21T00:00:00Z'))
    await task.run(new Date('2026-11-21T00:30:00Z'))
    expect(runs).toBe(1)
    await task.run(new Date('2026-11-21T01:00:00Z'))
    expect(runs).toBe(2)
  })
})

describe('createScheduler', () => {
  test('một task lỗi chỉ bị log, không chặn các task còn lại', async () => {
    const ran: string[] = []
    const scheduler = createScheduler([
      { name: 'hỏng', run: () => { throw new Error('boom') } },
      { name: 'tốt', run: () => void ran.push('tốt') },
    ], { now: () => AT_2AM })
    await scheduler.tick()
    expect(ran).toEqual(['tốt'])
    expect(errorSpy).toHaveBeenCalledTimes(1)
  })

  test('tick đang chạy dở thì tick sau bị bỏ qua, không chồng nhau', async () => {
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let started = 0
    const scheduler = createScheduler([{ name: 'chậm', run: async () => { started += 1; await gate } }])
    const first = scheduler.tick()
    await scheduler.tick() // trả về ngay vì tick đầu chưa xong
    expect(started).toBe(1)
    release()
    await first
    await scheduler.tick()
    expect(started).toBe(2)
  })
})
