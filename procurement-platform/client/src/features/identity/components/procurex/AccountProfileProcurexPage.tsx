import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { setSessionUser } from '@/features/auth/slice';
import { identityApi } from '@/features/identity/api';
import { useNotifications } from '@/features/notifications/hooks';
import { createTenderSetup } from '@/features/procurement/createTenderConfig';
import type { SigningCredentialStatus, VerificationProfile } from '@/features/identity/types';
import { apiClient } from '@/shared/api/http';
import { notificationFromApiError } from '@/shared/api/errors';
import { AccountMenu } from '@/shared/components/AccountMenu';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { displayTrustRiskLabel, riskLevelSummary, trustTierSummary } from '@/shared/trustRisk';
import { TanzaniaLocationSelector } from '@/shared/components/TanzaniaLocationSelector';
import {
  PlatformAppsButton,
  PlatformAppsDrawer,
  resolvePlatformAppRoute,
  type PlatformAppPageKey
} from '@/shared/components/procurex/PlatformAppsDrawer';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';
import type { CreateNotificationInput } from '@/shared/types/notifications';
import { getTanzaniaRegions, isValidTanzaniaLocation, type TanzaniaLocationSelection } from '@procurex/shared';
import { ProfileImageCard } from './ProfileImageCard';
import type { ProfileImageMetadata } from '@/features/identity/types';

type ProfileTab = 'overview' | 'account' | 'entity' | 'classification' | 'documents' | 'security';

type ProfileForm = {
  fullName: string;
  emailAddress: string;
  phoneNumber: string;
  country: string;
  location: Partial<TanzaniaLocationSelection>;
  preferredLanguage: string;
  displayName: string;
  professionalTitle: string;
  companyName: string;
  tradingName: string;
  tinNumber: string;
  registrationNumber: string;
  businessCategories: string[];
  regionsOfOperation: string[];
  bankName: string;
  accountName: string;
  accountNumber: string;
  profileImage: ProfileImageMetadata | null;
};

type ProfileDocumentRow = {
  id: string;
  type: string;
  name: string;
  fileName: string;
};

type ContactChangeField = 'email' | 'phone';

type ContactChangeState = {
  field: ContactChangeField;
  value: string;
  code: string;
  challengeId?: string;
  target?: string;
  expiresAt?: string;
  devCode?: string;
  error?: string;
};

type TaxonomyResponse = {
  data?: {
    categories?: Array<{ label?: string; value?: string; isActive?: boolean }>;
  };
};

const tabs: Array<{ key: ProfileTab; label: string }> = [
  { key: 'overview', label: 'Overview' },
  { key: 'account', label: 'Account' },
  { key: 'entity', label: 'Entity' },
  { key: 'classification', label: 'Classification' },
  { key: 'documents', label: 'Documents' },
  { key: 'security', label: 'Security' }
];

const profileDocumentNames = [
  'Business Registration Certificate',
  'Tax Clearance Certificate',
  'VAT Registration Certificate',
  'Trading/Business License',
  'Professional/Firm Registration',
  'Regulatory License or Permit',
  'Manufacturer Authorization',
  'Product/Quality Certificate',
  'Insurance Certificate',
  'Financial Capacity Evidence',
  'Bank Confirmation Letter',
  'Identity Document',
  'Key Personnel CVs',
  'Professional Certificates',
  'Past Contract Evidence',
  'Client References',
  'Completion Certificates',
  'HSE Policy',
  'Equipment Ownership/Lease Evidence',
  'Methodology/Technical Proposal',
  'Financial Proposal',
  'Other Eligibility Evidence'
];

const fallbackBusinessCategories = uniqueStrings(Object.values(createTenderSetup.categories).flat());
const regionsOfOperation = ['Nationwide', ...getTanzaniaRegions()];
const legacyDocumentTypeLabels: Record<string, string> = {
  businessRegistration: 'Business Registration Certificate',
  taxCertificate: 'Tax Clearance Certificate',
  identityDocument: 'Identity Document',
  bankDocument: 'Bank Confirmation Letter'
};

const defaultProfile: ProfileForm = {
  fullName: '',
  emailAddress: '',
  phoneNumber: '',
  country: 'Tanzania',
  location: {},
  preferredLanguage: 'English',
  displayName: '',
  professionalTitle: '',
  companyName: '',
  tradingName: '',
  tinNumber: '',
  registrationNumber: '',
  businessCategories: [],
  regionsOfOperation: ['Nationwide'],
  bankName: '',
  accountName: '',
  accountNumber: '',
  profileImage: null
};

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function stringValue(value: unknown, fallback = '') {
  return typeof value === 'string' ? value : fallback;
}

function stringArrayValue(value: unknown, fallback: string[]) {
  return Array.isArray(value) ? uniqueStrings(value.map(String)) : fallback;
}

function profileImageValue(value: unknown): ProfileImageMetadata | null {
  const image = objectValue(value);
  return typeof image.objectKey === 'string' && typeof image.fileName === 'string' ? (image as ProfileImageMetadata) : null;
}

function statusBadge(status?: string) {
  if (status === 'APPROVED') return 'badge badge-success';
  if (status === 'REJECTED' || status === 'EXPIRED') return 'badge badge-error';
  if (status === 'PENDING') return 'badge badge-warning';
  return 'badge badge-info';
}

function reviewReasons(profile: VerificationProfile | null) {
  const reasons = objectValue(profile?.payload).reviewReasons;
  return Array.isArray(reasons) ? reasons.map(String) : [];
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>();
  return values
    .map((value) => value.trim())
    .filter((value) => {
      const key = value.toLowerCase();
      if (!value || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function documentTypeFromName(name: string) {
  return name
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toUpperCase();
}

function createDocumentRow(document?: Record<string, unknown>, index = 0): ProfileDocumentRow {
  const rawType = stringValue(document?.type);
  const rawName = stringValue(document?.name, stringValue(document?.documentName));
  const name = legacyDocumentTypeLabels[rawType] ?? rawName;
  const type = rawType && !legacyDocumentTypeLabels[rawType] ? rawType : name ? documentTypeFromName(name) : '';
  const fileName = stringValue(document?.fileName, stringValue(document?.uploadName, legacyDocumentTypeLabels[rawType] ? rawName : ''));
  return {
    id: stringValue(document?.id, `profile-document-${Date.now()}-${index}`),
    type,
    name,
    fileName
  };
}

function businessCategoriesFromProfile(savedProfile: Record<string, unknown>) {
  return uniqueStrings([
    ...stringArrayValue(savedProfile.businessCategories, []),
    stringValue(savedProfile.businessCategory),
    ...stringArrayValue(savedProfile.preferredTenderCategories, [])
  ]);
}

async function loadBusinessCategoryOptions() {
  try {
    const response = await apiClient.get<TaxonomyResponse>('/api/procurement/design/taxonomy');
    const categories = response.data.data?.categories ?? [];
    const labels = categories
      .filter((category) => category.isActive !== false)
      .map((category) => category.label || category.value || '');
    return uniqueStrings([...labels, ...fallbackBusinessCategories]);
  } catch {
    return fallbackBusinessCategories;
  }
}

export function AccountProfileProcurexPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { notifySuccess } = useNotifications();
  const user = useAppSelector((state) => state.auth.user);
  const [activeTab, setActiveTab] = useState<ProfileTab>('overview');
  const [verification, setVerification] = useState<VerificationProfile | null>(null);
  const [signingCredential, setSigningCredential] = useState<SigningCredentialStatus | null>(null);
  const [profile, setProfile] = useState<ProfileForm>(defaultProfile);
  const [documents, setDocuments] = useState<ProfileDocumentRow[]>([]);
  const [businessCategoryOptions, setBusinessCategoryOptions] = useState<string[]>(fallbackBusinessCategories);
  const [statusMessage, setStatusMessage] = useState<CreateNotificationInput | null>(null);
  const [loading, setLoading] = useState(false);
  const [contactChange, setContactChange] = useState<ContactChangeState | null>(null);
  const [contactChangeLoading, setContactChangeLoading] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);
  const headerRef = useRef<HTMLElement | null>(null);

  useBodyPageMetadata('verification-status');

  useEffect(() => {
    function handleDocumentClick(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) setAppsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setAppsOpen(false);
    }

    document.addEventListener('pointerdown', handleDocumentClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handleDocumentClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let active = true;
    loadBusinessCategoryOptions().then((options) => {
      if (active) setBusinessCategoryOptions(options);
    });
    return () => {
      active = false;
    };
  }, []);

  function selectPlatformApp(pageKey: PlatformAppPageKey) {
    setAppsOpen(false);
    navigate(resolvePlatformAppRoute(pageKey));
  }

  const payload = useMemo(() => objectValue(verification?.payload), [verification]);
  const registryRecord = objectValue(payload.registryRecord);
  const entityType = stringValue(payload.entityType, 'individual');
  const reasons = reviewReasons(verification);
  const trustRisk = user?.trustRisk;
  const eKycApproved = user?.verificationStatus === 'APPROVED' || verification?.status === 'APPROVED';
  const visibleTabs = eKycApproved ? tabs : tabs.filter((tab) => tab.key !== 'security');
  const requiredValues = [
    profile.fullName,
    profile.emailAddress,
    profile.phoneNumber,
    profile.country,
    isValidTanzaniaLocation(profile.location) ? profile.location.ward : '',
    profile.displayName || profile.companyName,
    profile.tinNumber || verification?.registryNumber,
    profile.businessCategories.length ? profile.businessCategories.join(', ') : ''
  ];
  const completedRequired = requiredValues.filter((value) => String(value ?? '').trim()).length;
  const completion = Math.round((completedRequired / requiredValues.length) * 100);

  useEffect(() => {
    let active = true;

    async function loadProfile() {
      setLoading(true);
      setStatusMessage(null);

      try {
        const response = await identityApi.getVerificationMe();
        if (!active) return;
        const savedProfile = objectValue(response.verification?.payload.profile);
        const savedDocuments = Array.isArray(response.verification?.payload.documents) ? response.verification?.payload.documents : [];
        const registry = objectValue(response.verification?.payload.registryRecord);

        dispatch(setSessionUser(response.user));
        setVerification(response.verification);
        setProfile({
          ...defaultProfile,
          fullName: stringValue(savedProfile.fullName, response.user.displayName),
          emailAddress: stringValue(savedProfile.emailAddress, response.user.email),
          phoneNumber: stringValue(savedProfile.phoneNumber, response.user.phone ?? ''),
          country: stringValue(savedProfile.country, 'Tanzania'),
          location: isValidTanzaniaLocation(savedProfile.location) ? savedProfile.location : isValidTanzaniaLocation(response.user.location) ? response.user.location : {},
          preferredLanguage: stringValue(savedProfile.preferredLanguage, 'English'),
          displayName: stringValue(savedProfile.displayName, stringValue(registry.name, response.user.displayName)),
          professionalTitle: stringValue(savedProfile.professionalTitle),
          companyName: stringValue(savedProfile.companyName, response.user.organization ?? stringValue(registry.name)),
          tradingName: stringValue(savedProfile.tradingName),
          tinNumber: stringValue(savedProfile.tinNumber, response.verification?.registrySource === 'TRA' ? response.verification.registryNumber ?? '' : ''),
          registrationNumber: stringValue(savedProfile.registrationNumber, response.verification?.registrySource === 'BRELA' ? response.verification.registryNumber ?? '' : ''),
          businessCategories: businessCategoriesFromProfile(savedProfile),
          regionsOfOperation: stringArrayValue(savedProfile.regionsOfOperation, defaultProfile.regionsOfOperation),
          bankName: stringValue(savedProfile.bankName),
          accountName: stringValue(savedProfile.accountName),
          accountNumber: stringValue(savedProfile.accountNumber),
          profileImage: profileImageValue(savedProfile.profileImage)
        });
        setDocuments(savedDocuments.map((document, index) => createDocumentRow(objectValue(document), index)).filter((document) => document.name || document.fileName));
        if (response.user.verificationStatus === 'APPROVED' || response.verification?.status === 'APPROVED') {
          try {
            const keyphraseStatus = await identityApi.getKeyphraseStatus();
            if (active) setSigningCredential(keyphraseStatus.credential);
          } catch {
            if (active) setSigningCredential(null);
          }
        } else if (active) {
          setSigningCredential(null);
          if (activeTab === 'security') setActiveTab('overview');
        }
      } catch (error) {
        if (active) setStatusMessage(notificationFromApiError(error, { title: 'Account profile could not load', fallback: 'Could not load account profile.' }));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadProfile();
    return () => {
      active = false;
    };
  }, [dispatch]);

  function updateProfileField<Key extends keyof ProfileForm>(field: Key, value: ProfileForm[Key]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function addListValue(field: 'businessCategories' | 'regionsOfOperation', value: string) {
    const selected = value.trim();
    if (!selected) return;
    setProfile((current) => ({ ...current, [field]: uniqueStrings([...current[field], selected]) }));
  }

  function removeListValue(field: 'businessCategories' | 'regionsOfOperation', value: string) {
    setProfile((current) => ({ ...current, [field]: current[field].filter((item) => item !== value) }));
  }

  function addDocument() {
    setDocuments((current) => [...current, createDocumentRow(undefined, current.length)]);
  }

  function updateDocument(rowId: string, patch: Partial<ProfileDocumentRow>) {
    setDocuments((current) =>
      current.map((row) => {
        if (row.id !== rowId) return row;
        const next = { ...row, ...patch };
        if (patch.name !== undefined) next.type = documentTypeFromName(patch.name);
        return next;
      })
    );
  }

  function updateDocumentFile(rowId: string, event: ChangeEvent<HTMLInputElement>) {
    updateDocument(rowId, { fileName: event.target.files?.[0]?.name ?? '' });
  }

  function removeDocument(rowId: string) {
    setDocuments((current) => current.filter((row) => row.id !== rowId));
  }

  function openContactChange(field: ContactChangeField) {
    setContactChange({
      field,
      value: field === 'email' ? profile.emailAddress : profile.phoneNumber,
      code: ''
    });
  }

  async function startContactChange() {
    if (!contactChange) return;
    setContactChangeLoading(true);
    setContactChange((current) => (current ? { ...current, error: undefined } : current));

    try {
      const started = await identityApi.startProfileContactChange({
        field: contactChange.field,
        value: contactChange.value
      });
      setContactChange((current) =>
        current
          ? {
              ...current,
              challengeId: started.challengeId,
              target: started.target,
              expiresAt: started.expiresAt,
              devCode: started.devCode,
              code: '',
              error: undefined
            }
          : current
      );
    } catch (error) {
      const notification = notificationFromApiError(error, {
        title: 'Verification code could not be sent',
        fallback: 'Could not send the verification code.'
      });
      setContactChange((current) => (current ? { ...current, error: notification.message } : current));
    } finally {
      setContactChangeLoading(false);
    }
  }

  async function verifyContactChange() {
    if (!contactChange?.challengeId) return;
    setContactChangeLoading(true);
    setContactChange((current) => (current ? { ...current, error: undefined } : current));

    try {
      const result = await identityApi.verifyProfileContactChange({
        challengeId: contactChange.challengeId,
        code: contactChange.code
      });
      dispatch(setSessionUser(result.user));
      setVerification(result.verification);
      const updatedProfile = objectValue(result.verification.payload.profile);
      setProfile((current) => ({
        ...current,
        emailAddress: stringValue(updatedProfile.emailAddress, result.user.email),
        phoneNumber: stringValue(updatedProfile.phoneNumber, result.user.phone ?? current.phoneNumber)
      }));
      const label = contactChange.field === 'email' ? 'Email address' : 'Phone number';
      notifySuccess(`${label} verified`, `${label} updated after code verification.`);
      setContactChange(null);
    } catch (error) {
      const notification = notificationFromApiError(error, {
        title: 'Verification failed',
        fallback: 'Could not verify this contact change.'
      });
      setContactChange((current) => (current ? { ...current, error: notification.message } : current));
    } finally {
      setContactChangeLoading(false);
    }
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setStatusMessage(null);

    try {
      const {
        location: profileLocation,
        emailAddress: _emailAddress,
        phoneNumber: _phoneNumber,
        displayName: _displayName,
        ...profileWithoutLocation
      } = profile;
      const saved = await identityApi.updateProfile({
        profile: {
          ...profileWithoutLocation,
          businessCategories: uniqueStrings(profile.businessCategories),
          regionsOfOperation: uniqueStrings(profile.regionsOfOperation),
          ...(isValidTanzaniaLocation(profileLocation) ? { location: profileLocation } : {})
        },
        documents: documents
          .filter((document) => document.name || document.fileName)
          .map((document) => ({
            type: document.type || documentTypeFromName(document.name),
            name: document.name,
            fileName: document.fileName,
            status: 'captured',
            source: 'profile'
          }))
      });
      setVerification(saved);
      const notification: CreateNotificationInput = {
        tone: 'success',
        title: 'Profile saved',
        message: 'Profile saved to the verification database record.',
        reason: 'ProcureX updated the profile payload used for account verification and procurement preferences.',
        dismissible: false
      };
      setStatusMessage(null);
      notifySuccess(notification.title, notification.message, { reason: notification.reason });
    } catch (error) {
      setStatusMessage(notificationFromApiError(error, { title: 'Profile could not be saved', fallback: 'Could not save profile.' }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="app-topbar" ref={headerRef}>
        <div className="app-topbar-left">
          <button className="app-brand-button" type="button" onClick={() => navigate('/apps')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <span>Registration and Verification</span>
          </button>
        </div>

        <div className="app-topbar-actions">
          <PlatformAppsButton expanded={appsOpen} onClick={() => setAppsOpen((open) => !open)} />
          <div className="profile-menu-wrap">
            <AccountMenu buttonClassName="profile-button" />
          </div>
        </div>

        <PlatformAppsDrawer open={appsOpen} organizationLabel={user?.organization ?? 'ProcureX account tools'} onSelect={selectPlatformApp} />
      </header>

      <div className="main-layout">
        <div className="main-content">
          <form className="iam-profile-page" onSubmit={(event) => void saveProfile(event)}>
            <section className="iam-profile-hero">
              <div>
                <span className={statusBadge(user?.verificationStatus)}>{user?.verificationStatus ?? 'NOT_STARTED'}</span>
                <h1>Account Profile Workspace</h1>
                <p>Account, registry, documents, and procurement preferences are stored against the verification profile for the current signed-in user.</p>
                <div className="iam-hero-actions">
                  <button className="btn btn-primary" type="submit" disabled={loading}>
                    {loading ? 'Saving...' : 'Save Profile'}
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigate('/identity/verification')}>
                    Update Identity Verification
                  </button>
                  {eKycApproved ? (
                    <button className="btn btn-secondary" type="button" onClick={() => navigate('/identity/security/keyphrase')}>
                      Signing Keyphrase
                    </button>
                  ) : null}
                </div>
                {statusMessage ? (
                  <NotificationCard notification={statusMessage} compact />
                ) : (
                  <small className="iam-save-status">Changes are written to the database-backed profile payload.</small>
                )}
              </div>
              <div className="iam-profile-score">
                <div className="iam-score-copy">
                  <span>Profile completion</span>
                  <strong>{completion}%</strong>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{ width: `${completion}%` }} />
                  </div>
                  <small>
                    {completedRequired} of {requiredValues.length} required profile fields complete
                  </small>
                </div>
              </div>
            </section>

            <nav className="iam-profile-tabs" aria-label="account profile sections">
              {visibleTabs.map((tab) => (
                <button className={activeTab === tab.key ? 'active' : ''} key={tab.key} type="button" onClick={() => setActiveTab(tab.key)}>
                  {tab.label}
                </button>
              ))}
            </nav>

            <section className={`iam-profile-section ${activeTab === 'overview' ? 'active' : ''}`}>
              <div className="iam-section-heading">
                <div>
                  <span className="section-kicker">Overview</span>
                  <h2>Verification record</h2>
                </div>
                <span className={statusBadge(verification?.status)}>{verification?.status ?? 'No profile yet'}</span>
              </div>
              <div className="iam-overview-grid">
                <div className="iam-readonly-row">
                  <span>Verified name</span>
                  <strong>{stringValue(registryRecord.name, profile.displayName || user?.displayName)}</strong>
                </div>
                <div className="iam-readonly-row">
                  <span>Registry source</span>
                  <strong>{verification?.registrySource ?? stringValue(payload.registrySource, 'Pending')}</strong>
                </div>
                <div className="iam-readonly-row">
                  <span>Registry reference</span>
                  <strong>{verification?.registryNumber ?? stringValue(payload.registryNumber, 'Pending')}</strong>
                </div>
                <div className="iam-readonly-row">
                  <span>Digital signature</span>
                  <strong>{stringValue(payload.signatureName, 'Pending signature')}</strong>
                </div>
                <div className="iam-readonly-row">
                  <span>Organization</span>
                  <strong>{user?.organization ?? profile.companyName ?? 'Pending verification'}</strong>
                </div>
                <div className="iam-readonly-row">
                  <span>Last updated</span>
                  <strong>{verification?.updatedAt ? new Date(verification.updatedAt).toLocaleString() : 'Not saved yet'}</strong>
                </div>
              </div>
              <div className="iam-trust-risk-panel">
                <div className="iam-section-heading">
                  <div>
                    <span className="section-kicker">Trust and risk</span>
                    <h2>Account assessment</h2>
                  </div>
                  <span className={statusBadge(user?.verificationStatus)}>{displayTrustRiskLabel(user?.trustTier ?? 'UNVERIFIED')}</span>
                </div>
                <div className="iam-overview-grid">
                  <div className="iam-readonly-row">
                    <span>Trust tier</span>
                    <strong>{displayTrustRiskLabel(user?.trustTier ?? 'UNVERIFIED')}</strong>
                  </div>
                  <div className="iam-readonly-row">
                    <span>Risk level</span>
                    <strong>{displayTrustRiskLabel(user?.riskLevel ?? 'MEDIUM')}</strong>
                  </div>
                  <div className="iam-readonly-row">
                    <span>Screening</span>
                    <strong>{displayTrustRiskLabel(user?.screeningStatus ?? 'NOT_RUN')}</strong>
                  </div>
                  <div className="iam-readonly-row">
                    <span>Score</span>
                    <strong>{trustRisk?.score ?? 'Not assessed yet'}</strong>
                  </div>
                </div>
                <div className="auth-note">
                  <strong>Trust:</strong> {trustTierSummary(user?.trustTier, trustRisk?.reasons)}
                  <br />
                  <strong>Risk:</strong> {riskLevelSummary(user?.riskLevel, user?.screeningStatus)}
                </div>
                {trustRisk?.history?.length ? (
                  <details className="iam-trust-history">
                    <summary>Trust history</summary>
                    <div className="admin-timeline compact">
                      {trustRisk.history.map((entry) => (
                        <div key={`${entry.createdAt}:${entry.nextTier}`}>
                          <strong>{displayTrustRiskLabel(entry.nextTier)} / {displayTrustRiskLabel(entry.riskLevel)}</strong>
                          <span>{entry.score} points - {entry.reasons.join(' ') || 'No additional reasons recorded.'}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
              {reasons.length ? <div className="auth-note">Admin review reasons: {reasons.join(' ')}</div> : null}
            </section>

            <section className={`iam-profile-section ${activeTab === 'account' ? 'active' : ''}`}>
              <div className="iam-section-heading">
                <div>
                  <span className="section-kicker">Account</span>
                  <h2>Account information</h2>
                </div>
                <span className="badge badge-info">Editable</span>
              </div>
              <ProfileImageCard
                entityType={entityType}
                profileImage={profile.profileImage}
                disabled={loading}
                compact
                onChange={(next) => {
                  setVerification(next.profile);
                  updateProfileField('profileImage', next.profileImage);
                }}
              />
              <div className="iam-form-grid">
                <label className="form-group iam-profile-field">
                  <span className="form-label">Full Name *</span>
                  <input className="form-input" value={profile.fullName} onChange={(event) => updateProfileField('fullName', event.target.value)} />
                </label>
                <ContactDisplayRow
                  label="Email Address *"
                  value={profile.emailAddress}
                  hint="Verified by code before account email changes."
                  onEdit={() => openContactChange('email')}
                />
                <ContactDisplayRow
                  label="Phone Number *"
                  value={profile.phoneNumber}
                  hint="Verified by code before account phone changes."
                  onEdit={() => openContactChange('phone')}
                />
                <label className="form-group iam-profile-field">
                  <span className="form-label">Country *</span>
                  <select className="form-input" value={profile.country} onChange={(event) => updateProfileField('country', event.target.value)}>
                    {['Tanzania', 'Kenya', 'Uganda', 'Rwanda', 'Burundi', 'South Africa', 'United Arab Emirates'].map((country) => (
                      <option value={country} key={country}>
                        {country}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="form-group iam-profile-field wide">
                  <span className="form-label">Primary Location</span>
                  <TanzaniaLocationSelector
                    idPrefix="profile-location"
                    value={profile.location}
                    onChange={(nextLocation) => updateProfileField('location', nextLocation)}
                    groupClassName="form-group iam-profile-field"
                    labelClassName="form-label"
                    inputClassName="form-input"
                  />
                </div>
                <label className="form-group iam-profile-field">
                  <span className="form-label">Preferred Language</span>
                  <select className="form-input" value={profile.preferredLanguage} onChange={(event) => updateProfileField('preferredLanguage', event.target.value)}>
                    {['English', 'Swahili', 'French', 'Arabic'].map((language) => (
                      <option value={language} key={language}>
                        {language}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className={`iam-profile-section ${activeTab === 'entity' ? 'active' : ''}`}>
              <div className="iam-section-heading">
                <div>
                  <span className="section-kicker">Legal identity</span>
                  <h2>Entity information</h2>
                </div>
                <span className="badge badge-info">{stringValue(payload.entityType, 'Account')}</span>
              </div>
              <div className="iam-form-grid">
                <label className="form-group iam-profile-field">
                  <span className="form-label">Display / Legal Name *</span>
                  <input className="form-input" aria-label="Display / Legal Name *" value={profile.displayName} disabled readOnly />
                  <small className="form-hint">Legal name changes require identity verification or admin review.</small>
                </label>
                <label className="form-group iam-profile-field">
                  <span className="form-label">Professional Title</span>
                  <input className="form-input" value={profile.professionalTitle} onChange={(event) => updateProfileField('professionalTitle', event.target.value)} />
                </label>
                <label className="form-group iam-profile-field">
                  <span className="form-label">Company / Business Name</span>
                  <input className="form-input" value={profile.companyName} onChange={(event) => updateProfileField('companyName', event.target.value)} />
                </label>
                <label className="form-group iam-profile-field">
                  <span className="form-label">Trading Name</span>
                  <input className="form-input" value={profile.tradingName} onChange={(event) => updateProfileField('tradingName', event.target.value)} />
                </label>
                <label className="form-group iam-profile-field">
                  <span className="form-label">TIN Number *</span>
                  <input className="form-input" value={profile.tinNumber} onChange={(event) => updateProfileField('tinNumber', event.target.value)} />
                </label>
                <label className="form-group iam-profile-field">
                  <span className="form-label">Registration Number</span>
                  <input className="form-input" value={profile.registrationNumber} onChange={(event) => updateProfileField('registrationNumber', event.target.value)} />
                </label>
              </div>
            </section>

            <section className={`iam-profile-section ${activeTab === 'classification' ? 'active' : ''}`}>
              <div className="iam-section-heading">
                <div>
                  <span className="section-kicker">Classification</span>
                  <h2>Procurement profile</h2>
                </div>
                <span className="badge badge-info">Matching</span>
              </div>
              <div className="iam-form-grid">
                <SearchableMultiSelector
                  label="Business Categories *"
                  emptyText="No business categories added yet."
                  options={businessCategoryOptions}
                  selected={profile.businessCategories}
                  onSelect={(value) => addListValue('businessCategories', value)}
                  onRemove={(value) => removeListValue('businessCategories', value)}
                />
                <SearchableMultiSelector
                  label="Regions of Operation"
                  emptyText="No regions added yet."
                  options={regionsOfOperation}
                  selected={profile.regionsOfOperation}
                  onSelect={(value) => addListValue('regionsOfOperation', value)}
                  onRemove={(value) => removeListValue('regionsOfOperation', value)}
                />
              </div>
            </section>

            <section className={`iam-profile-section ${activeTab === 'documents' ? 'active' : ''}`}>
              <div className="iam-section-heading">
                <div>
                  <span className="section-kicker">Documents</span>
                  <h2>Verification evidence</h2>
                </div>
                <button className="btn btn-secondary" type="button" onClick={addDocument}>
                  Add Document
                </button>
              </div>
              <div className="iam-document-list">
                {documents.length ? (
                  documents.map((document, index) => (
                    <div className="iam-document-row" key={document.id}>
                      <label className="form-group iam-profile-field" htmlFor={`profile-document-name-${document.id}`}>
                        <span className="form-label">Document name {index + 1}</span>
                        <select
                          id={`profile-document-name-${document.id}`}
                          className="form-input"
                          value={document.name}
                          aria-label={`Document name ${index + 1}`}
                          onChange={(event) => updateDocument(document.id, { name: event.target.value })}
                        >
                          <option value="">Select document name</option>
                          {profileDocumentNames.map((name) => (
                            <option value={name} key={name}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="form-group iam-profile-field" htmlFor={`profile-document-file-${document.id}`}>
                        <span className="form-label">Upload document {index + 1}</span>
                        <div className="iam-upload-control">
                          <input
                            id={`profile-document-file-${document.id}`}
                            className="form-input"
                            type="file"
                            aria-label={`Upload document ${index + 1}`}
                            onChange={(event) => updateDocumentFile(document.id, event)}
                          />
                          <small>{document.fileName || 'No file selected yet.'}</small>
                        </div>
                      </label>
                      <button className="iam-document-remove" type="button" onClick={() => removeDocument(document.id)} aria-label={`Remove document ${index + 1}`}>
                        Remove
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="scope-empty">No documents added yet.</div>
                )}
              </div>
            </section>

            {eKycApproved ? (
              <section className={`iam-profile-section ${activeTab === 'security' ? 'active' : ''}`}>
                <div className="iam-section-heading">
                  <div>
                    <span className="section-kicker">Identity security</span>
                    <h2>Signing keyphrase</h2>
                  </div>
                  <span className={signingCredential?.hasCredential ? 'badge badge-success' : 'badge badge-warning'}>
                    {signingCredential?.hasCredential ? 'Active' : 'Setup needed'}
                  </span>
                </div>
                <div className="iam-overview-grid">
                  <div className="iam-readonly-row">
                    <span>Credential status</span>
                    <strong>{signingCredential?.hasCredential ? signingCredential.status : 'No active credential'}</strong>
                  </div>
                  <div className="iam-readonly-row">
                    <span>Fingerprint</span>
                    <strong>{signingCredential?.keyFingerprint ?? 'Not recorded'}</strong>
                  </div>
                  <div className="iam-readonly-row">
                    <span>Provider</span>
                    <strong>{signingCredential?.provider ?? 'Not recorded'}</strong>
                  </div>
                  <div className="iam-readonly-row">
                    <span>Created</span>
                    <strong>{signingCredential?.createdAt ? new Date(signingCredential.createdAt).toLocaleString() : 'Not created yet'}</strong>
                  </div>
                </div>
                <div className="auth-note">
                  <strong>Use this area after eKYC approval.</strong> Change a known signing keyphrase, create one if missing, or recover a forgotten keyphrase through email and phone verification.
                </div>
                <div className="iam-hero-actions">
                  <button className="btn btn-primary" type="button" onClick={() => navigate('/identity/security/keyphrase')}>
                    Manage Signing Keyphrase
                  </button>
                  <button className="btn btn-secondary" type="button" onClick={() => navigate('/recover-keyphrase')}>
                    Recover Forgotten Keyphrase
                  </button>
                </div>
              </section>
            ) : null}
            {contactChange ? (
              <ContactChangeDialog
                state={contactChange}
                loading={contactChangeLoading}
                onChange={setContactChange}
                onCancel={() => setContactChange(null)}
                onStart={() => void startContactChange()}
                onVerify={() => void verifyContactChange()}
              />
            ) : null}
          </form>
        </div>
      </div>
    </>
  );
}

function ContactDisplayRow({ label, value, hint, onEdit }: { label: string; value: string; hint: string; onEdit: () => void }) {
  const plainLabel = label.replace('*', '').trim();
  return (
    <div className="form-group iam-profile-field">
      <span className="form-label">{label}</span>
      <div className="iam-readonly-row">
        <span>{value || 'Not provided'}</span>
        <button className="btn btn-secondary btn-sm" type="button" onClick={onEdit} aria-label={`Edit ${plainLabel}`}>
          <EditRoundedIcon fontSize="small" />
          Edit
        </button>
      </div>
      <small className="form-hint">{hint}</small>
    </div>
  );
}

function ContactChangeDialog({
  state,
  loading,
  onChange,
  onCancel,
  onStart,
  onVerify
}: {
  state: ContactChangeState;
  loading: boolean;
  onChange: (next: ContactChangeState) => void;
  onCancel: () => void;
  onStart: () => void;
  onVerify: () => void;
}) {
  const label = state.field === 'email' ? 'Email Address' : 'Phone Number';
  const inputType = state.field === 'email' ? 'email' : 'tel';
  const codeSent = Boolean(state.challengeId);

  return (
    <div className="product-spec-modal signature-keyphrase-modal" role="dialog" aria-modal="true" aria-labelledby="contact-change-title">
      <div className="product-spec-modal-card signature-keyphrase-modal-card">
        <div className="product-spec-modal-heading signature-keyphrase-modal-heading">
          <div>
            <span className="signature-keyphrase-modal-label">Account verification</span>
            <h4 id="contact-change-title">Edit {label}</h4>
            <p>{codeSent ? `Enter the code sent to ${state.target}.` : `A verification code will be sent to the new ${label.toLowerCase()}.`}</p>
          </div>
          <button className="signature-keyphrase-modal-close" type="button" onClick={onCancel} disabled={loading} aria-label="Close contact change dialog" title="Close">
            x
          </button>
        </div>
        <label className="signature-keyphrase-modal-label">
          <span>New {label}</span>
          <input
            className="form-input"
            type={inputType}
            value={state.value}
            disabled={loading || codeSent}
            onChange={(event) => onChange({ ...state, value: event.target.value, error: undefined })}
          />
        </label>
        {codeSent ? (
          <label className="signature-keyphrase-modal-label">
            <span>Verification Code</span>
            <input
              className="form-input"
              inputMode="numeric"
              value={state.code}
              maxLength={6}
              disabled={loading}
              onChange={(event) => onChange({ ...state, code: event.target.value.replace(/\D/g, '').slice(0, 6), error: undefined })}
            />
          </label>
        ) : null}
        {state.devCode ? <div className="auth-note">Temporary local code: {state.devCode}</div> : null}
        {state.error ? <div className="auth-note">{state.error}</div> : null}
        <div className="product-spec-modal-actions">
          <button className="btn btn-secondary" type="button" onClick={onCancel} disabled={loading}>
            Cancel
          </button>
          {codeSent ? (
            <button className="btn btn-primary" type="button" onClick={onVerify} disabled={loading || state.code.length !== 6}>
              {loading ? 'Verifying...' : 'Verify and Update'}
            </button>
          ) : (
            <button className="btn btn-primary" type="button" onClick={onStart} disabled={loading || !state.value.trim()}>
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SearchableMultiSelector({
  label,
  emptyText,
  options,
  selected,
  onSelect,
  onRemove
}: {
  label: string;
  emptyText: string;
  options: string[];
  selected: string[];
  onSelect: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const selectedKeys = useMemo(() => new Set(selected.map((value) => value.toLowerCase())), [selected]);
  const matches = useMemo(() => {
    const terms = query
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);
    return options
      .filter((option) => !selectedKeys.has(option.toLowerCase()))
      .filter((option) => terms.every((term) => option.toLowerCase().includes(term)))
      .slice(0, 12);
  }, [options, query, selectedKeys]);

  function choose(value: string) {
    onSelect(value);
    setQuery('');
    setOpen(false);
  }

  return (
    <div className="form-group iam-profile-field wide iam-searchable-selector">
      <span className="form-label">{label}</span>
      <div className="category-picker">
        <input
          className="form-input"
          type="search"
          value={query}
          aria-label={`Search ${label}`}
          placeholder={`Search ${label.toLowerCase()}`}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
        />
        <div className={`category-results ${open ? 'open' : ''}`} role="listbox" aria-label={label}>
          {matches.length ? (
            matches.map((option) => (
              <button className="category-result-option" type="button" role="option" key={option} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>
                {option}
              </button>
            ))
          ) : (
            <div className="category-result-empty">No matching listed option</div>
          )}
        </div>
      </div>
      <div className="selected-category-list">
        {selected.length ? (
          selected.map((item) => (
            <div className="selected-category-row" key={item}>
              <span>{item}</span>
              <button type="button" className="selected-category-remove" onClick={() => onRemove(item)} aria-label={`Remove ${item}`}>
                Remove
              </button>
            </div>
          ))
        ) : (
          <div className="scope-empty">{emptyText}</div>
        )}
      </div>
    </div>
  );
}
