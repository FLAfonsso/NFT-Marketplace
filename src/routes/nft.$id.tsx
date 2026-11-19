import { createFileRoute } from '@tanstack/react-router'
import { NftDetail } from '@/features/catalog/detail/NftDetail'
import { NftDetailError } from '@/features/catalog/detail/NftDetailError'
import { NftDetailSkeleton } from '@/features/catalog/detail/NftDetailSkeleton'
import { useNft } from '@/features/catalog/useNft'
import { APP_NAME, useDocumentTitle } from '@/lib/useDocumentTitle'

export const Route = createFileRoute('/nft/$id')({
  component: NftDetailPage,
})

function NftDetailPage() {
  const { id } = Route.useParams()
  // key: trocar de NFT reinicia edição, quantidade e galeria.
  return <NftDetailLoader key={id} id={id} />
}

function NftDetailLoader({ id }: { id: string }) {
  const { data, error, isPending, isFetching, refetch } = useNft(id)
  useDocumentTitle(`${data ? data.name : 'NFT'} | ${APP_NAME}`)

  // Refetch em segundo plano (tempo real, foco) não apaga a tela: só importa quando não há dado.
  if (data) return <NftDetail nft={data} />
  if (isPending && !error) return <NftDetailSkeleton />
  return <NftDetailError error={error} retrying={isFetching} onRetry={() => void refetch()} />
}
