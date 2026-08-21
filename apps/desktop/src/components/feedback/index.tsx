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
      aria-live={tone === "error" ? "assertive" : "polite"}
      {...props}
    />
  );
}

export interface LoadingStateProps extends ComponentPropsWithoutRef<"div"> {
  children?: ReactNode;
}

export function LoadingState({ children = "در حال بارگذاری…", className = "", ...props }: LoadingStateProps) {
  return (
    <div
      className={`ui-state ui-state--loading ${className}`.trim()}
      role="status"
      aria-live="polite"
      aria-busy="true"
      {...props}
    >
      <span className="ui-state__spinner" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}

export interface EmptyStateProps extends ComponentPropsWithoutRef<"div"> {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
}

export function EmptyState({ title, description, action, className = "", ...props }: EmptyStateProps) {
  return (
    <div className={`ui-state ui-state--empty ${className}`.trim()} role="status" {...props}>
      <strong className="ui-state__title">{title}</strong>
      {description ? <p className="ui-state__description">{description}</p> : null}
      {action ? <div className="ui-state__action">{action}</div> : null}
    </div>
  );
}

export interface ErrorStateProps extends ComponentPropsWithoutRef<"div"> {
  title?: ReactNode;
  children: ReactNode;
  technicalDetails?: ReactNode;
  action?: ReactNode;
}

export function ErrorState({
  title = "انجام عملیات ممکن نشد",
  children,
  technicalDetails,
  action,
  className = "",
  ...props
}: ErrorStateProps) {
  return (
    <div className={`ui-state ui-state--error ${className}`.trim()} role="alert" aria-live="assertive" {...props}>
      <strong className="ui-state__title">{title}</strong>
      <div className="ui-state__description">{children}</div>
      {technicalDetails ? (
        <details className="ui-state__technical">
          <summary>جزئیات فنی</summary>
          <pre dir="ltr">{technicalDetails}</pre>
        </details>
      ) : null}
      {action ? <div className="ui-state__action">{action}</div> : null}
    </div>
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
