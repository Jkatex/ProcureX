import { useEffect, useState } from 'react';
import { identityApi } from '@/features/identity/api';
import type { ProfileImageMetadata } from '@/features/identity/types';

export const profileImageUpdatedEvent = 'procurex:profile-image-updated';

type ProfileImageUpdatedDetail = {
  profileImage: ProfileImageMetadata | null;
};

type UseProfileImagePreviewOptions = {
  profileImage?: ProfileImageMetadata | null;
  loadFromProfile?: boolean;
  enabled?: boolean;
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

export function profileImageValue(value: unknown): ProfileImageMetadata | null {
  const image = objectValue(value);
  return typeof image.objectKey === 'string' && typeof image.fileName === 'string' ? (image as ProfileImageMetadata) : null;
}

export function dispatchProfileImageUpdated(profileImage: ProfileImageMetadata | null) {
  window.dispatchEvent(new CustomEvent<ProfileImageUpdatedDetail>(profileImageUpdatedEvent, { detail: { profileImage } }));
}

export function useProfileImagePreview({ profileImage, loadFromProfile = false, enabled = true }: UseProfileImagePreviewOptions = {}) {
  const [resolvedImage, setResolvedImage] = useState<ProfileImageMetadata | null>(profileImage ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResolvedImage(null);
      return;
    }
    if (profileImage !== undefined) setResolvedImage(profileImage);
  }, [enabled, profileImage]);

  useEffect(() => {
    if (!enabled || !loadFromProfile) return;
    let active = true;

    async function loadProfileImageMetadata() {
      try {
        const response = await identityApi.getVerificationMe();
        if (!active) return;
        const profile = objectValue(response.verification?.payload.profile);
        setResolvedImage(profileImageValue(profile.profileImage));
      } catch {
        if (active) setResolvedImage(null);
      }
    }

    void loadProfileImageMetadata();
    return () => {
      active = false;
    };
  }, [enabled, loadFromProfile]);

  useEffect(() => {
    if (!enabled) return;

    function handleProfileImageUpdated(event: Event) {
      const nextImage = (event as CustomEvent<ProfileImageUpdatedDetail>).detail?.profileImage ?? null;
      setResolvedImage(nextImage);
    }

    window.addEventListener(profileImageUpdatedEvent, handleProfileImageUpdated);
    return () => window.removeEventListener(profileImageUpdatedEvent, handleProfileImageUpdated);
  }, [enabled]);

  useEffect(() => {
    let active = true;
    let objectUrl: string | null = null;

    async function loadPreview() {
      if (!enabled || !resolvedImage?.objectKey || typeof URL.createObjectURL !== 'function') {
        setPreviewUrl(null);
        return;
      }
      try {
        const blob = await identityApi.getProfileImageBlob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      } catch {
        if (active) setPreviewUrl(null);
      }
    }

    void loadPreview();
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [enabled, resolvedImage?.checksum, resolvedImage?.objectKey]);

  return {
    profileImage: resolvedImage,
    previewUrl,
    hasImage: Boolean(resolvedImage?.objectKey)
  };
}
