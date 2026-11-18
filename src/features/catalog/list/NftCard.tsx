import { Link } from '@tanstack/react-router'
import { EyeIcon, HeartIcon, ShoppingCartIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Badge } from '@/components/ui/badge'
import type { Nft } from '@/contracts'
import { formatEth } from '@/lib/eth'
import { cn } from '@/lib/utils'

/** Dimensões compartilhadas com o skeleton: os dois ocupam exatamente o mesmo espaço. */
export const cardImageBox = 'aspect-square rounded-3xl p-2 md:rounded-lg'
export const cardTextRow = 'mt-2 flex h-5 items-center text-sm leading-5'

const action =
  'grid size-8 place-items-center rounded-full border border-border bg-background/90 text-foreground outline-none transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring aria-disabled:opacity-60'

function ActionButton({ className, ...props }: ComponentProps<'button'>) {
  return <button type="button" className={cn(action, className)} {...props} />
}

/**
 * Card do catálogo. O card inteiro é o link para o detalhe; as ações (carrinho, favorito, ver)
 * são irmãs do link, sobrepostas à imagem, para não aninhar controles interativos. Aparecem no
 * hover e no foco; em telas de toque ficam sempre visíveis.
 */
export function NftCard({
  nft,
  isFavorite,
  onToggleFavorite,
  favoriteBusy,
  onAddToCart,
  adding,
}: {
  nft: Nft
  isFavorite: boolean
  onToggleFavorite: (nft: Nft) => void
  favoriteBusy: boolean
  onAddToCart: (nft: Nft) => void
  adding: boolean
}) {
  const image = nft.gallery[0]
  const soldOut = !nft.editions.some((edition) => edition.available > 0)
  return (
    <li className="group relative">
      <Link
        to="/nft/$id"
        params={{ id: nft.id }}
        className="block rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-ring md:rounded-lg"
      >
        <div className={cn(cardImageBox, 'relative overflow-hidden bg-surface')}>
          <img
            src={image?.url}
            alt={image?.alt || nft.name}
            loading="lazy"
            className="size-full rounded-2xl object-cover md:rounded-md"
          />
          {nft.badge && (
            <Badge className="absolute top-2 left-2 h-6 rounded-none rounded-tl-2xl px-3 text-xs font-bold md:rounded-tl-md">
              {nft.badge}
            </Badge>
          )}
        </div>
        <div className={cn(cardTextRow, 'truncate')}>
          <span className="truncate">{nft.name}</span>
        </div>
        <div className={cn(cardTextRow, 'mt-0 gap-2')}>
          <span className="font-bold text-primary">{formatEth(nft.price)} ETH</span>
          {nft.compareAtPrice && (
            <span className="text-xs text-muted-foreground">
              <span className="sr-only">Preço antigo </span>
              <s>{formatEth(nft.compareAtPrice)} ETH</s>
            </span>
          )}
        </div>
      </Link>

      <div
        className={cn(
          'absolute top-4 right-4 flex flex-col gap-1.5 opacity-0 transition-opacity motion-reduce:transition-none',
          'group-hover:opacity-100 group-focus-within:opacity-100 max-md:opacity-100 pointer-coarse:opacity-100',
        )}
      >
        <ActionButton
          aria-label={isFavorite ? `Remover ${nft.name} dos favoritos` : `Favoritar ${nft.name}`}
          aria-pressed={isFavorite}
          aria-disabled={favoriteBusy}
          onClick={() => {
            if (!favoriteBusy) onToggleFavorite(nft)
          }}
        >
          <HeartIcon className={cn('size-4', isFavorite && 'fill-primary text-primary')} aria-hidden="true" />
        </ActionButton>
        <ActionButton
          aria-label={soldOut ? `${nft.name}: esgotado` : `Adicionar ${nft.name} ao carrinho`}
          aria-disabled={soldOut || adding}
          onClick={() => {
            if (!soldOut && !adding) onAddToCart(nft)
          }}
        >
          <ShoppingCartIcon className="size-4" aria-hidden="true" />
        </ActionButton>
        <Link
          to="/nft/$id"
          params={{ id: nft.id }}
          aria-label={`Ver ${nft.name}`}
          className={action}
        >
          <EyeIcon className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </li>
  )
}

/** Mesmas dimensões do NftCard, para o carregamento não deslocar o layout. */
export function NftCardSkeleton() {
  return (
    <li aria-hidden="true">
      <div className={cn(cardImageBox, 'shimmer')} />
      <div className={cardTextRow}>
        <div className="shimmer h-4 w-3/4 rounded-sm" />
      </div>
      <div className={cardTextRow.replace('mt-2', 'mt-0')}>
        <div className="shimmer h-4 w-1/3 rounded-sm" />
      </div>
    </li>
  )
}
