import { createFileRoute } from '@tanstack/react-router'
import { MobileHeader } from '@/components/layout/MobileHeader'

export const Route = createFileRoute('/favorites')({
  component: FavoritesPage,
})

function FavoritesPage() {
  return (
    <>
      <MobileHeader title="Favoritos" />
      <div className="mx-auto hidden w-full max-w-[1200px] px-4 py-8 md:block">
        <h1 className="text-2xl font-bold">Favoritos</h1>
      </div>
    </>
  )
}
