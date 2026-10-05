import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

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
  renderOption?: (option: T) => ReactNode;
}

export function SearchableDropdown<T extends SearchableDropdownOption>({
  value,
  options,
  search,
  onSearchChange,
  onChange,
  label,
  placeholder = "جست‌وجو و انتخاب…",
  emptyText = "موردی یافت نشد.",
  loading = false,
  disabled = false,
  required = false,
  renderOption,
}: Props<T>) {
  const inputId = useId();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  useEffect(() => {
    function handleOutsideMouseDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleOutsideMouseDown);
    };
  }, []);

  useEffect(() => {
    setActiveIndex(options.length ? 0 : -1);
  }, [options]);

  function selectOption(option: T) {
    onChange(option);
    onSearchChange(option.label);
    setIsOpen(false);
  }

  function handleSearchChange(searchValue: string) {
    onSearchChange(searchValue);
    if (value && searchValue !== value.label) {
      onChange(null);
    }
    setIsOpen(true);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setIsOpen(true);
        setActiveIndex(index => Math.min(index + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex(index => Math.max(index - 1, 0));
        break;
      case "Enter": {
        if (isOpen && activeIndex >= 0) {
          const option = options[activeIndex];
          if (option) {
            event.preventDefault();
            selectOption(option);
          }
        }
        break;
      }
      case "Escape":
        setIsOpen(false);
        break;
    }
  }

  function renderPopoverContent() {
    if (loading) {
      return <div className="ui-searchable-dropdown__state">در حال جست‌وجو…</div>;
    }
    if (options.length === 0) {
      return <div className="ui-searchable-dropdown__state">{emptyText}</div>;
    }

    return (
      <ul id={listId} role="listbox">
        {options.map((option, index) => (
          <li
            key={option.id}
            role="option"
            aria-selected={value?.id === option.id}
            className={index === activeIndex ? "is-active" : undefined}
            onMouseDown={event => event.preventDefault()}
            onMouseEnter={() => setActiveIndex(index)}
            onClick={() => selectOption(option)}
          >
            {renderOption ? renderOption(option) : (
              <>
                <strong>{option.label}</strong>
                {option.meta && <small>{option.meta}</small>}
              </>
            )}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="ui-searchable-dropdown" ref={rootRef}>
      <label htmlFor={inputId}>{label}</label>
      <div className="ui-searchable-dropdown__control">
        <input
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listId}
          value={search}
          placeholder={placeholder}
          autoComplete="off"
          disabled={disabled}
          required={required && !value}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onChange={event => handleSearchChange(event.target.value)}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label="باز کردن فهرست"
          disabled={disabled}
          onMouseDown={event => event.preventDefault()}
          onClick={() => setIsOpen(current => !current)}
        >
          ⌄
        </button>
      </div>
      {isOpen && !disabled && (
        <div className="ui-searchable-dropdown__popover">
          {renderPopoverContent()}
        </div>
      )}
    </div>
  );
}
