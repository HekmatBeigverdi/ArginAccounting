import { useEffect,useRef,useState } from "react";
import type { BelowCostSalesMode } from "@argin/sales";
import { Feedback } from "../../components/feedback";
import "./sales-document-form.css";

interface Props{
  current:{mode:BelowCostSalesMode;minimumMarginBasisPoints:number;effectiveFrom:string}|null;
  busy:boolean;
  onSave(input:{mode:BelowCostSalesMode;minimumMarginBasisPoints:number;effectiveFrom:string}):void;
  onClose():void;
}
const LABELS:Record<BelowCostSalesMode,string>={
  allow:"مجاز بدون توقف",
  warn:"نمایش هشدار و ادامه با تأیید کاربر",
  "require-approval":"نیازمند مجوز تأیید فروش زیر حد مجاز",
  block:"مسدودکردن قطعی‌سازی",
};
export function SalesBelowCostPolicyDialog({current,busy,onSave,onClose}:Props){
  const dialog=useRef<HTMLDialogElement>(null);
  const [mode,setMode]=useState<BelowCostSalesMode>(current?.mode??"warn");
  const [margin,setMargin]=useState(String((current?.minimumMarginBasisPoints??0)/100));
  const [effectiveFrom,setEffectiveFrom]=useState(current?.effectiveFrom??new Date().toISOString().slice(0,10));
  const [error,setError]=useState("");
  useEffect(()=>{dialog.current?.showModal();},[]);
  return <dialog ref={dialog} className="sales-document-form" dir="rtl" onCancel={e=>{e.preventDefault();if(!busy)onClose();}}>
    <form onSubmit={e=>{
      e.preventDefault();const percent=Number(margin);
      if(!Number.isFinite(percent)||percent<0||percent>100){setError("حداقل حاشیه سود باید بین صفر تا صد درصد باشد.");return;}
      onSave({mode,minimumMarginBasisPoints:Math.round(percent*100),effectiveFrom});
    }}>
      <h2>سیاست فروش زیر بهای تمام‌شده</h2>
      <p>این سیاست فقط برای کالاهای انبارشونده و با استفاده از بهای معتبر فاز ارزش‌گذاری موجودی اعمال می‌شود.</p>
      {error&&<Feedback tone="error">{error}</Feedback>}
      <label>رفتار سیستم
        <select value={mode} onChange={e=>setMode(e.target.value as BelowCostSalesMode)} disabled={busy}>
          {Object.entries(LABELS).map(([value,label])=><option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>حداقل حاشیه سود درصد
        <input dir="ltr" inputMode="decimal" value={margin} onChange={e=>setMargin(e.target.value)} disabled={busy}/>
      </label>
      <label>تاریخ اثر
        <input dir="ltr" type="date" value={effectiveFrom} onChange={e=>setEffectiveFrom(e.target.value)} disabled={busy}/>
      </label>
      <Feedback tone="warning">تغییر Policy تاریخچه قبلی را بازنویسی نمی‌کند؛ نسخه جدید با تاریخ اثر مستقل ثبت می‌شود.</Feedback>
      <footer><button className="primary" type="submit" disabled={busy}>{busy?"در حال ذخیره…":"ذخیره نسخه جدید"}</button><button type="button" disabled={busy} onClick={onClose}>انصراف</button></footer>
    </form>
  </dialog>;
}
