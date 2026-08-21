import { useMemo, useState } from "react";
import type {
  CodingTemplatePreviewAction,
  CodingTemplatePreviewPlan,
  CodingTemplateVersionContent,
} from "@argin/accounting";
import { Button } from "../../components/forms";
import {
  buildCodingTemplateAccountTree,
  codingTemplateAccountLabel,
  codingTemplateIssueAction,
  codingTemplateIssueMessage,
  codingTemplateLabel,
  type CodingTemplateAccountTreeNode,
} from "../../features/accounting/coding-templates-presenter";

type PreviewFilter = "all" | "changes" | "conflicts";

const previewFilters: readonly [PreviewFilter, string][] = [
  ["all", "همه حساب‌ها"],
  ["changes", "تغییرات"],
  ["conflicts", "فقط تعارض‌ها"],
];

interface Props {
  readonly content: Readonly<CodingTemplateVersionContent>;
  readonly preview: Readonly<CodingTemplatePreviewPlan>;
}

function isActionVisible(
  action: CodingTemplatePreviewAction,
  filter: PreviewFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "changes") {
    return action !== "compatible_existing" && action !== "skipped";
  }
  return action === "conflict" || action === "invalid";
}

function hasVisibleNode(
  node: CodingTemplateAccountTreeNode,
  filter: PreviewFilter,
): boolean {
  return (
    isActionVisible(node.action, filter) ||
    node.children.some((child) => hasVisibleNode(child, filter))
  );
}

function accountLevelInitial(
  level: CodingTemplateAccountTreeNode["account"]["level"],
): string {
  if (level === "group") return "گ";
  if (level === "general") return "ک";
  return "م";
}

function IssueResolution({
  issue,
}: {
  readonly issue: CodingTemplatePreviewPlan["issues"][number];
}) {
  return (
    <div className="coding-tree__resolution">
      <strong>{codingTemplateIssueMessage(issue.code)}</strong>
      <span>{codingTemplateIssueAction(issue)}</span>
    </div>
  );
}

function AccountNode({
  node,
  filter,
}: {
  readonly node: CodingTemplateAccountTreeNode;
  readonly filter: PreviewFilter;
}) {
  const children = node.children.filter((child) =>
    hasVisibleNode(child, filter),
  );
  const shouldRender =
    isActionVisible(node.action, filter) || children.length > 0;

  if (!shouldRender) return null;

  return (
    <li className={`coding-tree__item coding-tree__item--${node.action}`}>
      <details open={filter !== "all" || node.account.level === "group"}>
        <summary>
          <span className="coding-tree__level" aria-hidden="true">
            {accountLevelInitial(node.account.level)}
          </span>
          <span className="coding-tree__code" dir="ltr">
            {node.account.code}
          </span>
          <strong>{node.account.persianName}</strong>
          <span className="coding-tree__meta">
            {codingTemplateAccountLabel(node.account.level)} ·{" "}
            {codingTemplateAccountLabel(node.account.nature)}
          </span>
          <span
            className={`coding-tree__status coding-tree__status--${node.action}`}
          >
            {codingTemplateLabel(node.action)}
          </span>
        </summary>

        {node.issues.map((issue, index) => (
          <IssueResolution issue={issue} key={`${issue.code}-${index}`} />
        ))}

        {children.length > 0 ? (
          <ul>
            {children.map((child) => (
              <AccountNode
                key={child.account.logicalKey}
                node={child}
                filter={filter}
              />
            ))}
          </ul>
        ) : null}
      </details>
    </li>
  );
}

export function CodingTemplatePreviewTree({ content, preview }: Props) {
  const [filter, setFilter] = useState<PreviewFilter>("all");
  const tree = useMemo(
    () => buildCodingTemplateAccountTree(content.accounts, preview),
    [content.accounts, preview],
  );
  const visibleNodes = tree.filter((node) => hasVisibleNode(node, filter));
  const nonAccountIssues = preview.issues.filter(
    (issue) => issue.itemType !== "account",
  );

  return (
    <div className="coding-tree">
      <div className="coding-tree__heading">
        <div>
          <h3>ساختار درختی حساب‌ها</h3>
          <p className="muted">
            سطح، کد، ماهیت و وضعیت هر شاخه را پیش از اعمال بررسی کنید.
          </p>
        </div>
        <div
          className="coding-tree__filters"
          role="group"
          aria-label="فیلتر پیش‌نمایش"
        >
          {previewFilters.map(([value, label]) => (
            <Button type="button" compact
              key={value}
              className={filter === value ? "is-active" : ""}
              onClick={() => setFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {preview.issues.length > 0 ? (
        <div className="coding-tree__guidance" role="alert">
          <strong>این الگو فعلاً قابل اعمال نیست.</strong>
          <span>
            موارد قرمز را طبق اقدام پیشنهادی اصلاح کنید و سپس دوباره «پیش‌نمایش
            روی شرکت» را بزنید.
          </span>
        </div>
      ) : null}

      {visibleNodes.length > 0 ? (
        <ul className="coding-tree__root">
          {visibleNodes.map((node) => (
            <AccountNode
              key={node.account.logicalKey}
              node={node}
              filter={filter}
            />
          ))}
        </ul>
      ) : (
        <p className="muted">در این فیلتر موردی برای نمایش وجود ندارد.</p>
      )}

      {nonAccountIssues.length > 0 ? (
        <section className="coding-tree__other-issues">
          <h3>موارد ابعاد حسابداری</h3>
          {nonAccountIssues.map((issue, index) => (
            <div
              className="coding-tree__resolution"
              key={`${issue.logicalKey}-${index}`}
            >
              <strong>{codingTemplateIssueMessage(issue.code)}</strong>
              <span>{codingTemplateIssueAction(issue)}</span>
              <code dir="ltr">{issue.logicalKey}</code>
            </div>
          ))}
        </section>
      ) : null}
    </div>
  );
}
