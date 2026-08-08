import { useMemo, useState } from "react";
import type {
  CodingTemplatePreviewAction,
  CodingTemplatePreviewPlan,
  CodingTemplateVersionContent,
} from "@argin/accounting";
import {
  buildCodingTemplateAccountTree,
  codingTemplateAccountLabel,
  codingTemplateIssueAction,
  codingTemplateIssueMessage,
  codingTemplateLabel,
  type CodingTemplateAccountTreeNode,
} from "../../features/accounting/coding-templates-presenter";

type PreviewFilter = "all" | "changes" | "conflicts";

interface Props {
  readonly content: Readonly<CodingTemplateVersionContent>;
  readonly preview: Readonly<CodingTemplatePreviewPlan>;
}

const visibleAction = (action: CodingTemplatePreviewAction, filter: PreviewFilter): boolean =>
  filter === "all" ||
  (filter === "changes" && action !== "compatible_existing" && action !== "skipped") ||
  (filter === "conflicts" && (action === "conflict" || action === "invalid"));

function hasVisibleNode(node: CodingTemplateAccountTreeNode, filter: PreviewFilter): boolean {
  return visibleAction(node.action, filter) || node.children.some((child) => hasVisibleNode(child, filter));
}

function AccountNode({ node, filter }: { readonly node: CodingTemplateAccountTreeNode; readonly filter: PreviewFilter }) {
  const children = node.children.filter((child) => hasVisibleNode(child, filter));
  if (!visibleAction(node.action, filter) && children.length === 0) return null;
  return <li className={`coding-tree__item coding-tree__item--${node.action}`}>
    <details open={filter !== "all" || node.account.level === "group"}>
      <summary>
        <span className="coding-tree__code" dir="ltr">{node.account.code}</span>
        <strong>{node.account.persianName}</strong>
        <span className="coding-tree__meta">{codingTemplateAccountLabel(node.account.level)} · {codingTemplateAccountLabel(node.account.nature)}</span>
        <span className={`coding-tree__status coding-tree__status--${node.action}`}>{codingTemplateLabel(node.action)}</span>
      </summary>
      {node.issues.map((issue, index) => <div className="coding-tree__resolution" key={`${issue.code}-${index}`}>
        <strong>{codingTemplateIssueMessage(issue.code)}</strong>
        <span>{codingTemplateIssueAction(issue)}</span>
      </div>)}
      {children.length > 0 && <ul>{children.map((child) => <AccountNode key={child.account.logicalKey} node={child} filter={filter}/>)}</ul>}
    </details>
  </li>;
}

export function CodingTemplatePreviewTree({ content, preview }: Props) {
  const [filter, setFilter] = useState<PreviewFilter>("all");
  const tree = useMemo(() => buildCodingTemplateAccountTree(content.accounts, preview), [content.accounts, preview]);
  const visible = tree.filter((node) => hasVisibleNode(node, filter));
  const nonAccountIssues = preview.issues.filter((issue) => issue.itemType !== "account");

  return <div className="coding-tree">
    <div className="coding-tree__heading">
      <div><h3>ساختار درختی حساب‌ها</h3><p className="muted">شاخه‌ها را باز کنید و وضعیت هر حساب را پیش از اعمال بررسی کنید.</p></div>
      <div className="coding-tree__filters" role="group" aria-label="فیلتر پیش‌نمایش">
        {([['all', 'همه حساب‌ها'], ['changes', 'تغییرات'], ['conflicts', 'فقط تعارض‌ها']] as const).map(([value, label]) =>
          <button key={value} className={filter === value ? "is-active" : ""} onClick={() => setFilter(value)}>{label}</button>)}
      </div>
    </div>
    {preview.issues.length > 0 && <div className="coding-tree__guidance" role="alert">
      <strong>این الگو فعلاً قابل اعمال نیست.</strong>
      <span>موارد قرمز را طبق اقدام پیشنهادی اصلاح کنید و سپس دوباره «پیش‌نمایش روی شرکت» را بزنید.</span>
    </div>}
    {visible.length > 0 ? <ul className="coding-tree__root">{visible.map((node) => <AccountNode key={node.account.logicalKey} node={node} filter={filter}/>)}</ul> : <p className="muted">در این فیلتر موردی برای نمایش وجود ندارد.</p>}
    {nonAccountIssues.length > 0 && <section className="coding-tree__other-issues"><h3>موارد ابعاد حسابداری</h3>{nonAccountIssues.map((issue, index) => <div className="coding-tree__resolution" key={`${issue.logicalKey}-${index}`}><strong>{codingTemplateIssueMessage(issue.code)}</strong><span>{codingTemplateIssueAction(issue)}</span><code dir="ltr">{issue.logicalKey}</code></div>)}</section>}
  </div>;
}
