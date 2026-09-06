import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";
import {
  buildWarehouseSelectorQuery,
  toWarehouseSelectionReference,
  type WarehouseKind,
  type WarehouseListItemDto,
  type WarehouseReader,
  type WarehouseSelectionReference,
  type WarehouseSelectorConsumer,
} from "@argin/warehouse";

import "./warehouse-selector.css";

const defaultKinds: readonly WarehouseKind[] = Object.freeze([]);

export interface WarehouseSelectorProps {
  readonly reader: Pick<WarehouseReader, "select">;
  readonly companyId: string | null;
  readonly branchId?: string | null;
  readonly consumer: WarehouseSelectorConsumer;
  readonly value: WarehouseSelectionReference | null;
  readonly onChange: (value: WarehouseSelectionReference | null) => void;
  readonly includeCompanyWide?: boolean;
  readonly kinds?: readonly WarehouseKind[];
  readonly limit?: number;
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly allowClear?: boolean;
  readonly onError?: (error: unknown) => void;
}

export function WarehouseSelector({
  reader,
  companyId,
  branchId = null,
  consumer,
  value,
  onChange,
  includeCompanyWide = true,
  kinds = defaultKinds,
  limit = 20,
  label = "انبار",
  placeholder = "کد یا عنوان انبار...",
  disabled = false,
  required = false,
  allowClear = true,
  onError,
}: WarehouseSelectorProps) {
  const inputId = useId();
  const listboxId = useId();
  const requestId = useRef(0);
  const [search, setSearch] = useState(value ? `${value.code} — ${value.title}` : "");
  const deferredSearch = useDeferredValue(search);
  const [options, setOptions] = useState<readonly WarehouseListItemDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const kindsKey = kinds.join("|");

  useEffect(() => {
    setSearch(value ? `${value.code} — ${value.title}` : "");
  }, [value?.warehouseId, value?.code, value?.title]);

  useEffect(() => {
    if (!open || disabled || !companyId) return undefined;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);

    let querySearch = deferredSearch.trim();
    if (value && querySearch === `${value.code} — ${value.title}`) querySearch = "";

    void reader
      .select(buildWarehouseSelectorQuery(companyId, querySearch, {
        consumer,
        branchId,
        includeCompanyWide,
        kinds,
        limit,
      }))
      .then((items) => {
        if (requestId.current !== currentRequest) return;
        setOptions(items);
        setActiveIndex(items.length > 0 ? 0 : -1);
      })
      .catch((error: unknown) => {
        if (requestId.current !== currentRequest) return;
        setOptions([]);
        setActiveIndex(-1);
        onError?.(error);
      })
      .finally(() => {
        if (requestId.current === currentRequest) setLoading(false);
      });

    return () => {
      if (requestId.current === currentRequest) requestId.current += 1;
    };
  }, [branchId, companyId, consumer, deferredSearch, disabled, includeCompanyWide, kindsKey, limit, onError, open, reader, value]);

  function choose(option: WarehouseListItemDto): void {
    const reference = toWarehouseSelectionReference(option);
    onChange(reference);
    setSearch(`${reference.code} — ${reference.title}`);
    setOpen(false);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.target.value;
    setSearch(next);
    setOpen(true);
    if (value && next !== `${value.code} — ${value.title}`) onChange(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) => options.length === 0 ? -1 : Math.min(current + 1, options.length - 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => options.length === 0 ? -1 : Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && activeIndex >= 0) {
      const option = options[activeIndex];
      if (option) {
        event.preventDefault();
        choose(option);
      }
      return;
    }
    if (event.key === "Escape") setOpen(false);
  }

  const activeOptionId = activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;

  return (
    <div className="warehouse-selector" dir="rtl">
      <label className="warehouse-selector__label" htmlFor={inputId}>{label}</label>
      <div className="warehouse-selector__control">
        <input
          id={inputId}
          className="warehouse-selector__input"
          value={search}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled || !companyId}
          required={required}
          placeholder={companyId ? placeholder : "ابتدا شرکت را انتخاب کنید"}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
        />
        {allowClear && value && !disabled ? (
          <button
            type="button"
            className="warehouse-selector__clear"
            aria-label="پاک‌کردن انبار انتخاب‌شده"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(null);
              setSearch("");
              setOpen(true);
            }}
          >×</button>
        ) : null}
      </div>

      {open && !disabled && companyId ? (
        <div className="warehouse-selector__popover">
          {loading ? (
            <div className="warehouse-selector__state" role="status">در حال جستجو…</div>
          ) : options.length === 0 ? (
            <div className="warehouse-selector__state">انبار فعالی مطابق محدوده انتخاب‌شده یافت نشد.</div>
          ) : (
            <ul id={listboxId} className="warehouse-selector__list" role="listbox">
              {options.map((option, index) => (
                <li
                  id={`${listboxId}-option-${index}`}
                  key={option.warehouseId}
                  role="option"
                  aria-selected={value?.warehouseId === option.warehouseId}
                  className={index === activeIndex ? "warehouse-selector__option warehouse-selector__option--active" : "warehouse-selector__option"}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <span className="warehouse-selector__name">{option.title}</span>
                  <span className="warehouse-selector__meta">
                    <bdi dir="ltr">{option.code}</bdi>
                    <span>{option.organizationalScope.mode === "company" ? "کل شرکت" : "شعبه"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
