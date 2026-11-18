import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/components/AuthScreen'
import { authSearchSchema, redirectIfAuthenticated } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/login')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  component: LoginPage,
})

function LoginPage() {
  const { redirect } = Route.useSearch()
  return <AuthScreen mode="login" redirect={redirect} />
}
