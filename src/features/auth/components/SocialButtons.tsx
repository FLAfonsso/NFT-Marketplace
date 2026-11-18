import { Button } from '@/components/ui/button'
import { notifyUnavailable } from '@/lib/unavailable'

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true" className="size-5">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
      <path fill="#FBBC05" d="M10.5 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.2.8-4.7l-7.9-6.1C.9 16.4 0 20.100 0 24s.9 7.600 2.600 10.800l7.900-6.100z" />
      <path fill="#34A853" d="M24 48c6.500 0 11.900-2.100 15.900-5.800l-7.600-5.900c-2.100 1.400-4.900 2.300-8.300 2.300-6.300 0-11.600-4.100-13.500-9.800l-7.900 6.100C6.500 42.600 14.600 48 24 48z" />
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5">
      <path
        fill="#3B5998"
        d="M13.500 22v-8.200h2.800l.4-3.200h-3.200V8.600c0-.9.300-1.600 1.600-1.600h1.700V4.100c-.3 0-1.300-.1-2.500-.1-2.500 0-4.200 1.500-4.200 4.300v2.400H7.300v3.200h2.800V22h3.400z"
      />
    </svg>
  )
}

const providers = [
  { name: 'Google', icon: <GoogleIcon /> },
  { name: 'Facebook', icon: <FacebookIcon /> },
]

/** Entrada social fora do escopo: visível, aria-disabled, avisa e não finge sucesso. */
export function SocialButtons() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 text-xs text-foreground">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        <span>Ou continue com</span>
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </div>
      {providers.map(({ name, icon }) => (
        <Button
          key={name}
          type="button"
          variant="outline"
          aria-disabled="true"
          onClick={notifyUnavailable}
          className="h-10 w-full gap-3 rounded-sm border-border bg-transparent text-xs font-bold text-muted-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-80 max-md:rounded-md"
        >
          {icon}
          Continuar com {name}
        </Button>
      ))}
    </div>
  )
}
