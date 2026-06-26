import { useTranslations } from 'next-intl';

export default function HomePage() {
  const t = useTranslations('hero');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-20">
      <section className="mx-auto max-w-4xl text-center">
        <div className="mb-8 flex flex-wrap items-center justify-center gap-3">
          <span className="rounded-full bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary">
            {t('badge1')}
          </span>
          <span className="rounded-full bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary">
            {t('badge2')}
          </span>
          <span className="rounded-full bg-brand-primary/10 px-4 py-1.5 text-sm font-medium text-brand-primary">
            {t('badge3')}
          </span>
        </div>
        <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-6xl">
          {t('title')}
        </h1>
        <p className="mb-10 text-lg text-text-secondary md:text-xl">
          {t('subtitle')}
        </p>
        <p className="text-sm text-text-tertiary">{t('trustText')}</p>
      </section>
    </main>
  );
}
