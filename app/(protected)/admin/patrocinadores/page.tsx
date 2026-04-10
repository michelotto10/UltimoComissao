'use client'

import Link from "next/link"
import { useEffect, useState, useMemo } from "react"
import { supabase } from "@/lib/supabaseClient"


type Patrocinador = {
  id:number
  nome:string
  valor:number
  oferece:string
  contato:string
  responsavel:string
  telefone:string
  email:string
  status:string
  observacoes:string
}

export default function Patrocinadores(){

const [lista,setLista] = useState<Patrocinador[]>([])
const [busca,setBusca] = useState("")
const [editando,setEditando] = useState<number | null>(null)

const [form,setForm] = useState({
nome:"",
valor:"",
oferece:"",
contato:"",
responsavel:"",
telefone:"",
email:"",
status:"negociando",
observacoes:""
})

async function carregar(){
  const { data, error } = await supabase
    .from("patrocinadores")
    .select("*")
    .order("id", { ascending: false });

  if (error) {
    alert("Erro ao carregar patrocinadores: " + error.message);
    setLista([]);
    return;
  }

  setLista(data || []);
}

useEffect(() => {
  const fetchData = async () => {
    await carregar();
  };
  fetchData();
}, []);

function limpar(){

setForm({
nome:"",
valor:"",
oferece:"",
contato:"",
responsavel:"",
telefone:"",
email:"",
status:"negociando",
observacoes:""
})

setEditando(null)

}

function formatarTelefone(valor:string){

valor = valor.replace(/\D/g,'')

valor = valor.replace(/^(\d{2})(\d)/g,"($1) $2")
valor = valor.replace(/(\d)(\d{4})$/,"$1-$2")

return valor

}

async function salvar(e: React.FormEvent<HTMLFormElement>){

  e.preventDefault();

  const valorNumero = Number(form.valor);

  let errorMsg = "";

  if (editando) {
    const { error } = await supabase
      .from("patrocinadores")
      .update({
        ...form,
        valor: valorNumero
      })
      .eq("id", editando);

    if (error) {
      errorMsg = error.message;
    }
  } else {
    const { error } = await supabase
      .from("patrocinadores")
      .insert([{
        ...form,
        valor: valorNumero
      }]);

    if (error) {
      errorMsg = error.message;
    }
  }

  if (errorMsg) {
    alert("Erro ao salvar patrocinador: " + errorMsg);
    return;
  }

  limpar();
  carregar();

}

async function editar(p:Patrocinador){

setEditando(p.id)

setForm({
nome:p.nome || "",
valor:String(p.valor || ""),
oferece:p.oferece || "",
contato:p.contato || "",
responsavel:p.responsavel || "",
telefone:p.telefone || "",
email:p.email || "",
status:p.status || "negociando",
observacoes:p.observacoes || ""
})

}

async function excluir(id:number){

if(!confirm("Excluir patrocinador?")) return

await supabase
.from("patrocinadores")
.delete()
.eq("id",id)

carregar()

}

const filtrados = useMemo(()=>{

return lista.filter(p=>
p.nome.toLowerCase().includes(busca.toLowerCase())
)

},[lista,busca])

const total = lista.reduce((acc,p)=> acc + Number(p.valor || 0),0)

const confirmados = lista.filter(p=>p.status=="confirmado").length

const negociando = lista.filter(p=>p.status=="negociando").length



return(

<div className="container">


<div className="center">
  <h1>Painel de Patrocinadores</h1>
  <p>Gestão de empresas parceiras</p>
</div>

<div className="pageHeader">

<Link href="/admin">
  <button className="backButton">
    ⬅ Voltar
  </button>
</Link>

</div>


<div className="stats">

<div className="statCard">
<p>Total estimado</p>
<h2>R$ {total.toLocaleString()}</h2>
</div>

<div className="statCard">
<p>Confirmados</p>
<h2>{confirmados}</h2>
</div>

<div className="statCard">
<p>Negociando</p>
<h2>{negociando}</h2>
</div>

</div>


<div className="grid">

<div className="formCard">

<h2>
{editando ? "Editar patrocinador" : "Novo patrocinador"}
</h2>

<form onSubmit={salvar}>

<input
placeholder="Empresa"
value={form.nome}
onChange={e=>setForm({...form,nome:e.target.value})}
/>

<input
placeholder="Valor"
value={form.valor}
onChange={e=>setForm({...form,valor:e.target.value})}
/>

<input
placeholder="O que oferece"
value={form.oferece}
onChange={e=>setForm({...form,oferece:e.target.value})}
/>

<input
placeholder="Contato geral"
value={form.contato}
onChange={e=>setForm({...form,contato:e.target.value})}
/>

<input
placeholder="Responsável"
value={form.responsavel}
onChange={e=>setForm({...form,responsavel:e.target.value})}
/>

<input
placeholder="Telefone"
value={form.telefone}
onChange={e=>setForm({...form,telefone:formatarTelefone(e.target.value)})}
/>

<input
placeholder="Email"
value={form.email}
onChange={e=>setForm({...form,email:e.target.value})}
/>

<select
value={form.status}
onChange={e=>setForm({...form,status:e.target.value})}
>

<option value="negociando">Negociando</option>
<option value="confirmado">Confirmado</option>
<option value="recebido">Recebido</option>
<option value="cancelado">Cancelado</option>

</select>

<textarea
placeholder="Observações"
value={form.observacoes}
onChange={e=>setForm({...form,observacoes:e.target.value})}
/>

<button className="primaryButton">

{editando ? "Atualizar" : "Cadastrar"}

</button>

</form>

</div>


<div className="tableCard">

<div className="tableTop">

<div>
<h2>Patrocinadores</h2>
<p>{lista.length} empresas cadastradas</p>
</div>

<input
placeholder="Buscar patrocinador..."
value={busca}
onChange={e=>setBusca(e.target.value)}
/>

</div>


<table>

<thead>

<tr>

<th>Empresa</th>
<th>Contato</th>
<th>Valor</th>
<th>Status</th>
<th>Ações</th>

</tr>

</thead>

<tbody>

{filtrados.map(p=>(

<tr key={p.id}>

<td className="empresa">

<strong>{p.nome}</strong>

<p className="sub">
{p.oferece}
</p>

</td>


<td>

<p>{p.responsavel}</p>

<p className="sub">
{p.telefone}
</p>

</td>


<td className="valor">

R$ {Number(p.valor || 0).toLocaleString()}

</td>


<td>

<span className={"badge "+p.status}>
{p.status}
</span>

</td>


<td className="acoes">

<button
className="edit"
onClick={()=>editar(p)}
>
Editar
</button>

<button
className="delete"
onClick={()=>excluir(p.id)}
>
Excluir
</button>

</td>

</tr>

))}

</tbody>

</table>

</div>

</div>

</div>

)
}