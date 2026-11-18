import { cn } from '@/lib/utils'

const Bone = ({ className }: { className?: string }) => (
  <div aria-hidden="true" className={cn('shimmer rounded-md', className)} />
)

/** Mesmas dimensões do conteúdo: galeria, título, preço, edição e botões. */
export function NftDetailSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Carregando NFT">
      <span className="sr-only">Carregando NFT…</span>

      {/* mobile */}
      <div className="md:hidden">
        <Bone className="aspect-square w-full rounded-none" />
        <div className="-mt-6 flex flex-col gap-4 rounded-t-3xl bg-surface p-6">
          <Bone className="h-7 w-2/3" />
          <Bone className="h-16 w-full" />
          <Bone className="h-7 w-3/4" />
          <Bone className="h-5 w-1/2" />
        </div>
        <div className="fixed inset-x-0 bottom-0 flex flex-col gap-4 rounded-t-3xl bg-surface p-6">
          <Bone className="h-9 w-full" />
          <Bone className="h-14 w-full rounded-full" />
        </div>
      </div>

      {/* desktop */}
      <div className="mx-auto hidden w-full max-w-[1200px] px-4 pt-6 pb-16 md:block">
        <Bone className="mb-4 h-4 w-40" />
        <div className="grid grid-cols-[minmax(0,540px)_minmax(0,1fr)] gap-8">
          <div className="flex gap-4">
            <div className="flex w-[88px] shrink-0 flex-col gap-3">
              {Array.from({ length: 4 }, (_, i) => (
                <Bone key={i} className="aspect-square w-full rounded-lg" />
              ))}
            </div>
            <Bone className="aspect-square w-full rounded-lg" />
          </div>
          <div className="flex flex-col gap-4">
            <Bone className="h-9 w-3/4" />
            <Bone className="h-6 w-1/3" />
            <Bone className="h-24 w-full" />
            <Bone className="h-7 w-2/3" />
            <div className="flex items-center justify-between gap-4">
              <Bone className="h-9 w-32 rounded-full" />
              <Bone className="h-9 w-64" />
            </div>
            <Bone className="h-4 w-1/2" />
            <Bone className="h-4 w-2/3" />
          </div>
        </div>
      </div>
    </div>
  )
}
