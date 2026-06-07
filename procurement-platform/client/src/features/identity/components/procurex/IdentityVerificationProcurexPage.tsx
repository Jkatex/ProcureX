import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { setSessionUser } from '@/features/auth/slice';
import { identityApi } from '@/features/identity/api';
import type { BusinessRegistrationSource, EntityType, RegistryRecord, VerificationSubmitResult } from '@/features/identity/types';
import { apiErrorMessage } from '@/shared/api/errors';
import { useBodyPageMetadata } from '@/shared/hooks/useBodyPageMetadata';

type EkycStep = 1 | 2 | 3 | 4;

const applicantCards: Array<{
  type: EntityType;
  title: string;
  copy: string;
}> = [
  {
    type: 'individual',
    title: 'Individual',
    copy: 'Use a TIN number. ProcureX fetches TRA details for user review.'
  },
  {
    type: 'company',
    title: 'Company',
    copy: 'Use a BRELA company number and verify company registry details.'
  },
  {
    type: 'business',
    title: 'Business',
    copy: 'Choose local government/TIN or BRELA business registration.'
  }
];

const signatureConsentVersion = '2026.06.06';
const signatureConsentTitle = 'ProcureX identity verification signature consent';

function sourceFor(entityType: EntityType, businessRegistrationSource: BusinessRegistrationSource) {
  if (entityType === 'company') return 'BRELA';
  if (entityType === 'business' && businessRegistrationSource === 'brela') return 'BRELA';
  return 'TRA';
}

function registryLabel(entityType: EntityType, businessRegistrationSource: BusinessRegistrationSource) {
  if (entityType === 'company') return 'BRELA company number';
  if (entityType === 'business' && businessRegistrationSource === 'brela') return 'BRELA business number';
  return 'TIN number';
}

function registryPlaceholder(entityType: EntityType, businessRegistrationSource: BusinessRegistrationSource) {
  return `Enter ${registryLabel(entityType, businessRegistrationSource)}`;
}

function payloadRows(record: RegistryRecord) {
  return Object.entries(record.payload).filter(([, value]) => value !== null && value !== undefined && value !== '');
}

function stringValue(value: unknown) {
  if (Array.isArray(value)) return value.join(', ');
  if (typeof value === 'object' && value !== null) return JSON.stringify(value);
  return String(value);
}

function friendlyIdentityMessage(error: unknown, fallback: string) {
  const axiosError = error as { response?: { status?: number; data?: { message?: string } }; message?: string };
  const status = axiosError.response?.status;
  const serverMessage = axiosError.response?.data?.message || axiosError.message || '';

  if (status === 404) return 'No matching official registry record was found. Check the number and applicant type, then try again.';
  if (status === 409 && /duplicate|already uses/i.test(serverMessage)) {
    return 'This registry number is already linked to an approved ProcureX account. The verification will need admin review.';
  }
  if (status === 409) return serverMessage || 'The registry record must be fetched and confirmed before submitting.';
  if (status === 502) return 'The registry service is not available right now. Please try again later.';

  return apiErrorMessage(error, fallback);
}

export function IdentityVerificationProcurexPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const authUser = useAppSelector((state) => state.auth.user);
  const [step, setStep] = useState<EkycStep>(1);
  const [entityType, setEntityType] = useState<EntityType>('individual');
  const [businessRegistrationSource, setBusinessRegistrationSource] = useState<BusinessRegistrationSource>('tin');
  const [registryNumber, setRegistryNumber] = useState('');
  const [registryRecord, setRegistryRecord] = useState<RegistryRecord | null>(null);
  const [registryVerified, setRegistryVerified] = useState(false);
  const [signatureName, setSignatureName] = useState('');
  const [signatureTitle, setSignatureTitle] = useState('');
  const [signatureConsent, setSignatureConsent] = useState(false);
  const [result, setResult] = useState<VerificationSubmitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useBodyPageMetadata('iam-verification');

  const registrySource = useMemo(() => sourceFor(entityType, businessRegistrationSource), [businessRegistrationSource, entityType]);
  const canContinueRegistry = Boolean(registryRecord && registryVerified && registryRecord.registryNumber === registryNumber.trim());
  const canSubmit = canContinueRegistry && signatureName.trim().length > 1 && signatureConsent;

  useEffect(() => {
    let active = true;

    async function loadVerification() {
      try {
        const response = await identityApi.getVerificationMe();
        if (!active) return;
        dispatch(setSessionUser(response.user));
        const payload = response.verification?.payload ?? {};
        const savedEntity = payload.entityType === 'company' || payload.entityType === 'business' || payload.entityType === 'individual' ? payload.entityType : undefined;
        const savedSource = payload.businessRegistrationSource === 'brela' || payload.businessRegistrationSource === 'tin' ? payload.businessRegistrationSource : undefined;
        const savedRecord = payload.registryRecord && typeof payload.registryRecord === 'object' ? (payload.registryRecord as RegistryRecord) : null;

        if (savedEntity) setEntityType(savedEntity);
        if (savedSource) setBusinessRegistrationSource(savedSource);
        if (typeof payload.registryNumber === 'string') setRegistryNumber(payload.registryNumber);
        if (typeof payload.registryVerified === 'boolean') setRegistryVerified(payload.registryVerified);
        if (typeof payload.signatureName === 'string') setSignatureName(payload.signatureName);
        if (typeof payload.signatureTitle === 'string') setSignatureTitle(payload.signatureTitle);
        if (typeof payload.signatureConsent === 'boolean') setSignatureConsent(payload.signatureConsent);
        if (savedRecord?.id) setRegistryRecord(savedRecord);
      } catch (error) {
        if (active) setMessage(apiErrorMessage(error, 'Could not load your verification profile.'));
      }
    }

    void loadVerification();
    return () => {
      active = false;
    };
  }, [dispatch]);

  function chooseEntity(nextType: EntityType) {
    const nextSource: BusinessRegistrationSource = nextType === 'business' ? 'brela' : 'tin';
    setEntityType(nextType);
    setBusinessRegistrationSource(nextSource);
    setRegistryNumber('');
    setRegistryRecord(null);
    setRegistryVerified(false);
    setMessage('');
  }

  function chooseBusinessSource(nextSource: BusinessRegistrationSource) {
    setBusinessRegistrationSource(nextSource);
    setRegistryNumber('');
    setRegistryRecord(null);
    setRegistryVerified(false);
    setMessage('');
  }

  async function saveDraft(nextStep: EkycStep) {
    setLoading(true);
    setMessage('');

    try {
      await identityApi.saveVerificationDraft({
        entityType,
        businessRegistrationSource,
        registrySource,
        registryNumber: registryNumber.trim(),
        registryVerified,
        registryRecordId: registryRecord?.id,
        signatureName,
        signatureTitle,
        signatureConsent,
        signatureConsentVersion,
        signatureConsentTitle
      });
      if (authUser && authUser.verificationStatus === 'NOT_STARTED') {
        dispatch(setSessionUser({ ...authUser, verificationStatus: 'DRAFT' }));
      }
      setStep(nextStep);
    } catch (error) {
      setMessage(apiErrorMessage(error, 'Could not save the verification draft.'));
    } finally {
      setLoading(false);
    }
  }

  async function fetchRegistry() {
    setLoading(true);
    setMessage('');
    setRegistryRecord(null);
    setRegistryVerified(false);

    try {
      const record = await identityApi.lookupRegistry({
        entityType,
        businessRegistrationSource,
        registryNumber: registryNumber.trim()
      });
      setRegistryRecord(record);
      setRegistryNumber(record.registryNumber);
      setSignatureName((current) => current || record.name);
      setMessage(`${record.source} record fetched. Review and confirm the details.`);
    } catch (error) {
      setMessage(friendlyIdentityMessage(error, 'No matching registry record was found.'));
    } finally {
      setLoading(false);
    }
  }

  async function submitVerification(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!registryRecord || !canSubmit) {
      setMessage('Complete registry confirmation and digital signature before submitting.');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const submitted = await identityApi.submitVerification({
        entityType,
        businessRegistrationSource,
        registrySource: registryRecord.source,
        registryNumber: registryRecord.registryNumber,
        registryVerified: true,
        registryRecordId: registryRecord.id,
        signatureName: signatureName.trim(),
        signatureTitle: signatureTitle.trim(),
        signatureConsent: true,
        signatureConsentVersion,
        signatureConsentTitle,
        profile: {
          displayName: registryRecord.name,
          country: 'Tanzania',
          preferredLanguage: 'English'
        },
        documents: [
          {
            type: 'registry',
            source: registryRecord.source,
            registryNumber: registryRecord.registryNumber,
            status: 'fetched'
          }
        ]
      });
      dispatch(setSessionUser(submitted.user));
      setResult(submitted);
      setStep(4);
    } catch (error) {
      setMessage(friendlyIdentityMessage(error, 'Could not submit verification.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="ekyc-page">
      <div className="ekyc-shell">
        <aside className="ekyc-side">
          <button className="ekyc-brand" type="button" onClick={() => navigate('/')}>
            <span className="platform-logo">
              <img className="platform-logo-image" src="/assets/logo.svg" alt="ProcureX" />
            </span>
            <div>
              <strong>ProcureX</strong>
              <span>Registration</span>
            </div>
          </button>

          <div className="ekyc-side-status">
            <span className={authUser?.verificationStatus === 'APPROVED' ? 'badge badge-success' : 'badge badge-warning'}>
              {authUser?.verificationStatus === 'APPROVED' ? 'Identity verified' : 'Identity verification required'}
            </span>
            <h2>Verify the account before dashboard access.</h2>
            <p>Choose applicant type, verify TRA or BRELA registry information, and create a secure digital signature record for the account.</p>
          </div>

          <ol className="ekyc-steps">
            {['Applicant type', 'Registry lookup', 'Digital signature', 'Complete'].map((label, index) => {
              const itemStep = (index + 1) as EkycStep;
              return (
                <li className={`${step === itemStep ? 'active' : ''} ${step > itemStep ? 'completed' : ''}`} key={label}>
                  <span>{itemStep}</span>
                  {label}
                </li>
              );
            })}
          </ol>
        </aside>

        <main className="ekyc-main">
          <div className="ekyc-header">
            <div>
              <span className="section-kicker">Account registration</span>
              <h1>Identity verification flow</h1>
              <p>Registry data, consent, and signature hashes are saved to the verification profile and decide whether the account can access ProcureX apps immediately.</p>
            </div>
            <span className="badge badge-info">{authUser?.displayName ?? 'Current account'}</span>
          </div>

          <form className="ekyc-form" onSubmit={(event) => void submitVerification(event)}>
            <section className={`ekyc-section ekyc-step-panel ${step === 1 ? 'active' : ''}`}>
              <div className="ekyc-section-heading">
                <span className="ekyc-step-badge">1</span>
                <div>
                  <h2>Select applicant type</h2>
                  <p>Choose the card that matches how this account should be verified.</p>
                </div>
              </div>

              <div className="ekyc-role-grid three">
                {applicantCards.map((card) => (
                  <label className={`ekyc-role-card ${entityType === card.type ? 'selected' : ''}`} key={card.type}>
                    <input type="radio" name="entityType" value={card.type} checked={entityType === card.type} onChange={() => chooseEntity(card.type)} />
                    <span className="ekyc-role-icon">{card.type.slice(0, 1).toUpperCase()}</span>
                    <strong>{card.title}</strong>
                    <small>{card.copy}</small>
                  </label>
                ))}
              </div>

              <div className="ekyc-step-actions">
                <button type="button" className="btn btn-primary" disabled={loading} onClick={() => void saveDraft(2)}>
                  Continue
                </button>
              </div>
            </section>

            <section className={`ekyc-section ekyc-step-panel ${step === 2 ? 'active' : ''}`}>
              <div className="ekyc-section-heading">
                <span className="ekyc-step-badge">2</span>
                <div>
                  <h2>Enter {registryLabel(entityType, businessRegistrationSource)}</h2>
                  <p>{registrySource} details will be fetched and shown here for confirmation.</p>
                </div>
              </div>

              <div className="ekyc-grid two">
                {entityType === 'business' ? (
                  <div className="business-registry-fields span-2">
                    <label className="form-label-new">Business registration source *</label>
                    <div className="ekyc-role-grid compact">
                      {(['tin', 'brela'] as BusinessRegistrationSource[]).map((source) => (
                        <label className={`ekyc-role-card ${businessRegistrationSource === source ? 'selected' : ''}`} key={source}>
                          <input
                            type="radio"
                            name="businessRegistrationSource"
                            value={source}
                            checked={businessRegistrationSource === source}
                            onChange={() => chooseBusinessSource(source)}
                          />
                          <span className="ekyc-role-icon">{source === 'tin' ? 'TIN' : 'BRELA'}</span>
                          <strong>{source === 'tin' ? 'Local Government / TIN' : 'BRELA Number'}</strong>
                          <small>{source === 'tin' ? 'Use a TIN number for locally registered business.' : 'Use the BRELA business number.'}</small>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div className="form-group-new">
                  <label className="form-label-new">{registryLabel(entityType, businessRegistrationSource)} *</label>
                  <input
                    className="form-input-new"
                    type="text"
                    value={registryNumber}
                    placeholder={registryPlaceholder(entityType, businessRegistrationSource)}
                    onChange={(event) => {
                      setRegistryNumber(event.target.value);
                      setRegistryRecord(null);
                      setRegistryVerified(false);
                    }}
                    autoComplete="off"
                  />
                  <span className="form-hint-new">Enter the identifier exactly as shown on the official registry record.</span>
                </div>

                <div className="ekyc-fetch-panel">
                  <span className="badge badge-info">{registrySource} lookup</span>
                  <p>The lookup checks the registry database and returns the matching official record for review.</p>
                  <button type="button" className="btn btn-secondary" disabled={loading || registryNumber.trim().length < 3} onClick={() => void fetchRegistry()}>
                    {loading ? 'Fetching...' : 'Fetch and review'}
                  </button>
                </div>
              </div>

              {registryRecord ? (
                <div className="registry-review">
                  <div className="registry-review-header">
                    <div>
                      <span className="section-kicker">Fetched information</span>
                      <h3>{registryRecord.name}</h3>
                    </div>
                    <span className={registryRecord.status === 'MATCHED' ? 'badge badge-success' : 'badge badge-warning'}>{registryRecord.status}</span>
                  </div>
                  <div className="registry-summary">
                    <div>
                      <span>Source</span>
                      <strong>{registryRecord.source}</strong>
                    </div>
                    <div>
                      <span>Registry number</span>
                      <strong>{registryRecord.registryNumber}</strong>
                    </div>
                    <div>
                      <span>Confidence</span>
                      <strong>{registryRecord.confidence}%</strong>
                    </div>
                    {payloadRows(registryRecord).map(([key, value]) => (
                      <div key={key}>
                        <span>{key.replace(/([A-Z])/g, ' $1')}</span>
                        <strong>{stringValue(value)}</strong>
                      </div>
                    ))}
                  </div>
                  <label className={`confirm-action ${registryVerified ? 'confirmed' : ''}`}>
                    <input className="confirm-action-input" type="checkbox" checked={registryVerified} onChange={(event) => setRegistryVerified(event.target.checked)} />
                    <span>Confirm registry information</span>
                  </label>
                </div>
              ) : null}

              <div className="ekyc-step-actions split">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(1)}>
                  Back
                </button>
                <button type="button" className="btn btn-primary" disabled={loading || !canContinueRegistry} onClick={() => void saveDraft(3)}>
                  Continue
                </button>
              </div>
            </section>

            <section className={`ekyc-section ekyc-step-panel ${step === 3 ? 'active' : ''}`}>
              <div className="ekyc-section-heading">
                <span className="ekyc-step-badge">3</span>
                <div>
                  <h2>Create digital signature</h2>
                  <p>The signer name and consent are sealed into a server-generated signature hash with audit metadata for ProcureX actions.</p>
                </div>
              </div>

              <div className="signature-panel">
                <div className="ekyc-grid two">
                  <div className="form-group-new">
                    <label className="form-label-new">Signer full name *</label>
                    <input className="form-input-new" type="text" value={signatureName} onChange={(event) => setSignatureName(event.target.value)} />
                  </div>

                  <div className="form-group-new">
                    <label className="form-label-new">Signer title</label>
                    <input className="form-input-new" type="text" value={signatureTitle} placeholder="Owner, director, officer" onChange={(event) => setSignatureTitle(event.target.value)} />
                  </div>
                </div>

                <div className="signature-preview">{signatureName.trim() || 'Typed signature preview'}</div>

                <label className={`confirm-action ${signatureConsent ? 'confirmed' : ''}`}>
                  <input className="confirm-action-input" type="checkbox" checked={signatureConsent} onChange={(event) => setSignatureConsent(event.target.checked)} />
                  <span>Confirm digital signature consent</span>
                </label>
                <p className="form-hint-new">{signatureConsentTitle} v{signatureConsentVersion}</p>
              </div>

              <div className="ekyc-step-actions split">
                <button type="button" className="btn btn-secondary" onClick={() => setStep(2)}>
                  Back
                </button>
                <button type="submit" className="btn btn-primary" disabled={loading || !canSubmit}>
                  {loading ? 'Submitting...' : 'Submit verification'}
                </button>
              </div>
            </section>

            <section className={`ekyc-section ekyc-step-panel ${step === 4 ? 'active' : ''}`}>
              <div className="ekyc-complete">
                <span className="ekyc-complete-icon">{result?.user.verificationStatus === 'APPROVED' ? 'OK' : '!'}</span>
                <span className="section-kicker">Verification submitted</span>
                <h2>{result?.autoApproved ? 'Identity verification approved' : 'Verification is pending admin review'}</h2>
                <p>
                  {result?.autoApproved
                    ? 'The registry match and signature passed the approval checks. ProcureX apps are now available.'
                    : 'The account record was saved and routed to platform admin for a decision.'}
                </p>

                <div className="registry-summary complete-summary">
                  <div>
                    <span>Applicant type</span>
                    <strong>{entityType}</strong>
                  </div>
                  <div>
                    <span>Registry source</span>
                    <strong>{registryRecord?.source ?? registrySource}</strong>
                  </div>
                  <div>
                    <span>Verified name</span>
                    <strong>{registryRecord?.name ?? 'Pending'}</strong>
                  </div>
                  <div>
                    <span>Status</span>
                    <strong>{result?.user.verificationStatus ?? authUser?.verificationStatus ?? 'DRAFT'}</strong>
                  </div>
                  {result?.verification.payload.digitalSignature &&
                  typeof result.verification.payload.digitalSignature === 'object' &&
                  'status' in result.verification.payload.digitalSignature ? (
                    <div>
                      <span>Digital signature</span>
                      <strong>{String(result.verification.payload.digitalSignature.status)}</strong>
                    </div>
                  ) : null}
                </div>

                {result?.reviewReasons.length ? (
                  <div className="auth-note">
                    <strong>Review reasons:</strong> {result.reviewReasons.join(' ')}
                  </div>
                ) : null}
              </div>

              <div className="ekyc-step-actions split">
                <button type="button" className="btn btn-secondary" onClick={() => navigate('/identity/profile')}>
                  Open profile
                </button>
                <button type="button" className="btn btn-primary" disabled={result?.user.verificationStatus !== 'APPROVED'} onClick={() => navigate('/dashboard')}>
                  Open dashboard
                </button>
              </div>
            </section>
          </form>

          {message ? <p className="auth-note">{message}</p> : null}
        </main>
      </div>
    </div>
  );
}
