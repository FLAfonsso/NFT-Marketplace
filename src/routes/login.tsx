import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'
import { authSearchSchema, redirectIfAuthenticated } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
})

function LoginPage() {
  return <PageSkeleton title="Entrar" />
}
