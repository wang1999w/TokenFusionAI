'use client';

import { useState, useRef, useEffect, useTransition } from 'react';
import { useLocale, useRouter, usePathname } from 'next-intl';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { routing } from '@/i18n/routing';
import { LOCALE_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils/cn';

export function LanguageSwitcher() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function onLocaleChange(newLocale: string) {
    startTransition(() => {
      router.replace(pathname, { locale: newLocale });
      setIsOpen(false);
    });
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        disabled={isPending}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-white/5 hover:text-white',
          isPending && 'opacity-60'
        )}
      >
        <Globe className="h-4 w-4" />
        <span>{LOCALE_LABELS[locale as keyof typeof LOCALE_LABELS]}</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-lg border border-white/10 bg-brand-card shadow-xl">
          {routing.locales.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => onLocaleChange(l)}
              className={cn(
                'flex w-full items-center justify-between px-3 py-2.5 text-sm transition-colors hover:bg-white/5',
                locale === l
                  ? 'text-brand-primary'
                  : 'text-text-secondary hover:text-white'
              )}
            >
              {LOCALE_LABELS[l]}
              {locale === l && <Check className="h-4 w-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
