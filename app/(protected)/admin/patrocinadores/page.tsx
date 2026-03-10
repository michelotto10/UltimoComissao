"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type PagamentoRow = {
  id: number;
  aluno_id: number;
  competencia: string; // date: YYYY-MM-DD
  valor: number;
  status: "pago" | "pendente" | string;
  pago_em: string | null; // timestamptz
  created_at: string;
};

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function monthStartISO(ym: string) {
  // ym = YYYY-MM
  return `${ym}-01`;
}

export default function PagamentosPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [rows, setRows] = useState<PagamentoRow[]>([]);

  // filtros
  const [status, setStatus] = useState<"todos" | "pago" | "pendente">("pendente");
  const [alunoId, setAlunoId] = useState("");
  const [competenciaYM, setCompetenciaYM] = useState(""); // YYYY-MM (opcional)

  // form novo pagamento
  const [novoAlunoId, setNovoAlunoId] = useState("");
  const [novoValor, setNovoValor] = useState("");
  const [novoCompetenciaYM, setNovoCompetenciaYM] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });
  const [novoStatus, setNovoStatus] = useState<"pendente" | "pago">("pendente");

  const moeda = useMemo(() => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
  }, []);

  const resumo = useMemo(() => {
    let pagos = 0;
    let pendentes = 0;
    let totalPago = 0;
    for (const r of rows) {
      if (String(r.status).toLowerCase() === "pago") {
        pagos++;
        totalPago += Number(r.valor ?? 0);
      } else {
        pendentes++;
      }
    }
    return { pagos, pendentes, totalPago };
  }, [rows]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setErr(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session?.user) {
        router.replace("/");
        return;
      }

      // defesa extra (middleware já protege)
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      const role = String(profile?.role ?? "").trim().toLowerCase();
      if (!role) {
        setErr("Seu acesso não está configurado (role).");
        setLoading(false);
        return;
      }
      if (role !== "admin") {
        router.replace("/pais");
        return;
      }

      await loadRows();
      if (!alive) return;
      setLoading(false);
    }

    boot();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadRows() {
    setErr(null);

    let query = supabase
      .from("pagamentos")
      .select("id,aluno_id,competencia,valor,status,pago_em,created_at")
      .order("id", { ascending: false })
      .limit(300);

    if (status !== "todos") query = query.eq("status", status);

    const aId = alunoId.trim();
    if (aId) {
      const n = Number(aId);
      if (!Number.isFinite(n)) {
        setErr("Filtro aluno_id inválido.");
        setRows([]);
        return;
      }
      query = query.eq("aluno_id", n);
    }

    if (competenciaYM) {
      // filtra pelo mês inteiro: [YYYY-MM-01, próximo mês)
      const start = monthStartISO(competenciaYM);
      const d = new Date(`${competenciaYM}-01T00:00:00`);
      d.setMonth(d.getMonth() + 1);
      const end = d.toISOString().slice(0, 10); // YYYY-MM-DD
      query = query.gte("competencia", start).lt("competencia", end);
    }

    const { data, error } = await query;

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }

    setRows((data ?? []) as PagamentoRow[]);
  }

  async function criarPagamento(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const aId = Number(novoAlunoId.trim());
    if (!Number.isFinite(aId) || aId <= 0) {
      setSaving(false);
      setErr("Informe um aluno_id válido.");
      return;
    }

    const v = Number(String(novoValor).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setSaving(false);
      setErr("Informe um valor válido (maior que 0).");
      return;
    }

    if (!novoCompetenciaYM) {
      setSaving(false);
      setErr("Informe a competência (mês).");
      return;
    }

    const competencia = monthStartISO(novoCompetenciaYM);
    const st = novoStatus;

    const payload = {
      aluno_id: aId,
      competencia,
      valor: v,
      status: st,
      pago_em: st === "pago" ? new Date().toISOString() : null,
    };

    const { error } = await supabase.from("pagamentos").insert([payload]);

    if (error) {
      setSaving(false);
      setErr(error.message);
      return;
    }

    setNovoAlunoId("");
    setNovoValor("");
    setNovoStatus("pendente");

    await loadRows();
    setSaving(false);
  }

  async function marcarPago(row: PagamentoRow) {
    setErr(null);

    const { error } = await supabase
      .from("pagamentos")
      .update({
        status: "pago",
        pago_em: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (error) {
      setErr(error.message);
      return;
    }
    await loadRows();
  }

  async function marcarPendente(row: PagamentoRow) {
    setErr(null);

    const { error } = await supabase
      .from("pagamentos")
      .update({
        status: "pendente",
        pago_em: null,
      })
      .eq("id", row.id);

    if (error) {
      setErr(error.message);
      return;
    }
    await loadRows();
  }

  async function excluir(row: PagamentoRow) {
    const ok = confirm("Tem certeza que deseja excluir este pagamento?");
    if (!ok) return;

    setErr(null);
    const { error } = await supabase.from("pagamentos").delete().eq("id", row.id);

    if (error) {
      setErr(error.message);
      return;
    }
    await loadRows();
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="opacity-70">Carregando pagamentos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* topo */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pagamentos</h1>
          <p className="text-sm text-zinc-400">
            Controle de mensalidades (somente comissão).
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-white/5 transition"
          >
            Voltar
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/");
            }}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-white/5 transition"
          >
            Sair
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{err}</p>
        </div>
      )}

      {/* resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="✅ Pagos" value={String(resumo.pagos)} tone="green" />
        <StatCard title="⏳ Pendentes" value={String(resumo.pendentes)} tone="red" />
        <StatCard title="💵 Total Pago" value={moeda.format(resumo.totalPago)} tone="blue" />
      </div>

      {/* criar pagamento */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="font-semibold mb-3">Novo pagamento</h2>

        <form onSubmit={criarPagamento} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs text-zinc-300">Aluno ID</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={novoAlunoId}
              onChange={(e) => setNovoAlunoId(e.target.value)}
              placeholder="Ex: 12"
              inputMode="numeric"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Competência (mês)</label>
            <input
              type="month"
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={novoCompetenciaYM}
              onChange={(e) => setNovoCompetenciaYM(e.target.value)}
              required
            />
            <p className="text-xs text-zinc-400 mt-1">Salva como {monthStartISO(novoCompetenciaYM)}.</p>
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-zinc-300">Valor</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={novoValor}
              onChange={(e) => setNovoValor(e.target.value)}
              placeholder="Ex: 120"
              inputMode="decimal"
              required
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-zinc-300">Status</label>
            <select
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={novoStatus}
              onChange={(e) => setNovoStatus(e.target.value as any)}
            >
              <option value="pendente">pendente</option>
              <option value="pago">pago</option>
            </select>
          </div>

          <div className="md:col-span-1 flex items-end">
            <button
              disabled={saving}
              className="w-full rounded-xl px-5 py-3 bg-white text-black font-medium disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>

      {/* filtros */}
      <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-end">
        <div>
          <label className="text-xs text-zinc-300">Status</label>
          <select
            className="mt-1 rounded-xl p-3 bg-black/20 border border-white/10"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="todos">todos</option>
            <option value="pendente">pendente</option>
            <option value="pago">pago</option>
          </select>
        </div>

        <div>
          <label className="text-xs text-zinc-300">Aluno ID</label>
          <input
            className="mt-1 rounded-xl p-3 bg-black/20 border border-white/10"
            value={alunoId}
            onChange={(e) => setAlunoId(e.target.value)}
            placeholder="Ex: 12"
            inputMode="numeric"
          />
        </div>

        <div className="flex-1">
          <label className="text-xs text-zinc-300">Competência (mês)</label>
          <input
            type="month"
            className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
            value={competenciaYM}
            onChange={(e) => setCompetenciaYM(e.target.value)}
          />
        </div>

        <button
          onClick={loadRows}
          className="rounded-xl px-5 py-3 border border-white/15 hover:bg-white/5 transition"
        >
          Aplicar
        </button>

        <button
          onClick={() => {
            setStatus("pendente");
            setAlunoId("");
            setCompetenciaYM("");
            loadRows();
          }}
          className="rounded-xl px-5 py-3 border border-white/15 hover:bg-white/5 transition"
        >
          Limpar
        </button>
      </div>

      {/* tabela */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-300">
            <tr className="border-b border-white/10">
              <th className="py-2 text-left">Competência</th>
              <th className="py-2 text-left">Aluno ID</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-left">Pago em</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const st = String(r.status).toLowerCase();
              return (
                <tr key={r.id} className="border-b border-white/5">
                  <td className="py-2">
                    {r.competencia ? new Date(r.competencia).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-2">{r.aluno_id}</td>
                  <td className="py-2 text-right font-medium">{moeda.format(Number(r.valor ?? 0))}</td>
                  <td className="py-2">
                    <span
                      className={`px-2 py-1 rounded-lg border text-xs ${
                        st === "pago"
                          ? "border-green-500/30 bg-green-500/10"
                          : "border-red-500/30 bg-red-500/10"
                      }`}
                    >
                      {st}
                    </span>
                  </td>
                  <td className="py-2">
                    {r.pago_em ? new Date(r.pago_em).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="py-2 text-right space-x-3">
                    {st !== "pago" ? (
                      <button
                        onClick={() => marcarPago(r)}
                        className="text-xs underline opacity-80 hover:opacity-100"
                      >
                        marcar pago
                      </button>
                    ) : (
                      <button
                        onClick={() => marcarPendente(r)}
                        className="text-xs underline opacity-80 hover:opacity-100"
                      >
                        voltar pendente
                      </button>
                    )}

                    <button
                      onClick={() => excluir(r)}
                      className="text-xs underline text-red-300 opacity-80 hover:opacity-100"
                    >
                      excluir
                    </button>
                  </td>
                </tr>
              );
            })}

            {rows.length === 0 && (
              <tr>
                <td className="py-6 text-center text-zinc-300 opacity-80" colSpan={6}>
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-zinc-400">
        Dica: competência é salva como o dia <code>01</code> do mês selecionado (ex: 2026-03-01).
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  tone,
}: {
  title: string;
  value: string;
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
    </div>
  );
}