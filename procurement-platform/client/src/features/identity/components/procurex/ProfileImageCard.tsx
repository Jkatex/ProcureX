/* Renders the identity Profile Image Card UI while keeping page-specific presentation near its workflow data. */
import { ChangeEvent, useRef, useState } from 'react';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { identityApi } from '@/features/identity/api';
import type { EntityType, ProfileImageMetadata, ProfileImageMutationResult } from '@/features/identity/types';
import { dispatchProfileImageUpdated, useProfileImagePreview } from '@/features/identity/hooks/useProfileImagePreview';

type ProfileImageCardProps = {
  entityType?: EntityType | string;
  profileImage?: ProfileImageMetadata | null;
  disabled?: boolean;
  compact?: boolean;
  onChange: (result: ProfileImageMutationResult) => void;
};

function imageRoleFor(entityType?: string) {
  return entityType === 'individual' ? 'profile-photo' : 'logo';
}

function defaultLabelFor(entityType?: string) {
  return entityType === 'company' ? 'CO' : 'ID';
}

function titleFor(entityType?: string) {
  return entityType === 'individual' ? 'Profile photo' : 'Logo or profile image';
}

function copyFor(entityType?: string) {
  if (entityType === 'individual') return 'Add a profile photo for this account, or keep the default person avatar.';
  return 'Add a company logo or account image, or keep the default avatar.';
}

function statusFor(entityType?: string, hasImage?: boolean) {
  if (hasImage) return 'Image added';
  return entityType === 'company' ? 'Default organization placeholder' : 'Default person avatar';
}

export function ProfileImageCard({ entityType, profileImage, disabled = false, compact = false, onChange }: ProfileImageCardProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [actionsOpen, setActionsOpen] = useState(false);
  const { previewUrl, hasImage } = useProfileImagePreview({ profileImage });

  async function uploadImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await identityApi.uploadProfileImage(file, imageRoleFor(entityType));
      onChange(result);
      dispatchProfileImageUpdated(result.profileImage);
      setMessage('Image saved.');
    } catch {
      setMessage('Image could not be saved. Use a PNG, JPG, or WebP image under 2MB.');
    } finally {
      setLoading(false);
      setActionsOpen(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function removeImage() {
    setLoading(true);
    setMessage('');
    try {
      const result = await identityApi.deleteProfileImage();
      onChange(result);
      dispatchProfileImageUpdated(result.profileImage);
      setMessage('Image removed.');
    } catch {
      setMessage('Image could not be removed.');
    } finally {
      setLoading(false);
      setActionsOpen(false);
    }
  }

  if (compact) {
    return (
      <div className="profile-image-card compact account-editor">
        <div className={`profile-image-preview compact ${hasImage ? 'has-image' : 'is-default'}`}>
          {previewUrl ? <img src={previewUrl} alt={titleFor(entityType)} /> : <span>{defaultLabelFor(entityType)}</span>}
          <button
            className="profile-image-edit-button"
            type="button"
            aria-label="Edit account image"
            aria-expanded={actionsOpen}
            disabled={disabled || loading}
            onClick={() => setActionsOpen((open) => !open)}
          >
            <EditRoundedIcon fontSize="small" />
          </button>
          {actionsOpen ? (
            <div className="profile-image-action-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => inputRef.current?.click()}>
                {hasImage ? 'Replace image' : 'Add image'}
              </button>
              {hasImage ? (
                <button type="button" role="menuitem" onClick={() => void removeImage()}>
                  Remove image
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
        <div className="profile-image-copy compact">
          <span className="section-kicker">Account image</span>
          <h3>{titleFor(entityType)}</h3>
          <small>{statusFor(entityType, hasImage)}</small>
          {message ? <small className="profile-image-message">{message}</small> : null}
        </div>
        <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="profile-image-input" aria-label={titleFor(entityType)} onChange={(event) => void uploadImage(event)} />
      </div>
    );
  }

  return (
    <div className="profile-image-card">
      <div className={`profile-image-preview ${hasImage ? 'has-image' : 'is-default'}`}>
        {previewUrl ? <img src={previewUrl} alt={titleFor(entityType)} /> : <span>{defaultLabelFor(entityType)}</span>}
      </div>
      <div className="profile-image-copy">
        <span className="section-kicker">Account image</span>
        <h3>{titleFor(entityType)}</h3>
        <p>{copyFor(entityType)}</p>
        <small>{statusFor(entityType, hasImage)}</small>
        {message ? <small className="profile-image-message">{message}</small> : null}
        <div className="profile-image-actions">
          <button className="btn btn-secondary" type="button" disabled={disabled || loading} onClick={() => inputRef.current?.click()}>
            {loading ? 'Saving...' : hasImage ? 'Replace image' : 'Add image'}
          </button>
          {hasImage ? (
            <button className="btn btn-secondary" type="button" disabled={disabled || loading} onClick={() => void removeImage()}>
              Remove
            </button>
          ) : null}
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="profile-image-input" aria-label={titleFor(entityType)} onChange={(event) => void uploadImage(event)} />
        </div>
      </div>
    </div>
  );
}
