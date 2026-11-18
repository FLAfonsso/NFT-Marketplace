import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'

export const Route = createFileRoute('/_authenticated/profile')({
  component: ProfilePage,
})

function ProfilePage() {
  return <PageSkeleton title="Perfil do colecionador" />
}
