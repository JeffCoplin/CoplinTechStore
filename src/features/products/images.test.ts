import { describe, expect, it } from 'vitest'
import { fitWithin } from './compress-image'
import { validateImageFile, validateUploadImage } from './schema'

const MB = 1024 * 1024

describe('optimización de imágenes de producto', () => {
  it('reduce el lado mayor a 1200 px conservando la proporción', () => {
    expect(fitWithin(3024, 4032)).toEqual({ width: 900, height: 1200 })
    expect(fitWithin(4000, 3000)).toEqual({ width: 1200, height: 900 })
    expect(fitWithin(1600, 1600)).toEqual({ width: 1200, height: 1200 })
  })

  it('no agranda imágenes pequeñas', () => {
    expect(fitWithin(720, 960)).toEqual({ width: 720, height: 960 })
  })

  it('acepta fotos grandes antes de optimizar, pero exige ≤ 5 MB al subir', () => {
    expect(validateImageFile({ type: 'image/jpeg', size: 12 * MB })).toBeNull()
    expect(validateImageFile({ type: 'image/jpeg', size: 25 * MB })).toMatch(/20 MB/)
    expect(validateImageFile({ type: 'image/gif', size: MB })).toMatch(/Formato/)
    expect(validateUploadImage({ type: 'image/webp', size: 200 * 1024 })).toBeNull()
    expect(validateUploadImage({ type: 'image/jpeg', size: 6 * MB })).toMatch(/5 MB/)
  })
})
