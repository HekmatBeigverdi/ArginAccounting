import {
  useDeferredValue,
  useEffect,
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent
} from "react";
import {
  buildPartySelectorQuery,
  toPartySelectionReference,
  type PartyReader,
  type PartyRole,
  type PartySelectionReference,
  type PartySelectorDto,
  type PartyStatus
} from "@argin/party";

import "./party-selector.css";

const defaultRoles: readonly PartyRole[] = Object.freeze([]);
const defaultStatuses: readonly PartyStatus[] = Object.freeze(["active"]);

export interface PartySelectorProps {
  readonly reader: Pick<PartyReader, "select">;
  readonly companyId: string | null;
  readonly value: PartySelectionReference | null;
  readonly onChange: (value: PartySelectionReference | null) => void;
  readonly roles?: readonly PartyRole[];
  readonly statuses?: readonly PartyStatus[];
  readonly limit?: number;
  readonly label?: string;
  readonly placeholder?: string;
  readonly disabled?: boolean;
  readonly required?: boolean;
  readonly allowClear?: boolean;
  readonly onError?: (error: unknown) => void;
}

export function PartySelector({
  reader,
  companyId,
  value,
  onChange,
  roles = defaultRoles,
  statuses = defaultStatuses,
  limit = 20,
  label = "شخص",
  placeholder = "کد یا نام شخص...",
  disabled = false,
  required = false,
  allowClear = true,
  onError
}: PartySelectorProps) {
  const inputId = useId();
  const listboxId = useId();
  const requestId = useRef(0);
  const [search, setSearch] = useState(value?.displayName ?? "");
  const deferredSearch = useDeferredValue(search);
  const [options, setOptions] = useState<readonly PartySelectorDto[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rolesKey = roles.join("|");
  const statusesKey = statuses.join("|");

  useEffect(() => {
    setSearch(value?.displayName ?? "");
  }, [value?.partyId, value?.displayName]);

  useEffect(() => {
    if (!open || disabled || !companyId) return undefined;
    const currentRequest = requestId.current + 1;
    requestId.current = currentRequest;
    setLoading(true);

    void reader
      .select(
        buildPartySelectorQuery(companyId, deferredSearch, {
          roles,
          statuses,
          limit
        })
      )
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
  }, [companyId, deferredSearch, disabled, limit, onError, open, reader, rolesKey, statusesKey]);

  function choose(option: PartySelectorDto): void {
    const reference = toPartySelectionReference(option);
    onChange(reference);
    setSearch(reference.displayName);
    setOpen(false);
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>): void {
    const next = event.target.value;
    setSearch(next);
    setOpen(true);
    if (value && next !== value.displayName) onChange(null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((current) =>
        options.length === 0 ? -1 : Math.min(current + 1, options.length - 1)
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        options.length === 0 ? -1 : Math.max(current - 1, 0)
      );
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

  const activeOptionId = activeIndex >= 0
    ? `${listboxId}-option-${activeIndex}`
    : undefined;

  return (
    <div className="party-selector">
      <label className="party-selector__label" htmlFor={inputId}>{label}</label>
      <div className="party-selector__control">
        <input
          id={inputId}
          className="party-selector__input"
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
        {allowClear && value && !disabled && (
          <button
            type="button"
            className="party-selector__clear"
            aria-label="پاک‌کردن شخص انتخاب‌شده"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              onChange(null);
              setSearch("");
              setOpen(true);
            }}
          >×</button>
        )}
      </div>

      {open && !disabled && companyId && (
        <div className="party-selector__popover">
          {loading ? (
            <div className="party-selector__state" role="status">در حال جستجو…</div>
          ) : options.length === 0 ? (
            <div className="party-selector__state">شخصی یافت نشد.</div>
          ) : (
            <ul id={listboxId} className="party-selector__list" role="listbox">
              {options.map((option, index) => (
                <li
                  id={`${listboxId}-option-${index}`}
                  key={option.id}
                  role="option"
                  aria-selected={value?.partyId === option.id}
                  className={index === activeIndex ? "party-selector__option party-selector__option--active" : "party-selector__option"}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => choose(option)}
                >
                  <span className="party-selector__name">{option.displayName}</span>
                  <span className="party-selector__meta">
                    <bdi>{option.code}</bdi>
                    <span>{option.classification === "natural-person" ? "حقیقی" : "حقوقی"}</span>
                    {option.roles.length > 0 && (
                      <span>{option.roles.map((role) => role === "customer" ? "مشتری" : "تأمین‌کننده").join("، ")}</span>
                    )}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
