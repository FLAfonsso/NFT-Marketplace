import { createFileRoute } from '@tanstack/react-router'
import { AuthScreen } from '@/features/auth/components/AuthScreen'
import { authSearchSchema, redirectIfAuthenticated } from '@/features/auth/routeGuards'

export const Route = createFileRoute('/signup')({
  validateSearch: authSearchSchema,
  beforeLoad: redirectIfAuthenticated,
  component: SignupPage,
})

function SignupPage() {
  const { redirect } = Route.useSearch()
  return <AuthScreen mode="signup" redirect={redirect} />
}
