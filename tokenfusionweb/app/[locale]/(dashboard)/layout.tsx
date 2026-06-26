import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  LayoutDashboard,
  History,
  Key,
  CreditCard,
  Settings,
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useTranslations('nav');

  const navItems = [
    { label: t('dashboard'), href: 'dashboard', icon: LayoutDashboard },
    { label: t('history'), href: 'history', icon: History },
    { label: t('apiKeys'), href: 'api-keys', icon: Key },
    { label: t('billing'), href: 'billing', icon: CreditCard },
    { label: t('settings'), href: 'settings', icon: Settings },
  ];

  return (
    <div className="flex min-h-screen bg-brand-background">
      <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-white/10 bg-brand-card">
        <nav className="flex h-full flex-col gap-1 p-4">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-white/5 hover:text-white"
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <main className="flex-1 pl-64">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
