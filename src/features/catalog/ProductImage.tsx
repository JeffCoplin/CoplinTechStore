import { ImageOff } from 'lucide-react'
import { useState } from 'react'
import { productImageUrl } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

export function ProductImage({ path, alt, className }: { path: string | null; alt: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  const url = productImageUrl(path)
  if (!url || failed) {
    return (
      <div className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)} aria-label="Sin imagen" role="img">
        <ImageOff className="size-8" aria-hidden />
      </div>
    )
  }
  return <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={cn('object-cover', className)} />
}
