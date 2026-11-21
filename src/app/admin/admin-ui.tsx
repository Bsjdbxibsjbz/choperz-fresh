import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

export function PageHeading({ eyebrow = "OPERATIONS", title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-[10px] font-extrabold uppercase tracking-[.22em] text-[#168477]">{eyebrow}</p><h1 className="mt-2 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-[-.05em] text-[#102D38] sm:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-[#6D7E78]">{description}</p></div>{action && <div className="shrink-0">{action}</div>}</div>;
}
export function Panel({ title, description, action, children, className = "" }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`overflow-hidden rounded-2xl border border-[#DDE5DF] bg-white shadow-[0_4px_20px_rgba(16,45,56,.035)] ${className}`}><div className="flex flex-col justify-between gap-2 border-b border-[#EDF0EC] px-5 py-4 sm:flex-row sm:items-center"><div><h2 className="text-sm font-extrabold text-[#102D38]">{title}</h2>{description && <p className="mt-1 text-xs text-[#7B8983]">{description}</p>}</div>{action}</div><div className="p-5">{children}</div></section>;
}
export function MetricCard({ label, value, note, icon: Icon, tone = "teal" }: { label: string; value: string | number; note: string; icon: any; tone?: "teal" | "blue" | "orange" | "red" }) {
 const tones = { teal:"bg-[#E4F2EC] text-[#168477]", blue:"bg-[#E9EFF8] text-[#436A9B]", orange:"bg-[#FBF0E7] text-[#BC7442]", red:"bg-[#FBECE8] text-[#B84C3A]" };
 return <div className="rounded-2xl border border-[#DDE5DF] bg-white p-5 shadow-[0_4px_20px_rgba(16,45,56,.035)]"><div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-[#7B8983]">{label}</p><p className="mt-3 font-[family-name:var(--font-manrope)] text-3xl font-extrabold tracking-tight text-[#102D38]">{value}</p></div><span className={`flex size-10 items-center justify-center rounded-xl ${tones[tone]}`}><Icon size={19}/></span></div><p className="mt-3 text-[10px] text-[#8A9690]">{note}</p></div>;
}
export function StatusPill({ value }: { value: string }) {
 const key = value.toLowerCase();
 const color = ["delivered","paid","available","active","confirmed"].includes(key) ? "bg-[#E5F3EC] text-[#23765C]" : ["cancelled","failed","offline","inactive","out_of_stock"].includes(key) ? "bg-[#FBECE8] text-[#B84C3A]" : ["out_for_delivery","picked_up","busy","processing","packed"].includes(key) ? "bg-[#EAF0FA] text-[#496C9D]" : "bg-[#F7F0E3] text-[#9A743C]";
 return <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold capitalize ${color}`}>{value.replaceAll("_"," ")}</span>;
}
export function Notice({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: ReactNode }) {
 const cls = kind === "error" ? "border-[#F1D1CA] bg-[#FFF5F2] text-[#A34334]" : kind === "success" ? "border-[#CDE5D8] bg-[#F0F8F3] text-[#236F55]" : "border-[#D8E5E0] bg-[#F5FAF7] text-[#42685C]";
 return <div className={`rounded-xl border px-4 py-3 text-xs leading-5 ${cls}`}>{children}</div>;
}
export function EmptyState({ title, detail }: { title: string; detail: string }) {
 return <div className="rounded-xl border border-dashed border-[#D8E1DC] bg-[#FAFBF9] px-6 py-12 text-center"><p className="text-sm font-bold text-[#102D38]">{title}</p><p className="mt-2 text-xs text-[#7B8983]">{detail}</p></div>;
}
export function ActionButton({ children, onClick, disabled, tone = "primary", type = "button" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: "primary" | "secondary" | "danger"; type?: "button" | "submit" }) {
 const cls = tone === "danger" ? "bg-[#B84C3A] text-white hover:bg-[#963B2E]" : tone === "secondary" ? "border border-[#D8E1DC] bg-white text-[#24434A] hover:bg-[#F4F7F4]" : "bg-[#168477] text-white hover:bg-[#126E63]";
 return <button type={type} onClick={onClick} disabled={disabled} className={`inline-flex min-h-10 items-center justify-center rounded-xl px-4 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${cls}`}>{children}</button>;
}
export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
 return <label className="block"><span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-[#64756E]">{label}</span>{children}{hint && <span className="mt-1 block text-[10px] text-[#8A9690]">{hint}</span>}</label>;
}
export const inputClass = "h-11 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 text-sm text-[#102D38] outline-none transition placeholder:text-[#A1ACA6] focus:border-[#168477] focus:ring-2 focus:ring-[#168477]/10";
export const selectClass = inputClass;
export const textAreaClass = "min-h-24 w-full rounded-xl border border-[#D8E1DC] bg-white px-3 py-2.5 text-sm text-[#102D38] outline-none transition placeholder:text-[#A1ACA6] focus:border-[#168477] focus:ring-2 focus:ring-[#168477]/10";
