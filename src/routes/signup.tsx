import { createFileRoute } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'
import { authSearchSchema, redirectIfAuthenticated } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/signup')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  component: SignupPage,
})

function SignupPage() {
  return <PageSkeleton title="Criar conta" />
}
