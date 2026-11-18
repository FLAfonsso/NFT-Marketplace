import type { ReactNode } from 'react'
import { Loader2Icon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** CTA laranja. Desabilitado e com indicador enquanto envia. */
export function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <Button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="h-12 w-full rounded-full bg-linear-to-r from-primary to-[#B27A47] text-sm font-bold text-primary-foreground hover:from-primary/90 hover:to-[#B27A47]/90 md:h-10 md:rounded-sm md:bg-none md:bg-primary md:hover:bg-primary/90"
    >
      {pending && <Loader2Icon className="animate-spin" aria-hidden="true" />}
      {children}
    </Button>
  )
}
