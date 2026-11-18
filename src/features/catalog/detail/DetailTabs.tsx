import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Nft } from '@/contracts'
import { Rating } from './Rating'

const networkLabel = (network: string) => network.charAt(0).toUpperCase() + network.slice(1)

const trigger =
  'h-9 flex-none rounded-none px-1 text-sm data-active:font-bold data-active:text-primary after:bg-primary after:bottom-0'

/** Abas "Detalhes do NFT" e "Avaliações (N)". Teclado: setas trocam, Tab entra no painel. */
export function DetailTabs({ nft }: { nft: Nft }) {
  return (
    <Tabs defaultValue="details" className="gap-4">
      <TabsList variant="line" className="h-auto w-full justify-start gap-6 border-b border-border p-0">
        <TabsTrigger value="details" className={trigger}>
          Detalhes do NFT
        </TabsTrigger>
        <TabsTrigger value="reviews" className={trigger}>
          Avaliações ({nft.rating.count})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="details" className="flex flex-col gap-4 text-sm leading-relaxed text-muted-foreground">
        <p>{nft.description}</p>
        <dl className="flex flex-col gap-3">
          <div>
            <dt className="font-bold text-foreground">Rede:</dt>
            <dd>{networkLabel(nft.network)}</dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Criador:</dt>
            <dd>{nft.creator}</dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">Coleção:</dt>
            <dd>{nft.collectionName}</dd>
          </div>
          <div>
            <dt className="font-bold text-foreground">ID do token:</dt>
            <dd>#{nft.tokenId}</dd>
          </div>
          {nft.attributes.length > 0 && (
            <div>
              <dt className="font-bold text-foreground">Atributos:</dt>
              <dd>{nft.attributes.map((a) => `${a.traitType}: ${a.value}`).join(' · ')}</dd>
            </div>
          )}
        </dl>
      </TabsContent>

      <TabsContent value="reviews" className="flex flex-col gap-3 text-sm text-muted-foreground">
        <p className="text-2xl font-bold text-foreground">
          {nft.rating.average.toFixed(1)}
          <span className="text-sm font-normal text-muted-foreground"> / 5</span>
        </p>
        <Rating rating={nft.rating} />
        <p>As avaliações detalhadas ficam fora desta versão. Aqui aparece só a nota agregada.</p>
      </TabsContent>
    </Tabs>
  )
}
