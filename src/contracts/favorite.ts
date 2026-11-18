import { z } from 'zod'
import { Nft } from './nft'

/** Favoritos do usuário, do mais recente para o mais antigo. */
export const FavoriteList = z.object({ items: z.array(Nft) })
export type FavoriteList = z.infer<typeof FavoriteList>
