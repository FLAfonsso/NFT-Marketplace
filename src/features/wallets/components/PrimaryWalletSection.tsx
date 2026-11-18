import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2Icon } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { Wallet } from '@/contracts'
import { FormAlertBox, applyServerErrors, useUnsavedChanges, type FormAlertState } from '@/features/account'
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

/**
 * Carteira principal: formulário preenchido com a carteira existente (edição) ou vazio
 * (cadastro, com "Adicionar" no topo). Erros da API, inclusive endereço duplicado, vão para o campo.
 */
export function PrimaryWalletSection({
  userId,
  username,
  primary,
}: {
  userId: string
  username: string
  primary: Wallet | undefined
}) {
  const form = useForm<WalletFormValues, unknown, WalletFormOutput>({
    resolver: zodResolver(walletFormSchema),
    // Segue o servidor (ex.: apelido editado em Perfil) sem apagar o que o usuário digitou.
    values: primary ? toFormValues(primary) : EMPTY_WALLET_FORM,
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  })
  const save = useSaveWallet(userId)
  const [alert, setAlert] = useState<FormAlertState | null>(null)
  const dirty = form.formState.isDirty
  useUnsavedChanges(dirty)

  const submit = form.handleSubmit(async (values) => {
    setAlert(null)
    try {
      const saved = await save.mutateAsync({
        id: primary?.id,
        input: toWalletInput(values, 'primary', username, primary),
      })
      form.reset(toFormValues(saved))
      toast.success(primary ? 'Carteira principal atualizada' : 'Carteira principal cadastrada')
    } catch (error) {
      setAlert(applyServerErrors(error, form.setError, WALLET_FIELD_MAP))
    }
  })

  const busy = form.formState.isSubmitting || save.isPending

  return (
    <section aria-labelledby="primary-heading" className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="primary-heading" className="text-base font-bold">
            Carteira principal
          </h2>
          {!primary && (
            <Button
              type="button"
              variant="link"
              onClick={() => form.setFocus('displayName')}
              className="h-auto p-0 text-base font-bold"
            >
              Adicionar
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Estas carteiras ficam disponíveis no pagamento e para receber NFTs comprados.
        </p>
      </div>

      <form
        onSubmit={(event) => void submit(event)}
        noValidate
        aria-busy={busy}
        className="flex flex-col gap-8"
      >
        <FormAlertBox alert={alert} busy={busy} onRetry={() => void submit()} />
        <WalletFields form={form} disabled={busy} />
        <Button
          type="submit"
          disabled={busy || (Boolean(primary) && !dirty)}
          aria-busy={busy}
          className="h-10 w-full rounded-sm px-8 font-bold uppercase lg:w-auto lg:self-start"
        >
          {busy && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          Salvar carteira
        </Button>
      </form>
    </section>
  )
}
