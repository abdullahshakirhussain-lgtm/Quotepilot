import Link from "next/link";

/**
 * The frame around sign-in, sign-up, password, first-run and system pages:
 * the same dark top bar as the app, then the content in a white card on the
 * grey page.
 */
export function AuthShell({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="bg-stone-900 text-white">
        <div className="flex h-14 items-center px-4 sm:px-6 lg:px-5">
          <Link href="/" className="tap inline-flex items-center text-[20px] font-bold leading-none">
            QuoteLoop
          </Link>
        </div>
      </header>
      <main className="w-full flex-1 px-4 py-8 sm:px-6 sm:py-14">
        <div className={`card mx-auto p-6 sm:p-8 ${wide ? "max-w-2xl" : "max-w-[28rem]"}`}>{children}</div>
      </main>
    </div>
  );
}
