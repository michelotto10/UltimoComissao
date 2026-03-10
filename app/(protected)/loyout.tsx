import Link from "next/link";

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-7xl px-4 py-4 md:px-6 md:py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-[260px_1fr]">
          <aside className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="h-10 w-10 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                <span className="text-sm font-semibold">CF</span>
              </div>
              <div>
                <p className="text-sm font-semibold leading-4">Comissão</p>
                <p className="text-xs text-zinc-400">Painel financeiro</p>
              </div>
            </div>

            <nav className="mt-4 space-y-1">
              <NavItem href="/admin" label="Dashboard" />
              <NavItem href="/admin/pagamentos" label="Pagamentos" />
              <NavItem href="/admin/alunos" label="Alunos" />
              <NavItem href="/admin/financeiro" label="Financeiro" />
              <NavItem href="/admin/pais" label="Pais" />
              <div className="my-3 h-px bg-white/10" />
              <NavItem href="/pais" label="Pais (transparência)" />
            </nav>

          
          </aside>

          <main className="rounded-2xl border border-white/10 bg-zinc-900/70 backdrop-blur-xl">
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-4 md:px-6">
              <div>
                <p className="text-sm font-semibold">Sistema da Formatura</p>
                <p className="text-xs text-zinc-400">
                  Controle, lote, relatórios e transparência
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Link
                  href="/"
                  className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm hover:bg-white/10 transition"
                >
                  Login
                </Link>
              </div>
            </header>

            <div className="p-4 md:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function NavItem({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="block rounded-xl px-3 py-2 text-sm text-zinc-200 hover:bg-white/10 border border-transparent hover:border-white/10 transition"
    >
      {label}
    </Link>
  );
}