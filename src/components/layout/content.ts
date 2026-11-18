/** Textos estáticos da interface (Figma). Nenhum dado de negócio mora aqui. */

export const CATALOG_ANCHOR = 'catalogo'

export const footerHighlights = [
  {
    letter: 'W',
    title: 'Segurança da carteira',
    text: 'Proteja sua carteira e colecione arte digital verificada com confiança.',
  },
  {
    letter: 'C',
    title: 'Criadores em destaque',
    text: 'Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede.',
  },
  {
    letter: 'D',
    title: 'Alertas de lançamentos',
    text: 'Receba calendários de cunhagem, novidades de acesso e análises do mercado.',
  },
] as const

export const newsletter = {
  title: 'Antecipe-se ao próximo lançamento',
  label: 'E-mail para a newsletter',
  placeholder: 'digite seu e-mail...',
  submit: 'Enviar',
  text: 'Receba lançamentos selecionados, histórias de criadores e novidades do mercado.',
} as const

export const contactStrip = {
  tagline: 'Feito para colecionadores, criadores e cultura',
  email: 'contato@email.com',
  phone: '+55 11 4002 8922',
} as const

/** `to` presente: rota real. Ausente: fora do escopo (ComingSoon). */
export type FooterLink = { label: string; to?: '/profile' | '/favorites' }

export const footerColumns: { title: string; links: FooterLink[] }[] = [
  {
    title: 'Meu perfil',
    links: [
      { label: 'Meu perfil', to: '/profile' },
      { label: 'Minha coleção' },
      { label: 'Atividade' },
      { label: 'Estúdio do criador' },
      { label: 'Lista de interesse', to: '/favorites' },
    ],
  },
  {
    title: 'Central de ajuda',
    links: [
      { label: 'Central de ajuda' },
      { label: 'Como comprar NFTs' },
      { label: 'Carteira e segurança' },
      { label: 'Política do mercado' },
      { label: 'Denunciar item' },
    ],
  },
]

/** Ids = filtro `collections` de "/" (mesmos ids da API). */
export const footerCollections = [
  { id: 'arte-digital', label: 'Arte digital' },
  { id: 'fotografia', label: 'Fotografia' },
  { id: 'musica', label: 'Música' },
  { id: 'arte-3d', label: 'Arte 3D' },
] as const

export const socialLinks = [
  { name: 'Facebook', short: 'f' },
  { name: 'Instagram', short: 'ig' },
  { name: 'X (Twitter)', short: 'x' },
  { name: 'LinkedIn', short: 'in' },
  { name: 'YouTube', short: 'yt' },
] as const

export const compatibleWallets = ['METAMASK', 'WALLETCONNECT', 'COINBASE'] as const

export const copyright = '© 2026 Kurio. Propriedade digital para todos.'

export const cartLabel = (count: number | undefined) =>
  count === undefined ? 'Carrinho' : `Carrinho, ${count} ${count === 1 ? 'item' : 'itens'}`
