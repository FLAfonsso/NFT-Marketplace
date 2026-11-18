import { Bone } from '@/features/cart'
import { WALLET_GRID } from './WalletFields'

const Field = () => (
  <div className="flex flex-col gap-1.5">
    <Bone className="h-5 w-32" />
    <Bone className="h-10 w-full rounded-sm" />
  </div>
)

/** Mesmas dimensões do conteúdo: título, grade de 10 campos, botão e a seção secundária. */
export function WalletsSkeleton() {
  return (
    <div aria-hidden="true" className="flex flex-col gap-8">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <Bone className="h-6 w-40" />
          <Bone className="h-4 w-3/4 max-w-md" />
        </div>
        <div className="flex flex-col gap-8">
          <div className={WALLET_GRID}>
            {Array.from({ length: 10 }, (_, i) => (
              <Field key={i} />
            ))}
          </div>
          <Bone className="h-10 w-full rounded-sm lg:w-40" />
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <Bone className="h-6 w-44" />
          <Bone className="h-6 w-56" />
        </div>
        <Bone className="h-5 w-72 max-w-full" />
      </div>
    </div>
  )
}
