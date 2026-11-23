"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Edit3, Plus, RefreshCw, Search, X } from "lucide-react";
import { useAdminSession } from "../admin-shell";
import { ActionButton, EmptyState, Field, inputClass, Notice, PageHeading, Panel, selectClass, StatusPill, textAreaClass } from "../admin-ui";

type Variant={id:string;sku:string;label:string;weightGrams:number;pricePaise:number;isActive:boolean};
type ProductImage={id:string;url:string;kind:string;alt:string|null;sortOrder:number;isPlaceholder:boolean};
type Product={id:string;slug:string;name:string;localName:string|null;englishName:string|null;scientificName:string|null;description:string|null;sourceInfo:string|null;storageInstructions:string|null;isPlaceholder:boolean;isSourceVerified:boolean;isActive:boolean;deletedAt:string|null;category:{id:string;slug:string;name:string};variants:Variant[];images:ProductImage[];cutOptions:{cutOption:{id:string;name:string;extraPricePaise:number}}[]};
type Category={id:string;slug:string;name:string;children?:Category[]};
type CategoryOption={id:string;slug:string;name:string;displayName:string};
type ProductFormVariant=Variant & {priceRupees:string};
type ProductForm={name:string;localName:string;englishName:string;scientificName:string;description:string;sourceInfo:string;storageInstructions:string;categoryId:string;isActive:boolean;isPlaceholder:boolean;isSourceVerified:boolean;variants:ProductFormVariant[]};
const emptyProductForm:ProductForm={name:"",localName:"",englishName:"",scientificName:"",description:"",sourceInfo:"",storageInstructions:"",categoryId:"",isActive:true,isPlaceholder:false,isSourceVerified:false,variants:[]};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n/100);
async function api(url:string,init?:RequestInit){const r=await fetch(url,{...init,credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json",...(init?.headers||{})}});const d=await r.json().catch(()=>({error:"Invalid response"}));if(!r.ok)throw new Error(d.error||"Request failed");return d;}
const slugify=(v:string)=>v.toLowerCase().trim().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");

export default function AdminCataloguePage(){
 const {permissions}=useAdminSession();
 const canEdit=permissions.includes("products.write");
 const canPrice=permissions.includes("prices.write");
 const [products,setProducts]=useState<Product[]>([]);
 const [categories,setCategories]=useState<Category[]>([]);
 const [search,setSearch]=useState("");
 const [category,setCategory]=useState("");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [editor,setEditor]=useState<Product|null>(null);
 const [creating,setCreating]=useState(false);
 const [saving,setSaving]=useState(false);
 const [form,setForm]=useState<ProductForm>(emptyProductForm);
 const [newProduct,setNewProduct]=useState({name:"",slug:"",categoryId:"",weightGrams:"500",priceRupees:"",description:"",isPlaceholder:false});

 const categoryOptions=useMemo<CategoryOption[]>(()=>categories.flatMap(c=>[{id:c.id,slug:c.slug,name:c.name,displayName:c.name},...(c.children||[]).map(x=>({id:x.id,slug:x.slug,name:x.name,displayName:c.name+" / "+x.name}))]),[categories]);
 async function load(){
  try{
   const p=new URLSearchParams({limit:"100"});
   if(search.trim())p.set("q",search.trim());
   if(category)p.set("category",category);
   const [catalogue,cats]=await Promise.all([api("/api/admin/catalogue?"+p),api("/api/categories")]);
   setProducts(catalogue.products||[]);
   setCategories(cats.categories||[]);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load product catalogue");}
  finally{setLoading(false);}
 }
 // Loader state updates happen after the async catalogue requests resolve.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{void Promise.resolve().then(()=>load());},[category]);
 function openEdit(p:Product){setEditor(p);setForm({name:p.name,localName:p.localName||"",englishName:p.englishName||"",scientificName:p.scientificName||"",description:p.description||"",sourceInfo:p.sourceInfo||"",storageInstructions:p.storageInstructions||"",categoryId:p.category.id,isActive:p.isActive,isPlaceholder:p.isPlaceholder,isSourceVerified:p.isSourceVerified,variants:p.variants.map(v=>({...v,priceRupees:(v.pricePaise/100).toFixed(2)}))});}
 async function saveProduct(e:FormEvent){
  e.preventDefault();if(!editor)return;setSaving(true);setError("");setNotice("");
  try{
   const body:Record<string,unknown>={name:form.name,localName:form.localName||null,englishName:form.englishName||null,scientificName:form.scientificName||null,description:form.description||null,sourceInfo:form.sourceInfo||null,storageInstructions:form.storageInstructions||null,isActive:form.isActive,isPlaceholder:form.isPlaceholder,isSourceVerified:form.isSourceVerified,categoryId:form.categoryId};
   if(canPrice)body.variants=form.variants.map((v)=>({id:v.id,label:v.label,pricePaise:Math.round(Number(v.priceRupees)*100),isActive:v.isActive}));
   await api("/api/admin/catalogue/"+editor.id,{method:"PATCH",body:JSON.stringify(body)});
   setNotice("Product details saved.");setEditor(null);await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to save product");}
  finally{setSaving(false);}
 }
 async function createProduct(e:FormEvent){
  e.preventDefault();setSaving(true);setError("");setNotice("");
  const weight=Number(newProduct.weightGrams),price=Number(newProduct.priceRupees);
  try{
   await api("/api/admin/catalogue",{method:"POST",body:JSON.stringify({name:newProduct.name,slug:newProduct.slug||slugify(newProduct.name),categoryId:newProduct.categoryId,description:newProduct.description||null,isPlaceholder:newProduct.isPlaceholder,isSourceVerified:false,variants:[{label:weight>=1000?(weight/1000)+" kg":weight+" g",weightGrams:weight,pricePaise:Math.round(price*100)}]})});
   setNotice("Product and its first weight variant created.");setCreating(false);setNewProduct({name:"",slug:"",categoryId:"",weightGrams:"500",priceRupees:"",description:"",isPlaceholder:false});await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to create product");}
  finally{setSaving(false);}
 }
 const stats={total:products.length,active:products.filter(p=>p.isActive&&!p.isPlaceholder).length,placeholder:products.filter(p=>p.isPlaceholder).length,unverified:products.filter(p=>!p.isSourceVerified).length};

 return <div>
  <PageHeading eyebrow="MERCHANDISING" title="Product catalogue" description="Maintain product information, publication status and weight-based pricing. Changes are audited by the backend." action={<div className="flex gap-2"><ActionButton tone="secondary" onClick={()=>{setLoading(true);setError("");void load();}}><RefreshCw size={14} className="mr-2"/>Refresh</ActionButton>{canEdit&&canPrice&&<ActionButton onClick={()=>setCreating(true)}><Plus size={14} className="mr-2"/>Add product</ActionButton>}</div>}/>
  {error&&<div className="mb-4"><Notice kind="error">{error}</Notice></div>}{notice&&<div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
  <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><div className="rounded-2xl border border-[#DDE5DF] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Loaded catalogue</p><p className="mt-2 text-2xl font-extrabold">{stats.total}</p></div><div className="rounded-2xl border border-[#DDE5DF] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Active published</p><p className="mt-2 text-2xl font-extrabold text-[#168477]">{stats.active}</p></div><div className="rounded-2xl border border-[#DDE5DF] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Placeholders</p><p className="mt-2 text-2xl font-extrabold">{stats.placeholder}</p></div><div className="rounded-2xl border border-[#DDE5DF] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Source not verified</p><p className="mt-2 text-2xl font-extrabold text-[#B87A3C]">{stats.unverified}</p></div></div>
  <Panel title="Catalogue records" description="Search products by name and filter by category">
   <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_240px_auto]"><div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938D]"/><input className={inputClass+" pl-9"} value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&void load()} placeholder="Search name, local name or scientific name"/></div><select className={selectClass} value={category} onChange={e=>{setCategory(e.target.value);setLoading(true);}}><option value="">All categories</option>{categoryOptions.map(c=><option key={c.id} value={c.slug}>{c.displayName}</option>)}</select><ActionButton tone="secondary" onClick={()=>{setLoading(true);setError("");void load();}}>Search</ActionButton></div>
   {loading?<p className="py-12 text-center text-xs text-[#829089]">Loading catalogue…</p>:products.length===0?<EmptyState title="No products found" detail="Try a different search or category."/>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-[#E9EEEA] text-[9px] font-bold uppercase tracking-wider text-[#829089]"><th className="pb-3">Product</th><th className="pb-3">Category</th><th className="pb-3">Variants</th><th className="pb-3">Source</th><th className="pb-3">Visibility</th><th className="pb-3 text-right">Manage</th></tr></thead><tbody>{products.map(p=><tr key={p.id} className="border-b border-[#F0F2EF] text-xs last:border-0"><td className="py-4"><p className="font-extrabold">{p.name}</p><p className="mt-1 text-[10px] text-[#87938D]">{p.slug}{p.localName?" · "+p.localName:""}</p></td><td className="py-4">{p.category.name}</td><td className="py-4">{p.variants.length} options<p className="mt-1 text-[10px] text-[#87938D]">{p.variants.slice(0,2).map(v=>v.label+" · "+money(v.pricePaise)).join(" / ")}</p></td><td className="py-4">{p.isSourceVerified?<StatusPill value="Verified"/>:<StatusPill value="Unverified"/>}</td><td className="py-4"><StatusPill value={p.isPlaceholder?"Placeholder":p.isActive?"Active":"Inactive"}/></td><td className="py-4 text-right">{canEdit?<button onClick={()=>openEdit(p)} className="inline-flex items-center gap-1 rounded-lg border border-[#DCE5DF] px-3 py-2 text-[10px] font-bold hover:bg-[#F5F8F5]"><Edit3 size={12}/> Edit</button>:<span className="text-[10px] text-[#87938D]">Read only</span>}</td></tr>)}</tbody></table></div>}
  </Panel>

  {(editor||creating)&&<div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#07171D]/55 p-3 py-8 sm:p-8"><div className="my-auto w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
   <div className="flex items-center justify-between border-b border-[#E7ECE8] px-6 py-5"><div><p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-[#168477]">Catalogue editor</p><h2 className="mt-1 text-lg font-extrabold">{creating?"Create product":editor?.name}</h2></div><button onClick={()=>{setEditor(null);setCreating(false);}} className="rounded-lg p-2 hover:bg-[#F3F6F3]"><X size={18}/></button></div>
   {creating?<form onSubmit={createProduct} className="grid gap-4 p-6 sm:grid-cols-2">
    <Field label="Product name"><input required className={inputClass} value={newProduct.name} onChange={e=>setNewProduct(p=>({...p,name:e.target.value,slug:p.slug||slugify(e.target.value)}))}/></Field>
    <Field label="URL slug"><input required className={inputClass} value={newProduct.slug} onChange={e=>setNewProduct(p=>({...p,slug:e.target.value}))}/></Field>
    <Field label="Category"><select required className={selectClass} value={newProduct.categoryId} onChange={e=>setNewProduct(p=>({...p,categoryId:e.target.value}))}><option value="">Choose category</option>{categoryOptions.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></Field>
    <Field label="First weight (grams)"><input required type="number" min="1" step="1" className={inputClass} value={newProduct.weightGrams} onChange={e=>setNewProduct(p=>({...p,weightGrams:e.target.value}))}/></Field>
    <Field label="Price (₹)"><input required type="number" min="0" step="0.01" className={inputClass} value={newProduct.priceRupees} onChange={e=>setNewProduct(p=>({...p,priceRupees:e.target.value}))}/></Field>
    <Field label="Initial status"><select className={selectClass} value={String(newProduct.isPlaceholder)} onChange={e=>setNewProduct(p=>({...p,isPlaceholder:e.target.value==="true"}))}><option value="false">Published product</option><option value="true">Placeholder (hidden from storefront)</option></select></Field>
    <div className="sm:col-span-2"><Field label="Description"><textarea className={textAreaClass} value={newProduct.description} onChange={e=>setNewProduct(p=>({...p,description:e.target.value}))}/></Field></div>
    <div className="sm:col-span-2 flex justify-end gap-2 border-t border-[#EDF0EC] pt-4"><ActionButton tone="secondary" onClick={()=>setCreating(false)}>Cancel</ActionButton><ActionButton type="submit" disabled={saving||!canEdit||!canPrice||!permissions.includes("categories.write")}>{saving?"Creating…":"Create product"}</ActionButton></div>
   </form>:<form onSubmit={saveProduct} className="space-y-5 p-6">
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Product name"><input required className={inputClass} value={form.name||""} onChange={e=>setForm((p)=>({...p,name:e.target.value}))}/></Field><Field label="Category"><select className={selectClass} value={form.categoryId||""} onChange={e=>setForm((p)=>({...p,categoryId:e.target.value}))}>{categoryOptions.map(c=><option key={c.id} value={c.id}>{c.displayName}</option>)}</select></Field><Field label="Local name"><input className={inputClass} value={form.localName||""} onChange={e=>setForm((p)=>({...p,localName:e.target.value}))}/></Field><Field label="English name"><input className={inputClass} value={form.englishName||""} onChange={e=>setForm((p)=>({...p,englishName:e.target.value}))}/></Field><Field label="Scientific name"><input className={inputClass} value={form.scientificName||""} onChange={e=>setForm((p)=>({...p,scientificName:e.target.value}))}/></Field><Field label="Publication"><select className={selectClass} value={String(form.isActive)} onChange={e=>setForm((p)=>({...p,isActive:e.target.value==="true"}))}><option value="true">Active</option><option value="false">Inactive</option></select></Field></div>
    <Field label="Description"><textarea className={textAreaClass} value={form.description||""} onChange={e=>setForm((p)=>({...p,description:e.target.value}))}/></Field>
    <div className="grid gap-4 sm:grid-cols-2"><Field label="Sourcing information"><textarea className={textAreaClass} value={form.sourceInfo||""} onChange={e=>setForm((p)=>({...p,sourceInfo:e.target.value}))}/></Field><Field label="Storage instructions"><textarea className={textAreaClass} value={form.storageInstructions||""} onChange={e=>setForm((p)=>({...p,storageInstructions:e.target.value}))}/></Field></div>
    <div className="grid gap-3 sm:grid-cols-3"><Field label="Catalogue type"><select className={selectClass} value={String(form.isPlaceholder)} onChange={e=>setForm((p)=>({...p,isPlaceholder:e.target.value==="true"}))}><option value="false">Published product</option><option value="true">Placeholder</option></select></Field><Field label="Source verification"><select className={selectClass} value={String(form.isSourceVerified)} onChange={e=>setForm((p)=>({...p,isSourceVerified:e.target.value==="true"}))}><option value="false">Not verified</option><option value="true">Verified</option></select></Field><div className="self-end text-[10px] leading-5 text-[#829089]">Only mark sourcing as verified when supporting information has been checked.</div></div>
    <div className="rounded-xl border border-[#E0E8E2] p-4"><div className="mb-3 flex items-center justify-between"><p className="text-xs font-extrabold">Weight variants & prices</p><span className="text-[10px] text-[#87938D]">{form.variants.length} variants</span></div><div className="space-y-3">{(form.variants||[]).map((v,i)=><div key={v.id} className="grid gap-2 rounded-lg bg-[#F8FAF8] p-3 sm:grid-cols-[1fr_130px_110px]"><div><p className="text-xs font-bold">{v.label}</p><p className="mt-1 text-[10px] text-[#87938D]">{v.weightGrams} g · {v.sku}</p></div><Field label="Price (₹)"><input disabled={!canPrice} type="number" min="0" step="0.01" className={inputClass} value={v.priceRupees} onChange={e=>setForm((p)=>({...p,variants:p.variants.map((x,j)=>j===i?{...x,priceRupees:e.target.value}:x)}))}/></Field><Field label="Variant status"><select disabled={!canPrice} className={selectClass} value={String(v.isActive)} onChange={e=>setForm((p)=>({...p,variants:p.variants.map((x,j)=>j===i?{...x,isActive:e.target.value==="true"}:x)}))}><option value="true">Active</option><option value="false">Inactive</option></select></Field></div>)}</div></div>
    <div className="flex justify-end gap-2 border-t border-[#EDF0EC] pt-4"><ActionButton tone="secondary" onClick={()=>setEditor(null)}>Cancel</ActionButton><ActionButton type="submit" disabled={saving}>{saving?"Saving…":"Save product"}</ActionButton></div>
   </form>}
  </div></div>}
 </div>;
}
