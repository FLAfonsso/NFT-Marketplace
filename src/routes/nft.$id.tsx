import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'

export const Route = createFileRoute('/nft/$id')({
  component: NftDetailPage,
})

function NftDetailPage() {
  return <PageSkeleton title="Detalhes do NFT" />
}
