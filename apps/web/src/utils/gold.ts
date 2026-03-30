export type GoldUnit = 'chi' | 'luong'

export function calculateGoldValueFromPrice(
  unit: GoldUnit,
  quantity: number,
  goldPricePerLuong: number,
): number {
  if (unit === 'luong') {
    return Math.round(quantity * goldPricePerLuong)
  }

  return Math.round((quantity * goldPricePerLuong) / 10)
}

export function formatGoldQuantityLabel(unit: GoldUnit, quantity: number): string {
  return `${quantity} ${unit === 'chi' ? 'chỉ' : 'lượng'}`
}

export function getGoldPriceStatusMessage(goldPricePerLuong: number | null | undefined): string | null {
  if (goldPricePerLuong == null || goldPricePerLuong <= 0) {
    return 'Chưa cấu hình giá 1 lượng vàng'
  }

  return null
}

export function parseGoldMetadata(
  metadata: string | null | undefined,
): { unit: GoldUnit; quantity: number } | null {
  if (!metadata) return null

  try {
    const parsed = JSON.parse(metadata) as { unit?: string; quantity?: number }
    if (
      (parsed.unit === 'chi' || parsed.unit === 'luong') &&
      typeof parsed.quantity === 'number' &&
      Number.isFinite(parsed.quantity)
    ) {
      return {
        unit: parsed.unit,
        quantity: parsed.quantity,
      }
    }
  } catch {
    return null
  }

  return null
}
