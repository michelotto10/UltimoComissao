"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Aluno = {
  id: number;
  nome: string;
  ativo: boolean;
};

type Pagamento = {
  id: number;
  aluno_id: number;
  competencia: string; // YYYY-MM-DD
  valor: number;
  status: "pago" | "pendente" | string;
  pago_em: string | null;
  created_at: string;
};

type Relatorio = {
  qtd: number;
  qtd_pagos: number;
  qtd_pendentes: number;
  total: number;
  total_pago: number;
};

function monthStartISO(ym: string) {
  return `${ym}-01`;
}

function nextMonthStartISO(ym: string) {
  const d = new Date(`${ym}-01T00:00:00`);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function PagamentosPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // dados
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);

  // filtros
  const [status, setStatus] = useState<"todos" | "pago" | "pendente">("pendente");
  const [competenciaYM, setCompetenciaYM] = useState(""); // YYYY-MM
  const [alunoPick, setAlunoPick] = useState<string>(""); // id como string
  const [qNome, setQNome] = useState("");

  // novo pagamento manual
  const [novoAlunoId, setNovoAlunoId] = useState<string>("");
  const [novoCompetenciaYM, setNovoCompetenciaYM] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });
  const [novoValor, setNovoValor] = useState("");
  const [novoStatus, setNovoStatus] = useState<"pendente" | "pago">("pendente");
  const [saving, setSaving] = useState(false);

  // lote
  const [loteYM, setLoteYM] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    return `${yyyy}-${mm}`;
  });
  const [loteValor, setLoteValor] = useState("");
  const [loteMsg, setLoteMsg] = useState<string | null>(null);
  const [loteRunning, setLoteRunning] = useState(false);

  // relatório
  const [relYM, setRelYM] = useState(loteYM);
  const [rel, setRel] = useState<Relatorio | null>(null);
  const [relLoading, setRelLoading] = useState(false);

  const moeda = useMemo(
    () => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }),
    []
  );

  const alunoMap = useMemo(() => {
    const m = new Map<number, string>();
    alunos.forEach((a) => m.set(a.id, a.nome));
    return m;
  }, [alunos]);

  const alunosFiltrados = useMemo(() => {
    const term = qNome.trim().toLowerCase();
    if (!term) return alunos;
    return alunos.filter((a) => a.nome.toLowerCase().includes(term) || String(a.id).includes(term));
  }, [alunos, qNome]);

  const resumoTabela = useMemo(() => {
    let pagos = 0, pendentes = 0, totalPago = 0;
    for (const p of pagamentos) {
      const st = String(p.status).toLowerCase();
      if (st === "pago") {
        pagos++;
        totalPago += Number(p.valor ?? 0);
      } else pendentes++;
    }
    return { pagos, pendentes, totalPago };
  }, [pagamentos]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setErr(null);

      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      if (!user) return router.replace("/");

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      const role = String(profile?.role ?? "").trim().toLowerCase();
      if (role !== "admin") return router.replace("/pais");

      await loadAlunos();
      await loadPagamentos();
      if (!alive) return;
      setLoading(false);
    })();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function loadAlunos() {
    const { data, error } = await supabase
      .from("alunos")
      .select("id,nome,ativo")
      .order("nome", { ascending: true });

    if (error) {
      setErr(error.message);
      setAlunos([]);
      return;
    }
    setAlunos((data ?? []) as Aluno[]);
  }

  async function loadPagamentos() {
    setErr(null);

    let query = supabase
      .from("pagamentos")
      .select("id,aluno_id,competencia,valor,status,pago_em,created_at")
      .order("id", { ascending: false })
      .limit(500);

    if (status !== "todos") query = query.eq("status", status);

    if (alunoPick) query = query.eq("aluno_id", Number(alunoPick));

    if (competenciaYM) {
      const start = monthStartISO(competenciaYM);
      const end = nextMonthStartISO(competenciaYM);
      query = query.gte("competencia", start).lt("competencia", end);
    }

    const { data, error } = await query;
    if (error) {
      setErr(error.message);
      setPagamentos([]);
      return;
    }
    setPagamentos((data ?? []) as Pagamento[]);
  }

  async function criarPagamento(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const aId = Number(novoAlunoId);
    if (!Number.isFinite(aId) || aId <= 0) {
      setSaving(false);
      setErr("Escolha um aluno válido.");
      return;
    }

    const v = Number(String(novoValor).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setSaving(false);
      setErr("Informe um valor válido.");
      return;
    }

    const competencia = monthStartISO(novoCompetenciaYM);
    const st = novoStatus;

    const { error } = await supabase.from("pagamentos").insert([
      {
        aluno_id: aId,
        competencia,
        valor: v,
        status: st,
        pago_em: st === "pago" ? new Date().toISOString() : null,
      },
    ]);

    if (error) {
      setSaving(false);
      // se bater na UNIQUE (aluno_id, competencia), o erro aparece aqui
      setErr(error.message);
      return;
    }

    setNovoAlunoId("");
    setNovoValor("");
    setNovoStatus("pendente");
    await loadPagamentos();
    setSaving(false);
  }

  async function marcarPago(p: Pagamento) {
    setErr(null);
    const { error } = await supabase
      .from("pagamentos")
      .update({ status: "pago", pago_em: new Date().toISOString() })
      .eq("id", p.id);

    if (error) return setErr(error.message);
    await loadPagamentos();
  }

  async function marcarPendente(p: Pagamento) {
    setErr(null);
    const { error } = await supabase
      .from("pagamentos")
      .update({ status: "pendente", pago_em: null })
      .eq("id", p.id);

    if (error) return setErr(error.message);
    await loadPagamentos();
  }

  async function excluir(p: Pagamento) {
    const ok = confirm("Excluir este pagamento?");
    if (!ok) return;
    setErr(null);
    const { error } = await supabase.from("pagamentos").delete().eq("id", p.id);
    if (error) return setErr(error.message);
    await loadPagamentos();
  }

  async function gerarLote() {
    setLoteRunning(true);
    setLoteMsg(null);
    setErr(null);

    const v = Number(String(loteValor).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setLoteRunning(false);
      setErr("Informe um valor válido para o lote.");
      return;
    }

    const competencia = monthStartISO(loteYM);

    const { data, error } = await supabase.rpc("gerar_pagamentos_mes", {
      p_competencia: competencia,
      p_valor: v,
    });

    if (error) {
      setLoteRunning(false);
      setErr(error.message);
      return;
    }

    setLoteMsg(`Lote gerado. Novos pagamentos inseridos: ${data ?? 0}`);
    await loadPagamentos();
    setLoteRunning(false);
  }

  async function carregarRelatorio() {
    setRelLoading(true);
    setRel(null);
    setErr(null);

    const competencia = monthStartISO(relYM);

    const { data, error } = await supabase.rpc("relatorio_pagamentos_mes", {
      p_competencia: competencia,
    });

    if (error) {
      setRelLoading(false);
      setErr(error.message);
      return;
    }

    setRel(data);
    setRelLoading(false);
  }

  function exportarCSV() {
    // Exporta o que está na tabela (já filtrado)
    const header = ["id", "aluno_id", "aluno_nome", "competencia", "valor", "status", "pago_em"].join(",");
    const lines = pagamentos.map((p) => {
      const nome = (alunoMap.get(p.aluno_id) ?? "").replaceAll('"', '""');
      return [
        p.id,
        p.aluno_id,
        `"${nome}"`,
        p.competencia,
        String(p.valor).replace(".", ","),
        String(p.status),
        p.pago_em ?? "",
      ].join(",");
    });
    const csv = [header, ...lines].join("\n");
    downloadCSV(`pagamentos_${competenciaYM || "todos"}.csv`, csv);
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
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Pagamentos</h1>
         
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-zinc-900/60 transition"
          >
            Voltar
          </button>
          <button
            onClick={() => router.push("/admin/alunos")}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-zinc-900/60 transition"
          >
            Alunos
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{err}</p>
        </div>
      )}

      {/* RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard title="✅ Pagos" value={String(resumoTabela.pagos)} tone="green" />
        <StatCard title="⏳ Pendentes" value={String(resumoTabela.pendentes)} tone="red" />
        <StatCard title="💵 Total Pago (na tabela)" value={moeda.format(resumoTabela.totalPago)} tone="blue" />
      </div>

      {/* NOVO PAGAMENTO */}
      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <h2 className="font-semibold mb-3">Novo pagamento (manual)</h2>

        <form onSubmit={criarPagamento} className="grid grid-cols-1 md:grid-cols-8 gap-3">
          <div className="md:col-span-3">
            <label className="text-xs text-zinc-300">Selecionar aluno</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              placeholder="buscar por nome..."
              value={qNome}
              onChange={(e) => setQNome(e.target.value)}
            />
            <select
              className="mt-2 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={novoAlunoId}
              onChange={(e) => setNovoAlunoId(e.target.value)}
              required
            >
              <option value="">— escolher —</option>
              {alunosFiltrados.map((a) => (
                <option key={a.id} value={String(a.id)}>
                  {a.nome} (ID {a.id}){a.ativo ? "" : " — inativo"}
                </option>
              ))}
            </select>
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
              onChange={(e) => setNovoStatus(e.target.value as "pendente" | "pago")}
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

        <p className="mt-2 text-xs text-zinc-400">
          A competência é salva como <code>YYYY-MM-01</code>. Duplicados por aluno/mês são bloqueados.
        </p>
      </div>

      {/* LOTE */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <h2 className="font-semibold mb-3">Gerar mensalidade em lote</h2>

        {loteMsg && (
          <div className="mb-3 rounded-2xl border border-white/10 bg-zinc-900/60 p-3">
            <p className="text-sm text-zinc-200">{loteMsg}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Competência (mês)</label>
            <input
              type="month"
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={loteYM}
              onChange={(e) => setLoteYM(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Valor da mensalidade</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={loteValor}
              onChange={(e) => setLoteValor(e.target.value)}
              placeholder="Ex: 120"
              inputMode="decimal"
            />
          </div>

          <div className="md:col-span-2 flex items-end">
            <button
              onClick={gerarLote}
              disabled={loteRunning}
              className="w-full rounded-xl px-5 py-3 bg-white text-black font-medium disabled:opacity-60"
            >
              {loteRunning ? "Gerando..." : "Gerar lote"}
            </button>
          </div>
        </div>

        <p className="mt-2 text-xs text-zinc-400">
          Gera para todos alunos <b>ativos</b>. Se já existir pagamento no mês, ele não duplica.
        </p>
      </div>

      {/* RELATÓRIO */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <h2 className="font-semibold mb-3">Relatório do mês</h2>

        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Competência (mês)</label>
            <input
              type="month"
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={relYM}
              onChange={(e) => setRelYM(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <button
              onClick={carregarRelatorio}
              disabled={relLoading}
              className="w-full rounded-xl px-5 py-3 border border-white/15 hover:bg-zinc-900/60 transition disabled:opacity-60"
            >
              {relLoading ? "Carregando..." : "Gerar relatório"}
            </button>
          </div>
        </div>

        {rel && (
          <div className="mt-4 grid grid-cols-1 md:grid-cols-5 gap-3">
            <MiniCard title="Qtd registros" value={String(rel.qtd ?? 0)} />
            <MiniCard title="Pagos" value={String(rel.qtd_pagos ?? 0)} />
            <MiniCard title="Pendentes" value={String(rel.qtd_pendentes ?? 0)} />
            <MiniCard title="Total (R$)" value={moeda.format(Number(rel.total ?? 0))} />
            <MiniCard title="Total pago (R$)" value={moeda.format(Number(rel.total_pago ?? 0))} />
          </div>
        )}
      </div>

      {/* FILTROS + EXPORT */}
      <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-end">
        <div>
          <label className="text-xs text-zinc-300">Status</label>
          <select
            className="mt-1 rounded-xl p-3 bg-black/20 border border-white/10"
            value={status}
            onChange={(e) => setStatus(e.target.value as "todos" | "pago" | "pendente")}
          >
            <option value="todos">todos</option>
            <option value="pendente">pendente</option>
            <option value="pago">pago</option>
          </select>
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

        <div className="flex-1">
          <label className="text-xs text-zinc-300">Aluno</label>
          <select
            className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
            value={alunoPick}
            onChange={(e) => setAlunoPick(e.target.value)}
          >
            <option value="">— todos —</option>
            {alunos.map((a) => (
              <option key={a.id} value={String(a.id)}>
                {a.nome} (ID {a.id})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={loadPagamentos}
          className="rounded-xl px-5 py-3 border border-white/15 hover:bg-zinc-900/60 transition"
        >
          Aplicar
        </button>

        <button
          onClick={exportarCSV}
          className="rounded-xl px-5 py-3 bg-white text-black font-medium"
        >
          Exportar CSV
        </button>
      </div>

      {/* TABELA */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/60 p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-300">
            <tr className="border-b border-white/10">
              <th className="py-2 text-left">Competência</th>
              <th className="py-2 text-left">Aluno</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2 text-left">Status</th>
              <th className="py-2 text-left">Pago em</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {pagamentos.map((p) => {
              const st = String(p.status).toLowerCase();
              return (
                <tr key={p.id} className="border-b border-white/5">
                  <td className="py-2">
                    {p.competencia ? new Date(p.competencia).toLocaleDateString("pt-BR") : "—"}
                  </td>
                  <td className="py-2">
                    {alunoMap.get(p.aluno_id) ?? `ID ${p.aluno_id}`}
                  </td>
                  <td className="py-2 text-right font-medium">
                    {moeda.format(Number(p.valor ?? 0))}
                  </td>
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
                    {p.pago_em ? new Date(p.pago_em).toLocaleString("pt-BR") : "—"}
                  </td>
                  <td className="py-2 text-right space-x-3">
                    {st !== "pago" ? (
                      <button
                        onClick={() => marcarPago(p)}
                        className="text-xs underline opacity-80 hover:opacity-100"
                      >
                        marcar pago
                      </button>
                    ) : (
                      <button
                        onClick={() => marcarPendente(p)}
                        className="text-xs underline opacity-80 hover:opacity-100"
                      >
                        voltar pendente
                      </button>
                    )}

                    <button
                      onClick={() => excluir(p)}
                      className="text-xs underline text-red-300 opacity-80 hover:opacity-100"
                    >
                      excluir
                    </button>
                  </td>
                </tr>
              );
            })}

            {pagamentos.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-zinc-300 opacity-80">
                  Nenhum pagamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      
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

function MiniCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <p className="text-xs text-zinc-300">{title}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}