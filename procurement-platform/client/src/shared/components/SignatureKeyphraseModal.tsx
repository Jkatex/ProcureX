/* Renders the shared Signature Keyphrase Modal UI while keeping page-specific presentation near its workflow data. */
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import { useEffect, useState, type FormEvent } from 'react';

type SignatureKeyphraseModalProps = {
  open: boolean;
  title: string;
  actionLabel?: string;
  isSubmitting?: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (signatureKeyphrase: string) => void;
};

export function SignatureKeyphraseModal({
  open,
  title,
  actionLabel = 'Confirm',
  isSubmitting = false,
  error = '',
  onCancel,
  onConfirm
}: SignatureKeyphraseModalProps) {
  const [signatureKeyphrase, setSignatureKeyphrase] = useState('');

  useEffect(() => {
    if (!open) setSignatureKeyphrase('');
  }, [open]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (signatureKeyphrase.length < 6 || isSubmitting) return;
    onConfirm(signatureKeyphrase);
    setSignatureKeyphrase('');
  }

  return (
    <div className="product-spec-modal signature-keyphrase-modal" role="dialog" aria-modal="true" aria-labelledby="signature-keyphrase-modal-title">
      <form className="product-spec-modal-card signature-keyphrase-modal-card" onSubmit={submit}>
        <div className="product-spec-modal-heading signature-keyphrase-modal-heading">
          <div>
            <span className="signature-keyphrase-modal-label">Digital signature</span>
            <h4 id="signature-keyphrase-modal-title">{title}</h4>
            <p>This keyphrase unlocks your private signing key for this action only. Set up or reset it from Identity Verification if you do not have an active signing credential.</p>
          </div>
          <button className="signature-keyphrase-modal-close" type="button" onClick={onCancel} disabled={isSubmitting} aria-label="Close signature prompt" title="Close">
            <CloseRoundedIcon fontSize="small" aria-hidden="true" />
          </button>
        </div>
        <div className="form-field signature-keyphrase-field">
          <input
            autoFocus
            type="password"
            value={signatureKeyphrase}
            onChange={(event) => setSignatureKeyphrase(event.target.value)}
            minLength={6}
            autoComplete="current-password"
            aria-label="Signature keyphrase"
            placeholder="Enter signature keyphrase"
          />
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="product-spec-modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={isSubmitting}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={isSubmitting || signatureKeyphrase.length < 6}>
            {isSubmitting ? 'Signing...' : actionLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
