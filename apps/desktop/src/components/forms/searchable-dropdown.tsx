import { useEffect,useId,useRef,useState,type KeyboardEvent,type ReactNode } from "react";

export interface SearchableDropdownOption{readonly id:string;readonly label:string;readonly meta?:string;}
interface Props<T extends SearchableDropdownOption>{
 value:T|null;options:readonly T[];search:string;onSearchChange(value:string):void;onChange(value:T|null):void;
 label:string;placeholder?:string;emptyText?:string;loading?:boolean;disabled?:boolean;required?:boolean;
 allowClear?:boolean;renderOption?:(option:T)=>ReactNode;
}
const Chevron=({open}:{open:boolean})=><svg className={open?"is-open":undefined} viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>;
const SearchIcon=()=> <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>;
const CheckIcon=()=> <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 3.5 3.5L16 5.5"/></svg>;

export function SearchableDropdown<T extends SearchableDropdownOption>({
 value,options,search,onSearchChange,onChange,label,placeholder="انتخاب کنید…",emptyText="موردی یافت نشد.",
 loading=false,disabled=false,required=false,allowClear=true,renderOption,
}:Props<T>){
 const controlId=useId(),listId=useId(),root=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1);
 useEffect(()=>{const close=(e:MouseEvent)=>{if(root.current&&!root.current.contains(e.target as Node))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
 useEffect(()=>{setActive(options.length?0:-1);},[options]);
 useEffect(()=>{if(open)requestAnimationFrame(()=>searchRef.current?.focus());},[open]);
 function choose(option:T){onChange(option);onSearchChange("");setOpen(false);}
 function keyDown(event:KeyboardEvent<HTMLInputElement>){
  if(event.key==="ArrowDown"){event.preventDefault();setActive(i=>Math.min(i+1,options.length-1));}
  else if(event.key==="ArrowUp"){event.preventDefault();setActive(i=>Math.max(i-1,0));}
  else if(event.key==="Enter"&&active>=0){const option=options[active];if(option){event.preventDefault();choose(option);}}
  else if(event.key==="Escape"){event.preventDefault();setOpen(false);}
 }
 return <div className="ui-combobox" ref={root}>
  <label className="ui-combobox__label" htmlFor={controlId}>{label}</label>
  <button id={controlId} type="button" className="ui-combobox__trigger" disabled={disabled}
   aria-haspopup="listbox" aria-expanded={open} aria-controls={listId} onClick={()=>setOpen(v=>!v)}>
   <span className={value?"ui-combobox__value":"ui-combobox__placeholder"}>{value?.label??placeholder}</span>
   <span className="ui-combobox__actions">
    {allowClear&&value&&!disabled&&<span role="button" tabIndex={0} className="ui-combobox__clear" aria-label="پاک کردن انتخاب"
      onClick={e=>{e.stopPropagation();onChange(null);onSearchChange("");}}
      onKeyDown={e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();e.stopPropagation();onChange(null);onSearchChange("");}}}>×</span>}
    <span className="ui-combobox__separator"/>
    <span className="ui-combobox__chevron"><Chevron open={open}/></span>
   </span>
  </button>
  {required&&!value&&<input className="ui-combobox__required-proxy" tabIndex={-1} aria-hidden="true" required value="" onChange={()=>{}}/>}
  {open&&!disabled&&<div className="ui-combobox__popover">
   <div className="ui-combobox__search"><SearchIcon/><input ref={searchRef} role="combobox" aria-autocomplete="list"
     aria-expanded="true" aria-controls={listId} value={search} placeholder="جست‌وجو…" autoComplete="off"
     onChange={e=>onSearchChange(e.target.value)} onKeyDown={keyDown}/></div>
   <div className="ui-combobox__body">
    {loading?<div className="ui-combobox__state"><span className="ui-combobox__spinner"/>در حال جست‌وجو…</div>:
     options.length===0?<div className="ui-combobox__state">{emptyText}</div>:
     <ul id={listId} role="listbox">{options.map((option,index)=>{
      const selected=value?.id===option.id;
      return <li key={option.id} role="option" aria-selected={selected}
       className={[index===active?"is-active":"",selected?"is-selected":""].filter(Boolean).join(" ")}
       onMouseDown={e=>e.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option)}>
       <span className="ui-combobox__option-content">{renderOption?renderOption(option):<><strong>{option.label}</strong>{option.meta&&<small>{option.meta}</small>}</>}</span>
       <span className="ui-combobox__check">{selected&&<CheckIcon/>}</span>
      </li>})}</ul>}
   </div>
  </div>}
 </div>;
}
