import { useEffect,useMemo,useRef,useState } from "react";
import type { BelowCostEvaluation, BelowCostLineRouting, BelowCostSalesMode } from "@argin/sales";
import type { WarehouseListItemDto } from "@argin/warehouse";
import type { SalesWorkspaceDocument } from "../../composition/sales/create-sales-workspace-services";
import { Feedback } from "../../components/feedback";
import "./sales-document-form.css";

export interface BelowCostPreviewResult {
  readonly policy:{readonly mode:BelowCostSalesMode;readonly minimumMarginBasisPoints:number};
  readonly results:readonly {readonly snapshot:{readonly lineId:string;readonly productId:string};readonly evaluation:BelowCostEvaluation}[];
}
interface Props{
  document:SalesWorkspaceDocument;
  warehouses:readonly WarehouseListItemDto[];
  busy:boolean;
  canApproveBelowCost:boolean;
  guardEnabled:boolean;
  preview(routing:readonly BelowCostLineRouting[]):Promise<BelowCostPreviewResult>;
  onConfirm(input:{routing:readonly BelowCostLineRouting[];acknowledgeWarning:boolean;approvalReason:string|null}):void;
  onClose():void;
}
const money=new Intl.NumberFormat("fa-IR");
const OUTCOME:Record<BelowCostEvaluation["outcome"],string>={
  "not-applicable":"نامرتبط","allowed":"مجاز","warning":"هشدار","approval-required":"نیازمند تأیید","blocked":"مسدود","cost-unavailable":"بهای معتبر در دسترس نیست",
};

export function SalesFinalizeDialog({document,warehouses,busy,canApproveBelowCost,guardEnabled,preview,onConfirm,onClose}:Props){
  const dialog=useRef<HTMLDialogElement>(null);
  const stockLines=document.lines.filter(line=>line.lineKind==="stock-product");
  const [routing,setRouting]=useState<Record<string,string>>(()=>Object.fromEntries(stockLines.map(line=>[line.lineId,warehouses.length===1?warehouses[0]!.warehouseId:""])));
  const [result,setResult]=useState<BelowCostPreviewResult|null>(null);
  const [error,setError]=useState("");
  const [loading,setLoading]=useState(false);
  const [ack,setAck]=useState(false);
  const [approvalReason,setApprovalReason]=useState("");
  useEffect(()=>{dialog.current?.showModal();},[]);
  const routeArray=useMemo(()=>stockLines.map(line=>({salesLineId:line.lineId,warehouseId:routing[line.lineId]??""})),[stockLines,routing]);
  const incomplete=routeArray.some(x=>!x.warehouseId);
  const outcomes=result?.results.map(x=>x.evaluation.outcome)??[];
  const blocked=outcomes.includes("blocked")||outcomes.includes("cost-unavailable");
  const warning=outcomes.includes("warning");
  const approval=outcomes.includes("approval-required");
  const canFinalize=guardEnabled
    ? Boolean(result)&&!blocked&&(!warning||ack)&&(!approval||(canApproveBelowCost&&approvalReason.trim().length>0))
    : !incomplete;

  async function runPreview(){
    if(incomplete){setError("برای هر کالای انبارشونده انبار خروج را انتخاب کنید.");return;}
    setLoading(true);setError("");setResult(null);setAck(false);
    try{setResult(await preview(routeArray));}
    catch(e){setError(e instanceof Error?e.message:"بررسی بهای تمام‌شده ناموفق بود.");}
    finally{setLoading(false);}
  }

  return <dialog ref={dialog} className="sales-document-form sales-finalize-dialog" dir="rtl"
    onCancel={e=>{e.preventDefault();if(!busy&&!loading)onClose();}}>
    <form onSubmit={e=>{e.preventDefault();if(canFinalize)onConfirm({routing:routeArray,acknowledgeWarning:ack,approvalReason:approval?approvalReason.trim():null});}}>
      <h2>قطعی‌کردن فاکتور فروش</h2>
      <p>{guardEnabled
        ? "قبل از قطعی‌سازی، انبار خروج و سیاست فروش زیر بهای تمام‌شده بر اساس ارزش‌گذاری معتبر موجودی بررسی می‌شود."
        : "برای ردیف‌های کالای انبارشونده، انبار مرتبط را انتخاب کنید تا سند انبار متناظر ایجاد شود."}</p>
      {error&&<Feedback tone="error">{error}</Feedback>}
      {stockLines.map(line=><label key={line.lineId}>انبار خروج — {line.description||line.item.productId}
        <select value={routing[line.lineId]??""} disabled={busy||loading} onChange={e=>{setRouting(v=>({...v,[line.lineId]:e.target.value}));setResult(null);}}>
          <option value="">انتخاب انبار…</option>
          {warehouses.map(w=><option key={w.warehouseId} value={w.warehouseId}>{w.code} — {w.title}</option>)}
        </select>
      </label>)}
      {guardEnabled&&!result&&<button type="button" onClick={()=>void runPreview()} disabled={busy||loading||incomplete}>{loading?"در حال بررسی…":"بررسی بهای تمام‌شده و سیاست فروش"}</button>}
      {result&&<div className="sales-below-cost-preview">
        <strong>سیاست: {result.policy.mode} · حداقل حاشیه {result.policy.minimumMarginBasisPoints/100}%</strong>
        <table><thead><tr><th>ردیف</th><th>قیمت فروش</th><th>بهای مبنا</th><th>حاشیه</th><th>نتیجه</th></tr></thead>
        <tbody>{result.results.map(item=><tr key={item.snapshot.lineId}>
          <td dir="ltr">{item.snapshot.productId}</td>
          <td dir="ltr">{money.format(item.evaluation.sellingUnitPrice)}</td>
          <td dir="ltr">{item.evaluation.costUnitPrice??"—"}</td>
          <td dir="ltr">{item.evaluation.marginAmount==null?"—":money.format(item.evaluation.marginAmount)} {item.evaluation.marginBasisPoints==null?"":"("+item.evaluation.marginBasisPoints/100+"%)"}</td>
          <td>{OUTCOME[item.evaluation.outcome]}</td>
        </tr>)}</tbody></table>
      </div>}
      {warning&&<label className="sales-finalize-dialog__ack"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> هشدار فروش زیر حد مجاز را مشاهده کردم و ادامه می‌دهم.</label>}
      {approval&&<>{!canApproveBelowCost&&<Feedback tone="warning">این فاکتور نیازمند مجوز «تأیید فروش زیر بهای تمام‌شده» است.</Feedback>}
        {canApproveBelowCost&&<label>دلیل تأیید فروش زیر حد مجاز<textarea value={approvalReason} onChange={e=>setApprovalReason(e.target.value)} rows={3}/></label>}</>}
      {blocked&&<Feedback tone="error">طبق سیاست شرکت یا وضعیت ارزش‌گذاری، این فاکتور در حال حاضر قابل قطعی‌کردن نیست.</Feedback>}
      <footer>
        <button className="primary" type="submit" disabled={busy||loading||!canFinalize}>{busy?"در حال ثبت…":"قطعی‌کردن"}</button>
        <button type="button" disabled={busy||loading} onClick={onClose}>انصراف</button>
      </footer>
    </form>
  </dialog>;
}
