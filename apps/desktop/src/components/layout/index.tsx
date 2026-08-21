import type {
  ComponentPropsWithoutRef,
  ReactNode,
} from "react";

export function Page({ className = "", ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={`ui-page ${className}`.trim()} {...props} />;
}

export function Stack({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`ui-stack ${className}`.trim()} {...props} />;
}

export function Panel({ className = "", ...props }: ComponentPropsWithoutRef<"section">) {
  return <section className={`ui-panel ${className}`.trim()} {...props} />;
}

export interface CardProps extends ComponentPropsWithoutRef<"section"> {
  header?: ReactNode;
}

export function Card({ header, children, className = "", ...props }: CardProps) {
  return (
    <section className={`ui-card ${className}`.trim()} {...props}>
      {header ? <header className="ui-card__header">{header}</header> : null}
      <div className="ui-card__body">{children}</div>
    </section>
  );
}

export function Toolbar({ className = "", ...props }: ComponentPropsWithoutRef<"div">) {
  return <div className={`ui-toolbar ${className}`.trim()} role="toolbar" {...props} />;
}
