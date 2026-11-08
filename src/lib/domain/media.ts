/** ¿La ruta de la galería es un video? (misma regla que public.is_video_path en la BD). */
export function isVideoPath(path: string | null | undefined): boolean {
  return Boolean(path && /\.(mp4|webm|mov)$/i.test(path))
}
