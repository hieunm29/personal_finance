import { describe, expect, test } from 'bun:test'
import { downloadImage, sniffImageType } from './zaloClient'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]
const GIF = [0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 1, 2]
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50, 1, 2]
const bytes = (values: number[]) => Uint8Array.from(values)

const fakeFetch = (body: Uint8Array | string, init: ResponseInit = {}) =>
  (async () => new Response(body as BodyInit, init)) as unknown as typeof fetch

describe('sniffImageType', () => {
  test('nhận diện jpeg, png, gif, webp bằng magic bytes', () => {
    expect(sniffImageType(bytes(JPEG))).toBe('image/jpeg')
    expect(sniffImageType(bytes(PNG))).toBe('image/png')
    expect(sniffImageType(bytes(GIF))).toBe('image/gif')
    expect(sniffImageType(bytes(WEBP))).toBe('image/webp')
  })

  test('RIFF không phải webp (ví dụ wav) thì không nhận', () => {
    expect(sniffImageType(bytes([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull()
  })

  test('HTML, văn bản và dữ liệu rỗng không phải ảnh', () => {
    expect(sniffImageType(new TextEncoder().encode('<html>không phải ảnh</html>'))).toBeNull()
    expect(sniffImageType(new Uint8Array())).toBeNull()
  })
})

describe('downloadImage', () => {
  const url = 'https://cdn.example.test/bill.jpg'

  test('trả về loại ảnh và base64', async () => {
    const image = await downloadImage(url, fakeFetch(bytes(PNG)))
    expect(image).toEqual({ mediaType: 'image/png', base64: Buffer.from(PNG).toString('base64') })
  })

  test('tin magic bytes, không tin Content-Type do máy chủ ảnh khai', async () => {
    const image = await downloadImage(url, fakeFetch(bytes(JPEG), { headers: { 'content-type': 'text/plain' } }))
    expect(image.mediaType).toBe('image/jpeg')
  })

  test('chỉ nhận địa chỉ https', async () => {
    await expect(downloadImage('http://cdn.example.test/bill.jpg', fakeFetch(bytes(PNG)))).rejects.toThrow('https')
    await expect(downloadImage('file:///etc/passwd', fakeFetch(bytes(PNG)))).rejects.toThrow('https')
  })

  test('HTTP lỗi thì báo lỗi', async () => {
    await expect(downloadImage(url, fakeFetch('hết hạn', { status: 403 }))).rejects.toThrow('403')
  })

  test('nội dung không phải ảnh dù Content-Type nói là ảnh', async () => {
    await expect(downloadImage(url, fakeFetch('<html>login</html>', { headers: { 'content-type': 'image/jpeg' } })))
      .rejects.toThrow('định dạng ảnh')
  })

  test('ảnh quá 5 MB bị từ chối, kể cả khi máy chủ không khai Content-Length', async () => {
    const huge = new Uint8Array(5 * 1024 * 1024 + 1)
    huge.set(PNG)
    await expect(downloadImage(url, fakeFetch(huge))).rejects.toThrow('quá lớn')
  })

  test('Content-Length khai quá lớn thì từ chối ngay', async () => {
    const declared = fakeFetch(bytes(PNG), { headers: { 'content-length': String(50 * 1024 * 1024) } })
    await expect(downloadImage(url, declared)).rejects.toThrow('quá lớn')
  })
})
