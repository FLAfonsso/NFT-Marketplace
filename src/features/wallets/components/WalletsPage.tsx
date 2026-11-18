import { AccountLayout, QueryError, useUserId } from '@/features/account'
import { useProfile } from '@/features/profile'
import { useWallets } from '../useWallets'
import { PrimaryWalletSection } from './PrimaryWalletSection'
import { SecondaryWalletSection } from './SecondaryWalletSection'
import { WalletsSkeleton } from './WalletsSkeleton'

export function WalletsPage() {
  const userId = useUserId()
  return (
    <AccountLayout section="wallets" title="Carteiras">
      {userId && <WalletsContent userId={userId} />}
    </AccountLayout>
  )
}

function WalletsContent({ userId }: { userId: string }) {
  const wallets = useWallets(userId)
  // O contrato de carteira leva o nome de usuário do perfil.
  const profile = useProfile(userId)

  if (wallets.isPending || profile.isPending) {
    return (
      <div role="status" aria-label="Carregando carteiras">
        <WalletsSkeleton />
      </div>
    )
  }
  if (!wallets.data || !profile.data) {
    const failed = wallets.isError ? wallets : profile
    return (
      <QueryError
        what="as carteiras"
        error={failed.error}
        retrying={wallets.isFetching || profile.isFetching}
        onRetry={() => void Promise.all([wallets.refetch(), profile.refetch()])}
      />
    )
  }

  const primary = wallets.data.items.find((w) => w.role === 'primary')
  const secondary = wallets.data.items.find((w) => w.role === 'secondary')
  return (
    <div className="flex flex-col gap-10">
      <PrimaryWalletSection userId={userId} username={profile.data.username} primary={primary} />
      <SecondaryWalletSection userId={userId} username={profile.data.username} primary={primary} secondary={secondary} />
    </div>
  )
}
