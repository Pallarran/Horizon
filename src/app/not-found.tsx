import Link from "next/link";

export default function RootNotFound() {
  return (
    <html lang="en">
      <body className="flex min-h-dvh items-center justify-center bg-neutral-50 font-sans text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <div className="mx-4 w-full max-w-md rounded-xl border border-neutral-200 bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-4 text-5xl">404</div>
          <h1 className="mb-2 text-xl font-semibold">
            Page not found / Page introuvable
          </h1>
          <p className="mb-6 text-sm text-neutral-500 dark:text-neutral-400">
            The page you&apos;re looking for doesn&apos;t exist.
            <br />
            La page que vous cherchez n&apos;existe pas.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center rounded-md bg-neutral-900 px-4 text-sm font-medium text-white transition-colors hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            Dashboard / Tableau de bord
          </Link>
        </div>
      </body>
    </html>
  );
}
