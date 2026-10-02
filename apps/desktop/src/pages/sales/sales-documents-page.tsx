import { useEffect,useMemo,useState } from "react";
import type { SalesDocumentSnapshot,SalesDocumentStatus } from "@argin/sales";
import { salesPermissions } from "@argin/sales";
import { getDesktopDatabase } from "@argin/database-tauri";
import "@argin/sales-tauri";
import { useActiveContext } from "../../app/providers/active-context-provider";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { Page } from "../../components/layout";
import { Feedback } from "../../components/feedback";
import "./sales-documents-page.css";

const TYPE_LABELS:Record<SalesDocumentSnapshot["documentType"],string>={
 "sales-order":"سفارش فروش","sales-invoice":"فاکتور فروش","sales-return":"برگشت از فروش","sales-correction":"اصلاح فروش",
};
const STATUS_LABELS:Record<SalesDocumentStatus,string>={
 draft:"پیش‌نویس",submitted:"ارسال‌شده",approved:"تأییدشده",finalized:"قطعی",cancelled:"لغوشده",
};
const faDate=new Intl.DateTimeFormat("fa-IR-u-ca-persian",{year:"numeric",month:"2-digit",day:"2-digit"});
const money=new Intl.NumberFormat("fa-IR");
const date=(v:string)=>{const d=new Date(v+"T00:00:00");return Number.isNaN(d.getTime())?v:faDate.format(d);};
const lineTotal=(line:SalesDocumentSnapshot["lines"][number])=>{
 const t=line.commercialTerms;if(!t)return 0;
 const gross=t.quantity*t.unitPrice;
 const discount=t.discounts.reduce((a,x)=>a+(x.mode==="amount"?x.value:Math.round(gross*x.value/10000)),0);
 const net=gross-discount;
 const charge=t.charges.reduce((a,x)=>a+(x.mode==="amount"?x.value:Math.round(net*x.value/10000)),0);
 const base=net+charge;
 const tax=t.taxes.reduce((a,x)=>a+Math.round(base*x.rateBasisPoints/10000),0);
 return base+tax;
};

export function SalesDocumentsPage(){
 const active=useActiveContext();const {session}=useAuthSession();
 const [documents,setDocuments]=useState<readonly SalesDocumentSnapshot[]>([]);
 const [selectedId,setSelectedId]=useState<string|null>(null);const [error,setError]=useState("");const [search,setSearch]=useState("");
 const can=(p:string)=>Boolean(session?.user.permissions.includes("system.full-access")||session?.user.permissions.includes(p));
 useEffect(()=>{let cancelled=false;(async()=>{
  if(!active.companyId||!session)return;
  try{
   const db=await getDesktopDatabase();
   const rows=await db.query<{document_json:string}>("SELECT document_json FROM sales_documents WHERE company_id=? ORDER BY business_date DESC,updated_at DESC",[active.companyId]);
   if(cancelled)return;const values=rows.map(r=>JSON.parse(r.document_json) as SalesDocumentSnapshot);setDocuments(values);setSelectedId(x=>x&&values.some(d=>d.documentId===x)?x:values[0]?.documentId??null);
  }catch(e){if(!cancelled)setError(e instanceof Error?e.message:"بارگذاری اسناد فروش ناموفق بود.");}
 })();return()=>{cancelled=true};},[active.companyId,session]);
 const filtered=useMemo(()=>{const q=search.trim().toLocaleLowerCase("fa");return !q?documents:documents.filter(d=>[d.documentNumber,d.customer.displayName,d.customer.code,TYPE_LABELS[d.documentType]].some(x=>x?.toLocaleLowerCase("fa").includes(q)));},[documents,search]);
 const selected=documents.find(d=>d.documentId===selectedId)??null;
 const total=selected?.lines.reduce((a,l)=>a+lineTotal(l),0)??0;
 return <Page><div className="sales-workspace" dir="rtl">
  <header className="sales-workspace__toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="جست‌وجو در شماره سند، مشتری یا نوع سند" aria-label="جست‌وجوی اسناد فروش"/><button className="primary" disabled={!can(salesPermissions.create)}>سند فروش جدید</button></header>
  {error&&<Feedback tone="error">{error}</Feedback>}
  <div className="sales-workspace__grid">
   <section className="sales-list" aria-label="فهرست اسناد فروش"><div className="sales-list__header"><span>تاریخ</span><span>سند / مشتری</span><span>وضعیت</span></div>
    <div className="sales-list__scroll">{filtered.map(d=><button key={d.documentId} className={"sales-list__row "+(selectedId===d.documentId?"is-active":"")} onClick={()=>setSelectedId(d.documentId)}><span>{date(d.businessDate)}</span><span><strong>{d.documentNumber??"بدون شماره"}</strong><small>{TYPE_LABELS[d.documentType]} · {d.customer.displayName}</small></span><span className={"status status--"+(selectedId===d.documentId?"active":"normal")}>{STATUS_LABELS.draft}</span></button>)}{filtered.length===0&&<div className="empty">سند فروشی برای نمایش وجود ندارد.</div>}</div>
   </section>
   <section className="sales-detail">{selected?<><header><div><h2>{selected.documentNumber??TYPE_LABELS[selected.documentType]}</h2><div className="meta"><span>{TYPE_LABELS[selected.documentType]}</span><span>مشتری: {selected.customer.displayName}</span><span>تاریخ: {date(selected.businessDate)}</span></div></div></header>
    <div className="sales-detail__actions"><button disabled={!can(salesPermissions.edit)}>ویرایش</button><button disabled={!can(salesPermissions.submit)}>ارسال برای تأیید</button><button disabled={!can(salesPermissions.approve)}>تأیید</button><button disabled={!can(salesPermissions.finalize)}>قطعی‌کردن</button><button disabled={!can(salesPermissions.cancel)}>لغو</button></div>
    <div className="sales-summary"><div><span>مشتری</span><strong>{selected.customer.displayName}</strong></div><div><span>تعداد اقلام</span><strong>{money.format(selected.lines.length)}</strong></div><div><span>جمع فروش</span><strong dir="ltr">{money.format(total)} {selected.lines[0]?.commercialTerms?.currency??""}</strong></div></div>
    <div className="sales-lines-wrap"><table className="sales-lines"><thead><tr><th>ردیف</th><th>کالا / خدمت</th><th>نوع</th><th>تعداد</th><th>قیمت واحد</th><th>تخفیف</th><th>مالیات</th><th>جمع</th></tr></thead><tbody>{selected.lines.map(l=>{const t=l.commercialTerms;return <tr key={l.lineId}><td>{money.format(l.position)}</td><td><strong>{l.description||l.item.productId}</strong><small dir="ltr">{l.item.productId}</small></td><td>{l.lineKind==="service"?"خدمت":"کالا"}</td><td dir="ltr">{t?.quantity??"-"}</td><td dir="ltr">{t?money.format(t.unitPrice):"-"}</td><td>{t?.discounts.length??0}</td><td>{t?.taxes.length??0}</td><td dir="ltr">{money.format(lineTotal(l))}</td></tr>})}</tbody></table></div>
    <details className="sales-history"><summary>ردیابی و ارتباطات سند</summary><dl><dt>شناسه پایدار سند</dt><dd dir="ltr">{selected.documentId}</dd><dt>سند مرتبط</dt><dd dir="ltr">{selected.relatedDocumentReference?.documentId??"—"}</dd><dt>منبع سند</dt><dd dir="ltr">{selected.sourceReference?.sourceDocumentId??"—"}</dd></dl></details>
   </>:<div className="empty">یک سند فروش را انتخاب کنید.</div>}</section>
  </div>
 </div></Page>;
}
