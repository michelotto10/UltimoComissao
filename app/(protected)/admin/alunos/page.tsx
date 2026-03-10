"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

type Aluno = {
  id: number;
  nome: string;
  turma: string | null;
  ativo: boolean;
  created_at: string;
};

export default function AlunosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [rows, setRows] = useState<Aluno[]>([]);
  const [q, setQ] = useState("");

  const [nome, setNome] = useState("");
  const [turma, setTurma] = useState("");
  const [ativo, setAtivo] = useState(true);
  const [saving, setSaving] = useState(false);

  const filtrados = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((a) => a.nome.toLowerCase().includes(term) || String(a.id).includes(term));
  }, [rows, q]);

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

      if (!alive) return;

      const role = String(profile?.role ?? "").trim().toLowerCase();
      if (role !== "admin") return router.replace("/pais");

      await load();
      if (!alive) return;
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [router]);

  async function load() {
    setErr(null);
    const { data, error } = await supabase
      .from("alunos")
      .select("id,nome,turma,ativo,created_at")
      .order("id", { ascending: true });

    if (error) {
      setErr(error.message);
      setRows([]);
      return;
    }
    setRows((data ?? []) as Aluno[]);
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);

    const n = nome.trim();
    if (!n) {
      setSaving(false);
      setErr("Informe o nome.");
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData.session?.user?.id;
    if (!userId) {
      setSaving(false);
      router.replace("/");
      return;
    }

    const { error } = await supabase.from("alunos").insert([
      { nome: n, turma: turma.trim() || null, ativo, created_by: userId },
    ]);

    if (error) {
      setSaving(false);
      setErr(error.message);
      return;
    }

    setNome("");
    setTurma("");
    setAtivo(true);
    await load();
    setSaving(false);
  }

  async function toggleAtivo(a: Aluno) {
    setErr(null);
    const { error } = await supabase.from("alunos").update({ ativo: !a.ativo }).eq("id", a.id);
    if (error) return setErr(error.message);
    await load();
  }

  async function excluir(a: Aluno) {
    const ok = confirm(`Excluir aluno ${a.nome} (ID ${a.id})?`);
    if (!ok) return;
    setErr(null);
    const { error } = await supabase.from("alunos").delete().eq("id", a.id);
    if (error) return setErr(error.message);
    await load();
  }

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <p className="opacity-70">Carregando alunos...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Alunos</h1>
          <p className="text-sm text-zinc-400">Cadastro e status (ativo/inativo).</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => router.push("/admin")}
            className="rounded-xl px-4 py-2 border border-white/15 hover:bg-zinc-900/60 transition"
          >
            Voltar
          </button>
        </div>
      </div>

      {err && (
        <div className="mb-4 rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
          <p className="text-sm text-red-200">{err}</p>
        </div>
      )}

      <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-5">
        <h2 className="font-semibold mb-3">Novo aluno</h2>
        <form onSubmit={criar} className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div className="md:col-span-3">
            <label className="text-xs text-zinc-300">Nome</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome do aluno"
              required
            />
          </div>

          <div className="md:col-span-2">
            <label className="text-xs text-zinc-300">Turma</label>
            <input
              className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
              value={turma}
              onChange={(e) => setTurma(e.target.value)}
              placeholder="Ex: 3º A"
            />
          </div>

          <div className="md:col-span-1 flex items-end gap-2">
            <label className="text-xs text-zinc-300 flex items-center gap-2 mb-2">
              <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} />
              Ativo
            </label>
            <button
              disabled={saving}
              className="w-full rounded-xl px-5 py-3 bg-white text-black font-medium disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Criar"}
            </button>
          </div>
        </form>
      </div>

      <div className="mt-6 flex gap-3 items-end">
        <div className="flex-1">
          <label className="text-xs text-zinc-300">Buscar</label>
          <input
            className="mt-1 w-full rounded-xl p-3 bg-black/20 border border-white/10"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Nome ou ID..."
          />
        </div>

        <button
          onClick={load}
          className="rounded-xl px-5 py-3 border border-white/15 bg-zinc-900/60 transition"
        >
          Recarregar
        </button>
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-zinc-900/70 p-5 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-zinc-300">
            <tr className="border-b border-white/10">
              <th className="py-2 text-left">ID</th>
              <th className="py-2 text-left">Nome</th>
              <th className="py-2 text-left">Turma</th>
              <th className="py-2 text-left">Ativo</th>
              <th className="py-2 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((a) => (
              <tr key={a.id} className="border-b border-white/5">
                <td className="py-2">{a.id}</td>
                <td className="py-2">{a.nome}</td>
                <td className="py-2">{a.turma ?? "—"}</td>
                <td className="py-2">{a.ativo ? "sim" : "não"}</td>
                <td className="py-2 text-right space-x-3">
                  <button
                    onClick={() => toggleAtivo(a)}
                    className="text-xs underline opacity-80 hover:opacity-100"
                  >
                    {a.ativo ? "desativar" : "ativar"}
                  </button>
                  <button
                    onClick={() => excluir(a)}
                    className="text-xs underline text-red-300 opacity-80 hover:opacity-100"
                  >
                    excluir
                  </button>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-zinc-300 opacity-80">
                  Nenhum aluno encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}