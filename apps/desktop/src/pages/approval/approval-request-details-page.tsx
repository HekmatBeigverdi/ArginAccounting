import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import type { ApprovalAction, ApprovalRequest, ApprovalStatus } from "@argin/audit";
import { useAuthSession } from "../../app/providers/auth-session-provider";
import { useAuditServices } from "../../composition/audit";
import "./approval-pages.css";

const statusLabels: Record<ApprovalStatus, string> = {
  draft: "پیش‌نویس",
  pending: "در انتظار تأیید",
  approved: "تأییدشده",
  rejected: "ردشده",
  cancelled: "لغوشده"
};

const actionLabels: Record<ApprovalAction, string> = {
  create: "ایجاد درخواست",
  submit: "ارسال برای تأیید",
  approve: "تأیید",
  reject: "رد",
  "return-to-draft": "بازگشت به پیش‌نویس",
  cancel: "لغو",
  comment: "ثبت یادداشت"
};

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
    } catch (error) {
      console.error(error);
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
      ...(comment.trim() ? { comment: comment.trim() } : {})
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
      console.error(error);
      setErrorMessage(error instanceof Error ? error.message : "انجام عملیات با خطا مواجه شد.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) return <section className="temporary-page"><p>در حال دریافت اطلاعات...</p></section>;
  if (!request) return <section className="temporary-page approval-page"><p className="approval-message approval-message--error">{errorMessage || "درخواست یافت نشد."}</p><Link to="/approval/requests">بازگشت</Link></section>;

  return (
    <section className="temporary-page approval-page">
      <header className="approval-page__header">
        <div><h1>{request.title}</h1><p>{request.description ?? "بدون توضیحات"}</p></div>
        <Link to="/approval/requests">بازگشت به فهرست</Link>
      </header>

      {errorMessage && <p className="approval-message approval-message--error">{errorMessage}</p>}

      <div className="approval-grid">
        <article className="approval-card">
          <h2>اطلاعات درخواست</h2>
          <dl className="approval-detail-list">
            <dt>وضعیت</dt><dd><span className="approval-status">{statusLabels[request.status]}</span></dd>
            <dt>نوع درخواست</dt><dd>{request.requestType}</dd>
            <dt>موجودیت مرتبط</dt><dd>{request.target.entityDisplayName ?? `${request.target.entityType} / ${request.target.entityId}`}</dd>
            <dt>درخواست‌کننده</dt><dd>{request.requestedBy.displayName}</dd>
            <dt>نسخه</dt><dd>{request.version}</dd>
            <dt>ایجاد</dt><dd>{new Date(request.createdAt).toLocaleString("fa-IR")}</dd>
            <dt>آخرین تغییر</dt><dd>{new Date(request.updatedAt).toLocaleString("fa-IR")}</dd>
            {request.decisionComment && <><dt>توضیح تصمیم</dt><dd>{request.decisionComment}</dd></>}
          </dl>
        </article>

        <article className="approval-card approval-action-form">
          <h2>عملیات</h2>
          <label>توضیح یا یادداشت<textarea rows={5} value={comment} onChange={(event) => setComment(event.target.value)} /></label>
          <div className="approval-actions">
            {request.status === "draft" && hasPermission("approval.requests.submit") && <button disabled={isSubmitting} onClick={() => void execute("submit")}>ارسال برای تأیید</button>}
            {request.status === "pending" && hasPermission("approval.requests.approve") && <button disabled={isSubmitting} onClick={() => void execute("approve")}>تأیید</button>}
            {request.status === "pending" && hasPermission("approval.requests.reject") && <button disabled={isSubmitting} onClick={() => void execute("reject")}>رد</button>}
            {request.status === "pending" && hasPermission("approval.requests.return-to-draft") && <button disabled={isSubmitting} onClick={() => void execute("return-to-draft")}>بازگشت به پیش‌نویس</button>}
            {(request.status === "draft" || request.status === "pending") && hasPermission("approval.requests.cancel") && <button disabled={isSubmitting} onClick={() => void execute("cancel")}>لغو</button>}
            {hasPermission("approval.requests.comment") && <button disabled={isSubmitting || !comment.trim()} onClick={() => void execute("comment")}>ثبت یادداشت</button>}
          </div>
        </article>
      </div>

      <article className="approval-card">
        <h2>تاریخچه گردش</h2>
        <ol className="approval-timeline">
          {[...request.history].reverse().map((entry) => (
            <li key={entry.id}>
              <strong>{actionLabels[entry.action]}</strong> توسط {entry.actor.displayName}
              <small>{entry.fromStatus ? `${statusLabels[entry.fromStatus]} ← ` : ""}{statusLabels[entry.toStatus]} — {new Date(entry.occurredAt).toLocaleString("fa-IR")}</small>
              {entry.comment && <p>{entry.comment}</p>}
            </li>
          ))}
        </ol>
      </article>
    </section>
  );
}
