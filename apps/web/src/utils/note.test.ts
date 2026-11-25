import { describe, expect, test } from 'bun:test'
import { noteTitle } from './note'

describe('noteTitle', () => {
  test('ghi chú một dòng giữ nguyên', () => {
    expect(noteTitle('Cà phê Highlands')).toBe('Cà phê Highlands')
  })

  test('ghi chú hóa đơn nhiều dòng chỉ lấy tên cửa hàng', () => {
    expect(noteTitle('Fujimart\nĐậu mix hạt 208g: 60.000\nĐĩa 9 inch: 16.500')).toBe('Fujimart')
    expect(noteTitle('WinMart+\r\nRau: 10.000')).toBe('WinMart+')
  })

  test('bỏ qua dòng trống ở đầu', () => {
    expect(noteTitle('\n  \n  Fujimart  \nRau: 10.000')).toBe('Fujimart')
  })

  test('không có ghi chú → chuỗi rỗng để dùng tên danh mục thay thế', () => {
    expect(noteTitle(null)).toBe('')
    expect(noteTitle(undefined)).toBe('')
    expect(noteTitle('  \n ')).toBe('')
  })
})
