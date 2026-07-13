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
    <div className="product-spec-modal" role="dialog" aria-modal="true" aria-labelledby="signature-keyphrase-modal-title">
      <form className="product-spec-modal-card" onSubmit={submit}>
        <div className="product-spec-modal-heading">
          <div>
            <span>Digital signature</span>
            <h4 id="signature-keyphrase-modal-title">{title}</h4>
            <p>This keyphrase unlocks your private signing key for this action only. Set up or reset it from Identity Verification if you do not have an active signing credential.</p>
          </div>
          <button className="btn btn-ghost" type="button" onClick={onCancel} disabled={isSubmitting}>
            Close
          </button>
        </div>
        <label className="form-field">
          <span>Signature keyphrase</span>
          <input
            autoFocus
            type="password"
            value={signatureKeyphrase}
            onChange={(event) => setSignatureKeyphrase(event.target.value)}
            minLength={6}
            autoComplete="current-password"
          />
        </label>
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
