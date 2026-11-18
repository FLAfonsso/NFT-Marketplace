import type { ReactNode } from 'react'
import { Skeleton } from '@/components/ui/skeleton'

/** Placeholder das telas enquanto o layout final não existe. */
export function PageSkeleton({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-semibold">{title}</h1>
      {children}
      <div aria-hidden="true" className="flex flex-col gap-3">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </main>
  )
}
