import { ImageIcon, Loader2Icon } from 'lucide-react'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { isApiRequestError } from '@/lib/api'
import { AVATAR_TYPES, resizeAvatar, validateAvatarFile } from '@/lib/image'
import { useAvatarMutation } from '../useProfile'

const errorOf = (error: unknown) =>
  isApiRequestError(error)
    ? (error.fieldErrors?.avatar?.[0] ?? error.message)
    : 'Não foi possível atualizar o avatar.'

/**
 * Avatar: "Alterar" abre o seletor (png, jpg ou webp, até 2 MB), mostra a prévia na hora e envia;
 * "Remover" volta ao ícone padrão. Em falha, o avatar anterior volta e o erro aparece aqui.
 */
export function AvatarField({
  userId,
  name,
  avatarUrl,
}: {
  userId: string
  name: string
  avatarUrl: string | null
}) {
  const mutation = useAvatarMutation(userId)
  const input = useRef<HTMLInputElement>(null)
  const [error, setError] = useState<string | null>(null)
  const labelId = useId()
  const errorId = useId()
  const busy = mutation.isPending

  const send = (change: Parameters<typeof mutation.mutate>[0], done: string) => {
    setError(null)
    mutation.mutate(change, {
      onSuccess: () => toast.success(done),
      onError: (failure) => setError(errorOf(failure)),
    })
  }

  const onFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = '' // permite escolher o mesmo arquivo de novo
    if (!file) return
    const problem = validateAvatarFile(file)
    if (problem) {
      setError(problem)
      return
    }
    try {
      send({ blob: await resizeAvatar(file) }, 'Avatar atualizado')
    } catch {
      setError('Não foi possível ler esta imagem. Escolha outro arquivo.')
    }
  }

  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm">
        Avatar
      </span>
      <div className="flex h-[50px] items-center gap-6">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={`Avatar de ${name}`}
            className="size-[50px] shrink-0 rounded-full border border-border object-cover"
          />
        ) : (
          <span
            role="img"
            aria-label="Avatar padrão"
            className="grid size-[50px] shrink-0 place-items-center rounded-full border border-border bg-surface text-primary"
          >
            <ImageIcon className="size-5" aria-hidden="true" />
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept={AVATAR_TYPES.join(',')}
          onChange={(event) => void onFile(event)}
          tabIndex={-1}
          className="sr-only"
          aria-hidden="true"
        />
        <Button
          type="button"
          disabled={busy}
          aria-busy={busy}
          aria-describedby={error ? errorId : undefined}
          aria-label="Alterar avatar"
          onClick={() => input.current?.click()}
          className="h-10 rounded-sm px-6 font-bold"
        >
          {busy && <Loader2Icon className="animate-spin" aria-hidden="true" />}
          Alterar
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={busy || !avatarUrl}
          aria-label="Remover avatar"
          onClick={() => send({ remove: true }, 'Avatar removido')}
          className="h-10 px-0 text-sm font-normal hover:bg-transparent hover:text-primary"
        >
          Remover
        </Button>
      </div>
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
