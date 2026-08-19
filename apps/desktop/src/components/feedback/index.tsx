import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

export type FeedbackTone = "info" | "success" | "warning" | "error";

export interface FeedbackProps extends ComponentPropsWithoutRef<"div"> {
  tone?: FeedbackTone;
}

export function Feedback({ tone = "info", className = "", ...props }: FeedbackProps) {
  return (
    <div
      className={`ui-feedback ui-feedback--${tone} ${className}`.trim()}
      role={tone === "error" ? "alert" : "status"}
      {...props}
    />
  );
}

export interface DialogProps {
  open: boolean;
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  labelledBy?: string;
}

export function Dialog({
  open,
  title,
  children,
  footer,
  onClose,
  labelledBy = "ui-dialog-title",
}: DialogProps) {
  if (!open) return null;

  return (
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) onClose();
      }}
    >
      <section
        className="ui-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
      >
        <header className="ui-dialog__header">
          <h2 id={labelledBy}>{title}</h2>
        </header>
        <div className="ui-dialog__body">{children}</div>
        {footer ? <footer className="ui-dialog__footer">{footer}</footer> : null}
      </section>
    </div>
  );
}
