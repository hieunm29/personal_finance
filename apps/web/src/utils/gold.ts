export type GoldUnit = 'phan' | 'chi' | 'luong'

export function calculateGoldValueFromPrice(
  unit: GoldUnit,
  quantity: number,
  goldPricePerLuong: number,
): number {
  const divisor = unit === 'luong' ? 1 : unit === 'chi' ? 10 : 100
  return Math.round((quantity * goldPricePerLuong) / divisor)
}

export function formatGoldQuantityLabel(unit: GoldUnit, quantity: number): string {
  return `${quantity} ${unit === 'luong' ? 'lượng' : unit === 'chi' ? 'chỉ' : 'phân'}`
}

export function getGoldPriceStatusMessage(goldPricePerLuong: number | null | undefined): string | null {
  if (goldPricePerLuong == null || goldPricePerLuong <= 0) {
    return 'Chưa cấu hình giá 1 lượng vàng'
  }

  return null
}

export function parseGoldMetadata(
  metadata: string | null | undefined,
): { unit: GoldUnit; quantity: number; purchaseAmount?: number } | null {
  if (!metadata) return null

  try {
    const parsed = JSON.parse(metadata) as { unit?: string; quantity?: number; purchaseAmount?: number }
    if (
      (parsed.unit === 'phan' || parsed.unit === 'chi' || parsed.unit === 'luong') &&
      typeof parsed.quantity === 'number' &&
      Number.isFinite(parsed.quantity)
    ) {
      return {
        unit: parsed.unit,
        quantity: parsed.quantity,
        ...(typeof parsed.purchaseAmount === 'number' && Number.isFinite(parsed.purchaseAmount)
          ? { purchaseAmount: parsed.purchaseAmount }
          : {}),
      }
    }
  } catch {
    return null
  }

  return null
}
