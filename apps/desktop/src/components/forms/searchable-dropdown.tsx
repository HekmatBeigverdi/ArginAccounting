import { createPortal } from "react-dom";
import { useCallback,useEffect,useId,useLayoutEffect,useRef,useState,type KeyboardEvent,type ReactNode } from "react";

export interface SearchableDropdownOption{readonly id:string;readonly label:string;readonly meta?:string;}
interface Props<T extends SearchableDropdownOption>{
 value:T|null;options:readonly T[];search:string;onSearchChange(value:string):void;onChange(value:T|null):void;
 label:string;placeholder?:string;emptyText?:string;loading?:boolean;disabled?:boolean;required?:boolean;
 allowClear?:boolean;renderOption?:(option:T)=>ReactNode;portalTarget?:HTMLElement|null;
}
interface PopupPosition{left:number;top:number;width:number;maxHeight:number;placement:"bottom"|"top";}
const Chevron=({open}:{open:boolean})=><svg className={open?"is-open":undefined} viewBox="0 0 20 20" aria-hidden="true"><path d="m6 8 4 4 4-4"/></svg>;
const SearchIcon=()=> <svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4"/></svg>;
const CheckIcon=()=> <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 3.5 3.5L16 5.5"/></svg>;

export function SearchableDropdown<T extends SearchableDropdownOption>({
 value,options,search,onSearchChange,onChange,label,placeholder="انتخاب کنید…",emptyText="موردی یافت نشد.",
 loading=false,disabled=false,required=false,allowClear=true,renderOption,portalTarget,
}:Props<T>){
 const controlId=useId(),listId=useId(),root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null),popup=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null);
 const [open,setOpen]=useState(false),[active,setActive]=useState(-1),[position,setPosition]=useState<PopupPosition|null>(null);
 const positionPopup=useCallback(()=>{
  const rect=trigger.current?.getBoundingClientRect();if(!rect)return;
  const gap=6,edge=12,preferred=310;
  const below=window.innerHeight-rect.bottom-edge-gap,above=rect.top-edge-gap;
  const placement=below>=Math.min(220,preferred)||below>=above?"bottom":"top";
  const available=Math.max(120,placement==="bottom"?below:above);
  const maxHeight=Math.min(preferred,available);
  const width=Math.max(rect.width,280);
  const left=Math.min(Math.max(edge,rect.left),Math.max(edge,window.innerWidth-width-edge));
  const top=placement==="bottom"?rect.bottom+gap:Math.max(edge,rect.top-gap-maxHeight);
  setPosition({left,top,width,maxHeight,placement});
 },[]);
 useEffect(()=>{const close=(e:MouseEvent)=>{const node=e.target as Node;if(!root.current?.contains(node)&&!popup.current?.contains(node))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
 useEffect(()=>{setActive(options.length?0:-1);},[options]);
 useLayoutEffect(()=>{if(!open)return;positionPopup();const update=()=>positionPopup();window.addEventListener("resize",update);window.addEventListener("scroll",update,true);return()=>{window.removeEventListener("resize",update);window.removeEventListener("scroll",update,true);};},[open,positionPopup]);
 useEffect(()=>{if(open)requestAnimationFrame(()=>searchRef.current?.focus());},[open]);
 function choose(option:T){onChange(option);onSearchChange("");setOpen(false);}
 function keyDown(event:KeyboardEvent<HTMLInputElement>){
  if(event.key==="ArrowDown"){event.preventDefault();setActive(i=>Math.min(i+1,options.length-1));}
  else if(event.key==="ArrowUp"){event.preventDefault();setActive(i=>Math.max(i-1,0));}
  else if(event.key==="Enter"&&active>=0){const option=options[active];if(option){event.preventDefault();choose(option);}}
  else if(event.key==="Escape"){event.preventDefault();setOpen(false);trigger.current?.focus();}
 }
 const popupNode=open&&!disabled&&position?<div ref={popup} className={"ui-combobox__popover is-"+position.placement}
   style={{position:"fixed",left:position.left,top:position.top,width:position.width,maxHeight:position.maxHeight}}>
   <div className="ui-combobox__search"><SearchIcon/><input ref={searchRef} role="combobox" aria-autocomplete="list"
    aria-expanded="true" aria-controls={listId} value={search} placeholder="جست‌وجو…" autoComplete="off"
    onChange={e=>onSearchChange(e.target.value)} onKeyDown={keyDown}/></div>
   <div className="ui-combobox__body" style={{maxHeight:Math.max(80,position.maxHeight-58)}}>
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
  </div>:null;
 return <div className="ui-combobox" ref={root}>
  <label className="ui-combobox__label" htmlFor={controlId}>{label}</label>
  <button ref={trigger} id={controlId} type="button" className="ui-combobox__trigger" disabled={disabled}
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
  {popupNode&&createPortal(popupNode,portalTarget ?? document.body)}
 </div>;
}
