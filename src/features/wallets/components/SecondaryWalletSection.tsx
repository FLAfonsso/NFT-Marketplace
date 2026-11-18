import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { Wallet } from '@/contracts'
import { FormAlertBox, applyServerErrors, type FormAlertState } from '@/features/account'
import { NETWORK_LABELS } from '@/features/checkout/labels'
import {
  EMPTY_WALLET_FORM,
  toFormValues,
  toWalletInput,
  WALLET_FIELD_MAP,
  walletFormSchema,
  type WalletFormOutput,
  type WalletFormValues,
} from '../schema'
import { useSaveWallet } from '../useWallets'
import { WalletFields } from './WalletFields'

const COPIED_MESSAGE =
  'Dados copiados da carteira principal. Altere o endereço: ele não pode repetir o da principal.'

interface DialogState {
  initial: WalletFormValues
  copied: boolean
}

/**
 * Carteira secundária: estado vazio ou os dados da existente, com "Adicionar" ou "Editar" (mesmo
 * formulário, em Dialog) e a opção "Igual à carteira principal", que copia os dados e é anunciada.
 */
export function SecondaryWalletSection({
  userId,
  username,
  primary,
  secondary,
}: {
  userId: string
  username: string
  primary: Wallet | undefined
  secondary: Wallet | undefined
}) {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const copyId = useId()

  const open = () =>
    setDialog({ initial: secondary ? toFormValues(secondary) : EMPTY_WALLET_FORM, copied: false })
  const copyPrimary = () => primary && setDialog({ initial: toFormValues(primary), copied: true })

  return (
    <section aria-labelledby="secondary-heading" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="secondary-heading" className="text-base font-bold">
          Carteira secundária
        </h2>
        <div className="flex items-center gap-4">
          <label
            htmlFor={copyId}
            className="flex cursor-pointer items-center gap-2 text-xs has-disabled:cursor-not-allowed has-disabled:opacity-60"
          >
            <input
              id={copyId}
              type="checkbox"
              checked={dialog?.copied ?? false}
              disabled={!primary}
              onChange={(event) => event.target.checked && copyPrimary()}
              className="size-4 cursor-pointer appearance-none rounded-full border-2 border-primary outline-none checked:border-[5px] focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
            />
            Igual à carteira principal
          </label>
          <Button
            type="button"
            variant="link"
            disabled={!primary}
            onClick={open}
            className="h-auto p-0 text-base font-bold"
          >
            {secondary ? 'Editar' : 'Adicionar'}
          </Button>
        </div>
      </div>

      {secondary ? (
        <dl className="grid grid-cols-1 gap-x-7 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label="Apelido" value={secondary.nickname} />
          <Detail label="Nome do perfil" value={secondary.profileName} />
          <Detail label="Rede" value={NETWORK_LABELS[secondary.network]} />
          <Detail label="Tipo de carteira" value={secondary.walletType} />
          <Detail label="Endereço" value={secondary.address} wrap />
          <Detail label="Nome ENS" value={secondary.ensName} />
          <Detail label="E-mail" value={secondary.email} />
          <Detail label="Código de indicação" value={secondary.referralCode} />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          {primary
            ? 'Você ainda não adicionou uma carteira secundária.'
            : 'Você ainda não adicionou uma carteira secundária. Cadastre primeiro a carteira principal.'}
        </p>
      )}

      <Dialog open={dialog !== null} onOpenChange={(next) => !next && setDialog(null)}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-lg bg-surface p-6 ring-border sm:max-w-3xl">
          {dialog && (
            <SecondaryWalletForm
              userId={userId}
              username={username}
              secondary={secondary}
              state={dialog}
              onDone={() => setDialog(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  )
}

function Detail({ label, value, wrap }: { label: string; value: string | null | undefined; wrap?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={wrap ? 'font-bold break-all' : 'truncate font-bold'}>{value || '—'}</dd>
    </div>
  )
}

function SecondaryWalletForm({
  userId,
  username,
  secondary,
  state,
  onDone,
}: {
  userId: string
  username: string
  secondary: Wallet | undefined
  state: DialogState
  onDone: () => void
}) {
  const form = useForm<WalletFormValues, unknown, WalletFormOutput>({
    resolver: zodResolver(walletFormSchema),
    defaultValues: state.initial,
    mode: 'onTouched',
  })
  const save = useSaveWallet(userId)
  const [alert, setAlert] = useState<FormAlertState | null>(null)
  const [announcement, setAnnouncement] = useState('')

  // A região já existe vazia quando o texto entra: só assim o leitor de tela anuncia.
  useEffect(() => {
    if (!state.copied) return
    const timer = setTimeout(() => setAnnouncement(COPIED_MESSAGE), 150)
    return () => clearTimeout(timer)
  }, [state.copied])

  const submit = form.handleSubmit(async (values) => {
    setAlert(null)
    try {
      await save.mutateAsync({
        id: secondary?.id,
        input: toWalletInput(values, 'secondary', username, secondary),
      })
      toast.success(secondary ? 'Carteira secundária atualizada' : 'Carteira secundária cadastrada')
      onDone()
    } catch (error) {
      setAlert(applyServerErrors(error, form.setError, WALLET_FIELD_MAP))
    }
  })

  const busy = form.formState.isSubmitting || save.isPending

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-base font-bold">
          {secondary ? 'Editar carteira secundária' : 'Adicionar carteira secundária'}
        </DialogTitle>
        <DialogDescription>
          Ela fica disponível no pagamento, junto com a carteira principal.
        </DialogDescription>
      </DialogHeader>
      <p role="status" className={announcement ? 'text-xs text-primary' : 'sr-only'}>
        {announcement}
      </p>
      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={busy}
        className="flex flex-col gap-6"
      >
        <FormAlertBox alert={alert} busy={busy} onRetry={() => void submit()} />
        <WalletFields form={form} disabled={busy} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onDone} className="h-10 rounded-sm px-6">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={busy}
            aria-busy={busy}
            className="h-10 rounded-sm px-8 font-bold uppercase"
          >
            {busy && <Loader2Icon className="animate-spin" aria-hidden="true" />}
            Salvar carteira
          </Button>
        </div>
      </form>
    </>
  )
}
