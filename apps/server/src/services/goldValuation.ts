import type { GoldAssetMetadata, GoldUnit } from '@pf/shared'

type GoldAssetRow = {
  id: string
  metadata: string | null
}

function assertSupportedGoldUnit(unit: unknown): GoldUnit {
  if (unit !== 'chi' && unit !== 'luong') {
    throw new Error('Đơn vị vàng chỉ hỗ trợ chi hoặc lượng')
  }

  return unit
}

function assertQuantity(quantity: unknown): number {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity) || quantity < 0) {
    throw new Error('Số lượng vàng không hợp lệ')
  }

  return quantity
}

export function parseGoldMetadata(metadata: string | null | undefined): GoldAssetMetadata {
  if (!metadata) {
    throw new Error('Thiếu thông tin vàng')
  }

  let parsed: unknown

  try {
    parsed = JSON.parse(metadata)
  } catch {
    throw new Error('Thông tin vàng không hợp lệ')
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Thông tin vàng không hợp lệ')
  }

  const record = parsed as Record<string, unknown>

  return {
    unit: assertSupportedGoldUnit(record.unit),
    quantity: assertQuantity(record.quantity),
  }
}

export function serializeGoldMetadata(metadata: GoldAssetMetadata): string {
  return JSON.stringify(metadata)
}

export function calculateGoldAssetValue(
  metadata: GoldAssetMetadata,
  goldPricePerLuong: number | null | undefined,
): number {
  if (goldPricePerLuong == null || goldPricePerLuong <= 0) {
    throw new Error('Chưa cấu hình giá 1 lượng vàng')
  }

  if (metadata.unit === 'luong') {
    return Math.round(metadata.quantity * goldPricePerLuong)
  }

  return Math.round((metadata.quantity * goldPricePerLuong) / 10)
}

export function buildGoldRevaluationUpdates(
  goldAssets: GoldAssetRow[],
  goldPricePerLuong: number | null | undefined,
) {
  return goldAssets.map((asset) => {
    const metadata = parseGoldMetadata(asset.metadata)

    return {
      id: asset.id,
      currentValue: calculateGoldAssetValue(metadata, goldPricePerLuong),
      metadata: serializeGoldMetadata(metadata),
    }
  })
}

export function assertGoldManualValueUpdateAllowed(assetType: string): void {
  if (assetType === 'gold') {
    throw new Error('Giá trị vàng được tính từ giá 1 lượng vàng trong Cài đặt')
  }
}
