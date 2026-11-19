import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState, type ReactNode } from 'react'
import { XIcon } from 'lucide-react'
import { Logo } from '@/components/Logo'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useIsDesktop } from '@/lib/useMediaQuery'
import { LoginForm } from './LoginForm'
import { SignupForm } from './SignupForm'

type Mode = 'login' | 'signup'

const copy = {
  login: {
    description: 'Entre para gerenciar sua carteira, coleção e perfil de criador.',
    mobileTitle: 'Entrar',
    switchText: 'Novo na Kurio? Crie uma conta',
  },
  signup: {
    description: 'Crie seu perfil de colecionador e conecte uma carteira quando quiser.',
    mobileTitle: 'Criar perfil de colecionador',
    switchText: 'Já tem uma conta? Entre',
  },
} as const

/** Desktop (>= 768px): modal sobre a Início. Mobile: página cheia. */
export function AuthScreen({
  mode,
  redirect,
  expired = false,
}: {
  mode: Mode
  redirect: string | undefined
  expired?: boolean
}) {
  const isDesktop = useIsDesktop()
  const notice = useExpiredNotice(expired, redirect)
  return isDesktop ? (
    <AuthDialog mode={mode} redirect={redirect} notice={notice} />
  ) : (
    <AuthPage mode={mode} redirect={redirect} notice={notice} />
  )
}

/**
 * Aviso de sessão expirada (vindo de um 401). Guarda o aviso em estado e remove `reason` da URL,
 * para que ele não reapareça ao recarregar nem ao compartilhar o link.
 */
function useExpiredNotice(expired: boolean, redirect: string | undefined) {
  const navigate = useNavigate()
  const [shown] = useState(expired)
  useEffect(() => {
    if (!expired) return
    void navigate({ to: '/login', search: { redirect }, replace: true })
  }, [expired, redirect, navigate])
  return shown ? (
    <p
      role="status"
      className="rounded-md border border-border bg-surface px-3 py-2 text-center text-sm text-foreground"
    >
      Sua sessão expirou. Entre novamente para continuar.
    </p>
  ) : null
}

function AuthDialog({
  mode,
  redirect,
  notice,
}: {
  mode: Mode
  redirect: string | undefined
  notice: ReactNode
}) {
  const navigate = useNavigate()
  const { description } = copy[mode]

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        // Esc, clique fora ou botão de fechar: volta para a Início.
        if (!open) void navigate({ to: '/' })
      }}
    >
      <DialogContent
        showCloseButton={false}
        initialFocus={() => document.querySelector<HTMLElement>('form input')}
        className="top-1/2 max-h-[calc(100dvh-2rem)] gap-5 overflow-y-auto rounded-lg border-b-[6px] border-b-primary bg-surface px-10 pt-8 pb-10 ring-0 sm:max-w-[500px]"
      >
        <DialogClose
          aria-label="Fechar"
          className="absolute top-3 right-3 rounded-sm p-1 text-primary outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
        >
          <XIcon className="size-4" aria-hidden="true" />
        </DialogClose>

        <Tabs
          value={mode}
          onValueChange={(value) =>
            void navigate(
              value === 'signup'
                ? { to: '/signup', search: { redirect }, replace: true }
                : { to: '/login', search: { redirect }, replace: true },
            )
          }
          className="items-center gap-5"
        >
          <DialogTitle render={<h1 />} className="sr-only">
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </DialogTitle>
          <TabsList variant="line" className="h-auto gap-0 p-0">
            <TabsTrigger
              value="login"
              className="h-auto flex-none px-4 py-1 text-lg font-medium text-foreground after:bottom-[-6px] after:bg-primary data-active:text-primary"
            >
              Entrar
            </TabsTrigger>
            <span aria-hidden="true" className="h-6 w-px bg-primary" />
            <TabsTrigger
              value="signup"
              className="h-auto flex-none px-4 py-1 text-lg font-medium text-foreground after:bottom-[-6px] after:bg-primary data-active:text-primary"
            >
              Criar conta
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <DialogDescription className="px-2 text-center text-xs text-foreground">
          {description}
        </DialogDescription>

        {mode === 'login' && notice}
        {mode === 'login' ? (
          <LoginForm redirect={redirect} />
        ) : (
          <SignupForm redirect={redirect} submitLabel="Criar conta" />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AuthPage({
  mode,
  redirect,
  notice,
}: {
  mode: Mode
  redirect: string | undefined
  notice: ReactNode
}) {
  const { mobileTitle, switchText } = copy[mode]
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-8 px-7 pt-20 pb-10">
      <div className="flex justify-center">
        <Logo size="auth" />
      </div>
      <h1 className="text-center text-base font-bold">{mobileTitle}</h1>
      {mode === 'login' && notice}
      {mode === 'login' ? (
        <LoginForm redirect={redirect} />
      ) : (
        <SignupForm redirect={redirect} submitLabel="Criar perfil" />
      )}
      <p className="text-center text-sm text-muted-foreground">
        {mode === 'login' ? (
          <Link to="/signup" search={{ redirect }} replace className="underline-offset-4 hover:underline">
            {switchText}
          </Link>
        ) : (
          <Link to="/login" search={{ redirect }} replace className="underline-offset-4 hover:underline">
            {switchText}
          </Link>
        )}
      </p>
    </main>
  )
}
