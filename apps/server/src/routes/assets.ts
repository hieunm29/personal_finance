import { Hono } from 'hono'
import { z } from 'zod'
import { zValidator } from '@hono/zod-validator'
import { createAssetSchema, updateAssetSchema } from '@pf/shared'
import {
  getAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getNetWorth,
  updateAssetValue,
  getNetWorthHistory,
} from '../services/assetService'

type Variables = { userId: string }
const assetRoute = new Hono<{ Variables: Variables }>()

const valueSchema = z.object({ newValue: z.number().int().min(0) })

assetRoute.get('/networth', (c) => {
  const data = getNetWorth(c.get('userId'))
  return c.json({ data })
})

const historyQuerySchema = z.object({ limit: z.coerce.number().int().positive().optional() })

assetRoute.get('/networth-history', zValidator('query', historyQuerySchema), (c) => {
  const { limit } = c.req.valid('query')
  const data = getNetWorthHistory(c.get('userId'), limit)
  return c.json({ data })
})

assetRoute.get('/', (c) => {
  const type = c.req.query('type')
  const data = getAssets(c.get('userId'), type)
  return c.json({ data })
})

assetRoute.post('/', zValidator('json', createAssetSchema), (c) => {
  const asset = createAsset(c.get('userId'), c.req.valid('json'))
  return c.json({ data: asset }, 201)
})

assetRoute.put('/:id/value', zValidator('json', valueSchema), (c) => {
  const asset = updateAssetValue(c.get('userId'), c.req.param('id'), c.req.valid('json').newValue)
  return c.json({ data: asset })
})

assetRoute.put('/:id', zValidator('json', updateAssetSchema), (c) => {
  const asset = updateAsset(c.get('userId'), c.req.param('id'), c.req.valid('json'))
  return c.json({ data: asset })
})

assetRoute.delete('/:id', (c) => {
  deleteAsset(c.get('userId'), c.req.param('id'))
  return c.body(null, 204)
})

export default assetRoute
