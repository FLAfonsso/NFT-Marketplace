import { ZoomInIcon } from 'lucide-react'
import { useState } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import type { NftImage } from '@/contracts'
import { cn } from '@/lib/utils'

/** Miniaturas verticais (só desktop) + imagem principal; a lupa abre a imagem num Dialog. */
export function Gallery({
  images,
  badge,
  name,
}: {
  images: readonly NftImage[]
  badge?: string
  name: string
}) {
  const [index, setIndex] = useState(0)
  const [zoom, setZoom] = useState(false)
  const current = images[index] ?? images[0]

  return (
    <div className="flex gap-4">
      <ul aria-label="Imagens do NFT" className="hidden w-[88px] shrink-0 flex-col gap-3 md:flex">
        {images.map((image, i) => (
          <li key={`${image.url}-${i}`}>
            <button
              type="button"
              aria-label={`Ver imagem ${i + 1} de ${images.length}`}
              aria-pressed={i === index}
              onClick={() => setIndex(i)}
              className={cn(
                'block aspect-square w-full overflow-hidden rounded-lg border bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring',
                i === index ? 'border-primary' : 'border-transparent opacity-80 hover:opacity-100',
              )}
            >
              <img src={image.url} alt={image.alt} className="size-full object-cover" />
            </button>
          </li>
        ))}
      </ul>

      <div className="relative aspect-square w-full overflow-hidden bg-surface md:rounded-lg md:p-4">
        {current && (
          <img
            src={current.url}
            alt={current.alt}
            className="size-full object-cover md:rounded-2xl"
          />
        )}
        {badge && (
          <span className="absolute top-14 left-3 rounded-sm bg-primary px-2 py-0.5 text-[10px] font-bold text-primary-foreground md:top-6 md:left-6">
            {badge}
          </span>
        )}
        <button
          type="button"
          aria-label="Ampliar imagem"
          onClick={() => setZoom(true)}
          className="absolute right-3 bottom-9 grid size-9 place-items-center rounded-full bg-background/80 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring md:top-6 md:right-6 md:bottom-auto"
        >
          <ZoomInIcon className="size-4" aria-hidden="true" />
        </button>
      </div>

      <Dialog open={zoom} onOpenChange={setZoom}>
        <DialogContent className="max-w-[min(92vw,720px)] sm:max-w-[min(92vw,720px)]">
          <DialogTitle className="sr-only">{name}: imagem ampliada</DialogTitle>
          {current && (
            <img
              src={current.url}
              alt={current.alt}
              className="max-h-[80dvh] w-full rounded-lg object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
