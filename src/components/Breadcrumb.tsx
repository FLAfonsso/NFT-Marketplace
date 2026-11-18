import { Link, type LinkProps } from '@tanstack/react-router'
import { ChevronRightIcon } from 'lucide-react'
import { Fragment } from 'react'
import { cn } from '@/lib/utils'

export interface BreadcrumbItem {
  label: string
  /** Sem `to`, é o item atual (último). */
  to?: LinkProps['to']
}

/** Trilha de navegação: <Breadcrumb items={[{label:'Início',to:'/'},{label:'Mercado',to:'/'},{label:'Carrinho'}]} /> */
export function Breadcrumb({ items, className }: { items: BreadcrumbItem[]; className?: string }) {
  return (
    <nav aria-label="Trilha de navegação" className={className}>
      <ol className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        {items.map((item, index) => {
          const last = index === items.length - 1
          return (
            <Fragment key={`${item.label}-${index}`}>
              <li>
                {item.to && !last ? (
                  <Link
                    to={item.to}
                    className="rounded-sm underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <span aria-current={last ? 'page' : undefined} className={cn(last && 'text-foreground')}>
                    {item.label}
                  </span>
                )}
              </li>
              {!last && (
                <li aria-hidden="true">
                  <ChevronRightIcon className="size-3" />
                </li>
              )}
            </Fragment>
          )
        })}
      </ol>
    </nav>
  )
}
