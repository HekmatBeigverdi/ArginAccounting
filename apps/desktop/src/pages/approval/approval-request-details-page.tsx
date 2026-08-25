import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import type { ApprovalAction, ApprovalRequest, ApprovalStatus } from "@argin/audit";
import { journalVoucherPermissions } from "@argin/accounting/journal";

import {
  desktopDataTopics,
  invalidateDesktopData,
} from "../../app/data-invalidation";
import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button, Field, Textarea } from "../../components/forms";
import { Card, Page, Panel } from "../../components/layout";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAccountingServices } from "../../composition/accounting/accounting-provider";
import { useAuditServices } from "../../composition/audit";

import "../governance/governance-workspace.css";

const statusLabels: Record<ApprovalStatus, string> = {
  draft: "پیش‌نویس",
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
  cancelled: "لغوشده",
};

const actionLabels: Record<ApprovalAction, string> = {
  create: "ایجاد درخواست",
  submit: "ارسال برای تأیید",
  approve: "تأیید",
  reject: "رد",
  "return-to-draft": "بازگشت به پیش‌نویس",
  cancel: "لغو",
  comment: "ثبت یادداشت",
};

type ExecutableApprovalAction = Exclude<ApprovalAction, "create">;

function statusTone(status: ApprovalStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fa-IR-u-ca-persian");
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div className="governance-card-title">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function DefinitionItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function ApprovalRequestDetailsPage() {
  const { id = "" } = useParams();
  const services = useAuditServices();
  const { journalLifecycle } = useAccountingServices();
  const { session } = useAuthSession();
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const permissions = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const hasPermission = (code: string) =>
    permissions.has("system.full-access") || permissions.has(code);

  async function load(): Promise<void> {
    setIsLoading(true);
    setErrorMessage("");
    try {
      setRequest(await services.getApprovalRequest(id));
    } catch {
      setErrorMessage("دریافت جزئیات درخواست تأیید با خطا مواجه شد.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [id]);

  async function execute(action: ExecutableApprovalAction): Promise<void> {
    if (!request || !session) {
      setErrorMessage("برای انجام عملیات باید وارد سامانه شوید.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    const trimmedComment = comment.trim();
    const actor = {
      type: "user" as const,
      id: session.user.id,
      displayName: session.user.displayName,
    };
    const command = {
      approvalRequestId: request.id,
      actor,
      ...(trimmedComment ? { comment: trimmedComment } : {}),
    };

    try {
      let updated: ApprovalRequest;
      const isJournalRequest = isJournalVoucherApproval(request);

      if (
        isJournalRequest &&
        (action === "approve" || action === "reject" || action === "return-to-draft" || action === "cancel")
      ) {
        const companyId = request.scope.companyId;
        if (!companyId) {
          throw new Error("شرکت مرتبط با درخواست تأیید سند مشخص نیست.");
        }
        const lifecycle = await journalLifecycle.get(companyId, request.target.entityId);
        const result = await journalLifecycle.decide({
          context: {
            actorId: session.user.id,
            companyId,
            requestId: crypto.randomUUID(),
            correlationId: crypto.randomUUID(),
            occurredAt: new Date().toISOString(),
          },
          voucherId: request.target.entityId,
          expectedVersion: lifecycle.version,
          expectedApprovalVersion: request.version,
          actor,
          decision:
            action === "return-to-draft"
              ? "return-to-draft"
              : action,
          ...(trimmedComment ? { comment: trimmedComment } : {}),
        });
        updated = result.approvalRequest;
      } else {
        switch (action) {
          case "submit":
            updated = await services.submitApprovalRequest(command);
            break;
          case "approve":
            updated = await services.approveApprovalRequest(command);
            break;
          case "reject":
            updated = await services.rejectApprovalRequest(command);
            break;
          case "return-to-draft":
            updated = await services.returnApprovalRequestToDraft(command);
            break;
          case "cancel":
            updated = await services.cancelApprovalRequest(command);
            break;
          case "comment":
            updated = await services.commentOnApprovalRequest(command);
            break;
        }
      }

      setRequest(updated);
      setComment("");
      invalidateDesktopData(
        desktopDataTopics.approvalRequests,
        desktopDataTopics.auditEntries,
      );
    } catch (error) {
      if (isCommittedLifecycleFailure(error)) {
        try {
          const refreshed = await services.getApprovalRequest(id);
          setRequest(refreshed);
          setComment("");
        } catch {
          // Preserve the original lifecycle failure when the recovery refresh also fails.
        }
        invalidateDesktopData(
          desktopDataTopics.approvalRequests,
          desktopDataTopics.auditEntries,
          desktopDataTopics.journalVouchers,
        );
      }
      setErrorMessage(error instanceof Error ? error.message : "انجام عملیات با خطا مواجه شد.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <Page className="governance-page">
        <Feedback tone="info">در حال دریافت جزئیات درخواست...</Feedback>
      </Page>
    );
  }

  if (!request) {
    return (
      <Page className="governance-page">
        <Feedback tone="error">{errorMessage || "درخواست یافت نشد."}</Feedback>
        <Link className="governance-back-link" to="/approval/requests">
          بازگشت به درخواست‌های تأیید
        </Link>
      </Page>
    );
  }

  const journalRequest = isJournalVoucherApproval(request);
  const canSubmit =
    request.status === "draft" &&
    hasPermission(journalRequest ? journalVoucherPermissions.submit : "approval.requests.submit");
  const canApprove =
    request.status === "pending" &&
    hasPermission(journalRequest ? journalVoucherPermissions.approve : "approval.requests.approve");
  const canReject =
    request.status === "pending" &&
    hasPermission(journalRequest ? journalVoucherPermissions.reject : "approval.requests.reject");
  const canReturnToDraft =
    request.status === "pending" &&
    hasPermission(journalRequest ? journalVoucherPermissions.returnToDraft : "approval.requests.return-to-draft");
  const canCancel =
    ["draft", "pending"].includes(request.status) &&
    hasPermission(journalRequest ? journalVoucherPermissions.cancelApproval : "approval.requests.cancel");
  const canComment = hasPermission("approval.requests.comment");

  return (
    <Page className="governance-page">
      <header className="governance-header">
        <div>
          <p className="governance-eyebrow">کنترل داخلی / جزئیات گردش تأیید</p>
          <h2>{request.title}</h2>
          <p>{request.description ?? "بدون توضیحات"}</p>
        </div>
        <div className="governance-header__actions">
          <Badge tone={statusTone(request.status)}>{statusLabels[request.status]}</Badge>
          <Link className="governance-back-link" to="/approval/requests">
            بازگشت به فهرست
          </Link>
        </div>
      </header>

      {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}

      <div className="governance-detail-grid">
        <Card className="governance-detail-card">
          <SectionTitle
            title="اطلاعات درخواست"
            description="مشخصات ثبت‌شده و وضعیت فعلی گردش."
          />
          <dl className="governance-definition-list">
            <DefinitionItem label="وضعیت">
              <Badge tone={statusTone(request.status)}>{statusLabels[request.status]}</Badge>
            </DefinitionItem>
            <DefinitionItem label="نوع درخواست">
              {journalRequest ? "تأیید سند حسابداری" : request.requestType}
            </DefinitionItem>
            <DefinitionItem label="موجودیت مرتبط">
              {request.target.entityDisplayName ??
                `${request.target.entityType} / ${request.target.entityId}`}
            </DefinitionItem>
            <DefinitionItem label="درخواست‌کننده">{request.requestedBy.displayName}</DefinitionItem>
            <DefinitionItem label="نسخه">{request.version.toLocaleString("fa-IR")}</DefinitionItem>
            <DefinitionItem label="ایجاد">{formatDateTime(request.createdAt)}</DefinitionItem>
            <DefinitionItem label="آخرین تغییر">{formatDateTime(request.updatedAt)}</DefinitionItem>
            {request.decisionComment ? (
              <DefinitionItem label="توضیح تصمیم">{request.decisionComment}</DefinitionItem>
            ) : null}
          </dl>
        </Card>

        <Panel className="governance-action-form">
          <SectionTitle
            title="عملیات مجاز"
            description="عملیات بر اساس وضعیت درخواست و مجوزهای کاربر نمایش داده می‌شوند."
          />
          {journalRequest ? (
            <Feedback tone="info">
              تصمیم‌های این درخواست هم‌زمان وضعیت سند حسابداری و گردش تأیید را به‌صورت اتمیک تغییر می‌دهند.
            </Feedback>
          ) : null}
          <Field label="توضیح یا یادداشت">
            <Textarea
              rows={5}
              value={comment}
              disabled={isSubmitting}
              onChange={(event) => setComment(event.target.value)}
            />
          </Field>
          <div className="governance-actions">
            {canSubmit ? (
              <Button disabled={isSubmitting} variant="primary" onClick={() => void execute("submit")}>
                ارسال برای تأیید
              </Button>
            ) : null}
            {canApprove ? (
              <Button disabled={isSubmitting} variant="primary" onClick={() => void execute("approve")}>
                تأیید
              </Button>
            ) : null}
            {canReject ? (
              <Button disabled={isSubmitting} variant="danger" onClick={() => void execute("reject")}>
                رد
              </Button>
            ) : null}
            {canReturnToDraft ? (
              <Button disabled={isSubmitting} onClick={() => void execute("return-to-draft")}>
                بازگشت به پیش‌نویس
              </Button>
            ) : null}
            {canCancel ? (
              <Button disabled={isSubmitting} variant="danger" onClick={() => void execute("cancel")}>
                لغو
              </Button>
            ) : null}
            {canComment ? (
              <Button
                disabled={isSubmitting || !comment.trim()}
                onClick={() => void execute("comment")}
              >
                ثبت یادداشت
              </Button>
            ) : null}
          </div>
        </Panel>
      </div>

      <Panel>
        <SectionTitle
          title="تاریخچه گردش"
          description="تمام تغییرات ثبت‌شده در درخواست به ترتیب زمانی معکوس."
        />
        <ol className="governance-timeline">
          {[...request.history].reverse().map((entry) => (
            <li key={entry.id}>
              <strong>
                {actionLabels[entry.action]} توسط {entry.actor.displayName}
              </strong>
              <small>
                {entry.fromStatus ? `${statusLabels[entry.fromStatus]} ← ` : ""}
                {statusLabels[entry.toStatus]} — {formatDateTime(entry.occurredAt)}
              </small>
              {entry.comment ? <p>{entry.comment}</p> : null}
            </li>
          ))}
        </ol>
      </Panel>
    </Page>
  );
}

function isJournalVoucherApproval(request: ApprovalRequest): boolean {
  return (
    request.requestType === "accounting.journal-voucher" &&
    request.target.entityType === "accounting.journal-voucher"
  );
}

function isCommittedLifecycleFailure(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const candidate = error as {
    code?: unknown;
    details?: { committed?: unknown };
  };
  return (
    candidate.code === "journal.post-commit-effects-failed" &&
    candidate.details?.committed === true
  );
}
