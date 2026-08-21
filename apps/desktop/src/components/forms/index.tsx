import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

export type ButtonVariant = "default" | "primary" | "danger" | "ghost";

export interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  compact?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    { variant = "default", compact = false, className = "", ...props },
    ref,
  ) {
    const classes = [
      "ui-button",
      variant !== "default" ? `ui-button--${variant}` : "",
      compact ? "ui-button--compact" : "",
      className,
    ].filter(Boolean).join(" ");

    return <button ref={ref} className={classes} {...props} />;
  },
);

export const Input = forwardRef<HTMLInputElement, ComponentPropsWithoutRef<"input">>(
  function Input({ className = "", ...props }, ref) {
    return <input ref={ref} className={`ui-input ${className}`.trim()} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, ComponentPropsWithoutRef<"select">>(
  function Select({ className = "", ...props }, ref) {
    return <select ref={ref} className={`ui-select ${className}`.trim()} {...props} />;
  },
);

export const Textarea = forwardRef<HTMLTextAreaElement, ComponentPropsWithoutRef<"textarea">>(
  function Textarea({ className = "", ...props }, ref) {
    return <textarea ref={ref} className={`ui-textarea ${className}`.trim()} {...props} />;
  },
);

export interface FieldProps {
  label: ReactNode;
  children: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
}

export function Field({ label, children, hint, error, className = "" }: FieldProps) {
  return (
    <label className={`ui-field ${className}`.trim()}>
      <span className="ui-field__label">{label}</span>
      {children}
      {error ? <span className="ui-field__error">{error}</span> : null}
      {!error && hint ? <span className="ui-field__hint">{hint}</span> : null}
    </label>
  );
}

export {
  PersianDatePicker,
  gregorianIsoToPersian,
  persianToGregorianIso,
} from "./persian-date-picker";
