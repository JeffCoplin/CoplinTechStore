/**
 * Comprueba que el navegador pueda leer el video (p. ej. los MOV en HEVC de iPhone
 * no se reproducen en Chrome/Android). Resuelve false si no carga en `timeoutMs`.
 */
export function canPlayVideo(file: File, timeoutMs = 10_000): Promise<boolean> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    const done = (ok: boolean) => {
      clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(ok)
    }
    const timer = setTimeout(() => done(false), timeoutMs)
    video.preload = 'metadata'
    video.muted = true
    video.onloadedmetadata = () => done(video.videoWidth > 0 && video.videoHeight > 0)
    video.onerror = () => done(false)
    video.src = url
  })
}
