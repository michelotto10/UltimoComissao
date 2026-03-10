"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type ResumoPais = {
  entradas: number;
  saidas: number;
  saldo: number;
  total_mensalidades: number;
  pagos: number;
  pendentes: number;
};

export default function PaisPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [resumo, setResumo] = useState<ResumoPais | null>(null);

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

      // 1) Precisa estar logado
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

      // 2) Confere role (defesa extra; o middleware já protege também)
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

      // Se for admin, não faz sentido ficar no /pais
      if (role === "admin") {
        router.replace("/admin");
        return;
      }

      // 3) Busca os dados agregados com RPC (seguro: não expõe tabelas)
      const { data, error } = await supabase.rpc("get_resumo_pais");

      if (!alive) return;

      if (error) {
        setErr(error.message);
        setLoading(false);
        return;
      }

      // RPC retorna JSON (o "data" é um objeto com os campos)
      const parsed: ResumoPais = {
        entradas: Number(data?.entradas ?? 0),
        saidas: Number(data?.saidas ?? 0),
        saldo: Number(data?.saldo ?? 0),
        total_mensalidades: Number(data?.total_mensalidades ?? 0),
        pagos: Number(data?.pagos ?? 0),
        pendentes: Number(data?.pendentes ?? 0),
      };

      setResumo(parsed);
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
        <p className="opacity-70">Carregando transparência...</p>
      </div>
    );
  }

  if (err) {
    return (
      <div className="max-w-xl mx-auto p-6">
        <h1 className="text-xl font-semibold mb-2">Erro</h1>
        <p className="opacity-80 mb-4">{err}</p>

        <div className="flex gap-2">
          <button
            className="rounded-xl px-4 py-2 bg-white text-black font-medium"
            onClick={() => router.replace("/")}
          >
            Voltar
          </button>
          <button
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-white/5 transition"
            onClick={logout}
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  const saldo = resumo?.saldo ?? 0;
  const entradas = resumo?.entradas ?? 0;
  const saidas = resumo?.saidas ?? 0;
  const pagos = resumo?.pagos ?? 0;
  const pendentes = resumo?.pendentes ?? 0;
  const totalMensalidades = resumo?.total_mensalidades ?? 0;

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Painel dos Pais</h1>
          <p className="text-sm text-zinc-400">
            Transparência da formatura.
          </p>
        </div>

        <button
          onClick={logout}
          className="rounded-xl px-4 py-2 border border-white/15 hover:bg-zinc-900/60 transition"
        >
          Sair
        </button>
      </div>

      {/* Cards principais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="💰 Saldo Atual"
          value={moeda.format(saldo)}
          tone="green"
        />
        <StatCard
          title="✅ Mensalidades Pagas"
          value={String(pagos)}
          tone="blue"
        />
        <StatCard
          title="⏳ Mensalidades Pendentes"
          value={String(pendentes)}
          tone="red"
        />
      </div>

      {/* Detalhes agregados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
        <MiniCard title="📥 Total de Entradas" value={moeda.format(entradas)} />
        <MiniCard title="📤 Total de Saídas" value={moeda.format(saidas)} />
        <MiniCard
          title="💵 Total Mensalidades (pagas)"
          value={moeda.format(totalMensalidades)}
        />
      </div>

      {/* Aviso de segurança */}
      <div className="mt-8 p-5 rounded-2xl border border-white/10 bg-zinc-900/60">
        <h2 className="font-semibold mb-1">Segurança e Transparência</h2>
        <p className="text-sm text-zinc-300">
          Este painel mostra apenas totais e contagens. Ele <b>não</b> exibe dados
          individuais de alunos nem movimentações detalhadas, para evitar
          exposição indevida.
        </p>
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