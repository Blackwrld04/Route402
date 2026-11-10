import { Activity, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { Notice } from '../types';

interface ToastNoticeProps {
  notice: Notice | null;
  onDismiss: () => void;
}

export function ToastNotice({ notice, onDismiss }: ToastNoticeProps) {
  if (!notice) return null;

  return (
    <div className={`toast toast-${notice.kind}`} role="status" aria-live="polite">
      <span className="toast-icon">
        {notice.kind === 'ok' ? (
          <CheckCircle2 size={16} />
        ) : notice.kind === 'blocked' ? (
          <ShieldAlert size={16} />
        ) : (
          <Activity size={16} />
        )}
      </span>
      <span className="toast-message">{notice.message}</span>
      <button
        type="button"
        className="toast-close"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  );
}

