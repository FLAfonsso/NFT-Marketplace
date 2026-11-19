import { Link } from '@tanstack/react-router'
import { CheckCircle2Icon, EllipsisVerticalIcon, LoaderCircleIcon, WalletIcon } from 'lucide-react'
import { useId, useRef } from 'react'
import { Button } from '@/components/ui/button'
import type { Wallet, WalletType } from '@/contracts'
import { Bone } from '@/features/cart'
import { cn } from '@/lib/utils'
import { NETWORK_LABELS, PROVIDERS, shortAddress } from '../labels'
import type { WalletConnectionState } from '../useWalletConnection'

const card = 'rounded-3xl bg-surface md:rounded-sm md:border md:border-border md:bg-transparent'
const radio =
  'size-4 shrink-0 cursor-pointer appearance-none rounded-full border-2 border-muted-foreground/60 outline-none checked:border-[5px] checked:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed'

function ProviderIcon({ provider }: { provider: WalletType }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-10 shrink-0 place-items-center rounded-full border border-border bg-background/40 text-sm font-bold text-primary"
    >
      {provider === 'Coinbase Wallet' ? <WalletIcon className="size-4" /> : provider[0]}
    </span>
  )
}

export function WalletListSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-3">
      {[0, 1].map((i) => (
        <div key={i} className={cn(card, 'flex h-[92px] items-center gap-4 px-5')}>
          <Bone className="skeleton-bone-strong size-4 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Bone className="skeleton-bone-strong h-4 w-24" />
            <Bone className="skeleton-bone-strong h-3 w-40" />
            <Bone className="skeleton-bone-strong h-3 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}

function statusText(state: WalletConnectionState, wallet: Wallet | undefined, provider: WalletType | null) {
  const name = wallet ? `${wallet.nickname} (${shortAddress(wallet.address)})` : 'a carteira'
  switch (state.status) {
    case 'idle':
      return 'Carteira desconectada. Conecte para confirmar a compra.'
    case 'connecting':
      return `Conectando ${name} via ${provider ?? 'carteira'}…`
    case 'connected':
      return `Conectada: ${name} via ${state.connection.provider}, rede ${NETWORK_LABELS[state.connection.network]}.`
    case 'rejected':
      return `${state.message} Você pode tentar de novo.`
    case 'failed':
      return `Não foi possível conectar: ${state.message}`
    case 'disconnected':
      return 'Carteira desconectada.'
  }
}

/**
 * Carteiras cadastradas (seleção + "Trocar carteira") e "Carteira e rede" (provedor, como
 * radiogroup), com a conexão simulada: status anunciado em role="status".
 */
export function WalletSection({
  wallets,
  loading,
  loadError,
  onRetryLoad,
  selectedId,
  onSelect,
  provider,
  onProvider,
  connection,
  onConnect,
  onDisconnect,
  disabled,
}: {
  wallets: readonly Wallet[] | undefined
  loading: boolean
  loadError: string | null
  onRetryLoad: () => void
  selectedId: string
  onSelect: (wallet: Wallet) => void
  provider: WalletType | null
  onProvider: (provider: WalletType) => void
  connection: WalletConnectionState
  onConnect: () => void
  onDisconnect: () => void
  disabled: boolean
}) {
  const walletsTitle = useId()
  const providersTitle = useId()
  const listRef = useRef<HTMLDivElement>(null)
  const selected = wallets?.find((w) => w.id === selectedId)
  const connecting = connection.status === 'connecting'
  const connected = connection.status === 'connected'

  const swapWallet = () => {
    onDisconnect()
    listRef.current?.querySelector<HTMLInputElement>('input:checked, input')?.focus()
  }

  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby={walletsTitle} className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id={walletsTitle} className="font-bold">
            Carteira conectada
          </h2>
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 font-bold"
            disabled={disabled || !wallets || wallets.length < 2}
            onClick={swapWallet}
          >
            Trocar carteira
          </Button>
        </div>

        {loading ? (
          <WalletListSkeleton />
        ) : loadError ? (
          <div role="alert" className="flex flex-wrap items-center gap-3 rounded-sm border border-destructive/40 p-4 text-sm text-destructive">
            {loadError}
            <Button type="button" variant="outline" size="sm" onClick={onRetryLoad}>
              Tentar de novo
            </Button>
          </div>
        ) : wallets && wallets.length === 0 ? (
          <p className="rounded-sm border border-border p-4 text-sm text-muted-foreground">
            Nenhuma carteira cadastrada.{' '}
            <Link to="/wallets" className="text-primary underline-offset-4 hover:underline">
              Cadastrar carteira
            </Link>
          </p>
        ) : (
          <div ref={listRef} role="radiogroup" aria-labelledby={walletsTitle} className="flex flex-col gap-3">
            {wallets?.map((wallet) => (
              <div key={wallet.id} className={cn(card, 'relative flex items-center has-checked:md:border-primary')}>
                <label className="flex flex-1 cursor-pointer items-center gap-4 py-4 pr-12 pl-5">
                  <input
                    type="radio"
                    name="registered-wallet"
                    value={wallet.id}
                    checked={wallet.id === selectedId}
                    disabled={disabled}
                    onChange={() => onSelect(wallet)}
                    className={radio}
                  />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="font-bold">
                      {wallet.nickname}
                      {wallet.role === 'primary' && (
                        <span className="ml-2 text-xs font-normal text-muted-foreground">principal</span>
                      )}
                    </span>
                    <span className="truncate text-sm text-muted-foreground">
                      {shortAddress(wallet.address)}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Rede {NETWORK_LABELS[wallet.network]}
                    </span>
                  </span>
                </label>
                <Link
                  to="/wallets"
                  aria-label={`Gerenciar carteira ${wallet.nickname}`}
                  className="absolute top-1/2 right-3 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground outline-none hover:text-primary focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <EllipsisVerticalIcon className="size-4" aria-hidden="true" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby={providersTitle} className="flex flex-col gap-3">
        <h2 id={providersTitle} className="font-bold md:text-center">
          Carteira e rede
        </h2>
        <div role="radiogroup" aria-labelledby={providersTitle} className="flex flex-col gap-3">
          {PROVIDERS.map((option) => (
            <label
              key={option}
              className={cn(
                card,
                'flex cursor-pointer items-center gap-4 px-4 py-3 has-checked:md:border-foreground has-disabled:cursor-not-allowed',
              )}
            >
              <ProviderIcon provider={option} />
              <span className="flex-1 text-sm">{option}</span>
              <input
                type="radio"
                name="wallet-provider"
                value={option}
                checked={provider === option}
                disabled={disabled}
                onChange={() => onProvider(option)}
                className={radio}
              />
            </label>
          ))}
        </div>

        <div className="flex flex-col gap-3 rounded-sm border border-border p-4">
          <p
            role="status"
            className={cn(
              'flex items-start gap-2 text-sm',
              connected ? 'text-foreground' : 'text-muted-foreground',
              (connection.status === 'rejected' || connection.status === 'failed') && 'text-destructive',
            )}
          >
            {connecting && <LoaderCircleIcon className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
            {connected && <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />}
            {statusText(connection, selected, provider)}
          </p>
          {connected ? (
            <Button type="button" variant="outline" disabled={disabled} onClick={onDisconnect}>
              Desconectar
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              disabled={disabled || connecting || !selected || !provider}
              onClick={onConnect}
            >
              {connecting
                ? 'Conectando…'
                : connection.status === 'rejected' || connection.status === 'failed'
                  ? 'Tentar de novo'
                  : 'Conectar carteira'}
            </Button>
          )}
        </div>
      </section>
    </div>
  )
}
