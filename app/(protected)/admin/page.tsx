"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ResumoAdmin = {
  entradas: number;
  saidas: number;
  saldo: number;
  mensalidades_pagas: number;
  qtd_pagos: number;
  qtd_pendentes: number;
  total_patrocinio: number;
  qtd_patrocinadores: number;
};

type FinanceiroRow = {
  id: number;
  tipo: string;
  categoria: string | null;
  descricao: string | null;
  valor: number;
  data: string | null;
};

export default function AdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [resumo, setResumo] = useState<ResumoAdmin | null>(null);
  const [ultimas, setUltimas] = useState<FinanceiroRow[]>([]);

  const moeda = useMemo(() => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }, []);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setErr(null);

      // 1) Sessão
      const { data: sessionData, error: sessionErr } =
        await supabase.auth.getSession();
      if (!alive) return;

      if (sessionErr) {
        setErr(sessionErr.message);
        setLoading(false);
        return;
      }

      const session = sessionData.session;
      if (!session?.user) {
        router.replace("/");
        return;
      }

      // 2) Role (defesa em profundidade — middleware já protege)
      const { data: profile, error: profErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!alive) return;

      const role = String(profile?.role ?? "").trim().toLowerCase();
      if (profErr || !role) {
        setErr("Seu acesso não está configurado (role).");
        setLoading(false);
        return;
      }
      if (role !== "admin") {
        router.replace("/pais");
        return;
      }

      // 3) Resumo do dashboard via RPC
      const { data: dash, error: dashErr } = await supabase.rpc("get_resumo_admin");
      if (!alive) return;

      if (dashErr) {
        setErr(dashErr.message);
        setLoading(false);
        return;
      }

      const parsed: ResumoAdmin = {
        entradas: Number(dash?.entradas ?? 0),
        saidas: Number(dash?.saidas ?? 0),
        saldo: Number(dash?.saldo ?? 0),
        mensalidades_pagas: Number(dash?.mensalidades_pagas ?? 0),
        qtd_pagos: Number(dash?.qtd_pagos ?? 0),
        qtd_pendentes: Number(dash?.qtd_pendentes ?? 0),
        total_patrocinio: Number(dash?.total_patrocinio ?? 0),
        qtd_patrocinadores: Number(dash?.qtd_patrocinadores ?? 0),
      };
      setResumo(parsed);

      // 4) (Opcional) últimas movimentações (admin-only via RLS)
      const { data: rows, error: finErr } = await supabase
        .from("financeiro")
        .select("id,tipo,categoria,descricao,valor,data")
        .order("id", { ascending: false })
        .limit(8);

      if (!alive) return;

      if (finErr) {
        // não derruba o dashboard, só avisa
        setUltimas([]);
      } else {
        setUltimas((rows ?? []) as FinanceiroRow[]);
      }

      setLoading(false);
    }

    boot();

    return () => {
      alive = false;
    };
  }, [router]);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="opacity-70">Carregando painel da comissão...</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="w-full min-h-screen bg-[#0b0f1a] px-10 py-8">
        <h1 className="text-xl font-semibold mb-2">Erro</h1>
        <p className="opacity-80 mb-4">{err}</p>
        <button
          className="rounded-xl px-4 py-2 bg-white text-black font-medium"
          onClick={() => router.replace("/")}
        >
          Voltar
        </button>
      </div>
    );
  }

  const saldo = resumo?.saldo ?? 0;

  return (
    <div className="w-full min-h-screen bg-[#0b0f1a] px-10 py-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Painel da Comissão</h1>
         
        </div>

        <div className="flex gap-2">
          

          <button
            onClick={logout}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-zinc-900/60 transition"
          >
            Sair
          </button>
        </div>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="💰 Saldo Atual"
          value={moeda.format(saldo)}
          tone={saldo >= 0 ? "green" : "red"}
        />
        <StatCard
          title="📥 Total de Entradas"
          value={moeda.format(resumo?.entradas ?? 0)}
          tone="blue"
        />
        <StatCard
          title="📤 Total de Saídas"
          value={moeda.format(resumo?.saidas ?? 0)}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
        <MiniCard
          title="💵 Mensalidades pagas (R$)"
          value={moeda.format(resumo?.mensalidades_pagas ?? 0)}
        />
        <MiniCard
          title="✅ Qtd pagamentos pagos"
          value={String(resumo?.qtd_pagos ?? 0)}
        />
        <MiniCard
          title="⏳ Qtd pendentes"
          value={String(resumo?.qtd_pendentes ?? 0)}
        />
        <MiniCard
          title="🤝 Patrocínio (R$) / Qtd"
          value={`${moeda.format(resumo?.total_patrocinio ?? 0)} • ${String(
            resumo?.qtd_patrocinadores ?? 0
          )}`}
        />
      </div>

      {/* Atalhos */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
        <ActionCard
          title="📒 Financeiro"
          desc="Registrar entradas/saídas, anexar comprovantes e controlar saldo."
          onClick={() => router.push("/admin/financeiro")}
          cta="Abrir"
        />
        <ActionCard
          title="🧾 Pagamentos"
          desc="Controlar mensalidades por competência, status e relatórios."
          onClick={() => router.push("/admin/pagamentos")}
          cta="Abrir"
        />
        <ActionCard
          title="🤝 Patrocinadores"
          desc="Cadastrar patrocinadores e acompanhar o que oferecem."
          onClick={() => router.push("/admin/patrocinadores")}
          cta="Abrir"
        />

          <ActionCard
          title="👨‍🎓 Alunos"
          desc="Gerenciar cadastro e status dos alunos."
          onClick={() => router.push("/admin/alunos")}
          cta="Abrir"
        />
      </div>

      {/* Últimas movimentações */}
      <div className="mt-8 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <div className="flex items-center justify-between gap-4 mb-3">
          <h2 className="font-semibold">Últimas movimentações</h2>
          <button
            onClick={() => router.push("/admin/financeiro")}
            className="text-sm underline opacity-80 hover:opacity-100"
          >
            ver tudo
          </button>
        </div>

        {ultimas.length === 0 ? (
          <p className="text-sm text-zinc-300 opacity-80">
            Sem dados para mostrar (ou sem permissão).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-zinc-300">
                <tr className="border-b border-white/10">
                  <th className="py-2 text-left">Data</th>
                  <th className="py-2 text-left">Tipo</th>
                  <th className="py-2 text-left">Categoria</th>
                  <th className="py-2 text-left">Descrição</th>
                  <th className="py-2 text-right">Valor</th>
                </tr>
              </thead>
              <tbody>
                {ultimas.map((r) => (
                  <tr key={r.id} className="border-b bg-zinc-900/60">
                    <td className="py-2">
                      {r.data ? new Date(r.data).toLocaleDateString("pt-BR") : "—"}
                    </td>
                    <td className="py-2">
                      <span
                        className={`px-2 py-1 rounded-lg border text-xs ${
                          r.tipo === "entrada"
                            ? "border-green-500/30 bg-green-500/10"
                            : "border-red-500/30 bg-red-500/10"
                        }`}
                      >
                        {r.tipo}
                      </span>
                    </td>
                    <td className="py-2">{r.categoria ?? "—"}</td>
                    <td className="py-2">{r.descricao ?? "—"}</td>
                    <td className="py-2 text-right font-medium">
                      {moeda.format(Number(r.valor ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  tone,
}: {
  title: string;
  value: string;
  subtitle?: string;
  tone: "green" | "blue" | "red";
}) {
  const toneClass =
    tone === "green"
      ? "border-green-500/25 bg-green-500/10"
      : tone === "blue"
      ? "border-blue-500/25 bg-blue-500/10"
      : "border-red-500/25 bg-red-500/10";

  return (
    <div className={`rounded-2xl border ${toneClass} p-5`}>
      <p className="text-sm text-zinc-200">{title}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
      {subtitle && <p className="mt-2 text-xs text-zinc-300">{subtitle}</p>}
    </div>
  );
}

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <p className="text-sm text-zinc-300">{title}</p>
      <p className="mt-2 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ActionCard({
  title,
  desc,
  cta,
  onClick,
}: {
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-zinc-300 mb-4">{desc}</p>
      <button
        onClick={onClick}
        className="rounded-xl px-4 py-2 bg-white text-black font-medium"
      >
        {cta}
      </button>
    </div>
  );
}