import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { CatalogSection } from '@/features/catalog/list/CatalogSection'
import { catalogSearchDefaults, catalogSearchSchema } from '@/features/catalog/searchParams'
import { FeaturedBox } from '@/features/home/FeaturedBox'
import { HomeHero } from '@/features/home/HomeHero'
import { MintDiary } from '@/features/home/MintDiary'
import { PromoBanners } from '@/features/home/PromoBanners'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams(catalogSearchDefaults)] },
  component: HomePage,
})

function HomePage() {
  return (
    <>
      <h1 className="sr-only">Kurio, marketplace de NFTs</h1>
      <HomeHero />
      <CatalogSection sidebarExtra={<FeaturedBox />} />
      <PromoBanners />
      <MintDiary />
    </>
  )
}
