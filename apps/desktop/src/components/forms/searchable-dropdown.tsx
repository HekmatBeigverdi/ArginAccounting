import { useEffect,useId,useRef,useState,type KeyboardEvent, type ReactNode } from "react";

export interface SearchableDropdownOption {
  readonly id:string;
  readonly label:string;
  readonly meta?:string;
}
interface Props<T extends SearchableDropdownOption>{
  value:T|null;
  options:readonly T[];
  search:string;
  onSearchChange(value:string):void;
  onChange(value:T|null):void;
  label:string;
  placeholder?:string;
  emptyText?:string;
  loading?:boolean;
  disabled?:boolean;
  required?:boolean;
  renderOption?:(option:T)=>ReactNode;
}

export function SearchableDropdown<T extends SearchableDropdownOption>({
  value,options,search,onSearchChange,onChange,label,placeholder="جست‌وجو و انتخاب…",
  emptyText="موردی یافت نشد.",loading=false,disabled=false,required=false,renderOption,
}:Props<T>){
  const inputId=useId(),listId=useId(),root=useRef<HTMLDivElement>(null);
  const [open,setOpen]=useState(false),[active,setActive]=useState(-1);
  useEffect(()=>{const close=(event:MouseEvent)=>{if(root.current&&!root.current.contains(event.target as Node))setOpen(false);};document.addEventListener("mousedown",close);return()=>document.removeEventListener("mousedown",close);},[]);
  useEffect(()=>{setActive(options.length?0:-1);},[options]);
  function choose(option:T){onChange(option);onSearchChange(option.label);setOpen(false);}
  function keyDown(event:KeyboardEvent<HTMLInputElement>){
    if(event.key==="ArrowDown"){event.preventDefault();setOpen(true);setActive(i=>Math.min(i+1,options.length-1));}
    else if(event.key==="ArrowUp"){event.preventDefault();setActive(i=>Math.max(i-1,0));}
    else if(event.key==="Enter"&&open&&active>=0){const option=options[active];if(option){event.preventDefault();choose(option);}}
    else if(event.key==="Escape")setOpen(false);
  }
  return <div className="ui-searchable-dropdown" ref={root}>
    <label htmlFor={inputId}>{label}</label>
    <div className="ui-searchable-dropdown__control">
      <input id={inputId} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={listId}
        value={search} placeholder={placeholder} autoComplete="off" disabled={disabled} required={required&&!value}
        onFocus={()=>setOpen(true)} onKeyDown={keyDown}
        onChange={event=>{onSearchChange(event.target.value);if(value&&event.target.value!==value.label)onChange(null);setOpen(true);}}/>
      <button type="button" tabIndex={-1} aria-label="باز کردن فهرست" disabled={disabled}
        onMouseDown={event=>event.preventDefault()} onClick={()=>setOpen(v=>!v)}>⌄</button>
    </div>
    {open&&!disabled&&<div className="ui-searchable-dropdown__popover">
      {loading?<div className="ui-searchable-dropdown__state">در حال جست‌وجو…</div>:options.length===0?
        <div className="ui-searchable-dropdown__state">{emptyText}</div>:
        <ul id={listId} role="listbox">{options.map((option,index)=><li key={option.id} role="option"
          aria-selected={value?.id===option.id} className={index===active?"is-active":undefined}
          onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActive(index)} onClick={()=>choose(option)}>
          {renderOption?renderOption(option):<><strong>{option.label}</strong>{option.meta&&<small>{option.meta}</small>}</>}
        </li>)}</ul>}
    </div>}
  </div>;
}
