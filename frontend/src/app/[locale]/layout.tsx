import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { routing } from '@/i18n/routing';
import { Toaster } from 'react-hot-toast';
import ThemeWrapper from '@/components/ThemeWrapper';
import GoogleProvider from '@/components/GoogleProvider';
import { UpgradeModalProvider } from '@/components/UpgradeModal';
import Providers from '@/components/Providers';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Xeni AI - Your Intelligent E-commerce Assistant',
  description: 'Automate your Facebook shop with Xeni AI agents.',
  icons: {
    icon: '/favicon.png',
    shortcut: '/favicon.png',
    apple: '/favicon.png',
  },
};

export default async function LocaleLayout({
  children,
  params: { locale },
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  setRequestLocale(locale);

  const messages = await getMessages();
  const fontClass = locale === 'bn' ? 'font-bangla' : 'font-body';

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={fontClass}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeWrapper>
            <GoogleProvider>
              <Providers>
                <Toaster position="top-right" toastOptions={{
                  style: { background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', backdropFilter: 'blur(16px)' },
                }} />
                <UpgradeModalProvider>
                  {children}
                </UpgradeModalProvider>
              </Providers>
            </GoogleProvider>
          </ThemeWrapper>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
