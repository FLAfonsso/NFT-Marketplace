import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeftIcon, HeartIcon, MailIcon, ShoppingCartIcon, StarIcon } from 'lucide-react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { ComingSoon } from '@/components/ComingSoon'
import { Button } from '@/components/ui/button'
import type { Nft } from '@/contracts'
import { useFavorites } from '@/features/favorites'
import { formatEth } from '@/lib/eth'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { DetailTabs } from './DetailTabs'
import { EditionPicker } from './EditionPicker'
import { Gallery } from './Gallery'
import { QuantityStepper } from './QuantityStepper'
import { Rating } from './Rating'
import { RelatedCarousel } from './RelatedCarousel'
import { useNftChangeAnnouncer } from './useNftChangeAnnouncer'
import { usePurchase } from './usePurchase'

const roundIcon =
  'grid size-10 place-items-center rounded-full bg-background/70 outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring'

function FavoriteButton({ nft, variant }: { nft: Nft; variant: 'desktop' | 'mobile' }) {
  const { isFavorite, toggle, busy } = useFavorites()
  const pressed = isFavorite(nft.id)
  const heart = <HeartIcon className={cn('size-4', pressed && 'fill-current')} aria-hidden="true" />

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        aria-label="Favoritar"
        aria-pressed={pressed}
        disabled={busy}
        onClick={() => toggle(nft)}
        className={cn(roundIcon, pressed && 'text-primary', 'disabled:opacity-60')}
      >
        {heart}
      </button>
    )
  }
  return (
    <Button
      variant="outline"
      aria-pressed={pressed}
      disabled={busy}
      onClick={() => toggle(nft)}
      className="h-9 gap-2 rounded-sm border-primary px-4 text-primary hover:bg-primary/10"
    >
      {heart}
      Favoritar
    </Button>
  )
}

function BackButton() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return canGoBack ? (
    <button type="button" aria-label="Voltar" onClick={() => router.history.back()} className={roundIcon}>
      <ArrowLeftIcon className="size-5" aria-hidden="true" />
    </button>
  ) : (
    <Link to="/" aria-label="Voltar" className={roundIcon}>
      <ArrowLeftIcon className="size-5" aria-hidden="true" />
    </Link>
  )
}

function Meta({ nft, className }: { nft: Nft; className?: string }) {
  const attributes = nft.attributes.map((a) => a.value).join(', ')
  return (
    <ul className={cn('flex flex-col gap-3 text-sm text-muted-foreground', className)}>
      <li>ID do token: #{nft.tokenId}</li>
      <li>Coleção: {nft.collectionName}</li>
      {attributes && <li>Atributos: {attributes}</li>}
    </ul>
  )
}

function Share() {
  const item = 'grid size-6 place-items-center text-sm font-bold hover:text-primary'
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="font-bold">Compartilhar este NFT:</span>
      <ComingSoon as="button" aria-label="Compartilhar no LinkedIn (indisponível nesta versão)" className={item}>
        in
      </ComingSoon>
      <ComingSoon as="button" aria-label="Compartilhar por e-mail (indisponível nesta versão)" className={item}>
        <MailIcon className="size-4" aria-hidden="true" />
      </ComingSoon>
      <ComingSoon as="button" aria-label="Compartilhar no X (indisponível nesta versão)" className={item}>
        X
      </ComingSoon>
    </div>
  )
}

export function NftDetail({ nft }: { nft: Nft }) {
  const isDesktop = useIsDesktop()
  const purchase = usePurchase(nft)
  const liveMessage = useNftChangeAnnouncer(nft, {
    editionId: purchase.edition?.id ?? null,
    quantity: purchase.quantity,
  })
  const price = `${formatEth(nft.price)} ETH`
  const compareAt = nft.compareAtPrice ? `${formatEth(nft.compareAtPrice)} ETH` : null

  // Mudanças em tempo real (preço, estoque, seleção ajustada), anunciadas sem roubar o foco.
  const live = (
    <p aria-live="polite" className="sr-only">
      {liveMessage}
    </p>
  )
  const stock = purchase.edition && (
    <p className="text-xs text-muted-foreground">
      Edição {purchase.edition.name}: {purchase.edition.available}{' '}
      {purchase.edition.available === 1 ? 'disponível' : 'disponíveis'}
    </p>
  )

  const alert = purchase.error && (
    <p role="alert" className="rounded-sm border border-destructive/40 bg-surface px-3 py-2 text-xs text-destructive">
      {purchase.error}
    </p>
  )
  const soldOutNotice = purchase.soldOut && (
    <p role="status" className="text-sm text-muted-foreground">
      Todas as edições estão esgotadas no momento.
    </p>
  )

  const editions = (
    <EditionPicker
      editions={nft.editions}
      value={purchase.edition?.id ?? null}
      onChange={purchase.selectEdition}
    />
  )

  const stepper = (compact?: boolean) => (
    <QuantityStepper
      value={purchase.quantity}
      max={purchase.max}
      disabled={purchase.soldOut}
      compact={compact}
      onChange={purchase.changeQuantity}
    />
  )

  if (!isDesktop) {
    return (
      <div className="pb-60">
        <div className="relative">
          <Gallery images={nft.gallery} badge={nft.badge} name={nft.name} />
          <div className="absolute inset-x-4 top-4 flex justify-between">
            <BackButton />
            <FavoriteButton nft={nft} variant="mobile" />
          </div>
        </div>

        <div className="relative -mt-6 flex flex-col gap-4 rounded-t-3xl bg-surface p-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold">{nft.name}</h1>
            <p className="flex shrink-0 items-center gap-1 rounded-full border border-primary px-2.5 py-1 text-xs font-bold text-primary">
              <StarIcon className="size-3 fill-current" aria-hidden="true" />
              <span>
                <span className="sr-only">Nota </span>
                {nft.rating.average.toFixed(1)}
                <span className="font-normal"> ({nft.rating.count}<span className="sr-only"> avaliações</span>)</span>
              </span>
            </p>
          </div>
          <p className="text-sm text-muted-foreground">{nft.description}</p>
          {editions}
          <Meta nft={nft} />
          <DetailTabs nft={nft} />
          <RelatedCarousel nft={nft} />
        </div>

        <div className="fixed inset-x-0 bottom-0 z-40 flex flex-col gap-3 rounded-t-3xl border-t border-border bg-surface px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="pt-1.5 text-sm text-muted-foreground">Qtd.</span>
              {stepper(true)}
            </div>
            <p className="pt-1 text-right font-bold text-primary">
              <span className="text-lg">{price}</span>
              {compareAt && <span className="block text-xs font-normal text-muted-foreground line-through">{compareAt}</span>}
            </p>
          </div>
          {stock}
          {alert}
          {soldOutNotice}
          {live}
          <div className="flex items-center gap-3">
            <Button
              disabled={purchase.soldOut || purchase.submitting}
              onClick={() => void purchase.buy()}
              className="h-14 flex-1 rounded-full bg-linear-to-b from-primary to-[#B27A47] text-base font-bold"
            >
              Comprar NFT
            </Button>
            <button
              type="button"
              aria-label="Adicionar ao carrinho"
              disabled={purchase.soldOut || purchase.submitting}
              onClick={() => void purchase.addOnly()}
              className="grid size-14 place-items-center rounded-full border border-border bg-background/40 text-primary outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            >
              <ShoppingCartIcon className="size-5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-16 px-4 pt-6 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumb
          items={[{ label: 'Início', to: '/' }, { label: 'Mercado', to: '/' }]}
        />
        <div className="grid grid-cols-[minmax(0,540px)_minmax(0,1fr)] gap-8">
          <Gallery images={nft.gallery} badge={nft.badge} name={nft.name} />

          <div className="flex flex-col gap-4">
            <h1 className="text-3xl font-bold">{nft.name}</h1>
            <div className="flex items-center justify-between gap-4 border-b border-border pb-2">
              <p className="flex items-baseline gap-3 text-2xl font-bold text-primary">
                {price}
                {compareAt && (
                  <span className="text-sm font-normal text-muted-foreground line-through">{compareAt}</span>
                )}
              </p>
              <Rating rating={nft.rating} />
            </div>

            <div className="flex flex-col gap-1">
              <h2 className="text-sm font-bold">Sobre este NFT:</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">{nft.description}</p>
            </div>

            {editions}

            <div className="flex items-start justify-between gap-4">
              {stepper()}
              <div className="flex gap-3">
                <Button
                  disabled={purchase.soldOut || purchase.submitting}
                  onClick={() => void purchase.buy()}
                  className="h-9 rounded-sm px-8 font-bold uppercase"
                >
                  Comprar
                </Button>
                <FavoriteButton nft={nft} variant="desktop" />
              </div>
            </div>
            {stock}
            {alert}
            {soldOutNotice}
            {live}

            <Meta nft={nft} />
            <Share />
          </div>
        </div>
      </div>

      <DetailTabs nft={nft} />
      <RelatedCarousel nft={nft} />
    </div>
  )
}
