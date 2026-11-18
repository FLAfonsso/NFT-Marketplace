import { StarIcon } from 'lucide-react'
import type { NftRating } from '@/contracts'
import { cn } from '@/lib/utils'

const reviewsLabel = (count: number) => `${count} ${count === 1 ? 'avaliação' : 'avaliações'}`

/** Estrelas (decorativas) + texto com a nota e a contagem. */
export function Rating({ rating, className }: { rating: NftRating; className?: string }) {
  const filled = Math.round(rating.average)
  return (
    <p className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <span className="flex gap-0.5 text-primary" aria-hidden="true">
        {Array.from({ length: 5 }, (_, i) => (
          <StarIcon key={i} className={cn('size-3', i < filled ? 'fill-current' : 'opacity-40')} />
        ))}
      </span>
      <span>
        <span className="sr-only">Nota {rating.average.toFixed(1)} de 5, </span>
        {reviewsLabel(rating.count)}
      </span>
    </p>
  )
}
