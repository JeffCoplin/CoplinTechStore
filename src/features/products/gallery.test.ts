import { describe, expect, it } from 'vitest'
import { galleryChanged, makePrimary, moveItem, removeAt, type GalleryItem } from './gallery'

const item = (path: string | null, file = false): GalleryItem => ({ key: path ?? 'new', path, file: file ? new File(['x'], 'a.webp') : null, preview: '' })

describe('galería del producto', () => {
  it('mueve, hace principal y elimina', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(makePrimary(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b'])
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  it('detecta cambios de orden, altas y bajas', () => {
    const saved = ['p1', 'p2']
    expect(galleryChanged([item('p1'), item('p2')], saved)).toBe(false)
    expect(galleryChanged([item('p2'), item('p1')], saved)).toBe(true)
    expect(galleryChanged([item('p1')], saved)).toBe(true)
    expect(galleryChanged([item('p1'), item('p2'), item(null, true)], saved)).toBe(true)
  })
})
