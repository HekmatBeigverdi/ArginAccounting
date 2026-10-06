import { useEffect, useRef, useState } from "react";
import { Feedback } from "../../components/feedback";
import "./sales-document-form.css";

interface Props {
  title: string;
  busy: boolean;
  error: string;
  onConfirm(reason: string): void;
  onClose(): void;
}

export function SalesActionDialog({ title, busy, error, onConfirm, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return (
    <dialog ref={dialog} className="sales-document-form sales-action-dialog" dir="rtl" aria-labelledby="sales-action-title"
      onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
      <form onSubmit={event => { event.preventDefault(); if (!busy) onConfirm(reason); }}>
        <h2 id="sales-action-title">{title}</h2>
        {error && <Feedback tone="error">{error}</Feedback>}
        <label>دلیل (اختیاری)
          <textarea autoFocus value={reason} onChange={event => setReason(event.target.value)} disabled={busy} rows={3} />
        </label>
        <footer>
          <button className="primary" type="submit" disabled={busy}>{busy ? "در حال ثبت…" : title}</button>
          <button type="button" disabled={busy} onClick={onClose}>انصراف</button>
        </footer>
      </form>
    </dialog>
  );
}
