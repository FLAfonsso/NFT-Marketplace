import { Link } from '@tanstack/react-router'
import { HeartIcon } from 'lucide-react'
import { Breadcrumb } from '@/components/Breadcrumb'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { Button, buttonVariants } from '@/components/ui/button'
import { NftGrid, NftGridSkeleton } from '@/features/catalog/list/NftGrid'
import { isApiRequestError } from '@/lib/api'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { cn } from '@/lib/utils'
import { useFavorites } from '../useFavorites'

/** Lista de interesse: os NFTs favoritados do usuário atual, com os mesmos cards do catálogo. */
export function FavoritesPage() {
  const isDesktop = useIsDesktop()
  const { query } = useFavorites()
  const items = query.data?.items

  let body
  if (!items && query.isError) {
    body = (
      <div
        role="alert"
        className="flex flex-col items-start gap-3 rounded-lg border border-destructive/40 bg-surface p-4"
      >
        <p className="font-bold text-destructive">Não foi possível carregar sua lista de interesse.</p>
        <p className="text-sm text-muted-foreground">
          {isApiRequestError(query.error) ? query.error.message : 'Ocorreu um erro inesperado.'}
        </p>
        <Button disabled={query.isFetching} onClick={() => void query.refetch()}>
          {query.isFetching ? 'Tentando…' : 'Tentar de novo'}
        </Button>
      </div>
    )
  } else if (!items) {
    body = <NftGridSkeleton testId="favorites-skeleton-grid" />
  } else if (items.length === 0) {
    body = (
      <div className="flex flex-col items-center gap-4 rounded-3xl bg-surface px-6 py-16 text-center md:rounded-lg">
        <HeartIcon className="size-10 text-primary" aria-hidden="true" />
        <h2 className="text-lg font-bold">Você ainda não favoritou nenhum NFT</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          Toque no coração de um NFT para guardá-lo aqui.
        </p>
        <Link to="/" className={cn(buttonVariants(), 'h-10 rounded-sm px-6 font-bold')}>
          Explorar NFTs
        </Link>
      </div>
    )
  } else {
    body = <NftGrid items={items} testId="favorites-grid" />
  }

  return (
    <>
      {isDesktop ? null : <MobileHeader title="Lista de interesse" />}
      <div className="mx-auto w-full max-w-[1200px] px-4 py-4 md:py-6 md:pb-16">
        {isDesktop && (
          <>
            <Breadcrumb
              className="mb-4"
              items={[{ label: 'Início', to: '/' }, { label: 'Lista de interesse' }]}
            />
            <h1 className="mb-6 text-2xl font-bold">Lista de interesse</h1>
          </>
        )}
        <div aria-busy={query.isPending}>{body}</div>
      </div>
    </>
  )
}
