import { Link } from '@tanstack/react-router'
import { formatEth } from '@/lib/eth'
import { featuredBox } from './content'
import { useFeaturedNft } from './useHomeNfts'

/** "NFT EM DESTAQUE / OFERTA LIMITADA": o NFT marcado como destaque na API, com link ao detalhe. */
export function FeaturedBox() {
  const { data: nft } = useFeaturedNft()
  if (!nft) return null

  const image = nft.gallery[0]
  return (
    <Link
      to="/nft/$id"
      params={{ id: nft.id }}
      aria-label={`${featuredBox.title}, ${featuredBox.subtitle}: ${nft.name}, ${formatEth(nft.price)} ETH`}
      className="mt-6 block overflow-hidden rounded-lg bg-surface outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="p-5 pb-3">
        <p className="text-lg font-bold text-primary">{featuredBox.title}</p>
        <p className="mt-1 text-center text-sm font-bold">{featuredBox.subtitle}</p>
      </div>
      <img
        src={image?.url}
        alt={image?.alt || nft.name}
        width={500}
        height={500}
        loading="lazy"
        className="aspect-square w-full rounded-lg object-cover"
      />
    </Link>
  )
}
