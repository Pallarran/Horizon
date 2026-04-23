import { cookies } from "next/headers";
import { Inter, JetBrains_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import { Toaster } from "@/components/ui/sonner";
import { ThemeWatcher } from "@/components/theme/ThemeWatcher";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as "fr-CA" | "en-CA")) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  const cookieStore = await cookies();
  const theme = cookieStore.get("horizon_theme")?.value ?? "system";
  const ssrDark =
    theme === "dark"
      ? true
      : theme === "light"
        ? false
        : undefined; // "system" — can't determine server-side

  return (
    <html
      lang={locale}
      className={ssrDark === true ? "dark" : undefined}
      suppressHydrationWarning
    >
      <head />
      <body
        className={`${inter.variable} ${jetbrainsMono.variable} min-h-dvh bg-background font-sans text-foreground antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
        <ThemeWatcher theme={theme} />
        <Toaster richColors />
      </body>
    </html>
  );
}
