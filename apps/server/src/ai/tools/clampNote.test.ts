import { describe, expect, test } from 'bun:test'
import { clampNote, MAX_NOTE_LENGTH } from './helpers'

describe('clampNote', () => {
  test('giữ nguyên ghi chú ngắn, bỏ khoảng trắng thừa', () => {
    expect(clampNote('  Cà phê Highlands ')).toBe('Cà phê Highlands')
  })

  test('ghi chú rỗng → không lưu', () => {
    expect(clampNote(undefined)).toBeUndefined()
    expect(clampNote('   ')).toBeUndefined()
  })

  test('ghi chú hóa đơn vừa đủ 500 ký tự thì không cắt', () => {
    const note = 'x'.repeat(MAX_NOTE_LENGTH)
    expect(clampNote(note)).toBe(note)
  })

  test('hóa đơn quá dài: cắt ở ranh giới giữa 2 món, không đứt giữa tên món', () => {
    const items = Array.from({ length: 60 }, (_, index) => `Món số ${index + 1} 12.500`)
    const note = `Fujimart: ${items.join('; ')}`
    const clamped = clampNote(note)!

    expect(clamped.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH)
    expect(clamped.startsWith('Fujimart: Món số 1 12.500; ')).toBe(true)
    expect(clamped.endsWith('; …')).toBe(true)
    // Món cuối cùng còn giữ phải đầy đủ cả giá
    expect(clamped.slice(0, -'; …'.length)).toMatch(/Món số \d+ 12\.500$/)
  })

  test('chuỗi dài không có dấu "; " vẫn bị cắt đúng giới hạn', () => {
    const clamped = clampNote('a'.repeat(800))!
    expect(clamped.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH)
    expect(clamped.endsWith('; …')).toBe(true)
  })
})
