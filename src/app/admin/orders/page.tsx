"use client";

import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, RefreshCw, X, UserRound, MapPin, Truck, CreditCard } from "lucide-react";
import { useAdminSession } from "../admin-shell";
import { ActionButton, EmptyState, Field, inputClass, Notice, PageHeading, Panel, selectClass, StatusPill } from "../admin-ui";

type OrderRow={id:string;orderNumber:string;status:string;paymentStatus:string;paymentMethod:string;subtotalPaise:number;deliveryFeePaise:number;discountPaise:number;totalPaise:number;customer:{id:string;name:string;phoneNumber:string|null};shipping:{name:string;phone:string;city:string;pincode:string};outlet:{id:string;code:string;name:string}|null;driver:{id:string;name:string|null;phoneNumber:string|null;availability:string}|null;itemCount:number;createdAt:string};
type Driver={id:string;name:string;phoneNumber:string;availability:string};
type OrderItem={id:string;productName:string;variantLabel:string;quantity:number;cutName:string|null;lineTotalPaise:number};
type OrderHistoryEntry={id:string;toStatus:string;createdAt:string;note:string|null};
type OrderDriverAssignment={id:string;status:string;driverProfile:{id:string;availability:string;staffProfile:{isActive:boolean;user:{id:string;name:string;phoneNumber:string|null;phoneNumberVerified:boolean}}}};
type OrderDetail={id:string;orderNumber:string;status:string;paymentStatus:string;paymentMethod:string;pricing:{subtotalPaise:number;deliveryFeePaise:number;discountPaise:number;totalPaise:number};customer:{id:string;name:string;phoneNumber:string|null};shipping:{name:string;phone:string;line1:string;line2:string|null;landmark:string|null;city:string;pincode:string;latitude:number|null;longitude:number|null};notes:string|null;outlet:{id:string;code:string;name:string;city:string|null}|null;items:OrderItem[];history:OrderHistoryEntry[];deliveryAssignments:OrderDriverAssignment[];createdAt:string;updatedAt:string};
type AssignmentState={orderId:string;drivers:Driver[];selected:string;note:string};
const statuses=["pending","confirmed","processing","packed","picked_up","out_for_delivery","delivered","cancelled"];
const nextStatus:Record<string,string>={pending:"confirmed",confirmed:"processing",processing:"packed",packed:"picked_up",picked_up:"out_for_delivery",out_for_delivery:"delivered"};
const money=(n:number)=>new Intl.NumberFormat("en-IN",{style:"currency",currency:"INR",maximumFractionDigits:2}).format(n/100);
const date=(s:string)=>new Date(s).toLocaleString("en-IN",{dateStyle:"medium",timeStyle:"short"});
async function requestJson(url:string,init?:RequestInit){const r=await fetch(url,{...init,credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json",...(init?.headers||{})}});const d=await r.json().catch(()=>({error:"The server returned an invalid response"}));if(!r.ok)throw new Error(d.error||"Request failed");return d;}

export default function AdminOrdersPage(){
 const {role,permissions}=useAdminSession();
 const isSuper=role==="SUPER_ADMIN";
 const [rows,setRows]=useState<OrderRow[]>([]);
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 const [search,setSearch]=useState("");
 const [status,setStatus]=useState("");
 const [payment,setPayment]=useState("");
 const [selected,setSelected]=useState<OrderDetail|null>(null);
 const [busy,setBusy]=useState("");
 const [notice,setNotice]=useState("");
 const [assignment,setAssignment]=useState<AssignmentState|null>(null);
 const [page,setPage]=useState(1);
 const [total,setTotal]=useState(0);
 const pageSize=20;

 async function load(){
  try{
   const p=new URLSearchParams({page:String(page),pageSize:String(pageSize)});
   if(search.trim())p.set("search",search.trim());
   if(status)p.set("status",status);
   if(payment)p.set("paymentStatus",payment);
   const d=await requestJson("/api/admin/orders?"+p.toString());
   setRows(d.data||[]);setTotal(d.pagination?.total||0);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load orders");}
  finally{setLoading(false);}
 }
 // The order request completes before load() updates the table state.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 useEffect(()=>{void Promise.resolve().then(()=>load());},[page,status,payment]);
 async function openOrder(id:string){
  setBusy("detail");setError("");setNotice("");
  try{const d=await requestJson("/api/admin/orders/"+encodeURIComponent(id));setSelected(d.order);}
  catch(e){setError(e instanceof Error?e.message:"Unable to load order detail");}
  finally{setBusy("");}
 }
 async function updateStatus(orderId:string,next:string){
  const ok=window.confirm("Move this order to "+next.replaceAll("_"," ")+"?");
  if(!ok)return;
  setBusy(orderId);setError("");setNotice("");
  try{await requestJson("/api/admin/orders/"+orderId+"/status",{method:"PATCH",body:JSON.stringify({status:next})});setNotice("Order status updated.");await load();if(selected?.id===orderId)await openOrder(orderId);}
  catch(e){setError(e instanceof Error?e.message:"Unable to update order");}
  finally{setBusy("");}
 }
 async function openAssignment(orderId:string){
  setBusy("assignment");
  try{const d=await requestJson("/api/admin/orders/"+orderId+"/assignment");setAssignment({orderId,drivers:d.availableDrivers||[],selected:"",note:""});}
  catch(e){setError(e instanceof Error?e.message:"Unable to load drivers");}
  finally{setBusy("");}
 }
 async function assignDriver(){
  if(!assignment?.selected)return;
  setBusy("assign-save");setError("");
  try{await requestJson("/api/admin/orders/"+assignment.orderId+"/assignment",{method:"POST",body:JSON.stringify({driverProfileId:assignment.selected,note:assignment.note||undefined})});setAssignment(null);setNotice("Driver assignment saved.");await load();if(selected?.id===assignment.orderId)await openOrder(assignment.orderId);}
  catch(e){setError(e instanceof Error?e.message:"Driver assignment failed");}
  finally{setBusy("");}
 }
 async function collectCash(orderId:string){
  if(!window.confirm("Confirm that COD cash was physically collected for this delivered order?"))return;
  setBusy("payment");setError("");
  try{await requestJson("/api/admin/orders/"+orderId+"/payment",{method:"POST",body:JSON.stringify({action:"confirm_cod_cash_collected",note:"Cash collection confirmed in admin console."})});setNotice("COD cash collection recorded.");await load();if(selected?.id===orderId)await openOrder(orderId);}
  catch(e){setError(e instanceof Error?e.message:"Unable to record payment");}
  finally{setBusy("");}
 }
 async function cancelOrder(orderId:string){
  const reason=window.prompt("Reason for cancellation (optional):");
  if(reason===null)return;
  if(!window.confirm("Cancel this order and restore its inventory?"))return;
  setBusy("cancel");setError("");
  try{await requestJson("/api/admin/orders/"+orderId,{method:"PATCH",body:JSON.stringify({reason})});setNotice("Order cancelled and stock restored.");await load();setSelected(null);}
  catch(e){setError(e instanceof Error?e.message:"Unable to cancel order");}
  finally{setBusy("");}
 }

 return <div>
  <PageHeading eyebrow="FULFILMENT" title="Orders" description="Review customer orders, follow fulfilment status, assign drivers and reconcile cash collection." action={<ActionButton tone="secondary" onClick={()=>{setLoading(true);setError("");void load();}}><RefreshCw size={14} className="mr-2"/>Refresh</ActionButton>}/>
  {error&&<div className="mb-4"><Notice kind="error">{error}</Notice></div>}{notice&&<div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
  <Panel title="Order queue" description={total.toLocaleString("en-IN")+" order records"} action={<span className="text-[10px] text-[#87938D]">Page {page} · {pageSize} per page</span>}>
   <div className="mb-5 grid gap-3 md:grid-cols-[1fr_190px_190px_auto]">
    <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#87938D]"/><input className={inputClass+" pl-9"} placeholder="Search order, customer or phone" value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==="Enter"&&(setPage(1),void load())}/></div>
    <select className={selectClass} value={status} onChange={e=>{setLoading(true);setPage(1);setStatus(e.target.value);}}><option value="">All order statuses</option>{statuses.map(s=><option key={s} value={s}>{s.replaceAll("_"," ")}</option>)}</select>
    <select className={selectClass} value={payment} onChange={e=>{setLoading(true);setPage(1);setPayment(e.target.value);}}><option value="">All payment states</option>{["UNPAID","PENDING","PAID","FAILED","REFUNDED","PARTIALLY_REFUNDED"].map(s=><option key={s}>{s}</option>)}</select>
    <ActionButton onClick={()=>{setLoading(true);setPage(1);void load();}}><SlidersHorizontal size={14} className="mr-2"/>Apply</ActionButton>
   </div>
   {loading?<p className="py-14 text-center text-xs text-[#829089]">Loading order queue…</p>:rows.length===0?<EmptyState title="No matching orders" detail="Try another search or remove one of the filters."/>:
    <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-[#E9EEEA] text-[9px] font-extrabold uppercase tracking-wider text-[#829089]"><th className="pb-3">Order / Date</th><th className="pb-3">Customer</th><th className="pb-3">Outlet / Driver</th><th className="pb-3">Fulfilment</th><th className="pb-3">Payment</th><th className="pb-3 text-right">Total</th><th className="pb-3"></th></tr></thead><tbody>{rows.map(o=><tr key={o.id} className="border-b border-[#F0F2EF] text-xs last:border-0"><td className="py-4"><p className="font-extrabold">{o.orderNumber}</p><p className="mt-1 text-[10px] text-[#87938D]">{date(o.createdAt)}</p></td><td className="py-4"><p className="font-bold">{o.customer?.name||o.shipping.name}</p><p className="mt-1 text-[10px] text-[#87938D]">{o.customer?.phoneNumber||o.shipping.phone}</p></td><td className="py-4"><p>{o.outlet?.name||"Unassigned"}</p><p className="mt-1 text-[10px] text-[#87938D]">{o.driver?.name||"No driver assigned"}</p></td><td className="py-4"><StatusPill value={o.status}/></td><td className="py-4"><StatusPill value={o.paymentStatus}/><p className="mt-1 text-[9px] text-[#87938D]">{o.paymentMethod}</p></td><td className="py-4 text-right font-extrabold tabular-nums">{money(o.totalPaise)}</td><td className="py-4 text-right"><button onClick={()=>void openOrder(o.id)} className="rounded-lg border border-[#DCE5DF] px-3 py-2 text-[10px] font-bold hover:bg-[#F5F8F5]">Details</button></td></tr>)}</tbody></table></div>}
   <div className="mt-5 flex items-center justify-between border-t border-[#EDF0EC] pt-4"><p className="text-[10px] text-[#829089]">Showing {rows.length?((page-1)*pageSize+1):0}–{Math.min(page*pageSize,total)} of {total}</p><div className="flex gap-2"><ActionButton tone="secondary" disabled={page<=1||loading} onClick={()=>{setLoading(true);setPage(p=>Math.max(1,p-1));}}>Previous</ActionButton><ActionButton tone="secondary" disabled={page*pageSize>=total||loading} onClick={()=>{setLoading(true);setPage(p=>p+1);}}>Next</ActionButton></div></div>
  </Panel>

  {selected&&<div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-[#07171D]/55 p-3 py-8 sm:p-8"><div className="my-auto w-full max-w-4xl overflow-hidden rounded-2xl bg-[#F8FAF7] shadow-2xl">
   <div className="flex items-start justify-between gap-4 border-b border-[#E0E7E1] bg-white px-5 py-5 sm:px-7"><div><p className="text-[9px] font-extrabold uppercase tracking-[.2em] text-[#168477]">Order details</p><h2 className="mt-1 text-xl font-extrabold">{selected.orderNumber}</h2><p className="mt-1 text-[10px] text-[#85918B]">Placed {date(selected.createdAt)}</p></div><button onClick={()=>setSelected(null)} className="rounded-lg p-2 hover:bg-[#F1F5F1]" aria-label="Close details"><X size={19}/></button></div>
   <div className="grid gap-5 p-5 sm:p-7 lg:grid-cols-[1.2fr_.8fr]">
    <div className="space-y-5">
     <div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-[#E0E7E1] bg-white p-4"><div className="flex items-center gap-2 text-[#168477]"><UserRound size={15}/><span className="text-[10px] font-bold uppercase tracking-wider">Customer</span></div><p className="mt-3 text-sm font-bold">{selected.customer?.name}</p><p className="mt-1 text-xs text-[#7B8983]">{selected.customer?.phoneNumber||"No phone"}</p></div><div className="rounded-xl border border-[#E0E7E1] bg-white p-4"><div className="flex items-center gap-2 text-[#168477]"><MapPin size={15}/><span className="text-[10px] font-bold uppercase tracking-wider">Delivery address</span></div><p className="mt-3 text-xs leading-5">{selected.shipping?.name} · {selected.shipping?.phone}</p><p className="mt-1 text-xs leading-5 text-[#7B8983]">{[selected.shipping?.line1,selected.shipping?.line2,selected.shipping?.landmark,selected.shipping?.city,selected.shipping?.pincode].filter(Boolean).join(", ")}</p></div></div>
     <Panel title="Items" description={(selected.items||[]).length+" line items"}><div className="space-y-3">{(selected.items||[]).map((i)=><div key={i.id} className="flex items-start justify-between gap-3 border-b border-[#EDF0EC] pb-3 last:border-0 last:pb-0"><div><p className="text-xs font-bold">{i.productName}</p><p className="mt-1 text-[10px] text-[#7B8983]">{i.variantLabel} · Qty {i.quantity}{i.cutName?" · "+i.cutName:""}</p></div><p className="text-xs font-bold">{money(i.lineTotalPaise)}</p></div>)}</div></Panel>
     <Panel title="Order timeline"><div className="space-y-3">{(selected.history||[]).map((h)=><div key={h.id} className="flex gap-3"><span className="mt-1 size-2 rounded-full bg-[#168477]"/><div><p className="text-xs font-bold capitalize">{String(h.toStatus).replaceAll("_"," ")}</p><p className="mt-1 text-[10px] text-[#85918B]">{date(h.createdAt)}{h.note?" · "+h.note:""}</p></div></div>)}</div></Panel>
    </div>
    <div className="space-y-4">
     <div className="rounded-xl border border-[#E0E7E1] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Fulfilment state</p><div className="mt-2"><StatusPill value={selected.status}/></div><p className="mt-4 text-[10px] font-bold uppercase tracking-wider text-[#829089]">Payment</p><div className="mt-2 flex flex-wrap gap-2"><StatusPill value={selected.paymentStatus}/><StatusPill value={selected.paymentMethod}/></div><div className="mt-4 border-t border-[#EDF0EC] pt-3 text-xs"><div className="flex justify-between py-1"><span className="text-[#7B8983]">Subtotal</span><b>{money(selected.pricing.subtotalPaise)}</b></div><div className="flex justify-between py-1"><span className="text-[#7B8983]">Delivery</span><b>{money(selected.pricing.deliveryFeePaise)}</b></div><div className="flex justify-between py-1"><span className="text-[#7B8983]">Discount</span><b>{money(selected.pricing.discountPaise)}</b></div><div className="mt-2 flex justify-between border-t border-[#EDF0EC] pt-3 text-sm"><b>Total</b><b>{money(selected.pricing.totalPaise)}</b></div></div></div>
     {selected.outlet&&<div className="rounded-xl border border-[#E0E7E1] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Assigned outlet</p><p className="mt-2 text-sm font-bold">{selected.outlet.name}</p><p className="mt-1 text-[10px] text-[#829089]">{selected.outlet.code} · {selected.outlet.city}</p></div>}
     {(selected.deliveryAssignments||[]).some((a)=>a.status==="ACTIVE")&&<div className="rounded-xl border border-[#E0E7E1] bg-white p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-[#829089]">Current driver</p><p className="mt-2 text-sm font-bold">{(selected.deliveryAssignments||[]).find((a)=>a.status==="ACTIVE")?.driverProfile?.staffProfile?.user?.name||"Assigned driver"}</p><p className="mt-1 text-[10px] text-[#82938D]">{(selected.deliveryAssignments||[]).find((a)=>a.status==="ACTIVE")?.driverProfile?.staffProfile?.user?.phoneNumber||""}</p></div>}
     {nextStatus[selected.status]&&permissions.includes("orders.update_status")&&<ActionButton disabled={busy===selected.id} onClick={()=>void updateStatus(selected.id,nextStatus[selected.status])}>Move to {nextStatus[selected.status].replaceAll("_"," ")}</ActionButton>}
     {isSuper&&selected.status!=="delivered"&&selected.status!=="cancelled"&&<ActionButton tone="secondary" disabled={busy==="assignment"} onClick={()=>void openAssignment(selected.id)}><Truck size={14} className="mr-2"/>Assign / reassign driver</ActionButton>}
     {isSuper&&selected.status==="delivered"&&selected.paymentMethod==="COD"&&selected.paymentStatus!=="PAID"&&<ActionButton disabled={busy==="payment"} onClick={()=>void collectCash(selected.id)}><CreditCard size={14} className="mr-2"/>Confirm cash collected</ActionButton>}
     {isSuper&&selected.status==="pending"&&<ActionButton tone="danger" disabled={busy==="cancel"} onClick={()=>void cancelOrder(selected.id)}>Cancel order</ActionButton>}
     {selected.notes&&<Notice>Customer note: {selected.notes}</Notice>}
    </div>
   </div>
  </div></div>}

  {assignment&&<div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#07171D]/55 p-4"><div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><h3 className="text-base font-extrabold">Assign delivery driver</h3><button onClick={()=>setAssignment(null)}><X size={18}/></button></div><p className="mt-2 text-xs text-[#7B8983]">Only active, verified and available drivers are returned by the assignment service.</p><div className="mt-5 space-y-4"><Field label="Available driver"><select className={selectClass} value={assignment.selected} onChange={e=>setAssignment(a=>a?{...a,selected:e.target.value}:a)}><option value="">Choose a driver</option>{assignment.drivers.map(d=><option key={d.id} value={d.id}>{d.name} · {d.phoneNumber}</option>)}</select></Field><Field label="Assignment note"><input className={inputClass} value={assignment.note} onChange={e=>setAssignment(a=>a?{...a,note:e.target.value}:a)} placeholder="Optional instructions"/></Field><div className="flex justify-end gap-2"><ActionButton tone="secondary" onClick={()=>setAssignment(null)}>Close</ActionButton><ActionButton disabled={!assignment.selected||busy==="assign-save"} onClick={()=>void assignDriver()}>Confirm assignment</ActionButton></div></div></div></div>}
 </div>;
}
