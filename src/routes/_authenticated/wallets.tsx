import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'

export const Route = createFileRoute('/_authenticated/wallets')({
  component: WalletsPage,
})

function WalletsPage() {
  return <PageSkeleton title="Carteiras" />
}
