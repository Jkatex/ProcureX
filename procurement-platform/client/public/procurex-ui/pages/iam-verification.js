// identity verification page shown after first sign-in for new accounts.

function renderIamRegistrySummary(registryRecord = {}, profile = {}) {
    const rows = Array.isArray(registryRecord.summaryRows) && registryRecord.summaryRows.length
        ? registryRecord.summaryRows
        : [
            ['Source', registryRecord.source || profile.registrySource || 'TRA / BRELA'],
            ['Reference', registryRecord.reference || profile.tinNumber || profile.brelaNumber || profile.businessNumber || 'Stored on account'],
            ['Status', registryRecord.status || profile.verifiedStatus || 'Verified'],
            ['Registered', registryRecord.registeredOn || 'Stored registry date'],
            ['Location', registryRecord.location || 'Stored registry location']
        ];

    return rows
        .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
        .map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`)
        .join('');
}

function renderIamVerification() {
    const accountEmail = mockData.session?.email || mockData.pendingAccount?.email || '';
    const profile = mockData.eKycProfile || {};
    const account = mockData.pendingAccount || {};
    const registryRecord = profile.registryRecord || {};
    const isUpdateMode = profile.status === 'completed' || account.ekycCompleted || mockData.session?.isNewUser === false;
    const savedType = profile.entityType || 'individual';
    const savedBusinessSource = profile.businessRegistrationSource || (profile.businessNumber ? 'brela' : 'tin');
    const initialStep = isUpdateMode ? 2 : 1;
    const hasRegistryRecord = Boolean(registryRecord.reference || profile.registryVerified);
    const signatureName = profile.signatureName || '';
    const signatureTitle = profile.signatureTitle || '';
    const completeSummaryCopy = isUpdateMode
        ? 'Review the updated verification record before saving. Only changed registry or signature details need to be verified again.'
        : 'The onboarding record is ready. Completing this demo will mark the account as verified and open the ProcureX app launcher.';
    const registrySummary = hasRegistryRecord ? renderIamRegistrySummary(registryRecord, profile) : '';
    const registryKicker = registryRecord.source === 'TRA' ? 'TRA Information (Fetched)' : 'Fetched information';

    return `
        <div class="ekyc-page">
            <div class="ekyc-shell">
                <aside class="ekyc-side">
                    <div class="ekyc-brand" data-navigate="welcome">
                        ${renderPlatformLogo()}
                        <div>
                            <strong>ProcureX</strong>
                            <span>Registration</span>
                        </div>
                    </div>

                    <div class="ekyc-side-status">
                        <span class="badge ${isUpdateMode ? 'badge-info' : 'badge-warning'}">${isUpdateMode ? 'Verification update' : 'Identity verification required'}</span>
                        <h2>${isUpdateMode ? 'Update saved verification information.' : 'Verify the account before dashboard access.'}</h2>
                        <p>${isUpdateMode ? 'Edit only the fields that changed. TIN, BRELA, and digital signature changes must be matched and confirmed before saving.' : 'New users choose whether they are an individual, company, or business, verify registry information, and create a digital signature before opening the app launcher.'}</p>
                    </div>

                    <ol class="ekyc-steps" data-ekyc-steps>
                        <li class="${initialStep === 1 ? 'active' : 'completed'}" data-step-indicator="1"><span>1</span>Applicant type</li>
                        <li class="${initialStep === 2 ? 'active' : ''}" data-step-indicator="2"><span>2</span>${isUpdateMode ? 'Registry update' : 'Registry lookup'}</li>
                        <li data-step-indicator="3"><span>3</span>Digital signature</li>
                        <li data-step-indicator="4"><span>4</span>${isUpdateMode ? 'Save update' : 'Complete'}</li>
                    </ol>
                </aside>

                <main class="ekyc-main">
                    <div class="ekyc-header">
                        <div>
                            <span class="section-kicker">${isUpdateMode ? 'Account profile update' : 'Account registration'}</span>
                            <h1>${isUpdateMode ? 'Update verification details' : 'Identity verification flow'}</h1>
                            <p>${accountEmail ? `Signed in as ${accountEmail}. ` : ''}${isUpdateMode ? 'Your verified profile is already loaded. Update the changed fields, fetch matching registry details when TIN or BRELA changes, confirm the signature, and save.' : 'Start with applicant type, fetch TRA or BRELA details for review, create a digital signature, then continue to the app launcher.'}</p>
                        </div>
                        <span class="badge badge-info">${isUpdateMode ? 'Edit mode' : 'Demo flow'}</span>
                    </div>

                    <form class="ekyc-form" data-action="complete-ekyc" data-ekyc-mode="${isUpdateMode ? 'update' : 'onboarding'}" data-registry-fetched="${hasRegistryRecord ? 'true' : ''}" novalidate>
                        <section class="ekyc-section ekyc-step-panel ${initialStep === 1 ? 'active' : ''}" data-ekyc-step="1">
                            <div class="ekyc-section-heading">
                                <span class="ekyc-step-badge">1</span>
                                <div>
                                    <h2>${isUpdateMode ? 'Confirm applicant type' : 'Select applicant type'}</h2>
                                    <p>${isUpdateMode ? 'The existing applicant type is loaded. Change it only if the verification record must move to a different verification path.' : 'Choose the card that matches how this account should be verified.'}</p>
                                </div>
                            </div>

                            <div class="ekyc-role-grid three">
                                <label class="ekyc-role-card ${savedType === 'individual' ? 'selected' : ''}" data-applicant-card>
                                    <input type="radio" name="entityType" value="individual" ${savedType === 'individual' ? 'checked' : ''}>
                                    <span class="ekyc-role-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M20 21a8 8 0 0 0-16 0"/>
                                            <circle cx="12" cy="7" r="4"/>
                                        </svg>
                                    </span>
                                    <strong>Individual</strong>
                                    <small>Use TIN number. ProcureX will fetch TRA details for user review.</small>
                                </label>

                                <label class="ekyc-role-card ${savedType === 'company' ? 'selected' : ''}" data-applicant-card>
                                    <input type="radio" name="entityType" value="company" ${savedType === 'company' ? 'checked' : ''}>
                                    <span class="ekyc-role-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M3 21h18"/>
                                            <path d="M5 21V7l8-4v18"/>
                                            <path d="M19 21V11l-6-4"/>
                                            <path d="M9 9h1M9 13h1M9 17h1"/>
                                        </svg>
                                    </span>
                                    <strong>Company</strong>
                                    <small>Use a BRELA company number and verify company registry details.</small>
                                </label>

                                <label class="ekyc-role-card ${savedType === 'business' ? 'selected' : ''}" data-applicant-card>
                                    <input type="radio" name="entityType" value="business" ${savedType === 'business' ? 'checked' : ''}>
                                    <span class="ekyc-role-icon">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <path d="M4 21V9l8-6 8 6v12"/>
                                            <path d="M9 21v-7h6v7"/>
                                            <path d="M8 10h.01M16 10h.01"/>
                                        </svg>
                                    </span>
                                    <strong>Business</strong>
                                    <small>Choose whether the business is registered by local government with TIN or by BRELA.</small>
                                </label>
                            </div>

                            <div class="ekyc-step-actions">
                                <button type="button" class="btn btn-primary" data-ekyc-next>Continue</button>
                            </div>
                        </section>

                        <section class="ekyc-section ekyc-step-panel ${initialStep === 2 ? 'active' : ''}" data-ekyc-step="2">
                            <div class="ekyc-section-heading">
                                <span class="ekyc-step-badge">2</span>
                                <div>
                                    <h2 data-registry-title>Enter TIN number</h2>
                                    <p data-registry-copy>TRA details will be fetched for the individual and shown here for confirmation.</p>
                                </div>
                            </div>

                            <div class="ekyc-grid two">
                                <div class="business-registry-fields span-2 ekyc-hidden">
                                    <label class="form-label-new">Business registration source *</label>
                                    <div class="ekyc-role-grid compact">
                                        <label class="ekyc-role-card ${savedBusinessSource !== 'brela' ? 'selected' : ''}">
                                            <input type="radio" name="businessRegistrationSource" value="tin" ${savedBusinessSource !== 'brela' ? 'checked' : ''}>
                                            <span class="ekyc-role-icon">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M4 4h16v16H4z"/>
                                                    <path d="M8 9h8M8 13h8M8 17h5"/>
                                                </svg>
                                            </span>
                                            <strong>Local Government / TIN</strong>
                                            <small>Use the registered TIN number for a business registered by local government.</small>
                                        </label>

                                        <label class="ekyc-role-card ${savedBusinessSource === 'brela' ? 'selected' : ''}">
                                            <input type="radio" name="businessRegistrationSource" value="brela" ${savedBusinessSource === 'brela' ? 'checked' : ''}>
                                            <span class="ekyc-role-icon">
                                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                                    <path d="M3 21h18"/>
                                                    <path d="M6 21V7h8v14"/>
                                                    <path d="M14 11h4v10"/>
                                                </svg>
                                            </span>
                                            <strong>BRELA Number</strong>
                                            <small>Use the BRELA business number when the business is registered by BRELA.</small>
                                        </label>
                                    </div>
                                </div>

                                <div class="form-group-new individual-fields">
                                    <label class="form-label-new">TIN number *</label>
                                    <input type="text" class="form-input-new" name="tinNumber" value="${profile.tinNumber || ''}" data-verified-value="${profile.tinNumber || ''}" placeholder="Example: 123-456-789" autocomplete="off">
                                    <span class="form-hint-new">Source: Tanzania Revenue Authority.</span>
                                    <span class="form-error-new"></span>
                                </div>

                                <div class="form-group-new company-fields ekyc-hidden">
                                    <label class="form-label-new">BRELA company number *</label>
                                    <input type="text" class="form-input-new" name="brelaNumber" value="${profile.brelaNumber || ''}" data-verified-value="${profile.brelaNumber || ''}" placeholder="Example: 123456789" autocomplete="off">
                                    <span class="form-hint-new">Source: BRELA company registry.</span>
                                    <span class="form-error-new"></span>
                                </div>

                                <div class="form-group-new business-fields ekyc-hidden">
                                    <label class="form-label-new">BRELA business number *</label>
                                    <input type="text" class="form-input-new" name="businessNumber" value="${profile.businessNumber || ''}" data-verified-value="${profile.businessNumber || ''}" placeholder="Example: BN-123456" autocomplete="off">
                                    <span class="form-hint-new">Source: BRELA business name registry.</span>
                                    <span class="form-error-new"></span>
                                </div>

                                <div class="ekyc-fetch-panel">
                                    <span class="badge badge-info" data-registry-source>TRA lookup</span>
                                    <p data-registry-hint>The lookup is mocked in this UI. Click fetch to show the TRA record the user must verify.</p>
                                    <button type="button" class="btn btn-secondary" data-fetch-registry>${isUpdateMode ? 'Fetch matched details' : 'Fetch and review'}</button>
                                </div>
                            </div>

                            <div class="registry-review ${hasRegistryRecord ? '' : 'ekyc-hidden'}" data-registry-review>
                                <div class="registry-review-header">
                                    <div>
                                        <span class="section-kicker" data-registry-kicker>${registryKicker}</span>
                                        <h3 data-registry-name>${registryRecord.name || profile.verifiedName || 'Waiting for lookup'}</h3>
                                    </div>
                                    <span class="badge badge-success">Matched</span>
                                </div>
                                <div class="registry-summary" data-registry-summary>${registrySummary}</div>
                                <div class="confirm-action" data-confirm-control>
                                    <input type="checkbox" class="confirm-action-input" name="registryVerified" ${profile.registryVerified || hasRegistryRecord ? 'checked' : ''}>
                                    <button type="button" class="confirm-action-button" data-confirm-toggle aria-pressed="false">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="M20 6L9 17l-5-5"/>
                                        </svg>
                                        <span>Confirm registry information</span>
                                    </button>
                                    <p class="confirm-action-note" data-confirm-note>
                                        Confirm that the fetched TRA or BRELA details have been reviewed and match the applicant.
                                    </p>
                                </div>
                            </div>

                            <div class="ekyc-step-actions split">
                                <button type="button" class="btn btn-secondary" data-ekyc-prev>Back</button>
                                <button type="button" class="btn btn-primary" data-ekyc-next>Continue</button>
                            </div>
                        </section>

                        <section class="ekyc-section ekyc-step-panel" data-ekyc-step="3">
                            <div class="ekyc-section-heading">
                                <span class="ekyc-step-badge">3</span>
                                <div>
                                    <h2>Create digital signature</h2>
                                    <p>This typed signature represents the verified user in this demo. Later implementation will anchor the digital signature with blockchain records.</p>
                                </div>
                            </div>

                            <div class="signature-panel">
                                <div class="ekyc-grid two">
                                    <div class="form-group-new">
                                        <label class="form-label-new">Signer full name *</label>
                                        <input type="text" class="form-input-new" name="signatureName" value="${signatureName}" data-verified-value="${signatureName}" placeholder="Full legal name">
                                        <span class="form-error-new"></span>
                                    </div>

                                    <div class="form-group-new">
                                        <label class="form-label-new">Signer title</label>
                                        <input type="text" class="form-input-new" name="signatureTitle" value="${signatureTitle}" data-verified-value="${signatureTitle}" placeholder="Owner, director, officer">
                                    </div>
                                </div>

                                <div class="signature-preview" id="signature-preview">
                                    ${signatureName ? `<strong>${signatureName}</strong><span>Digitally signed on ProcureX</span>` : '<span>Typed signature preview</span>'}
                                </div>

                                <div class="confirm-action" data-confirm-control>
                                    <input type="checkbox" class="confirm-action-input" name="signatureConsent" ${profile.signatureConsent ? 'checked' : ''}>
                                    <button type="button" class="confirm-action-button" data-confirm-toggle aria-pressed="false">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="M20 6L9 17l-5-5"/>
                                        </svg>
                                        <span>Confirm digital signature</span>
                                    </button>
                                    <p class="confirm-action-note" data-confirm-note>
                                        Confirm that this digital signature is authorized for this ProcureX account and may later be anchored on blockchain.
                                    </p>
                                </div>
                            </div>

                            <div class="ekyc-step-actions split">
                                <button type="button" class="btn btn-secondary" data-ekyc-prev>Back</button>
                                <button type="button" class="btn btn-primary" data-ekyc-next>Review completion</button>
                            </div>
                        </section>

                        <section class="ekyc-section ekyc-step-panel" data-ekyc-step="4">
                            <div class="ekyc-complete">
                                <span class="ekyc-complete-icon">OK</span>
                                <span class="section-kicker">${isUpdateMode ? 'Ready to save' : 'Ready for dashboard'}</span>
                                <h2>${isUpdateMode ? 'Verification update ready' : 'Identity verification complete'}</h2>
                                <p>${completeSummaryCopy}</p>

                                <div class="registry-summary complete-summary" data-ekyc-complete-summary>
                                    <div><span>Applicant type</span><strong>Individual</strong></div>
                                    <div><span>Registry source</span><strong>TRA</strong></div>
                                    <div><span>Signature</span><strong>Prepared</strong></div>
                                    <div><span>Blockchain anchor</span><strong>Pending implementation</strong></div>
                                </div>
                            </div>

                            <div class="ekyc-step-actions split">
                                <button type="button" class="btn btn-secondary" data-ekyc-prev>Back</button>
                                <button type="submit" class="btn btn-primary">${isUpdateMode ? 'Save Verification updates' : 'Complete and open apps'}</button>
                            </div>
                        </section>
                    </form>
                </main>
            </div>
        </div>
    `;
}
