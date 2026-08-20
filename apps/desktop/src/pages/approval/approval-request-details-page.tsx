import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";

import type { ApprovalAction, ApprovalRequest, ApprovalStatus } from "@argin/audit";

import { Badge } from "../../components/data-display";
import { Feedback } from "../../components/feedback";
import { Button, Field, Textarea } from "../../components/forms";
import { Card, Page, Panel } from "../../components/layout";
import { useAuthSession } from "../../app/providers/auth-session-provider";
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

function statusTone(status: ApprovalStatus) {
  if (status === "approved") return "success" as const;
  if (status === "pending") return "warning" as const;
  if (status === "rejected" || status === "cancelled") return "danger" as const;
  return "neutral" as const;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("fa-IR-u-ca-persian");
}

export function ApprovalRequestDetailsPage() {
  const { id = "" } = useParams();
  const services = useAuditServices();
  const { session } = useAuthSession();
  const [request, setRequest] = useState<ApprovalRequest | null>(null);
  const [comment, setComment] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const permissions = useMemo(() => new Set(session?.user.permissions ?? []), [session]);
  const hasPermission = (code: string) => permissions.has("system.full-access") || permissions.has(code);

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

  useEffect(() => { void load(); }, [id]);

  async function execute(action: Exclude<ApprovalAction, "create">): Promise<void> {
    if (!request || !session) {
      setErrorMessage("برای انجام عملیات باید وارد سامانه شوید.");
      return;
    }
    setIsSubmitting(true);
    setErrorMessage("");
    const command = {
      approvalRequestId: request.id,
      actor: { type: "user" as const, id: session.user.id, displayName: session.user.displayName },
      ...(comment.trim() ? { comment: comment.trim() } : {}),
    };
    try {
      const updated = action === "submit" ? await services.submitApprovalRequest(command)
        : action === "approve" ? await services.approveApprovalRequest(command)
        : action === "reject" ? await services.rejectApprovalRequest(command)
        : action === "return-to-draft" ? await services.returnApprovalRequestToDraft(command)
        : action === "cancel" ? await services.cancelApprovalRequest(command)
        : await services.commentOnApprovalRequest(command);
      setRequest(updated);
      setComment("");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "انجام عملیات با خطا مواجه شد.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return <Page className="governance-page"><Feedback tone="info">در حال دریافت جزئیات درخواست...</Feedback></Page>;
  }

  if (!request) {
    return (
      <Page className="governance-page">
        <Feedback tone="error">{errorMessage || "درخواست یافت نشد."}</Feedback>
        <Link className="governance-back-link" to="/approval/requests">بازگشت به درخواست‌های تأیید</Link>
      </Page>
    );
  }

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
          <Link className="governance-back-link" to="/approval/requests">بازگشت به فهرست</Link>
        </div>
      </header>

      {errorMessage ? <Feedback tone="error">{errorMessage}</Feedback> : null}

      <div className="governance-detail-grid">
        <Card className="governance-detail-card">
          <div className="governance-card-title"><div><h3>اطلاعات درخواست</h3><p>مشخصات ثبت‌شده و وضعیت فعلی گردش.</p></div></div>
          <dl className="governance-definition-list">
            <div><dt>وضعیت</dt><dd><Badge tone={statusTone(request.status)}>{statusLabels[request.status]}</Badge></dd></div>
            <div><dt>نوع درخواست</dt><dd>{request.requestType}</dd></div>
            <div><dt>موجودیت مرتبط</dt><dd>{request.target.entityDisplayName ?? `${request.target.entityType} / ${request.target.entityId}`}</dd></div>
            <div><dt>درخواست‌کننده</dt><dd>{request.requestedBy.displayName}</dd></div>
            <div><dt>نسخه</dt><dd>{request.version.toLocaleString("fa-IR")}</dd></div>
            <div><dt>ایجاد</dt><dd>{formatDateTime(request.createdAt)}</dd></div>
            <div><dt>آخرین تغییر</dt><dd>{formatDateTime(request.updatedAt)}</dd></div>
            {request.decisionComment ? <div><dt>توضیح تصمیم</dt><dd>{request.decisionComment}</dd></div> : null}
          </dl>
        </Card>

        <Panel className="governance-action-form">
          <div className="governance-card-title"><div><h3>عملیات مجاز</h3><p>عملیات بر اساس وضعیت درخواست و مجوزهای کاربر نمایش داده می‌شوند.</p></div></div>
          <Field label="توضیح یا یادداشت">
            <Textarea rows={5} value={comment} disabled={isSubmitting} onChange={(event) => setComment(event.target.value)} />
          </Field>
          <div className="governance-actions">
            {request.status === "draft" && hasPermission("approval.requests.submit") ? <Button disabled={isSubmitting} variant="primary" onClick={() => void execute("submit")}>ارسال برای تأیید</Button> : null}
            {request.status === "pending" && hasPermission("approval.requests.approve") ? <Button disabled={isSubmitting} variant="primary" onClick={() => void execute("approve")}>تأیید</Button> : null}
            {request.status === "pending" && hasPermission("approval.requests.reject") ? <Button disabled={isSubmitting} variant="danger" onClick={() => void execute("reject")}>رد</Button> : null}
            {request.status === "pending" && hasPermission("approval.requests.return-to-draft") ? <Button disabled={isSubmitting} onClick={() => void execute("return-to-draft")}>بازگشت به پیش‌نویس</Button> : null}
            {(request.status === "draft" || request.status === "pending") && hasPermission("approval.requests.cancel") ? <Button disabled={isSubmitting} variant="danger" onClick={() => void execute("cancel")}>لغو</Button> : null}
            {hasPermission("approval.requests.comment") ? <Button disabled={isSubmitting || !comment.trim()} onClick={() => void execute("comment")}>ثبت یادداشت</Button> : null}
          </div>
        </Panel>
      </div>

      <Panel>
        <div className="governance-card-title"><div><h3>تاریخچه گردش</h3><p>تمام تغییرات ثبت‌شده در درخواست به ترتیب زمانی معکوس.</p></div></div>
        <ol className="governance-timeline">
          {[...request.history].reverse().map((entry) => (
            <li key={entry.id}>
              <strong>{actionLabels[entry.action]} توسط {entry.actor.displayName}</strong>
              <small>{entry.fromStatus ? `${statusLabels[entry.fromStatus]} ← ` : ""}{statusLabels[entry.toStatus]} — {formatDateTime(entry.occurredAt)}</small>
              {entry.comment ? <p>{entry.comment}</p> : null}
            </li>
          ))}
        </ol>
      </Panel>
    </Page>
  );
}
