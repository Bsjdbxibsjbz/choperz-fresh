"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, ClipboardList, Package, RefreshCw, ShoppingBag, Warehouse } from "lucide-react";
import { PageHeading, Panel, MetricCard, StatusPill, EmptyState, Notice } from "./admin-ui";
import { useAdminSession } from "./admin-shell";

type Order = { id: string; orderNumber: string; status: string; paymentStatus: string; totalPaise: number; customer?: { name: string }; shipping?: { name: string; city: string }; createdAt: string };
type Inventory = { id: string; stock: { onHandGrams: number }; product: { name: string }; outlet: { name: string } };
const money = (paise: number) => new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:0}).format(paise/100);

export default function AdminDashboard() {
 const { permissions } = useAdminSession();
 const [orders,setOrders]=useState<Order[]>([]);
 const [inventory,setInventory]=useState<Inventory[]>([]);
 const [orderTotal,setOrderTotal]=useState(0);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [updatedAt,setUpdatedAt]=useState<Date|null>(null);
 const canOrders=permissions.includes("orders.read");
 const canInventory=permissions.includes("inventory.read");

 async function load(){
  const jobs: Promise<void>[]=[];
  if(canOrders) jobs.push(fetch("/api/admin/orders?page=1&pageSize=100",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Orders could not be loaded");setOrders(d.data||[]);setOrderTotal(d.pagination?.total||0);}));
  if(canInventory) jobs.push(fetch("/api/admin/inventory?page=1&limit=100",{cache:"no-store"}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error||"Inventory could not be loaded");setInventory(d.inventory||[]);}));
  try{await Promise.all(jobs);setUpdatedAt(new Date());}catch(e){setError(e instanceof Error?e.message:"Dashboard data could not be loaded");}finally{setLoading(false);}
 }
 // Initial async data loads update component state after their requests resolve.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{void Promise.resolve().then(()=>load());},[]);
 const openOrders=orders.filter(o=>!["delivered","cancelled"].includes(o.status)).length;
 const lowStock=inventory.filter(i=>i.stock.onHandGrams<=1000);
 const recent=orders.slice(0,7);
 const shortcuts=[
  {href:"/admin/orders",label:"Process orders",desc:"Review and move orders through fulfilment",icon:ClipboardList,perm:"orders.read"},
  {href:"/admin/inventory",label:"Manage stock",desc:"Receive, adjust and trace inventory",icon:Warehouse,perm:"inventory.read"},
  {href:"/admin/catalogue",label:"Product catalogue",desc:"Review products, variants and quality status",icon:Package,perm:"products.read"},
 ];
 return <div>
  <PageHeading eyebrow="COMMAND CENTRE" title="Good to see you." description="A live operational snapshot of the Choperz Fresh business." action={<button onClick={()=>{setLoading(true);setError("");void load();}} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D8E1DC] bg-white px-4 text-xs font-bold hover:bg-[#F8FAF8]"><RefreshCw size={14} className={loading?"animate-spin":""}/> Refresh data</button>}/>
  {error&&<div className="mb-5"><Notice kind="error">{error}</Notice></div>}
  <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
   {canOrders&&<MetricCard label="All customer orders" value={loading?"—":orderTotal.toLocaleString("en-IN")} note="Total count reported by the order service" icon={ShoppingBag} tone="blue"/>}
   {canOrders&&<MetricCard label="Open orders · latest 100" value={loading?"—":openOrders} note="Not yet delivered or cancelled" icon={ClipboardList} tone="orange"/>}
   {canInventory&&<MetricCard label="Inventory records loaded" value={loading?"—":inventory.length} note={`Across ${new Set(inventory.map(i=>i.outlet.name)).size} visible outlets`} icon={Warehouse}/>}
   {canInventory&&<MetricCard label="Low-stock records" value={loading?"—":lowStock.length} note="At or below 1 kg on hand · loaded records" icon={AlertTriangle} tone={lowStock.length?"red":"teal"}/>}
  </div>
  <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
   <Panel title="Recent orders" description="Latest 7 orders visible to your role" action={<Link href="/admin/orders" className="inline-flex items-center gap-1 text-[11px] font-bold text-[#168477]">All orders <ArrowRight size={13}/></Link>}>
    {!canOrders?<EmptyState title="Orders access not assigned" detail="Your role does not include order visibility."/>:loading?<p className="py-10 text-center text-xs text-[#819089]">Loading recent orders…</p>:recent.length===0?<EmptyState title="No orders yet" detail="New customer orders will appear here."/>:<div className="overflow-x-auto"><table className="w-full min-w-[570px] text-left"><thead><tr className="text-[9px] font-bold uppercase tracking-wider text-[#83918A]"><th className="pb-3">Order</th><th className="pb-3">Customer</th><th className="pb-3">Status</th><th className="pb-3 text-right">Total</th></tr></thead><tbody>{recent.map(o=><tr key={o.id} className="border-t border-[#EDF0EC] text-xs"><td className="py-3.5 font-bold text-[#102D38]">{o.orderNumber}</td><td className="py-3.5 text-[#65766F]">{o.customer?.name||o.shipping?.name||"Customer"}</td><td className="py-3.5"><StatusPill value={o.status}/></td><td className="py-3.5 text-right font-bold tabular-nums">{money(o.totalPaise)}</td></tr>)}</tbody></table></div>}
   </Panel>
   <Panel title="Operational attention" description="Signals from currently loaded inventory records">
    {loading?<p className="py-8 text-xs text-[#819089]">Checking stock levels…</p>:!canInventory?<EmptyState title="Inventory access not assigned" detail="Your role does not include stock visibility."/>:<div className="space-y-3">{lowStock.slice(0,6).map(i=><div key={i.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#FAFBF9] px-3.5 py-3"><div className="min-w-0"><p className="truncate text-xs font-bold">{i.product.name}</p><p className="mt-1 text-[10px] text-[#829089]">{i.outlet.name}</p></div><span className="shrink-0 text-xs font-extrabold text-[#B84C3A]">{i.stock.onHandGrams.toLocaleString("en-IN")} g</span></div>)}{lowStock.length===0&&<Notice kind="success">No low-stock records in the loaded inventory page.</Notice>}</div>}
   </Panel>
  </div>
  <Panel title="Quick access" description="Jump into the work your role is allowed to manage" className="mt-5">
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {shortcuts.filter(x=>permissions.includes(x.perm)).map(x=><Link key={x.href} href={x.href} className="group flex items-start gap-3 rounded-xl border border-[#E4EAE5] p-4 transition hover:border-[#9FCABD] hover:bg-[#F8FBF9]"><span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E4F2EC] text-[#168477]"><x.icon size={17}/></span><span className="min-w-0 flex-1"><span className="block text-xs font-bold">{x.label}</span><span className="mt-1 block text-[10px] leading-4 text-[#84918B]">{x.desc}</span></span><ArrowRight size={14} className="mt-1 text-[#9BA9A2] transition group-hover:translate-x-1 group-hover:text-[#168477]"/></Link>)}
   </div>
  </Panel>
  <p className="mt-4 text-right text-[10px] text-[#87938D]">{updatedAt?`Last refreshed ${updatedAt.toLocaleTimeString("en-IN",{hour:"2-digit",minute:"2-digit"})}`:""} · Dashboard figures reflect the endpoints and records loaded for your role.</p>
 </div>;
}
