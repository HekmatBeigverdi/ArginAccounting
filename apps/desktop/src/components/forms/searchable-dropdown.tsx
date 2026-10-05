import { createPortal } from "react-dom";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";

export interface SearchableDropdownOption {
  readonly id: string;
  readonly label: string;
  readonly meta?: string;
}

interface Props<T extends SearchableDropdownOption> {
  value: T | null;
  options: readonly T[];
  search: string;
  onSearchChange(value: string): void;
  onChange(value: T | null): void;
  label: string;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  required?: boolean;
  allowClear?: boolean;
  renderOption?: (option: T) => ReactNode;
}

interface PopupPosition {
  left: number;
  top: number;
  width: number;
  maxHeight: number;
  placement: "bottom" | "top";
}

const Chevron = ({ isOpen }: { isOpen: boolean }) => (
  <svg className={isOpen ? "is-open" : undefined} viewBox="0 0 20 20" aria-hidden="true">
    <path d="m6 8 4 4 4-4" />
  </svg>
);
const SearchIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <circle cx="8.5" cy="8.5" r="5.5" />
    <path d="m13 13 4 4" />
  </svg>
);
const CheckIcon = () => (
  <svg viewBox="0 0 20 20" aria-hidden="true">
    <path d="m4 10 3.5 3.5L16 5.5" />
  </svg>
);

export function SearchableDropdown<T extends SearchableDropdownOption>({
  value,
  options,
  search,
  onSearchChange,
  onChange,
  label,
  placeholder = "انتخاب کنید…",
  emptyText = "موردی یافت نشد.",
  loading = false,
  disabled = false,
  required = false,
  allowClear = true,
  renderOption,
}: Props<T>) {
  const controlId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState<PopupPosition | null>(null);

  const positionPopup = useCallback(() => {
    const triggerBounds = triggerRef.current?.getBoundingClientRect();
    if (!triggerBounds) {
      return;
    }
    const popupGap = 6;
    const viewportPadding = 12;
    const preferredHeight = 310;
    const spaceBelow = window.innerHeight - triggerBounds.bottom - viewportPadding - popupGap;
    const spaceAbove = triggerBounds.top - viewportPadding - popupGap;
    const placement =
      spaceBelow >= Math.min(220, preferredHeight) || spaceBelow >= spaceAbove ? "bottom" : "top";
    const availableHeight = Math.max(120, placement === "bottom" ? spaceBelow : spaceAbove);
    const maxHeight = Math.min(preferredHeight, availableHeight);
    const width = Math.max(triggerBounds.width, 280);
    const left = Math.min(
      Math.max(viewportPadding, triggerBounds.left),
      Math.max(viewportPadding, window.innerWidth - width - viewportPadding),
    );
    const top =
      placement === "bottom"
        ? triggerBounds.bottom + popupGap
        : Math.max(viewportPadding, triggerBounds.top - popupGap - maxHeight);
    setPosition({ left, top, width, maxHeight, placement });
  }, []);

  useEffect(() => {
    const handleOutsideMouseDown = (event: MouseEvent) => {
      const node = event.target as Node;
      if (!rootRef.current?.contains(node) && !popupRef.current?.contains(node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => document.removeEventListener("mousedown", handleOutsideMouseDown);
  }, []);

  useEffect(() => {
    setActiveIndex(options.length ? 0 : -1);
  }, [options]);

  useLayoutEffect(() => {
    if (!isOpen) {
      return;
    }
    positionPopup();
    const updatePosition = () => positionPopup();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [isOpen, positionPopup]);

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchRef.current?.focus());
    }
  }, [isOpen]);

  function selectOption(option: T) {
    onChange(option);
    onSearchChange("");
    setIsOpen(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => Math.min(index + 1, options.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      const option = options[activeIndex];
      if (option) {
        event.preventDefault();
        selectOption(option);
      }
    } else if (event.key === "Escape") {
      event.preventDefault();
      setIsOpen(false);
      triggerRef.current?.focus();
    }
  }

  function renderPopupContent() {
    if (loading) {
      return (
        <div className="ui-combobox__state">
          <span className="ui-combobox__spinner" />
          در حال جست‌وجو…
        </div>
      );
    }
    if (options.length === 0) {
      return <div className="ui-combobox__state">{emptyText}</div>;
    }
    return (
      <ul id={listId} role="listbox">
        {options.map((option, index) => {
          const selected = value?.id === option.id;
          return (
            <li
              key={option.id}
              role="option"
              aria-selected={selected}
              className={[index === activeIndex ? "is-active" : "", selected ? "is-selected" : ""]
                .filter(Boolean)
                .join(" ")}
              onMouseDown={(event) => event.preventDefault()}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => selectOption(option)}
            >
              <span className="ui-combobox__option-content">
                {renderOption ? (
                  renderOption(option)
                ) : (
                  <>
                    <strong>{option.label}</strong>
                    {option.meta && <small>{option.meta}</small>}
                  </>
                )}
              </span>
              <span className="ui-combobox__check">{selected && <CheckIcon />}</span>
            </li>
          );
        })}
      </ul>
    );
  }

  const popupNode =
    isOpen && !disabled && position ? (
      <div
        ref={popupRef}
        className={"ui-combobox__popover is-" + position.placement}
        style={{
          position: "fixed",
          left: position.left,
          top: position.top,
          width: position.width,
          maxHeight: position.maxHeight,
        }}
      >
        <div className="ui-combobox__search">
          <SearchIcon />
          <input
            ref={searchRef}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={listId}
            value={search}
            placeholder="جست‌وجو…"
            autoComplete="off"
            onChange={(event) => onSearchChange(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </div>
        <div
          className="ui-combobox__body"
          style={{ maxHeight: Math.max(80, position.maxHeight - 58) }}
        >
          {renderPopupContent()}
        </div>
      </div>
    ) : null;

  return (
    <div className="ui-combobox" ref={rootRef}>
      <label className="ui-combobox__label" htmlFor={controlId}>
        {label}
      </label>
      <button
        ref={triggerRef}
        id={controlId}
        type="button"
        className="ui-combobox__trigger"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => setIsOpen((current) => !current)}
      >
        <span className={value ? "ui-combobox__value" : "ui-combobox__placeholder"}>
          {value?.label ?? placeholder}
        </span>
        <span className="ui-combobox__actions">
          {allowClear && value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              className="ui-combobox__clear"
              aria-label="پاک کردن انتخاب"
              onClick={(event) => {
                event.stopPropagation();
                onChange(null);
                onSearchChange("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  event.stopPropagation();
                  onChange(null);
                  onSearchChange("");
                }
              }}
            >
              ×
            </span>
          )}
          <span className="ui-combobox__separator" />
          <span className="ui-combobox__chevron">
            <Chevron isOpen={isOpen} />
          </span>
        </span>
      </button>
      {required && !value && (
        <input
          className="ui-combobox__required-proxy"
          tabIndex={-1}
          aria-hidden="true"
          required
          value=""
          onChange={() => {}}
        />
      )}
      {/* Keep the popup in the modal's top layer, outside any scrolling form fields. */}
      {popupNode && createPortal(popupNode, rootRef.current?.closest("dialog") ?? document.body)}
    </div>
  );
}
