import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

export interface BadgeProps extends ComponentPropsWithoutRef<"span"> {
  tone?: BadgeTone;
}

export function Badge({ tone = "neutral", className = "", ...props }: BadgeProps) {
  const toneClass = tone === "neutral" ? "" : `ui-badge--${tone}`;
  return <span className={["ui-badge", toneClass, className].filter(Boolean).join(" ")} {...props} />;
}

export interface DataTableProps extends ComponentPropsWithoutRef<"table"> {
  wrapperClassName?: string;
  caption?: ReactNode;
}

export function DataTable({ wrapperClassName = "", className = "", caption, children, ...props }: DataTableProps) {
  return (
    <div className={`ui-table-wrap ${wrapperClassName}`.trim()}>
      <table className={`ui-table ${className}`.trim()} {...props}>
        {caption ? <caption>{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}
