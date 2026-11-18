import { useBlocker, useRouter } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import { MobileHeader } from '@/components/layout/MobileHeader'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useAuth } from '@/features/auth'
import { ExitGuardContext } from '../exitGuard'
import { AccountNav, type AccountSection } from './AccountNav'

/**
 * Estrutura comum de Perfil e Carteiras: lateral "Meu perfil" (abas no mobile e no tablet) e
 * conteúdo. Cuida do aviso de mudanças não salvas ao navegar, recarregar ou sair da conta.
 */
export function AccountLayout({
  section,
  title,
  heading,
  children,
}: {
  section: AccountSection
  /** Título da tela: cabeçalho do mobile e h1 (visível ou só para leitores de tela). */
  title: string
  /** Mostra o título como cabeçalho visível no desktop (Perfil) ou só para leitores de tela. */
  heading?: boolean
  children: ReactNode
}) {
  const auth = useAuth()
  const router = useRouter()
  const dirty = useRef(false)
  const leaving = useRef(false)
  const setDirty = useCallback((value: boolean) => {
    dirty.current = value
  }, [])
  const guard = useMemo(() => ({ setDirty }), [setDirty])
  const [confirmLogout, setConfirmLogout] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  const blocker = useBlocker({
    shouldBlockFn: () => dirty.current && !leaving.current,
    enableBeforeUnload: () => dirty.current && !leaving.current,
    withResolver: true,
  })

  const logout = async () => {
    leaving.current = true
    setLoggingOut(true)
    setConfirmLogout(false)
    await auth.logout()
    await router.navigate({ to: '/', replace: true })
  }

  const onLogout = () => {
    if (dirty.current) setConfirmLogout(true)
    else void logout()
  }

  const open = blocker.status === 'blocked' || confirmLogout
  const stay = () => {
    if (blocker.status === 'blocked') blocker.reset()
    setConfirmLogout(false)
  }
  const discard = () => {
    if (confirmLogout) void logout()
    else if (blocker.status === 'blocked') blocker.proceed()
  }

  return (
    <ExitGuardContext.Provider value={guard}>
      <MobileHeader title={title} fallback="/" />
      <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-4 pb-8 md:pt-8 lg:grid lg:grid-cols-[310px_minmax(0,1fr)] lg:gap-7">
        <AccountNav active={section} onLogout={onLogout} loggingOut={loggingOut} />
        <div className="min-w-0">
          <h1 className={heading ? 'mb-6 hidden text-base font-bold md:block' : 'sr-only max-md:hidden'}>
            {title}
          </h1>
          {children}
        </div>
      </div>

      <Dialog open={open} onOpenChange={(next) => !next && stay()}>
        <DialogContent showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>Descartar alterações?</DialogTitle>
            <DialogDescription>
              Você tem mudanças que ainda não foram salvas.{' '}
              {confirmLogout
                ? 'Se sair agora, elas serão perdidas.'
                : 'Se sair desta tela, elas serão perdidas.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={stay}>
              Continuar editando
            </Button>
            <Button onClick={discard}>{confirmLogout ? 'Sair sem salvar' : 'Descartar e sair'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ExitGuardContext.Provider>
  )
}
