import { AccountLayout, QueryError, useUserId } from '@/features/account'
import { useProfile } from '../useProfile'
import { ProfileForm } from './ProfileForm'
import { ProfileSkeleton } from './ProfileSkeleton'

export function ProfilePage() {
  const userId = useUserId()
  return (
    <AccountLayout section="profile" title="Perfil do colecionador" heading>
      {userId && <ProfileContent userId={userId} />}
    </AccountLayout>
  )
}

function ProfileContent({ userId }: { userId: string }) {
  const profile = useProfile(userId)

  if (profile.isPending) {
    return (
      <div role="status" aria-label="Carregando perfil">
        <ProfileSkeleton />
      </div>
    )
  }
  if (profile.isError && !profile.data) {
    return (
      <QueryError
        what="o perfil"
        error={profile.error}
        retrying={profile.isFetching}
        onRetry={() => void profile.refetch()}
      />
    )
  }
  return <ProfileForm userId={userId} profile={profile.data} />
}
