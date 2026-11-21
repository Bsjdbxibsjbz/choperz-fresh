"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { authClient } from "@/lib/auth-client";
import {
  Activity, Boxes, ClipboardList, LayoutDashboard, LogOut, MapPin,
  Menu, Package, ShieldCheck, Users, Warehouse, ChevronRight,
} from "lucide-react";

export type AdminSession = {
  name: string;
  phoneNumber: string;
  role: string;
  outletId: string | null;
  permissions: string[];
};
const AdminContext = createContext<AdminSession | null>(null);
export function useAdminSession() {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdminSession must be used inside AdminShell");
  return value;
}

const navItems: { href: string; label: string; icon: typeof LayoutDashboard; permission?: string; superAdmin?: boolean }[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Orders", icon: ClipboardList, permission: "orders.read" },
  { href: "/admin/inventory", label: "Inventory", icon: Warehouse, permission: "inventory.read" },
  { href: "/admin/catalogue", label: "Product catalogue", icon: Package, permission: "products.read" },
  { href: "/admin/outlets", label: "Outlets & zones", icon: MapPin, permission: "outlets.write", superAdmin: true },
  { href: "/admin/team", label: "Team & drivers", icon: Users, permission: "staff.manage" },
  { href: "/admin/suppliers", label: "Suppliers", icon: Boxes, permission: "suppliers.write" },
];

export function AdminShell({ children, ...session }: AdminSession & { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const visibleItems = useMemo(() => navItems.filter((item) =>
    (!item.permission || session.permissions.includes(item.permission)) &&
    (!item.superAdmin || session.role === "SUPER_ADMIN")
  ), [session.permissions, session.role]);

  async function signOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
      router.replace("/login");
      router.refresh();
    } finally {
      setSigningOut(false);
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <Link href="/admin" className="flex h-[78px] items-center gap-3 border-b border-white/10 px-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#168477] text-white"><Activity size={21}/></span>
        <span><span className="block font-[family-name:var(--font-manrope)] text-lg font-extrabold tracking-tight text-white">CHOPERZ<span className="text-[#56B6A5]">.</span></span><span className="mt-0.5 block text-[9px] font-bold uppercase tracking-[.22em] text-[#A9C3BE]">Operations console</span></span>
      </Link>
      <div className="px-4 pt-7">
        <p className="px-3 pb-3 text-[9px] font-bold uppercase tracking-[.2em] text-[#88A7A5]">Workspace</p>
        <nav className="space-y-1">
          {visibleItems.map((item) => {
            const active = item.href === "/admin" ? pathname === item.href : pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-[13px] font-semibold transition ${active ? "bg-[#168477] text-white shadow-lg shadow-black/10" : "text-[#D0DEDA] hover:bg-white/10 hover:text-white"}`}>
              <Icon size={17} strokeWidth={1.9}/><span className="flex-1">{item.label}</span>{active && <ChevronRight size={15}/>}
            </Link>;
          })}
        </nav>
      </div>
      <div className="mt-auto p-4">
        <div className="rounded-2xl border border-white/10 bg-white/[.06] p-4">
          <div className="flex items-center gap-2 text-[#8FB8A9]"><ShieldCheck size={15}/><span className="text-[10px] font-bold uppercase tracking-wider">Secure workspace</span></div>
          <p className="mt-2 text-[11px] leading-5 text-[#C3D4D0]">Access is controlled by your assigned role and permissions.</p>
        </div>
        <button onClick={signOut} disabled={signingOut} className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-xs font-semibold text-[#D0DEDA] transition hover:bg-white/10 hover:text-white disabled:opacity-50"><LogOut size={16}/>{signingOut ? "Signing out..." : "Sign out"}</button>
      </div>
    </div>
  );

  return (
    <AdminContext.Provider value={session}>
      <div className="min-h-screen bg-[#F4F6F2] text-[#102D38] lg:flex">
        <aside className="sticky top-0 hidden h-screen w-[258px] shrink-0 bg-[#102D38] lg:block">{sidebar}</aside>
        {mobileOpen && <div className="fixed inset-0 z-[70] lg:hidden"><button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="absolute inset-0 bg-[#07171D]/60"/><aside className="absolute inset-y-0 left-0 w-[285px] bg-[#102D38] shadow-2xl">{sidebar}</aside></div>}
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-40 flex h-[72px] items-center justify-between border-b border-[#DCE4DE] bg-white/90 px-4 backdrop-blur-xl sm:px-7 lg:px-10">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileOpen(true)} className="flex size-10 items-center justify-center rounded-xl border border-[#DCE4DE] lg:hidden" aria-label="Open navigation"><Menu size={19}/></button>
              <div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#168477]">Choperz Fresh</p><p className="mt-0.5 text-sm font-bold text-[#102D38]">Operations workspace</p></div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block"><p className="text-xs font-bold">{session.name}</p><p className="mt-0.5 text-[10px] text-[#758680]">{session.role.replaceAll("_", " ")}</p></div>
              <div className="flex size-9 items-center justify-center rounded-full bg-[#DCECE5] text-xs font-extrabold text-[#126E63]">{session.name.trim().split(/\s+/).map(x => x[0]).slice(0,2).join("").toUpperCase() || "CF"}</div>
            </div>
          </header>
          <main className="mx-auto w-full max-w-[1600px] p-4 sm:p-7 lg:p-10">{children}</main>
          <footer className="px-7 pb-7 text-center text-[10px] text-[#82918B]">Choperz Fresh Operations · Internal workspace · Not a customer-facing page</footer>
        </div>
      </div>
    </AdminContext.Provider>
  );
}
