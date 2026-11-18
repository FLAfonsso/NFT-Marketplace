import { ComingSoon } from '@/components/ComingSoon'
import { mintDiary } from './content'

/** "Diário da Cunhagem": quatro cartões; "Ler mais" é ComingSoon e não navega. */
export function MintDiary() {
  return (
    <section
      aria-labelledby="diario-titulo"
      className="mx-auto w-full max-w-304 px-4 pb-12 md:px-6"
    >
      <h2 id="diario-titulo" className="text-center text-2xl font-bold">
        {mintDiary.title}
      </h2>
      <p className="mt-2 text-center text-xs text-muted-foreground">{mintDiary.subtitle}</p>

      <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {mintDiary.posts.map((post) => (
          <li key={post.id} className="overflow-hidden rounded-lg bg-surface">
            <img
              src={post.image.src}
              alt={post.image.alt}
              width={post.image.width}
              height={post.image.height}
              loading="lazy"
              className="aspect-video w-full lg:aspect-4/3 object-cover object-top"
            />
            <div className="p-4">
              <p className="text-[0.6875rem] text-muted-foreground">
                {post.date} <span aria-hidden="true">|</span> {post.readTime}
              </p>
              <h3 className="mt-2 text-sm font-bold">{post.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground">{post.summary}</p>
              <ComingSoon
                aria-label={`${mintDiary.readMore}: ${post.title}`}
                className="mt-3 inline-block text-xs font-bold text-primary"
              >
                {mintDiary.readMore} →
              </ComingSoon>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}
