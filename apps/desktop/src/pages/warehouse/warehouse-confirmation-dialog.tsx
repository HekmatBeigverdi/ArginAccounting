import { useEffect, useId, useRef, useState } from "react";
import { Feedback } from "../../components/feedback";

export interface WarehouseConfirmation {
  title: string;
  message: string;
  confirmLabel: string;
  execute: () => Promise<void>;
}

export function WarehouseConfirmationDialog({
  confirmation,
  onClose,
  formatError,
}: {
  confirmation: WarehouseConfirmation;
  onClose: () => void;
  formatError: (reason: unknown) => string;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (
        previouslyFocused instanceof HTMLElement &&
        previouslyFocused.isConnected
      ) {
        previouslyFocused.focus();
      }
    };
  }, []);

  async function confirmAction() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      await confirmation.execute();
      onClose();
    } catch (reason) {
      setError(formatError(reason));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="warehouse-dialog warehouse-dialog--small warehouse-confirmation"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descriptionId}
      aria-busy={submitting}
      onCancel={(event) => {
        event.preventDefault();
        if (!submittingRef.current) onClose();
      }}
    >
      <header>
        <h2 id={titleId}>{confirmation.title}</h2>
      </header>
      <p id={descriptionId} className="warehouse-confirmation__message">
        {confirmation.message}
      </p>
      {error ? <Feedback tone="error">{error}</Feedback> : null}
      <footer>
        <button type="button" autoFocus disabled={submitting} onClick={onClose}>
          انصراف
        </button>
        <button
          type="button"
          className="warehouse-button--danger"
          disabled={submitting}
          onClick={() => void confirmAction()}
        >
          {submitting ? "در حال انجام…" : confirmation.confirmLabel}
        </button>
      </footer>
    </dialog>
  );
}
