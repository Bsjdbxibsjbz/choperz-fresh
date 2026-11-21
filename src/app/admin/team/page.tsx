"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw, UserPlus, Users, Truck } from "lucide-react";
import { useAdminSession } from "../admin-shell";
import { ActionButton, EmptyState, Field, inputClass, Notice, PageHeading, Panel, selectClass, StatusPill } from "../admin-ui";

type Staff={id:string;userId:string;name:string;phoneNumber:string|null;phoneNumberVerified:boolean;joinedAt:string;isActive:boolean;role:{name:string;description:string|null};outlet:{id:string;code:string;name:string}|null;driverProfile:{id:string;availability:string}|null};
type Driver={id:string;availability:string;account:{name:string;phoneNumber:string|null;phoneNumberVerified:boolean;isActive:boolean};currentAssignment:any;assignmentCount:number;canReceiveAssignment:boolean};
type Outlet={id:string;code:string;name:string};
async function api(url:string,init?:RequestInit){const r=await fetch(url,{...init,credentials:"include",cache:"no-store",headers:{"Content-Type":"application/json",...(init?.headers||{})}});const d=await r.json().catch(()=>({error:"Invalid response"}));if(!r.ok)throw new Error(d.error||"Request failed");return d;}

export default function AdminTeamPage(){
 const {permissions,role,phoneNumber}=useAdminSession();
 const canManage=permissions.includes("staff.manage")&&permissions.includes("roles.manage");
 const isSuper=role==="SUPER_ADMIN";
 const [staff,setStaff]=useState<Staff[]>([]);
 const [drivers,setDrivers]=useState<Driver[]>([]);
 const [outlets,setOutlets]=useState<Outlet[]>([]);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [error,setError]=useState("");
 const [notice,setNotice]=useState("");
 const [tab,setTab]=useState<"staff"|"drivers">("staff");
 const [createOpen,setCreateOpen]=useState(false);
 const [form,setForm]=useState({name:"",phoneNumber:"+91",roleName:"INVENTORY_MANAGER",outletId:""});
 async function load(){
  setLoading(true);setError("");
  try{
   const jobs=[api("/api/admin/staff/list").then(d=>setStaff(d.staff||[]))];
   if(isSuper)jobs.push(api("/api/admin/drivers?page=1&pageSize=100").then(d=>setDrivers(d.drivers||[])));
   if(isSuper)jobs.push(api("/api/admin/outlets").then(d=>setOutlets(d.outlets||[])));
   await Promise.all(jobs);
  }catch(e){setError(e instanceof Error?e.message:"Unable to load team directory");}
  finally{setLoading(false);}
 }
 useEffect(()=>{void load();},[]);
 async function createStaff(e:FormEvent){
  e.preventDefault();setSaving(true);setError("");setNotice("");
  try{
   const phone=form.phoneNumber.trim();
   if(!/^\+[1-9]\d{7,14}$/.test(phone))throw new Error("Enter the phone number in international format, e.g. +919876543210.");
   await api("/api/admin/staff",{method:"POST",body:JSON.stringify({name:form.name,phoneNumber:phone,roleName:form.roleName,outletId:form.roleName==="OUTLET_MANAGER"?form.outletId:null})});
   setNotice("Staff account created. Mobile OTP verification is pending.");setCreateOpen(false);setForm({name:"",phoneNumber:"+91",roleName:"INVENTORY_MANAGER",outletId:""});await load();
  }catch(e){setError(e instanceof Error?e.message:"Unable to create staff account");}
  finally{setSaving(false);}
 }
 async function toggleStaff(s:Staff){
  if(s.phoneNumber===phoneNumber){setError("You cannot change your own staff account status.");return;}
  const action=s.isActive?"deactivate":"activate";
  if(!window.confirm("Are you sure you want to "+action+" "+s.name+"?"))return;
  setSaving(true);setError("");setNotice("");
  try{await api("/api/admin/staff/"+s.id,{method:"PATCH",body:JSON.stringify({isActive:!s.isActive})});setNotice("Staff account status updated.");await load();}
  catch(e){setError(e instanceof Error?e.message:"Unable to update staff account");}
  finally{setSaving(false);}
 }
 async function updateDriver(id:string,payload:any){
  setSaving(true);setError("");setNotice("");
  try{await api("/api/admin/drivers/"+id,{method:"PATCH",body:JSON.stringify(payload)});setNotice("Driver account updated.");await load();}
  catch(e){setError(e instanceof Error?e.message:"Unable to update driver");}
  finally{setSaving(false);}
 }
 const roles=["INVENTORY_MANAGER","OUTLET_MANAGER","PRODUCT_MANAGER","ORDER_MANAGER","DRIVER","CONTENT_MANAGER"];
 return <div>
  <PageHeading eyebrow="PEOPLE & ACCESS" title="Team & drivers" description="Create staff accounts, assign operational roles and manage delivery driver availability." action={<div className="flex gap-2"><ActionButton tone="secondary" onClick={()=>void load()}><RefreshCw size={14} className="mr-2"/>Refresh</ActionButton>{canManage&&<ActionButton onClick={()=>setCreateOpen(true)}><UserPlus size={14} className="mr-2"/>Add staff</ActionButton>}</div>}/>
  {error&&<div className="mb-4"><Notice kind="error">{error}</Notice></div>}{notice&&<div className="mb-4"><Notice kind="success">{notice}</Notice></div>}
  <div className="mb-5 flex gap-2"><button onClick={()=>setTab("staff")} className={`rounded-xl px-4 py-2.5 text-xs font-bold ${tab==="staff"?"bg-[#102D38] text-white":"border border-[#DCE4DE] bg-white text-[#52675F]"}`}><Users size={13} className="mr-2 inline"/>Staff directory</button>{isSuper&&<button onClick={()=>setTab("drivers")} className={`rounded-xl px-4 py-2.5 text-xs font-bold ${tab==="drivers"?"bg-[#102D38] text-white":"border border-[#DCE4DE] bg-white text-[#52675F]"}`}><Truck size={13} className="mr-2 inline"/>Driver operations</button>}</div>
  {tab==="staff"&&<Panel title="Staff directory" description={staff.length+" staff accounts"}>
   {loading?<p className="py-12 text-center text-xs text-[#829089]">Loading staff directory…</p>:staff.length===0?<EmptyState title="No staff accounts found" detail="Create a staff account to begin assigning operational responsibilities."/>:<div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left"><thead><tr className="border-b border-[#E9EEEA] text-[9px] font-bold uppercase tracking-wider text-[#829089]"><th className="pb-3">Staff member</th><th className="pb-3">Role</th><th className="pb-3">Outlet</th><th className="pb-3">Mobile verification</th><th className="pb-3">Account</th><th className="pb-3">Joined</th><th className="pb-3 text-right">Controls</th></tr></thead><tbody>{staff.map(s=><tr key={s.id} className="border-b border-[#F0F2EF] text-xs last:border-0"><td className="py-4"><p className="font-extrabold">{s.name}</p><p className="mt-1 text-[10px] text-[#87938D]">{s.phoneNumber||"No phone"}</p></td><td className="py-4"><span className="text-[10px] font-bold">{s.role.name.replaceAll("_"," ")}</span></td><td className="py-4">{s.outlet?.name||"—"}</td><td className="py-4"><StatusPill value={s.phoneNumberVerified?"Verified":"Pending"}/></td><td className="py-4"><StatusPill value={s.isActive?"Active":"Inactive"}/></td><td className="py-4 text-[10px] text-[#87938D]">{new Date(s.joinedAt).toLocaleDateString("en-IN")}</td><td className="py-4 text-right"><button disabled={saving||s.phoneNumber===phoneNumber} onClick={()=>void toggleStaff(s)} className="rounded-lg border border-[#DCE5DF] px-3 py-2 text-[10px] font-bold disabled:opacity-40">{s.isActive?"Deactivate":"Activate"}</button></td></tr>)}</tbody></table></div>}
   <div className="mt-4"><Notice>New staff accounts are created with mobile verification pending. They must complete OTP verification before using protected staff APIs.</Notice></div>
  </Panel>}
  {tab==="drivers"&&isSuper&&<Panel title="Driver operations" description={drivers.length+" driver profiles"}>
   {loading?<p className="py-12 text-center text-xs text-[#829089]">Loading driver operations…</p>:drivers.length===0?<EmptyState title="No drivers registered" detail="Create a staff account with the Driver role to add a driver."/>:<div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left"><thead><tr className="border-b border-[#E9EEEA] text-[9px] font-bold uppercase tracking-wider text-[#829089]"><th className="pb-3">Driver</th><th className="pb-3">Account</th><th className="pb-3">Availability</th><th className="pb-3">Current delivery</th><th className="pb-3">Controls</th></tr></thead><tbody>{drivers.map(d=><tr key={d.id} className="border-b border-[#F0F2EF] text-xs last:border-0"><td className="py-4"><p className="font-extrabold">{d.account.name}</p><p className="mt-1 text-[10px] text-[#87938D]">{d.account.phoneNumber||"No phone"}</p><p className="mt-1 text-[9px] text-[#87938D]">{d.account.phoneNumberVerified?"Mobile verified":"Verification pending"}</p></td><td className="py-4"><StatusPill value={d.account.isActive?"Active":"Inactive"}/></td><td className="py-4"><StatusPill value={d.availability}/></td><td className="py-4">{d.currentAssignment?<><p className="font-bold">{d.currentAssignment.order?.orderNumber||"Assigned"}</p><p className="mt-1 text-[10px] text-[#87938D]">{d.currentAssignment.order?.shipCity||""}</p></>:"—"}</td><td className="py-4"><div className="flex flex-wrap gap-2"><button disabled={saving||!d.account.isActive||!d.account.phoneNumberVerified||Boolean(d.currentAssignment)} onClick={()=>void updateDriver(d.id,{availability:d.availability==="AVAILABLE"?"OFFLINE":"AVAILABLE"})} className="rounded-lg border border-[#DCE5DF] px-3 py-2 text-[10px] font-bold disabled:opacity-40">{d.availability==="AVAILABLE"?"Set offline":"Set available"}</button><button disabled={saving||Boolean(d.currentAssignment)} onClick={()=>void updateDriver(d.id,{isActive:!d.account.isActive})} className="rounded-lg border border-[#DCE5DF] px-3 py-2 text-[10px] font-bold disabled:opacity-40">{d.account.isActive?"Deactivate":"Activate"}</button></div><p className="mt-2 text-[9px] text-[#87938D]">{d.canReceiveAssignment?"Eligible for assignment":"Not currently assignable"}</p></td></tr>)}</tbody></table></div>}
   <div className="mt-4"><Notice>Driver availability is automatically controlled by active assignments. Drivers with active deliveries cannot be manually switched offline.</Notice></div>
  </Panel>}
  {createOpen&&<div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#07171D]/55 p-4"><form onSubmit={createStaff} className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl"><div className="mb-5 flex items-center justify-between"><div><p className="text-[9px] font-extrabold uppercase tracking-wider text-[#168477]">Team setup</p><h2 className="mt-1 text-lg font-extrabold">Create staff account</h2></div><button type="button" onClick={()=>setCreateOpen(false)}>×</button></div><div className="space-y-4"><Field label="Full name"><input required minLength={2} className={inputClass} value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))}/></Field><Field label="Mobile number"><input required className={inputClass} value={form.phoneNumber} onChange={e=>setForm(p=>({...p,phoneNumber:e.target.value}))} placeholder="+919876543210" /></Field><Field label="Role"><select className={selectClass} value={form.roleName} onChange={e=>setForm(p=>({...p,roleName:e.target.value,outletId:""}))}>{roles.map(r=><option key={r} value={r}>{r.replaceAll("_"," ")}</option>)}</select></Field>{form.roleName==="OUTLET_MANAGER"&&<Field label="Assigned outlet"><select required className={selectClass} value={form.outletId} onChange={e=>setForm(p=>({...p,outletId:e.target.value}))}><option value="">Choose outlet</option>{outlets.filter(o=>o.isActive).map(o=><option key={o.id} value={o.id}>{o.name}</option>)}</select></Field>}<div className="flex justify-end gap-2 pt-2"><ActionButton tone="secondary" onClick={()=>setCreateOpen(false)}>Cancel</ActionButton><ActionButton type="submit" disabled={saving}>{saving?"Creating…":"Create staff"}</ActionButton></div></div></form></div>}
 </div>;
}
