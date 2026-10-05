import { createInventoryXlsx, type InventoryTabularData } from "@argin/inventory-tauri";
import type { SalesDocumentType } from "@argin/sales";
import type { SalesWorkspaceServices } from "../../composition/sales/create-sales-workspace-services";

export const SALES_IMPORT_HEADERS=Object.freeze(["کلید سند","نوع سند","تاریخ","کد مشتری","شرح سند","کد کالا","تعداد","قیمت واحد","تخفیف درصد","مالیات درصد"]);
export function createSalesImportTemplateXlsx():Uint8Array{return createInventoryXlsx([Object.fromEntries(SALES_IMPORT_HEADERS.map(h=>[h,""]))],"ورود اسناد فروش");}
export interface SalesImportPreviewDocument {readonly key:string;readonly valid:boolean;readonly issues:readonly string[];readonly input:null|{documentType:SalesDocumentType;customerId:string;businessDate:string;description:string;lines:readonly {productId:string;quantity:number;unitPrice:number;discountRateBasisPoints:number;taxRateBasisPoints:number}[]};}
export interface SalesImportPreview {readonly batchId:string;readonly totalRows:number;readonly documents:readonly SalesImportPreviewDocument[];readonly invalidCount:number;}
export async function previewSalesImport(input:{data:InventoryTabularData;batchId:string;services:SalesWorkspaceServices;companyId:string;branchId:string}):Promise<SalesImportPreview>{
 const missing=SALES_IMPORT_HEADERS.filter(h=>!input.data.headers.includes(h));if(missing.length)throw new Error("ستون‌های الزامی فایل وجود ندارند: "+missing.join("، "));
 const groups=new Map<string,InventoryTabularData["rows"][number][]>();
 input.data.rows.forEach((row,i)=>{const key=row["کلید سند"]?.trim();const actual=key||"__missing_"+i;groups.set(actual,[...(groups.get(actual)??[]),row]);});
 const documents:SalesImportPreviewDocument[]=[];
 for(const [key,rows] of groups){const issues:string[]=[];if(key.startsWith("__missing_"))issues.push("کلید سند الزامی است.");const first=rows[0]!;
  const type=parseType(first["نوع سند"]);if(!type)issues.push("نوع سند فقط «فاکتور فروش» یا «سفارش فروش» است.");
  if(rows.some(r=>r["نوع سند"]!==first["نوع سند"]||r["تاریخ"]!==first["تاریخ"]||r["کد مشتری"]!==first["کد مشتری"]))issues.push("مشخصات سربرگ در ردیف‌های یک سند یکسان نیست.");
  const customers=await input.services.selectCustomers(input.companyId,input.branchId,first["کد مشتری"]??"");const customer=customers.find(x=>x.code===(first["کد مشتری"]??"").trim());if(!customer)issues.push("کد مشتری فعال پیدا نشد.");
  const lines=[] as {productId:string;quantity:number;unitPrice:number;discountRateBasisPoints:number;taxRateBasisPoints:number}[];
  for(const [index,row] of rows.entries()){const products=await input.services.selectItems(input.companyId,input.branchId,row["کد کالا"]??"");const product=products.find(x=>x.code===(row["کد کالا"]??"").trim());if(!product){issues.push("ردیف "+(index+1)+": کد کالا/خدمت فعال پیدا نشد.");continue;}
   const quantity=number(row["تعداد"]),unitPrice=number(row["قیمت واحد"]),discount=percent(row["تخفیف درصد"]),tax=percent(row["مالیات درصد"]);
   if(!(quantity>0))issues.push("ردیف "+(index+1)+": تعداد باید بیشتر از صفر باشد.");if(unitPrice<0||!Number.isSafeInteger(unitPrice))issues.push("ردیف "+(index+1)+": قیمت واحد معتبر نیست.");if(discount<0||discount>10000)issues.push("ردیف "+(index+1)+": تخفیف معتبر نیست.");if(tax<0||tax>10000)issues.push("ردیف "+(index+1)+": مالیات معتبر نیست.");
   lines.push({productId:product.productId,quantity,unitPrice,discountRateBasisPoints:discount,taxRateBasisPoints:tax});
  }
  const businessDate=(first["تاریخ"]??"").trim();if(!/^\d{4}-\d{2}-\d{2}$/.test(businessDate))issues.push("تاریخ باید میلادی و به قالب YYYY-MM-DD باشد.");
  documents.push(Object.freeze({key,valid:issues.length===0,issues:Object.freeze(issues),input:issues.length||!type||!customer?null:Object.freeze({documentType:type,customerId:customer.id,businessDate,description:(first["شرح سند"]??"").trim(),lines:Object.freeze(lines)})}));
 }
 return Object.freeze({batchId:input.batchId,totalRows:input.data.rows.length,documents:Object.freeze(documents),invalidCount:documents.filter(x=>!x.valid).length});
}
export async function commitSalesImport(input:{preview:SalesImportPreview;services:SalesWorkspaceServices;companyId:string;branchId:string;fiscalYearId:string}):Promise<{created:number}>{
 if(input.preview.invalidCount)throw new Error("فایل دارای خطاست؛ ابتدا همه خطاهای پیش‌نمایش را برطرف کنید.");let created=0;
 for(const doc of input.preview.documents){if(!doc.input)throw new Error("پیش‌نمایش معتبر نیست.");await input.services.create({submissionId:"sales-import:"+input.preview.batchId+":"+doc.key,companyId:input.companyId,branchId:input.branchId,fiscalYearId:input.fiscalYearId,documentType:doc.input.documentType,customerId:doc.input.customerId,businessDate:doc.input.businessDate,description:doc.input.description,relatedDocumentId:"",lines:doc.input.lines});created++;}
 return {created};
}
export async function salesImportBatchId(bytes:Uint8Array):Promise<string>{const digest=await crypto.subtle.digest("SHA-256",new Uint8Array(bytes).buffer);return Array.from(new Uint8Array(digest)).map(x=>x.toString(16).padStart(2,"0")).join("");}
const parseType=(value:string|undefined):SalesDocumentType|null=>value?.trim()==="فاکتور فروش"?"sales-invoice":value?.trim()==="سفارش فروش"?"sales-order":null;
const number=(v:string|undefined)=>Number(String(v??"").replaceAll(",","").trim());
const percent=(v:string|undefined)=>{const n=number(v);return Number.isFinite(n)?Math.round(n*100):-1;};
