import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Đọc đúng file thật mà web sẽ phục vụ (apps/web/public), không phải bản sao trong test.
const publicDir = join(import.meta.dir, '../../../web/public')

type ManifestIcon = { src: string; sizes?: string; type?: string; purpose?: string }
type Manifest = {
  id?: string
  name: string
  start_url: string
  scope: string
  display: string
  icons: ManifestIcon[]
  shortcuts?: { name: string; url: string; icons?: ManifestIcon[] }[]
}

const manifest: Manifest = JSON.parse(readFileSync(join(publicDir, 'manifest.webmanifest'), 'utf8'))

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

/** Đọc width/height từ chunk IHDR (byte 16–24, big-endian). */
function pngSize(file: string): { width: number; height: number } {
  const bytes = readFileSync(file)
  expect([...bytes.subarray(0, 8)]).toEqual(PNG_SIGNATURE)
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
}

function localFile(src: string): string {
  expect(src.startsWith('/')).toBe(true)
  return join(publicDir, src.slice(1))
}

const allIcons: ManifestIcon[] = [
  ...manifest.icons,
  ...(manifest.shortcuts ?? []).flatMap((shortcut) => shortcut.icons ?? []),
]

describe('manifest.webmanifest', () => {
  test('khai báo đủ để cài được lên màn hình chính', () => {
    expect(manifest.id).toBe('/')
    expect(manifest.name).toBe('Personal Finance')
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url).toBe('/')
    expect(manifest.scope).toBe('/')
    expect(manifest.icons.some((icon) => icon.sizes === '192x192')).toBe(true)
    expect(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === undefined)).toBe(true)
    expect(manifest.icons.some((icon) => icon.sizes === '512x512' && icon.purpose === 'maskable')).toBe(true)
  })

  test('lối tắt "Thêm giao dịch" trỏ tới route mở form thêm', () => {
    const shortcut = manifest.shortcuts?.find((item) => item.url === '/transactions/new')
    expect(shortcut?.name).toBe('Thêm giao dịch')
  })

  test('mọi icons[].src và shortcuts[].icons[].src đều tồn tại trong apps/web/public', () => {
    expect(allIcons.length).toBeGreaterThan(0)
    for (const icon of allIcons) {
      expect(existsSync(localFile(icon.src))).toBe(true)
    }
  })

  test('kích thước PNG thật khớp với `sizes` khai báo', () => {
    let checked = 0
    for (const icon of allIcons) {
      if (icon.type !== 'image/png') continue
      const declared = icon.sizes?.match(/^(\d+)x(\d+)$/)
      expect(declared).not.toBeNull()
      const { width, height } = pngSize(localFile(icon.src))
      expect({ src: icon.src, width, height }).toEqual({
        src: icon.src,
        width: Number(declared![1]),
        height: Number(declared![2]),
      })
      checked++
    }
    expect(checked).toBeGreaterThan(0)
  })

  test('apple-touch-icon.png (index.html) là PNG 180x180', () => {
    const html = readFileSync(join(publicDir, '../index.html'), 'utf8')
    expect(html).toContain('href="/apple-touch-icon.png"')
    expect(pngSize(join(publicDir, 'apple-touch-icon.png'))).toEqual({ width: 180, height: 180 })
  })
})
