/** Textos e imagens estáticos da Início (Figma). Nenhum dado de negócio mora aqui. */

export const hero = {
  eyebrow: 'Bem-vindo à Kurio',
  titleDesktop: 'SEJA DONO DO FUTURO DA ARTE DIGITAL',
  titleMobile: 'SEJA DONO DA CULTURA DIGITAL',
  textDesktop:
    'Descubra NFTs raros de criadores emergentes e consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da cultura da internet.',
  textMobile: 'Descubra NFTs selecionados de criadores do mundo todo.',
  cta: 'EXPLORAR',
  dotsLabel: 'Escolher NFT em destaque',
} as const

export const featuredBox = {
  title: 'NFT EM DESTAQUE',
  subtitle: 'OFERTA LIMITADA',
} as const

/** Imagens de public/assets. Dimensões reais dos arquivos, para reservar o espaço. */
export const assetImages = {
  eape: { src: '/assets/Eape.png', width: 500, height: 500, alt: 'Macaco de óculos escuros e jaqueta verde' },
  sape: { src: '/assets/Sape.png', width: 500, height: 500, alt: 'Macaco cinza de chapéu verde e moletom roxo' },
  nape: { src: '/assets/Nape.png', width: 500, height: 500, alt: 'Macaco preto de blazer bege e gola verde' },
  gape: { src: '/assets/Gape.png', width: 516, height: 600, alt: 'Macaco laranja de fones de ouvido' },
} as const

export const promoBanners = [
  {
    id: 'genesis',
    title: 'Lançamentos gênesis de edição limitada',
    text: 'Colecione edições escassas diretamente dos criadores antes da revelação pública.',
    image: assetImages.eape,
  },
  {
    id: 'selecionada',
    title: 'Arte digital selecionada e muito mais',
    text: 'Explore novos artistas, coleções verificadas e obras digitais que definem a cultura.',
    image: assetImages.nape,
  },
] as const

export const promoCta = 'Explorar'

export const mintDiary = {
  title: 'Diário da Cunhagem',
  subtitle: 'Histórias, guias e insights para colecionadores sobre o universo da propriedade digital.',
  readMore: 'Ler mais',
  posts: [
    {
      id: 'propriedade',
      date: '12 de setembro',
      readTime: 'Leitura de 6 min',
      title: 'Como funciona a propriedade de NFTs',
      summary: 'Aprenda a colecionar, negociar e verificar ativos digitais.',
      image: assetImages.nape,
    },
    {
      id: 'artistas',
      date: '13 de setembro',
      readTime: 'Leitura de 2 min',
      title: '10 artistas digitais para acompanhar',
      summary: 'Conheça criadores que moldam a cultura digital.',
      image: assetImages.eape,
    },
    {
      id: 'raridade',
      date: '15 de setembro',
      readTime: 'Leitura de 3 min',
      title: 'Raridade, atributos e procedência',
      summary: 'Entenda raridade, procedência, direitos autorais e utilidade.',
      image: assetImages.sape,
    },
    {
      id: 'carteira',
      date: '15 de setembro',
      readTime: 'Leitura de 2 min',
      title: 'Como proteger sua carteira',
      summary: 'Proteja sua carteira, seus ativos e sua identidade.',
      image: assetImages.gape,
    },
  ],
} as const
