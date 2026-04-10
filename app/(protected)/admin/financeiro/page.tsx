"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type FinanceiroRow = {
  id: number;
  tipo: "entrada" | "saida";
  categoria: string | null;
  descricao: string | null;
  valor: number;
  data: string | null; // date no supabase geralmente vem string
  comprovante_url: string | null;
  created_at: string;
};

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

type Role = "admin" | "pais";

function todayISO() {
  const d = new Date();
  // YYYY-MM-DD
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function FinanceiroPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [resumo, setResumo] = useState<ResumoAdmin | null>(null);

  const [rows, setRows] = useState<FinanceiroRow[]>([]);

  // filtros
  const [fTipo, setFTipo] = useState<"todos" | "entrada" | "saida">("todos");
  const [q, setQ] = useState("");

  // form
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [categoria, setCategoria] = useState("");
  const [descricao, setDescricao] = useState("");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(todayISO());

  const moeda = useMemo(() => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }, []);

  const totals = useMemo(() => {
    let entradas = 0;
    let saidas = 0;
    for (const r of rows) {
      const v = Number(r.valor ?? 0);
      if (r.tipo === "entrada") entradas += v;
      else saidas += v;
    }
    return { entradas, saidas, saldo: entradas - saidas };
  }, [rows]);

  useEffect(() => {
    let alive = true;

    async function boot() {
      setLoading(true);
      setErr(null);
      
      async function loadResumo() {
  const { data, error } = await supabase
    .rpc("get_resumo_admin")
    .single<ResumoAdmin>();

  if (error) {
    console.error(error);
    return;
  }

  setResumo(data);
}

      // sessão
      const { data: sessionData, error: sErr } = await supabase.auth.getSession();
      if (!alive) return;

      if (sErr) {
        setErr(sErr.message);
        setLoading(false);
        return;
      }

      const session = sessionData.session;
      if (!session?.user) {
        router.replace("/");
        return;
      }

      // role (defesa extra)
      const { data: profile, error: pErr } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!alive) return;

      const role = String(profile?.role ?? "").trim().toLowerCase() as Role;

      if (pErr || !role) {
        setErr("Seu acesso não está configurado (role).");
        setLoading(false);
        return;
      }
      if (role !== "admin") {
        router.replace("/pais");
        return;
      }

      await loadRows();
      await loadResumo();

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
    
    async function loadResumo() {
  const { data, error } = await supabase
    .rpc("get_resumo_admin")
    .single<ResumoAdmin>();

  if (error) {
    console.error(error);
    return;
  }

  setResumo(data);
}
    setErr(null);

    let query = supabase
      .from("financeiro")
      .select("id,tipo,categoria,descricao,valor,data,comprovante_url,created_at")
      .order("id", { ascending: false })
      .limit(200);

    if (fTipo !== "todos") query = query.eq("tipo", fTipo);

    if (q.trim()) {
      // busca em categoria/descricao (ILIKE)
      const term = `%${q.trim()}%`;
      query = query.or(`categoria.ilike.${term},descricao.ilike.${term}`);
    }

    const { data, error } = await query;

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }

    setRows((data ?? []) as FinanceiroRow[]);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const v = Number(String(valor).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      setSaving(false);
      setErr("Informe um valor válido (maior que 0).");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;

    if (!userId) {
      setSaving(false);
      router.replace("/");
      return;
    }

    const payload = {
      tipo,
      categoria: categoria.trim() || null,
      descricao: descricao.trim() || null,
      valor: v,
      data: data || null,
      created_by: userId, // RLS exige auth.uid()
    };

    const { error } = await supabase.from("financeiro").insert([payload]);

    if (error) {
      setSaving(false);
      setErr(error.message);
      return;
    }

    // limpa form
    setCategoria("");
    setDescricao("");
    setValor("");
    setData(todayISO());
    setTipo("entrada");

    // recarrega
    await loadRows();
    setSaving(false);
  }

  async function handleDelete(id: number) {
    const ok = confirm("Tem certeza que deseja excluir este lançamento?");
    if (!ok) return;

    setErr(null);
    const { error } = await supabase.from("financeiro").delete().eq("id", id);

    if (error) {
      setErr(error.message);
      return;
    }

    await loadRows();
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="opacity-70">Carregando financeiro...</p>
      </div>
    );
  }

  return (
   <div className="w-full min-h-screen bg-[#0b0f1a] px-10 py-8">
      {/* Topo */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Financeiro</h1>
          <p className="text-sm text-zinc-400">
            Entradas e saídas da formatura.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-zinc-900/60 transition"
          >
            Voltar
          </button>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              router.replace("/");
            }}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-zinc-900/60 transition"
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

      {/* Cards */}
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 height-[120px] width-[500px]">
        <StatCard 
        title="📥 Entradas" 
        value={moeda.format(resumo?.entradas ?? 0)} 
        tone="blue" />

        <StatCard 
         title="📤 Saídas" 
         value={moeda.format(resumo?.saidas ?? 0)} 
        tone="red" />

        <StatCard
         title="💰 Saldo"
        value={moeda.format(resumo?.saldo ?? 0)}
        tone={(resumo?.saldo ?? 0) >= 0 ? "green" : "red"}
        />

        <StatCard
        title="🏢 Patrocínios"
        value={moeda.format(resumo?.total_patrocinio ?? 0)}
        tone={(resumo?.saldo ?? 0) >= 0 ? "green" : "red"}
        />
      </div>

      {/* Form */}
      <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <h2 className="font-semibold mb-3">Novo lançamento</h2>

        <form onSubmit={handleCreate} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-1">
            <label className="text-xs text-zinc-300">Tipo</label>
            <select
              className="mt-1 w-full rounded-xl p-3 bg-zinc-900/60 border border-white/10"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as "entrada" | "saida")}
            >
              <option value="entrada">entrada</option>
              <option value="saida">saida</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Categoria</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={categoria}
              onChange={(e) => setCategoria(e.target.value)}
              placeholder="Ex: Evento, Buffet, Foto..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Descrição</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Detalhe do lançamento"
            />
          </div>

          <div className="md:col-span-1">
            <label className="text-xs text-zinc-300">Data</label>
            <input
              type="date"
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Valor</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="Ex: 120.50"
              inputMode="decimal"
            />
            <p className="text-xs text-zinc-400 mt-1">Use ponto ou vírgula.</p>
          </div>

          <div className="md:col-span-4 flex items-end gap-2">
            <button
              disabled={saving}
              className="rounded-xl px-5 py-3 bg-white text-black font-medium disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar lançamento"}
            </button>

            <button
              type="button"
              onClick={() => {
                setTipo("entrada");
                setCategoria("");
                setDescricao("");
                setValor("");
                setData(todayISO());
              }}
              className="rounded-xl px-5 py-3 border border-white/15 hover:bg-zinc-900/60 transition"
            >
              Limpar
            </button>
          </div>
        </form>
      </div>

      {/* Filtros */}
      <div className="mt-6 flex flex-col md:flex-row gap-3 md:items-end">
        <div>
          <label className="text-xs text-zinc-300">Filtrar por tipo     </label>
          <select
            className="mt-1 rounded-xl p-3 border bg-zinc-900/60"
            value={fTipo}
            onChange={(e) => setFTipo(e.target.value as "todos" | "entrada" | "saida")}
          >
            <option value="todos">todos</option>
            <option value="entrada">entrada</option>
            <option value="saida">saida</option>
          </select>
        </div>

        <div className="flex-1">
          <label className="text-xs text-zinc-300">Pesquisar</label>
          <input
            className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Categoria ou descrição..."
          />
        </div>

        <button
          onClick={() => loadRows()}
          className="rounded-xl px-5 py-3 border border-white/15 hover:bg-zinc-900/60 transition"
        >
          Aplicar
        </button>
      </div>

      {/* Tabela */}
      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-300">
            <tr className="border-b border-white/10">
              <th className="py-2 text-left">Data</th>
              <th className="py-2 text-left">Tipo</th>
              <th className="py-2 text-left">Categoria</th>
              <th className="py-2 text-left">Descrição</th>
              <th className="py-2 text-right">Valor</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-white/5">
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
                <td className="py-2 text-right">
                  <button
                    onClick={() => handleDelete(r.id)}
                    className="text-xs underline opacity-80 hover:opacity-100"
                  >
                    excluir
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="py-6 text-center text-zinc-300 opacity-80" colSpan={6}>
                  Nenhum lançamento encontrado.
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