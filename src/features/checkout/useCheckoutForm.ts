import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import type { ApiError, Profile, Wallet } from '@/contracts'
import {
  checkoutFormSchema,
  EMPTY_FORM,
  fieldForApiPath,
  type CheckoutFormOutput,
  type CheckoutFormValues,
} from './schema'
import { draftStorage } from './storage'

const ensLabelOf = (ens: string | null | undefined) => (ens ?? '').replace(/\.eth$/i, '')

/** Valores iniciais: carteira principal + perfil (mais recente para nome, usuário, e-mail e ENS). */
function prefill(profile: Profile, wallets: readonly Wallet[]): CheckoutFormValues {
  const wallet = wallets.find((w) => w.role === 'primary') ?? wallets[0]
  return {
    ...EMPTY_FORM,
    walletId: wallet?.id ?? '',
    displayName: profile.displayName,
    username: profile.username,
    network: wallet?.network ?? '',
    profileName: wallet?.profileName ?? profile.displayName,
    address: wallet?.address ?? '',
    secondaryWallet: wallet?.secondaryWallet ?? '',
    walletType: wallet?.walletType ?? '',
    email: profile.email,
    referralCode: wallet?.referralCode ?? '',
    ensLabel: ensLabelOf(profile.ensName ?? wallet?.ensName),
  }
}

/**
 * Formulário do colecionador: pré-preenchido com perfil e carteiras, sobreposto pelo rascunho
 * do usuário (sessionStorage) e salvo a cada alteração. A carteira do rascunho só vale se ainda
 * estiver cadastrada.
 */
export function useCheckoutForm(
  userId: string,
  profile: Profile | undefined,
  wallets: readonly Wallet[] | undefined,
) {
  // Valores iniciais: servidor + rascunho. Só são calculados de novo se perfil ou carteiras
  // mudarem na API; o rascunho é salvo a cada alteração, então nada digitado se perde.
  const initial = useMemo(() => {
    if (!profile || !wallets) return undefined
    const base = prefill(profile, wallets)
    const draft = draftStorage.load(userId)
    const values = { ...base, ...draft }
    if (!wallets.some((w) => w.id === values.walletId)) values.walletId = base.walletId
    return { values, restored: draft !== null }
  }, [profile, wallets, userId])

  const form = useForm<CheckoutFormValues, unknown, CheckoutFormOutput>({
    resolver: zodResolver(checkoutFormSchema),
    defaultValues: EMPTY_FORM,
    values: initial?.values,
    resetOptions: { keepDirtyValues: true },
    mode: 'onTouched',
  })
  const ready = initial !== undefined
  const restored = initial?.restored ?? false
  const { subscribe, setValue, setError, trigger } = form

  // Rascunho restaurado (voltando do login, por exemplo): mostra o que ainda falta.
  useEffect(() => {
    if (ready && restored) void trigger()
  }, [ready, restored, trigger])

  useEffect(() => {
    if (!ready) return
    return subscribe({
      formState: { values: true },
      callback: ({ values }) => draftStorage.save(userId, values),
    })
  }, [ready, subscribe, userId])

  /** Escolher uma carteira cadastrada preenche endereço, rede e tipo com os dela. */
  const selectWallet = useCallback(
    (wallet: Wallet) => {
      const options = { shouldDirty: true, shouldValidate: true, shouldTouch: true }
      setValue('walletId', wallet.id, options)
      setValue('address', wallet.address, options)
      setValue('network', wallet.network, options)
      setValue('walletType', wallet.walletType, options)
    },
    [setValue],
  )

  /** Leva os fieldErrors do 400 da API aos campos. true se algum campo recebeu erro. */
  const applyFieldErrors = useCallback(
    (fieldErrors: NonNullable<ApiError['fieldErrors']>) => {
      let placed = false
      for (const [path, messages] of Object.entries(fieldErrors)) {
        const field = fieldForApiPath(path)
        if (field && messages[0]) {
          setError(field, { type: 'server', message: messages[0] }, { shouldFocus: !placed })
          placed = true
        }
      }
      return placed
    },
    [setError],
  )

  return { form, ready, selectWallet, applyFieldErrors }
}
