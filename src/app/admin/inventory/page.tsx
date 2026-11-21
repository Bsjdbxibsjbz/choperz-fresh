"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ArrowLeftRight, RefreshCw } from "lucide-react";
import { useAdminSession } from "../admin-shell";
import { ActionButton, EmptyState, Field, inputClass, Notice, PageHeading, Panel, selectClass, StatusPill, textAreaClass } from "../admin-ui";

type StockRow={id:string;outlet:{id:string;code:string;name:string;city:string|null};product:{id:string;name:string;slug:string;isPlaceholder:boolean;isActive:boolean};stock:{onHandGrams:number;availableGrams:number;hasStockIssue:boolean};updatedAt:string};
type Product={id:string;name:string;slug:string;isActive?:boolean;isPlaceholder?:boolean};
type Outlet={id:string;code:string;name:string;city?:string|null};
type Supplier={id:string;name:string};
type Batch={id:string;batchCode:string;product:{id:string;name:string};supplier?:{id:string;name:string}|null;receivedGrams:number;visibleAllocatedGrams:number;allocations:any[];createdAt:string};
const tabs=[["stock","Stock overview"],["batches","Batch history"],["receive","Receive stock"],["adjust","Adjust stock"],["transfer","Transfer stock"]] as const;
const grams=(v:number)=>v.toLocaleString("en-IN")+" g";
async function api(url:string,init?:RequestInit){const r=await fetch(url,{...init,credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json",...(init?.headers||{})}});const d=await r.json().catch(()=>({error:"Invalid server response"}));if(!r.ok)throw new Error(d.error||"Request failed");return d;}

export default function AdminInventoryPage(){
 const {permissions,role,outletId}=useAdminSession();
 const [tab,setTab]=useState<string>("stock");
 const [stock,setStock]=useState<StockRow[]>([]);
 const [batches,setBatches]=useState<Batch[]>([]);
 const [products,setProducts]=useState<Product[]>([]);
 const [outlets,setOutlets]=useState<Outlet[]>([]);
 const [suppliers,setSuppliers]=useState<Supplier[]>([]);
 const [loading,setLoading]=useState(false);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [search,setSearch]=useState("");
 const [outletFilter,setOutletFilter]=useState(outletId||"");
 const [productId,setProductId]=useState("");
 const [batchCode,setBatchCode]=useState("");
 const [supplierId,setSupplierId]=useState("");
 const [receivedGrams,setReceivedGrams]=useState("1000");
 const [costRupees,setCostRupees]=useState("");
 const [receiveOutlet,setReceiveOutlet]=useState("");
 const [adjustOutlet,setAdjustOutlet]=useState(outletId||"");
 const [adjustProduct,setAdjustProduct]=useState("");
 const [adjustDelta,setAdjustDelta]=useState("");
 const [adjustType,setAdjustType]=useState("ADJUSTMENT");
 const [adjustNote,setAdjustNote]=useState("");
 const [transferBatch,setTransferBatch]=useState("");
 const [fromOutlet,setFromOutlet]=useState("");
 const [toOutlet,setToOutlet]=useState("");
 const [transferGrams,setTransferGrams]=useState("");
 const [transferNote,setTransferNote]=useState("");

 const canReceive=permissions.includes("batches.write")&&permissions.includes("inventory.adjust");
 const canAdjust=permissions.includes("inventory.adjust");
 const canTransfer=permissions.includes("inventory.transfer");
 const canSuppliers=permissions.includes("suppliers.write");
 const isSuper=role==="SUPER_ADMIN";

 async function load(){
  setLoading(true);setError("");
  try{
   const jobs:Promise<void>[]=[
    api("/api/admin/inventory?limit=100").then(d=>setStock(d.inventory||[])),
    api("/api/admin/inventory/batches?limit=100").then(d=>setBatches(d.batches||[])),
    fetch("/api/products?limit=50",{cache:"no-store"}).then(async r=>{const d=await r.json();if(r.ok)setProducts(d.products||[]);}),
   ];
   if(isSuper)jobs.push(api("/api/admin/outlets").then(d=>setOutlets(d.outlets||[])));
   if(canSuppliers)jobs.push(api("/api/admin/suppliers").then(d=>setSuppliers(d.suppliers||[])));
   await Promise.all(jobs);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load inventory data");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 const stockOutlets=useMemo(()=>{const map=new Map<string,Outlet>();for(const r of stock)map.set(r.outlet.id,r.outlet);for(const o of outlets)map.set(o.id,o);return Array.from(map.values());},[stock,outlets]);
 const filtered=stock.filter(r=>(!outletFilter||r.outlet.id===outletFilter)&&(!search||r.product.name.toLowerCase().includes(search.toLowerCase())||r.outlet.name.toLowerCase().includes(search.toLowerCase())));
 const totalGrams=filtered.reduce((n,r)=>n+r.stock.onHandGrams,0);
 const low=filtered.filter(r=>r.stock.onHandGrams<=1000);

 async function submitReceive(e:FormEvent){
  e.preventDefault();setSaving(true);setError("");setNotice("");
  const q=Number(receivedGrams);
  try{
   await api("/api/admin/inventory/receive",{method:"POST",body:JSON.stringify({batchCode,productId,supplierId:supplierId||null,receivedGrams:q,costPaise:costRupees===""?null:Math.round(Number(costRupees)*100),allocations:[{outletId:receiveOutlet,grams:q}],note:"Stock received through admin console"})});
   setNotice("Batch received and inventory allocated.");setBatchCode("");setReceivedGrams("1000");setCostRupees("");await load();setTab("batches");
  }catch(e){setError(e instanceof Error?e.message:"Unable to receive stock");}
  finally{setSaving(false);}
 }
 async function submitAdjust(e:FormEvent){
  e.preventDefault();setSaving(true);setError("");setNotice("");
  try{
   await api("/api/admin/inventory/adjust",{method:"POST",body:JSON.stringify({outletId:adjustOutlet,productId:adjustProduct,gramsDelta:Number(adjustDelta),type:adjustType,note:adjustNote})});
   setNotice("Inventory adjustment recorded in the stock ledger.");setAdjustDelta("");setAdjustNote("");await load();setTab("stock");
  }catch(e){setError(e instanceof Error?e.message:"Unable to adjust inventory");}
  finally{setSaving(false);}
 }
 async function submitTransfer(e:FormEvent){
  e.preventDefault();setSaving(true);setError("");setNotice("");
  try{
   await api("/api/admin/inventory/transfer",{method:"POST",body:JSON.stringify({batchId:transferBatch,fromOutletId:fromOutlet,toOutletId:toOutlet,grams:Number(transferGrams),note:transferNote||null})});
   setNotice("Batch transfer completed and both stock movements were recorded.");setTransferGrams("");setTransferNote("");await load();setTab("batches");
  }catch(e){setError(e instanceof Error?e.message:"Unable to transfer stock");}
  finally{setSaving(false);}
 }

 return <div>
  <PageHeading eyebrow="STOCK CONTROL" title="Inventory" description="Track outlet stock, trace receiving batches and record every stock movement." action={<ActionButton tone="secondary" onClick={()=>void load()}><RefreshCw size={14} className="mr-2"/>Refresh</ActionButton>}/>
  {error&&<div className="mb-4"><Notice kind="error">{error}</Notice></div>}{notice&&<div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
  <div className="mb-5 flex gap-2 overflow-x-auto pb-1">{tabs.filter(([key])=>key==="stock"||key==="batches"||(key==="receive"&&canReceive)||(key==="adjust"&&canAdjust)||(key==="transfer"&&canTransfer)).map(([key,label])=><button key={key} onClick={()=>setTab(key)} className={`shrink-0 rounded-xl px-4 py-2.5 text-xs font-bold transition ${tab===key?"bg-[#102D38] text-white":"border border-[#DCE4DE] bg-white text-[#53675F] hover:bg-[#F8FAF8]"}`}>{label}</button>)}</div>

  {tab==="stock"&&<div className="space-y-5">
   <div className="grid gap-4 sm:grid-cols-3"><div className="rounded-2xl border border-[#DDE5DF] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#809088]">Visible stock</p><p className="mt-2 text-2xl font-extrabold">{loading?"—":grams(totalGrams)}</p></div><div className="rounded-2xl border border-[#DDE5DF] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#809088]">Inventory records</p><p className="mt-2 text-2xl font-extrabold">{filtered.length}</p></div><div className="rounded-2xl border border-[#DDE5DF] bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-wider text-[#809088]">Low stock · ≤ 1 kg</p><p className="mt-2 text-2xl font-extrabold text-[#B84C3A]">{low.length}</p></div></div>
   <Panel title="Stock by outlet and product" description="Balances are shown in grams; inventory movements are tracked separately in the ledger.">
    <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_220px]"><input className={inputClass} placeholder="Search product or outlet" value={search} onChange={e=>setSearch(e.target.value)}/><select className={selectClass} value={outletFilter} onChange={e=>setOutletFilter(e.target.value)}><option value="">All visible outlets</option>{stockOutlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></div>
    {loading?<p className="py-12 text-center text-xs text-[#829089]">Loading stock balances…</p>:filtered.length===0?<EmptyState title="No inventory records found" detail="Check another outlet or refresh after receiving stock."/>:<div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left"><thead><tr className="border-b border-[#E9EEEA] text-[9px] font-bold uppercase tracking-wider text-[#829089]"><th className="pb-3">Product</th><th className="pb-3">Outlet</th><th className="pb-3">On hand</th><th className="pb-3">Catalogue status</th><th className="pb-3">Updated</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id} className="border-b border-[#F0F2EF] text-xs last:border-0"><td className="py-3.5 font-bold">{r.product.name}</td><td className="py-3.5">{r.outlet.name}<p className="mt-1 text-[10px] text-[#87938D]">{r.outlet.city||r.outlet.code}</p></td><td className="py-3.5 font-extrabold tabular-nums">{grams(r.stock.onHandGrams)}</td><td className="py-3.5"><StatusPill value={r.product.isActive?"Active":"Inactive"}/>{r.product.isPlaceholder&&<span className="ml-2 text-[9px] text-[#9A743C]">Placeholder</span>}</td><td className="py-3.5 text-[10px] text-[#87938D]">{new Date(r.updatedAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>}
   </Panel>
  </div>}

  {tab==="batches"&&<Panel title="Inventory batch register" description="Batch traceability, supplier attribution, outlet allocations and receiving history">
   {loading?<p className="py-10 text-center text-xs text-[#829089]">Loading batch register…</p>:batches.length===0?<EmptyState title="No batches recorded" detail="Received inventory batches will appear here."/>:<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-[#E9EEEA] text-[9px] font-bold uppercase tracking-wider text-[#829089]"><th className="pb-3">Batch</th><th className="pb-3">Product</th><th className="pb-3">Supplier</th><th className="pb-3">Received</th><th className="pb-3">Visible allocated</th><th className="pb-3">Date</th></tr></thead><tbody>{batches.map(b=><tr key={b.id} className="border-b border-[#F0F2EF] text-xs last:border-0"><td className="py-4 font-extrabold">{b.batchCode}</td><td className="py-4">{b.product.name}</td><td className="py-4 text-[#718079]">{b.supplier?.name||"Not recorded"}</td><td className="py-4 font-bold">{grams(b.receivedGrams)}</td><td className="py-4">{grams(b.visibleAllocatedGrams)}</td><td className="py-4 text-[10px] text-[#87938D]">{new Date(b.createdAt).toLocaleDateString("en-IN")}</td></tr>)}</tbody></table></div>}
  </Panel>}

  {tab==="receive"&&<div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
   <Panel title="Receive a new batch" description="A batch receipt increases the chosen outlet stock and creates a receipt movement.">
    <form onSubmit={submitReceive} className="space-y-4">
     <Field label="Batch code"><input required className={inputClass} value={batchCode} onChange={e=>setBatchCode(e.target.value)} placeholder="e.g. FISH-2026-001"/></Field>
     <Field label="Product"><select required className={selectClass} value={productId} onChange={e=>setProductId(e.target.value)}><option value="">Choose product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
     {canSuppliers&&<Field label="Supplier"><select className={selectClass} value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Not specified</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>}
     <div className="grid gap-4 sm:grid-cols-2"><Field label="Received quantity (grams)"><input required min="1" step="1" type="number" className={inputClass} value={receivedGrams} onChange={e=>setReceivedGrams(e.target.value)}/></Field><Field label="Total batch cost (₹)"><input min="0" step="0.01" type="number" className={inputClass} value={costRupees} onChange={e=>setCostRupees(e.target.value)} placeholder="Optional"/></Field></div>
     <Field label="Allocate all received stock to"><select required className={selectClass} value={receiveOutlet} onChange={e=>setReceiveOutlet(e.target.value)}><option value="">Choose outlet</option>{stockOutlets.map(o=><option key={o.id} value={o.id}>{o.name} · {o.code}</option>)}</select></Field>
     <Notice>For multi-outlet receiving, the backend requires the sum of allocations to equal the received quantity. This form allocates the full batch to one outlet.</Notice>
     <ActionButton type="submit" disabled={saving||!canReceive}> {saving?"Receiving…":"Record batch receipt"}</ActionButton>
    </form>
   </Panel>
   <Panel title="Before receiving" description="Validation rules applied by the server">
    <ul className="space-y-3 text-xs leading-5 text-[#62736B]"><li>• Batch codes must be unique.</li><li>• Product and supplier must be active.</li><li>• Every destination outlet must be active.</li><li>• Allocations must add up exactly to received grams.</li><li>• Batch allocation, inventory update, stock movement and audit log are committed together.</li></ul>
   </Panel>
  </div>}

  {tab==="adjust"&&<div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
   <Panel title="Record a stock adjustment" description="Positive quantities add stock; negative quantities remove stock.">
    <form onSubmit={submitAdjust} className="space-y-4">
     <Field label="Outlet"><select required className={selectClass} value={adjustOutlet} onChange={e=>setAdjustOutlet(e.target.value)}><option value="">Choose outlet</option>{stockOutlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>
     <Field label="Product"><select required className={selectClass} value={adjustProduct} onChange={e=>setAdjustProduct(e.target.value)}><option value="">Choose product</option>{products.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></Field>
     <div className="grid gap-4 sm:grid-cols-2"><Field label="Quantity change (grams)" hint="Use a minus sign to remove stock"><input required type="number" step="1" min="-1000000" max="1000000" className={inputClass} value={adjustDelta} onChange={e=>setAdjustDelta(e.target.value)}/></Field><Field label="Movement reason"><select className={selectClass} value={adjustType} onChange={e=>setAdjustType(e.target.value)}>{["ADJUSTMENT","WASTAGE","DAMAGE","EXPIRY"].map(x=><option key={x}>{x}</option>)}</select></Field></div>
     <Field label="Reason / notes"><textarea required minLength={3} maxLength={500} className={textAreaClass} value={adjustNote} onChange={e=>setAdjustNote(e.target.value)} placeholder="Explain why this balance needs to change."/></Field>
     <ActionButton type="submit" disabled={saving||!canAdjust||Number(adjustDelta)===0}>{saving?"Saving…":"Record adjustment"}</ActionButton>
    </form>
   </Panel>
   <Panel title="Adjustment controls" description="The API enforces stock safety and records a ledger entry">
    <Notice kind="info">Wastage, damage and expiry must be negative. Negative adjustments cannot exceed the current stock balance. Placeholder products are restricted to Super Admin.</Notice>
    <p className="mt-4 text-xs leading-6 text-[#65766F]">Every change is written to the stock movement ledger and audit log. This screen does not directly overwrite an inventory balance from the browser.</p>
   </Panel>
  </div>}

  {tab==="transfer"&&<div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
   <Panel title="Transfer batch stock" description="Move a traceable batch allocation from one outlet to another.">
    <form onSubmit={submitTransfer} className="space-y-4">
     <Field label="Inventory batch"><select required className={selectClass} value={transferBatch} onChange={e=>setTransferBatch(e.target.value)}><option value="">Choose batch</option>{batches.map(b=><option key={b.id} value={b.id}>{b.batchCode} · {b.product.name}</option>)}</select></Field>
     <div className="grid gap-4 sm:grid-cols-2"><Field label="Source outlet"><select required className={selectClass} value={fromOutlet} onChange={e=>setFromOutlet(e.target.value)}><option value="">From outlet</option>{stockOutlets.map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field><Field label="Destination outlet"><select required className={selectClass} value={toOutlet} onChange={e=>setToOutlet(e.target.value)}><option value="">To outlet</option>{stockOutlets.filter(o=>o.id!==fromOutlet).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field></div>
     <Field label="Transfer quantity (grams)"><input required min="1" step="1" type="number" className={inputClass} value={transferGrams} onChange={e=>setTransferGrams(e.target.value)}/></Field>
     <Field label="Transfer note"><textarea className={textAreaClass} value={transferNote} onChange={e=>setTransferNote(e.target.value)} placeholder="Optional reason or handling note."/></Field>
     <ActionButton type="submit" disabled={saving||!canTransfer||!transferBatch||!fromOutlet||!toOutlet||fromOutlet===toOutlet}><ArrowLeftRight size={14} className="mr-2"/>{saving?"Transferring…":"Confirm stock transfer"}</ActionButton>
    </form>
   </Panel>
   <Panel title="Transfer safeguards" description="Inventory is moved against its original batch">
    <ul className="space-y-3 text-xs leading-5 text-[#62736B]"><li>• Source and destination outlets must be different.</li><li>• Source batch allocation must cover the transfer quantity.</li><li>• The source outlet needs enough on-hand stock.</li><li>• Both outlet balances and batch allocations update atomically.</li><li>• Separate TRANSFER_OUT and TRANSFER_IN movements are written.</li></ul>
   </Panel>
  </div>}
 </div>;
}
