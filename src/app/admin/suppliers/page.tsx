"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, RefreshCw, Search, Boxes } from "lucide-react";
import { ActionButton, EmptyState, Field, inputClass, Notice, PageHeading, Panel } from "../admin-ui";

type Supplier={id:string;name:string;location:string|null;contact:string|null;isActive:boolean};
async function api(url:string,init?:RequestInit){const r=await fetch(url,{...init,credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json",...(init?.headers||{})}});const d=await r.json().catch(()=>({error:"Invalid response"}));if(!r.ok)throw new Error(d.error||"Request failed");return d;}

export default function AdminSuppliersPage(){
 const [suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [search,setSearch]=useState("");
 const [open,setOpen]=useState(false);
 const [editing,setEditing]=useState<Supplier|null>(null);
 const [form,setForm]=useState({name:"",location:"",contact:""});
 async function load(){setLoading(true);setError("");try{const d=await api("/api/admin/suppliers");setSuppliers(d.suppliers||[]);}catch(e){setError(e instanceof Error?e.message:"Unable to load suppliers");}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 function openCreate(){setEditing(null);setForm({name:"",location:"",contact:""});setOpen(true);}
 function openEdit(s:Supplier){setEditing(s);setForm({name:s.name,location:s.location||"",contact:s.contact||""});setOpen(true);}
 async function save(e:FormEvent){e.preventDefault();setSaving(true);setError("");setNotice("");try{if(editing){await api("/api/admin/suppliers/"+editing.id,{method:"PATCH",body:JSON.stringify({name:form.name,location:form.location||null,contact:form.contact||null})});setNotice("Supplier details updated.");}else{await api("/api/admin/suppliers",{method:"POST",body:JSON.stringify({name:form.name,location:form.location||null,contact:form.contact||null})});setNotice("Supplier registered.");}setForm({name:"",location:"",contact:""});setOpen(false);setEditing(null);await load();}catch(e){setError(e instanceof Error?e.message:"Unable to save supplier");}finally{setSaving(false);}}
 const filtered=suppliers.filter(s=>(s.name+" "+(s.location||"")+" "+(s.contact||"")).toLowerCase().includes(search.toLowerCase()));
 return <div>
  <PageHeading eyebrow="PROCUREMENT" title="Suppliers" description="Maintain the supplier directory used for batch-level sourcing and traceability." action={<div className="flex gap-2"><ActionButton tone="secondary" onClick={()=>void load()}><RefreshCw size={14} className="mr-2"/>Refresh</ActionButton><ActionButton onClick={openCreate}><Plus size={14} className="mr-2"/>Add supplier</ActionButton></div>}/>
  {error&&<div className="mb-4"><Notice kind="error">{error}</Notice></div>}{notice&&<div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
  <div className="mb-5 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-[#DDE5DF] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Registered suppliers</p><p className="mt-2 text-2xl font-extrabold">{suppliers.length}</p></div><div className="rounded-2xl border border-[#DDE5DF] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Active suppliers</p><p className="mt-2 text-2xl font-extrabold text-[#168477]">{suppliers.filter(s=>s.isActive).length}</p></div><div className="rounded-2xl border border-[#DDE5DF] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Sourcing records</p><p className="mt-2 text-sm font-bold">Batch linked</p></div></div>
  <Panel title="Supplier directory" description="Supplier information recorded against incoming stock batches">
   <div className="relative mb-4 max-w-sm"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938D]"/><input className={inputClass+" pl-9"} placeholder="Search suppliers" value={search} onChange={e=>setSearch(e.target.value)}/></div>
   {loading?<p className="py-12 text-center text-xs text-[#829089]">Loading supplier directory…</p>:filtered.length===0?<EmptyState title="No suppliers found" detail="Register a supplier to associate sourcing information with inventory batches."/>:<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map(s=><div key={s.id} className="rounded-xl border border-[#E1E8E2] p-4"><div className="flex items-start justify-between gap-2"><span className="flex size-9 items-center justify-center rounded-lg bg-[#E4F2EC] text-[#168477]"><Boxes size={17}/></span><span className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${s.isActive?"bg-[#E5F3EC] text-[#23765C]":"bg-[#FBECE8] text-[#B84C3A]"}`}>{s.isActive?"Active":"Inactive"}</span></div><p className="mt-4 text-sm font-extrabold">{s.name}</p><p className="mt-1 text-xs text-[#829089]">{s.location||"Location not recorded"}</p><p className="mt-3 border-t border-[#EDF0EC] pt-3 text-xs text-[#5F7269]">{s.contact||"No contact details"}</p><div className="mt-3 flex justify-end"><button onClick={()=>openEdit(s)} className="rounded-lg border border-[#DCE5DF] px-3 py-2 text-[10px] font-bold hover:bg-[#F5F8F5]">Edit details</button></div></div>)}</div>}
  </Panel>
  {open&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#07171D]/55 p-4"><form onSubmit={save} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl"><h2 className="text-lg font-extrabold">{editing?"Edit supplier":"Register supplier"}</h2><p className="mt-1 text-xs text-[#829089]">Supplier details are included in new batch receiving records.</p><div className="mt-5 space-y-4"><Field label="Supplier name"><input required minLength={2} className={inputClass} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></Field><Field label="Location"><input className={inputClass} value={form.location} onChange={e=>setForm(p=>({...p,location:e.target.value}))}/></Field><Field label="Contact"><input className={inputClass} value={form.contact} onChange={e=>setForm(p=>({...p,contact:e.target.value}))}/></Field><div className="flex justify-end gap-2"><ActionButton tone="secondary" onClick={()=>{setOpen(false);setEditing(null);}}>Cancel</ActionButton><ActionButton type="submit" disabled={saving}>{saving?"Saving…":editing?"Save changes":"Register supplier"}</ActionButton></div></div></form></div>}
 </div>;
}
