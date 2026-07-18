import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'

/** The brand ampersand — Tacit's signature glyph, always champagne italic serif. */
function Amp({ className = '' }: { className?: string }) {
  return <span className={`font-display italic text-champagne ${className}`}>&amp;</span>
}

const pill =
  'inline-block rounded-full font-semibold text-center transition-colors ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne'

export function LandingPage() {
  const { t } = useTranslation('landing')
  return (
    <main className="bg-ink text-bone font-sans">
      {/* Header */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5 md:px-8">
        <span className="font-display text-lg font-semibold tracking-[0.35em]">TACIT</span>
        <nav className="flex items-center gap-2">
          <Link
            to="/login"
            className={`${pill} px-4 py-2 text-sm text-bone/80 hover:text-bone`}
          >
            {t('nav.login')}
          </Link>
          <Link
            to="/signup"
            className={`${pill} bg-champagne px-5 py-2 text-sm text-ink hover:bg-bone`}
          >
            {t('nav.join')}
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute -top-24 -right-16 text-[24rem] leading-none text-champagne/6 italic select-none md:-top-40 md:text-[40rem]"
        >
          &amp;
        </span>
        <div className="relative mx-auto max-w-6xl px-5 pt-14 pb-16 md:px-8 md:pt-24 md:pb-24">
          <h1 className="font-display max-w-3xl text-4xl leading-tight font-semibold md:text-6xl">
            <span className="whitespace-nowrap">{t('hero.h1.lead')}</span> <Amp />{' '}
            <span className="whitespace-nowrap">{t('hero.h1.tail')}</span>
            <br />
            <span className="text-bone/70">{t('hero.h1.line2')}</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-bone/80">{t('hero.sub')}</p>

          {/* Role fork */}
          <div className="mt-12 grid max-w-3xl gap-4 md:grid-cols-2">
            <Link
              to="/signup?role=baby"
              className="group rounded-3xl border border-rose/40 bg-dusk p-6 transition-colors hover:border-rose focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose"
            >
              <h2 className="font-display text-2xl font-semibold text-rose">
                {t('fork.baby.title')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-bone/70">{t('fork.baby.body')}</p>
              <span
                className={`${pill} mt-5 w-full bg-rose px-5 py-3 text-ink group-hover:bg-bone`}
              >
                {t('fork.baby.cta')}
              </span>
            </Link>
            <Link
              to="/signup?role=benefactor"
              className="group rounded-3xl border border-champagne/40 bg-dusk p-6 transition-colors hover:border-champagne focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-champagne"
            >
              <h2 className="font-display text-2xl font-semibold text-champagne">
                {t('fork.benefactor.title')}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-bone/70">
                {t('fork.benefactor.body')}
              </p>
              <span
                className={`${pill} mt-5 w-full bg-champagne px-5 py-3 text-ink group-hover:bg-bone`}
              >
                {t('fork.benefactor.cta')}
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-bone text-ink">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">{t('how.title')}</h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3">
            {(['step1', 'step2', 'step3'] as const).map((step, i) => (
              <li key={step}>
                <span className="font-display text-5xl text-champagne-deep italic">{i + 1}</span>
                <h3 className="mt-3 text-lg font-bold">{t(`how.${step}.title`)}</h3>
                <p className="mt-2 leading-relaxed text-ink/70">{t(`how.${step}.body`)}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Why Tacit */}
      <section className="bg-bone text-ink">
        <div className="mx-auto max-w-6xl px-5 pb-16 md:px-8 md:pb-24">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">{t('why.title')}</h2>
          <div className="mt-10 grid gap-4 md:grid-cols-2">
            {(['verified', 'noapp', 'credits', 'albums'] as const).map((item) => (
              <div key={item} className="rounded-2xl bg-white p-6 shadow-sm">
                <h3 className="text-lg font-bold">{t(`why.${item}.title`)}</h3>
                <p className="mt-2 leading-relaxed text-ink/70">{t(`why.${item}.body`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What is a Sugar Daddy */}
      <section id="sugar-daddy" className="bg-ink">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            {t('daddy.title.lead')}{' '}
            <span className="text-champagne">{t('daddy.title.term')}</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-bone/80">{t('daddy.def')}</p>
          <div className="mt-10 max-w-2xl rounded-3xl bg-dusk p-6 md:p-8">
            <h3 className="font-display text-xl font-semibold text-champagne">
              {t('daddy.benefits.title')}
            </h3>
            <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-bone/80 marker:text-champagne">
              <li>{t('daddy.benefit1')}</li>
              <li>{t('daddy.benefit2')}</li>
              <li>{t('daddy.benefit3')}</li>
            </ul>
          </div>
          <Link
            to="/signup?role=benefactor"
            className={`${pill} mt-8 bg-champagne px-8 py-3 text-ink hover:bg-bone`}
          >
            {t('daddy.cta')}
          </Link>
        </div>
      </section>

      {/* What is a Sugar Baby */}
      <section id="sugar-baby" className="bg-blush text-ink">
        <div className="mx-auto max-w-6xl px-5 py-16 md:px-8 md:py-24">
          <h2 className="font-display text-3xl font-semibold md:text-4xl">
            {t('baby.title.lead')} <span className="text-rose-deep">{t('baby.title.term')}</span>
          </h2>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink/80">{t('baby.def')}</p>
          <div className="mt-10 max-w-2xl rounded-3xl bg-white p-6 shadow-sm md:p-8">
            <h3 className="font-display text-xl font-semibold text-rose-deep">
              {t('baby.benefits.title')}
            </h3>
            <ul className="mt-4 list-disc space-y-3 pl-5 leading-relaxed text-ink/80 marker:text-rose-deep">
              <li>{t('baby.benefit1')}</li>
              <li>{t('baby.benefit2')}</li>
              <li>{t('baby.benefit3')}</li>
            </ul>
          </div>
          <Link
            to="/signup?role=baby"
            className={`${pill} mt-8 bg-rose-deep px-8 py-3 text-bone hover:bg-ink`}
          >
            {t('baby.cta')}
          </Link>
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-ink">
        <span
          aria-hidden="true"
          className="font-display pointer-events-none absolute -bottom-32 -left-12 text-[20rem] leading-none text-champagne/6 italic select-none"
        >
          &amp;
        </span>
        <div className="relative mx-auto max-w-6xl px-5 py-20 text-center md:px-8 md:py-28">
          <p className="font-display mx-auto max-w-2xl text-3xl leading-snug font-semibold md:text-5xl">
            {t('final.line')}
          </p>
          <Link
            to="/signup"
            className={`${pill} mt-10 bg-champagne px-10 py-4 text-lg text-ink hover:bg-bone`}
          >
            {t('final.cta')}
          </Link>
          <p className="mt-6 text-sm text-smoke">{t('final.reassure')}</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-bone/10 bg-ink">
        <div className="mx-auto max-w-6xl px-5 py-10 md:px-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <span className="font-display text-lg font-semibold tracking-[0.35em]">TACIT</span>
            <nav className="grid gap-2 text-sm text-bone/70 md:grid-cols-2 md:gap-x-12">
              <Link to="/login" className="hover:text-bone">
                {t('footer.login')}
              </Link>
              <a href="#sugar-daddy" className="hover:text-bone">
                {t('footer.whatIsDaddy')}
              </a>
              <Link to="/signup" className="hover:text-bone">
                {t('footer.join')}
              </Link>
              <a href="#sugar-baby" className="hover:text-bone">
                {t('footer.whatIsBaby')}
              </a>
            </nav>
          </div>
          <p className="mt-8 text-xs text-smoke">{t('footer.adults')}</p>
          <p className="mt-2 text-xs text-smoke">{t('footer.copyright')}</p>
          <p className="mt-2 text-xs text-smoke">
            <a
              href="https://www.geonames.org/"
              target="_blank"
              rel="noopener noreferrer license"
              className="underline hover:text-bone"
            >
              {t('footer.geonames')}
            </a>
          </p>
        </div>
      </footer>
    </main>
  )
}
