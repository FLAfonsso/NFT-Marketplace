import { createFileRoute, stripSearchParams } from '@tanstack/react-router'
import { PageSkeleton } from '@/components/PageSkeleton'
import { catalogSearchDefaults, catalogSearchSchema } from '@/features/catalog/searchParams'

export const Route = createFileRoute('/')({
  validateSearch: catalogSearchSchema,
  search: { middlewares: [stripSearchParams(catalogSearchDefaults)] },
  component: HomePage,
})

function HomePage() {
  return <PageSkeleton title="Início" />
}
