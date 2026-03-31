'use client'

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setErrorMsg(null)

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setLoading(false)
      setErrorMsg(error.message)
      return
    }

    // depois de logar, buscamos o role no banco (profiles)
    const userId = data.user?.id
    if (!userId) {
      setLoading(false)
      setErrorMsg("Usuário não encontrado.")
      return
    }

    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .single()

    setLoading(false)

    if (profErr || !profile?.role) {
      setErrorMsg("Seu acesso não está configurado (role).")
      return
    }

    if (profile.role === "admin") router.push("/admin")
    else router.push("/pais")
  }

  return (
    
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={handleLogin} className="w-full max-w-sm bg-white/5 border border-white/10 rounded-2xl p-6">
        <h1 className="text-xl font-semibold mb-4">Acesso</h1>

        <label className="block text-sm mb-1">Email</label>
        <input
          className="w-full rounded-xl p-3 mb-3 bg-black/20 border border-white/10"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label className="block text-sm mb-1">Senha</label>
        <input
          className="w-full rounded-xl p-3 mb-4 bg-black/20 border border-white/10"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />
          
        {errorMsg && <p className="text-red-400 text-sm mb-3">{errorMsg}</p>}

        <button
          disabled={loading}
          className="w-full rounded-xl p-3 bg-white text-black font-medium disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  )
}