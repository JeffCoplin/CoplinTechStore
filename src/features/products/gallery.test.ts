import { describe, expect, it } from 'vitest'
import { isVideoPath } from '@/lib/domain/media'
import { galleryChanged, isVideoItem, makePrimary, moveItem, removeAt, videosFirst, type GalleryItem } from './gallery'
import { validateVideoFile } from './schema'

const item = (path: string | null, file = false): GalleryItem => ({ key: path ?? 'new', path, file: file ? new File(['x'], 'a.webp') : null, preview: '' })

describe('galería del producto', () => {
  it('mueve, hace principal y elimina', () => {
    expect(moveItem(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b'])
    expect(moveItem(['a', 'b'], 0, 5)).toEqual(['a', 'b'])
    expect(makePrimary(['a', 'b', 'c'], 2)).toEqual(['c', 'a', 'b'])
    expect(removeAt(['a', 'b', 'c'], 1)).toEqual(['a', 'c'])
  })

  it('pone los videos primero y reconoce videos por ruta o archivo', () => {
    expect(isVideoPath('products/x.mp4')).toBe(true)
    expect(isVideoPath('products/x.MOV')).toBe(true)
    expect(isVideoPath('products/x.webp')).toBe(false)
    const newVideo: GalleryItem = { key: 'nv', path: null, file: new File(['x'], 'v.mp4', { type: 'video/mp4' }), preview: '' }
    expect(isVideoItem(newVideo)).toBe(true)
    expect(isVideoItem(item(null, true))).toBe(false)
    const ordered = videosFirst([item('a.webp'), item('v1.mp4'), item('b.webp'), newVideo])
    expect(ordered.map((i) => i.key)).toEqual(['v1.mp4', 'nv', 'a.webp', 'b.webp'])
  })

  it('valida videos: formato y 50 MB', () => {
    const MB = 1024 * 1024
    expect(validateVideoFile({ type: 'video/mp4', size: 14 * MB })).toBeNull()
    expect(validateVideoFile({ type: 'video/quicktime', size: 30 * MB })).toBeNull()
    expect(validateVideoFile({ type: 'video/mp4', size: 51 * MB })).toMatch(/50 MB/)
    expect(validateVideoFile({ type: 'video/x-msvideo', size: MB })).toMatch(/Formato/)
  })

  it('detecta cambios de orden, altas y bajas', () => {
    const saved = ['p1', 'p2']
    expect(galleryChanged([item('p1'), item('p2')], saved)).toBe(false)
    expect(galleryChanged([item('p2'), item('p1')], saved)).toBe(true)
    expect(galleryChanged([item('p1')], saved)).toBe(true)
    expect(galleryChanged([item('p1'), item('p2'), item(null, true)], saved)).toBe(true)
  })
})
