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

  test('giữ nguyên các dòng của ghi chú hóa đơn, chuẩn hóa \\r\\n thành \\n', () => {
    expect(clampNote('Fujimart\r\nĐậu mix hạt 208g: 60.000\r\nĐĩa 9 inch: 16.500'))
      .toBe('Fujimart\nĐậu mix hạt 208g: 60.000\nĐĩa 9 inch: 16.500')
  })

  test('ghi chú vừa đủ 500 ký tự thì không cắt', () => {
    const note = 'x'.repeat(MAX_NOTE_LENGTH)
    expect(clampNote(note)).toBe(note)
  })

  test('hóa đơn quá dài: cắt ở cuối một dòng, không đứt giữa tên món', () => {
    const items = Array.from({ length: 60 }, (_, index) => `Món số ${index + 1}: 12.500`)
    const clamped = clampNote(['Fujimart', ...items].join('\n'))!
    const lines = clamped.split('\n')

    expect(clamped.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH)
    expect(lines[0]).toBe('Fujimart')
    expect(lines.at(-1)).toBe('…')
    // Mọi dòng món còn giữ phải đầy đủ cả giá
    for (const line of lines.slice(1, -1)) expect(line).toMatch(/^Món số \d+: 12\.500$/)
  })

  test('chuỗi dài một dòng vẫn bị cắt đúng giới hạn', () => {
    const clamped = clampNote('a'.repeat(800))!
    expect(clamped.length).toBeLessThanOrEqual(MAX_NOTE_LENGTH)
    expect(clamped.endsWith('\n…')).toBe(true)
  })
})
