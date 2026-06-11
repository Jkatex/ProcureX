import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/app/store';
import { useNotifications } from '@/features/notifications/hooks';
import { createEmptyTenderDraft, createTenderSetup, getSuggestedCriteria } from '../../createTenderConfig';
import { publishSimulatedTender, saveCreateTenderDraft, submitCreateTenderForEvaluation } from '../../slice';
import { NotificationCard } from '@/shared/components/NotificationCard';
import type {
  CreateTenderConfirmationId,
  CreateTenderDraft,
  CreateTenderEvaluationCriterion,
  CreateTenderLineItem,
  CreateTenderProcurementTypeId,
  CreateTenderRequirementTemplate
} from '../../types';

const steps = ['Basic Information', 'Procurement Planning', 'Tender Requirements', 'Evaluation Criteria and Weights', 'Review Tender', 'Tender Review and Publication'];
const confirmationLabels: Record<CreateTenderConfirmationId, string> = {
  accuracy: 'Tender details and dates are accurate.',
  compliance: 'The procurement method and requirements comply with internal rules.',
  evaluation: 'Evaluation criteria and weights are complete and balanced.',
  publication: 'This tender can be submitted for system evaluation and publication.'
};

const goodsSpecificationKey = (itemId: string) => `goods_spec_${itemId}`;

function getLineItemTotal(item: CreateTenderLineItem) {
  const quantity = Number(item.quantity);
  const unitPrice = Number(item.unitPrice);
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPrice) || !item.quantity || !item.unitPrice) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(quantity * unitPrice);
}

function downloadGoodsQuantityTemplate() {
  const csv = ['Item,Description,Unit,Qty,Unit Price,Total', '1,,,,,'].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'goods-quantity-schedule-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (const char of line) {
    if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells.map((cell) => cell.replace(/^"|"$/g, ''));
}

function parseGoodsQuantityCsv(text: string): CreateTenderLineItem[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((row) => row.some(Boolean));
  const dataRows = rows[0]?.join(' ').toLowerCase().includes('description') ? rows.slice(1) : rows;

  return dataRows.map((row, index) => ({
    id: `item-import-${Date.now()}-${index}`,
    description: row[1] || row[0] || '',
    unit: row[2] || '',
    quantity: row[3] || '',
    unitPrice: row[4] || ''
  }));
}

type PlanningBridge = {
  title?: string;
  description?: string;
  objective?: string;
  procuringEntity?: string;
  entity?: string;
  buyer?: string;
  location?: string;
  category?: string;
  categories?: string[];
  method?: string;
  fundingSource?: string;
  currency?: string;
  estimatedBudget?: string | number;
  budget?: string | number;
  clarificationDeadline?: string;
  publicationDate?: string;
  openingDate?: string;
  closingDate?: string;
  submissionDate?: string;
  startStep?: number;
  procurementType?: string;
};

export function CreateTenderProcurexPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { notifySuccess, notifyWarning } = useNotifications();
  const [draft, setDraft] = useState<CreateTenderDraft>(() => createEmptyTenderDraft());
  const [activeStep, setActiveStep] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [validationMessage, setValidationMessage] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newSupplier, setNewSupplier] = useState('');
  const [newDeliverable, setNewDeliverable] = useState('');
  const [newAttachment, setNewAttachment] = useState('');
  const [planWarningFields, setPlanWarningFields] = useState<string[]>([]);

  const selectedType = createTenderSetup.procurementTypes.find((type) => type.id === draft.procurementTypeId) ?? createTenderSetup.procurementTypes[0];
  const requirementTemplates = createTenderSetup.requirementTemplates.filter((template) => template.typeId === draft.procurementTypeId);
  const availableCategories = createTenderSetup.categories[draft.procurementTypeId];
  const availableLicenses = createTenderSetup.regulatoryLicenses[draft.procurementTypeId];
  const criteriaTotal = draft.evaluationCriteria.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);
  const canSaveDraft = hasMeaningfulDraft(draft);
  const confirmationsComplete = Object.values(draft.confirmations).every(Boolean);
  const contactVerified = (draft.contact.verifiedPhone && Boolean(draft.contact.phone)) || (draft.contact.verifiedEmail && Boolean(draft.contact.email));
  const activeStepBadge =
    activeStep === 0
      ? contactVerified
        ? 'Contact verified'
        : 'Verify contact'
      : activeStep === 1
        ? 'Method valid'
      : activeStep === 2
        ? draft.procurementTypeId === 'goods'
          ? 'Goods Tender Requirements'
          : selectedType.label
        : activeStep === 3
          ? 'Evaluation criteria'
            : activeStep === 4
              ? 'Buyer preview'
              : confirmationsComplete
                ? 'Evaluation complete'
                : 'Evaluation required';

  useEffect(() => {
    const bridge = readPlanningBridge();
    if (!bridge) return;

    setDraft((current) => {
      const next = applyPlanningBridge(current, bridge);
      return normalizeDraftForType(next, next.procurementTypeId);
    });
    if (bridge.startStep) setActiveStep(Math.min(Math.max(Number(bridge.startStep) - 1, 0), steps.length - 1));
  }, []);

  function patchDraft(patch: Partial<CreateTenderDraft>) {
    setDraft((current) => ({ ...current, ...patch, updatedAt: new Date().toISOString() }));
  }

  function patchPlanAware(field: keyof CreateTenderDraft, value: CreateTenderDraft[keyof CreateTenderDraft]) {
    if (draft.planFilledFields.includes(field as string) && !planWarningFields.includes(field as string)) {
      setPlanWarningFields((current) => [...current, field as string]);
    }
    patchDraft({ [field]: value } as Partial<CreateTenderDraft>);
  }

  function patchContact(field: keyof CreateTenderDraft['contact'], value: string | boolean) {
    patchDraft({ contact: { ...draft.contact, [field]: value } });
  }

  function changeType(typeId: CreateTenderProcurementTypeId) {
    patchDraft(normalizeDraftForType({ ...draft, procurementTypeId: typeId }, typeId));
  }

  function addCategory() {
    if (!newCategory || draft.categories.includes(newCategory)) return;
    patchDraft({ categories: [...draft.categories, newCategory] });
    setNewCategory('');
  }

  function removeCategory(category: string) {
    patchDraft({ categories: draft.categories.filter((item) => item !== category) });
  }

  function addSupplier() {
    const supplier = newSupplier.trim();
    if (!supplier || draft.invitedSuppliers.includes(supplier)) return;
    patchDraft({ invitedSuppliers: [...draft.invitedSuppliers, supplier] });
    setNewSupplier('');
  }

  function addLineItem() {
    const item: CreateTenderLineItem = { id: `item-${Date.now()}`, description: '', quantity: '', unit: '', unitPrice: '' };
    patchDraft({ commercialItems: [...draft.commercialItems, item] });
  }

  function updateLineItem(itemId: string, patch: Partial<CreateTenderLineItem>) {
    patchDraft({ commercialItems: draft.commercialItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) });
  }

  function addTextListValue(value: string, key: 'deliverables' | 'attachments', reset: () => void) {
    const text = value.trim();
    if (!text) return;
    patchDraft({ [key]: [...draft[key], text] } as Partial<CreateTenderDraft>);
    reset();
  }

  function toggleLicense(license: string) {
    const selectedLicenses = draft.selectedLicenses.includes(license)
      ? draft.selectedLicenses.filter((item) => item !== license)
      : [...draft.selectedLicenses, license];
    patchDraft({ selectedLicenses });
  }

  function addCriterion(criterion: CreateTenderEvaluationCriterion) {
    if (draft.evaluationCriteria.some((item) => item.id === criterion.id)) return;
    patchDraft({ evaluationCriteria: [...draft.evaluationCriteria, { ...criterion }] });
  }

  function updateCriterion(criterionId: string, patch: Partial<CreateTenderEvaluationCriterion>) {
    patchDraft({ evaluationCriteria: draft.evaluationCriteria.map((criterion) => (criterion.id === criterionId ? { ...criterion, ...patch } : criterion)) });
  }

  function removeCriterion(criterionId: string) {
    patchDraft({ evaluationCriteria: draft.evaluationCriteria.filter((criterion) => criterion.id !== criterionId) });
  }

  function goToStep(index: number) {
    setValidationMessage('');
    setActiveStep(index);
  }

  function continueStep() {
    const error = validateStep(activeStep, draft, criteriaTotal);
    if (error) {
      setValidationMessage(error);
      return;
    }
    setValidationMessage('');
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function saveDraft() {
    if (!canSaveDraft) {
      setValidationMessage('Add a tender detail first, then you can save this draft.');
      notifyWarning('Tender draft not ready', 'Add at least one tender detail before saving.', {
        reason: 'ProcureX needs meaningful tender information before it can keep a session draft.'
      });
      return;
    }
    const saved = { ...draft, status: 'DRAFT' as const, updatedAt: new Date().toISOString() };
    setDraft(saved);
    dispatch(saveCreateTenderDraft(saved));
    setStatusMessage('Draft saved for this session.');
    notifySuccess('Tender draft saved', 'Your tender draft was saved for this session.', {
      reason: 'You can continue editing it from My Tenders while this browser session is active.',
      action: { label: 'Open My Tenders', to: '/procurement/my-tenders' }
    });
    setValidationMessage('');
  }

  function submitTender() {
    if (!confirmationsComplete) {
      setValidationMessage('Please review and tick each publication confirmation before submitting.');
      notifyWarning('Tender cannot be submitted yet', 'Complete all publication confirmations before submitting.', {
        reason: 'ProcureX blocks publication until accuracy, compliance, evaluation, and publication confirmations are ticked.'
      });
      return;
    }
    const now = new Date().toISOString();
    const submitted = { ...draft, status: 'SUBMITTED' as const, submittedAt: now, updatedAt: now };
    const published = { ...submitted, status: 'PUBLISHED' as const, publishedAt: now };
    dispatch(submitCreateTenderForEvaluation(submitted));
    dispatch(publishSimulatedTender(published));
    notifySuccess('Tender submitted', 'Your tender was submitted for evaluation and published to the marketplace.', {
      reason: 'A marketplace record and My Tenders record were created for this session.'
    });
    navigate('/procurement/my-tenders');
  }

  return (
    <div className="procurement-app-page tender-wizard-page" data-create-tender-root>
      <section className="journey-hero compact">
        <div>
          <span className="badge badge-info">Procurement design</span>
          <h1>Create Tender Wizard</h1>
          <p>Build a tender package that matches the procurement nature, then publish it directly to the marketplace.</p>
        </div>
        <div className="hero-action-stack">
          <button className="btn btn-secondary" type="button" onClick={saveDraft} disabled={!canSaveDraft}>
            Save Draft
          </button>
        </div>
      </section>

      <main className="wizard-shell" data-create-tender-wizard>
        <nav className="wizard-step-progress" aria-label="Tender progress">
          {steps.map((step, index) => {
            const stateClass = index === activeStep ? 'active' : index < activeStep ? 'completed' : '';
            return (
              <button
                key={step}
                type="button"
                className={`wizard-progress-step ${stateClass}`}
                onClick={() => goToStep(index)}
                aria-current={index === activeStep ? 'step' : undefined}
              >
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <span>{step}</span>
              </button>
            );
          })}
        </nav>

        <div className="wizard-workspace">
          <section className="journey-panel active">
            {statusMessage ? (
              <NotificationCard notification={{ tone: 'success', title: 'Tender updated', message: statusMessage, reason: 'This confirmation applies to the current browser session.', dismissible: false }} />
            ) : null}
            {validationMessage ? (
              <NotificationCard notification={{ tone: 'error', title: 'Action needed', message: validationMessage, reason: 'Review the current tender step and complete the missing information.', dismissible: false }} />
            ) : null}
            {planWarningFields.length ? <div className="planning-section planning-section-notice">Planning handoff fields were edited: {planWarningFields.join(', ')}.</div> : null}

            <div className="panel-heading">
              <div>
                <span className="section-kicker">Step {activeStep + 1}</span>
                <h2>{steps[activeStep]}</h2>
              </div>
              <span className="badge badge-info">{activeStepBadge}</span>
            </div>

            <div className="journey-panel-content">
              {activeStep === 0 ? (
                <BasicInfoStep draft={draft} onPatch={patchPlanAware} onContactPatch={patchContact} />
              ) : null}
              {activeStep === 1 ? (
                <PlanningStep
                  draft={draft}
                  selectedType={selectedType}
                  availableCategories={availableCategories}
                  newCategory={newCategory}
                  newSupplier={newSupplier}
                  onTypeChange={changeType}
                  onPatch={patchPlanAware}
                  onNewCategory={setNewCategory}
                  onAddCategory={addCategory}
                  onRemoveCategory={removeCategory}
                  onNewSupplier={setNewSupplier}
                  onAddSupplier={addSupplier}
                />
              ) : null}
              {activeStep === 2 ? (
                <RequirementsStep
                  draft={draft}
                  templates={requirementTemplates}
                  licenses={availableLicenses}
                  newDeliverable={newDeliverable}
                  newAttachment={newAttachment}
                  onPatch={patchDraft}
                  onToggleLicense={toggleLicense}
                  onAddLineItem={addLineItem}
                  onUpdateLineItem={updateLineItem}
                  onNewDeliverable={setNewDeliverable}
                  onNewAttachment={setNewAttachment}
                  onAddDeliverable={() => addTextListValue(newDeliverable, 'deliverables', () => setNewDeliverable(''))}
                  onAddAttachment={() => addTextListValue(newAttachment, 'attachments', () => setNewAttachment(''))}
                />
              ) : null}
              {activeStep === 3 ? (
                <EvaluationStep
                  draft={draft}
                  total={criteriaTotal}
                  suggestions={createTenderSetup.evaluationCatalog.filter((criterion) => criterion.suggestedFor.includes(draft.procurementTypeId))}
                  onAddCriterion={addCriterion}
                  onUpdateCriterion={updateCriterion}
                  onRemoveCriterion={removeCriterion}
                />
              ) : null}
              {activeStep === 4 ? <ReviewStep draft={draft} selectedTypeLabel={selectedType.label} total={criteriaTotal} /> : null}
              {activeStep === 5 ? <PublicationStep draft={draft} onPatch={patchDraft} confirmationsComplete={confirmationsComplete} /> : null}
            </div>

            <footer className="wizard-flow-controls" data-wizard-flow-controls>
              <button className="btn btn-secondary" type="button" onClick={() => setActiveStep((current) => Math.max(current - 1, 0))} disabled={activeStep === 0}>
                Back
              </button>
              <div className="wizard-flow-progress">
                <strong>Step {activeStep + 1} of {steps.length}</strong>
                <span>{steps[activeStep]}</span>
              </div>
              {activeStep < steps.length - 1 ? (
                <button className="btn btn-primary" type="button" onClick={continueStep}>
                  Continue
                </button>
              ) : (
                <button className="btn btn-primary" type="button" onClick={submitTender} disabled={!confirmationsComplete}>
                  Submit Tender for Evaluation
                </button>
              )}
            </footer>
          </section>
        </div>
      </main>
    </div>
  );
}

function BasicInfoStep({
  draft,
  onPatch,
  onContactPatch
}: {
  draft: CreateTenderDraft;
  onPatch: (field: keyof CreateTenderDraft, value: CreateTenderDraft[keyof CreateTenderDraft]) => void;
  onContactPatch: (field: keyof CreateTenderDraft['contact'], value: string | boolean) => void;
}) {
  const phoneStatus = draft.contact.verifiedPhone && draft.contact.phone ? 'Phone verified' : draft.contact.phone ? 'Phone ready to verify' : 'Enter a valid phone number';
  const emailStatus = draft.contact.verifiedEmail && draft.contact.email ? 'Email verified' : draft.contact.email ? 'Email ready to verify' : 'Enter a valid email address';
  const contactVerified = (draft.contact.verifiedPhone && Boolean(draft.contact.phone)) || (draft.contact.verifiedEmail && Boolean(draft.contact.email));

  return (
    <div className="basic-information-prototype wizard-step-surface">
      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Contact and delivery</h3>
            <span className="form-hint">Set the submission contact and delivery point visible to suppliers.</span>
          </div>
          <span className={`status-badge ${contactVerified ? 'is-success' : 'is-warning'}`}>{contactVerified ? 'Verified' : 'Action needed'}</span>
        </div>
        <div className="contact-detail-grid">
          <div className="form-group">
            <label className="form-label" htmlFor="create-tender-delivery-point">
              Delivery Point
            </label>
            <input
              id="create-tender-delivery-point"
              className="form-input"
              aria-label="Delivery Point"
              placeholder="Enter delivery point or project location"
              value={draft.location}
              onChange={(event) => onPatch('location', event.target.value)}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="create-tender-contact-name">
              Contact person or department
            </label>
            <input
              id="create-tender-contact-name"
              className="form-input"
              aria-label="Contact person or department"
              placeholder="Enter contact person or department"
              value={draft.contact.name}
              onChange={(event) => onContactPatch('name', event.target.value)}
            />
          </div>
          <div className="form-group contact-verify-field">
            <label className="form-label" htmlFor="create-tender-contact-phone">
              Contact phone number
            </label>
            <div className="contact-verify-row">
              <input
                id="create-tender-contact-phone"
                className="form-input"
                aria-label="Contact phone number"
                placeholder="+255 700 000 000"
                value={draft.contact.phone}
                onChange={(event) => onContactPatch('phone', event.target.value)}
              />
              <button className="btn btn-secondary" type="button" aria-label="Verify Phone" onClick={() => onContactPatch('verifiedPhone', true)} disabled={!draft.contact.phone}>
                Verify
              </button>
            </div>
            <span className={`form-hint ${draft.contact.verifiedPhone && draft.contact.phone ? 'is-verified' : ''}`}>{phoneStatus}</span>
          </div>
          <div className="form-group contact-verify-field">
            <label className="form-label" htmlFor="create-tender-contact-email">
              Contact email
            </label>
            <div className="contact-verify-row">
              <input
                id="create-tender-contact-email"
                className="form-input"
                aria-label="Contact email"
                type="email"
                placeholder="procurement@example.go.tz"
                value={draft.contact.email}
                onChange={(event) => onContactPatch('email', event.target.value)}
              />
              <button className="btn btn-secondary" type="button" aria-label="Verify Email" onClick={() => onContactPatch('verifiedEmail', true)} disabled={!draft.contact.email}>
                Verify
              </button>
            </div>
            <span className={`form-hint ${draft.contact.verifiedEmail && draft.contact.email ? 'is-verified' : ''}`}>{emailStatus}</span>
          </div>
        </div>
      </section>

      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Tender details</h3>
            <span className="form-hint">Enter the tender title and key dates before preparing documents.</span>
          </div>
        </div>
        <div className="form-group">
          <div className="form-group">
            <label className="form-label" htmlFor="create-tender-title">
              Tender title
            </label>
            <input
              id="create-tender-title"
              className="form-input"
              aria-label="Tender title"
              placeholder="Example: Supply of medical equipment for regional clinics"
              value={draft.title}
              onChange={(event) => onPatch('title', event.target.value)}
            />
          </div>
          <div className="form-grid two">
            <div className="form-group">
              <label className="form-label" htmlFor="create-tender-funding-source">
                Funding source
              </label>
              <select
                id="create-tender-funding-source"
                className="form-input"
                aria-label="Funding source"
                value={draft.fundingSource}
                onChange={(event) => onPatch('fundingSource', event.target.value)}
              >
                <option value="">Select funding source</option>
                {createTenderSetup.fundingSources.map((source) => (
                  <option key={source} value={source}>
                    {source}
                  </option>
                ))}
              </select>
              {draft.fundingSource === 'Other' ? (
                <input
                  className="form-input"
                  aria-label="Custom funding source"
                  placeholder="Type funding source"
                  value={draft.customFundingSource}
                  onChange={(event) => onPatch('customFundingSource', event.target.value)}
                />
              ) : null}
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="create-tender-submission-deadline">
                Submission deadline
              </label>
              <input
                id="create-tender-submission-deadline"
                className="form-input"
                aria-label="Submission deadline"
                type="date"
                value={draft.submissionDate}
                onChange={(event) => onPatch('submissionDate', event.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="create-tender-opening-date">
                Opening date
              </label>
              <input
                id="create-tender-opening-date"
                className="form-input"
                aria-label="Opening date"
                type="date"
                value={draft.openingDate}
                onChange={(event) => onPatch('openingDate', event.target.value)}
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function PlanningStep({
  draft,
  selectedType,
  availableCategories,
  newCategory,
  newSupplier,
  onTypeChange,
  onPatch,
  onNewCategory,
  onAddCategory,
  onRemoveCategory,
  onNewSupplier,
  onAddSupplier
}: {
  draft: CreateTenderDraft;
  selectedType: { id: CreateTenderProcurementTypeId; label: string; description: string };
  availableCategories: string[];
  newCategory: string;
  newSupplier: string;
  onTypeChange: (typeId: CreateTenderProcurementTypeId) => void;
  onPatch: (field: keyof CreateTenderDraft, value: CreateTenderDraft[keyof CreateTenderDraft]) => void;
  onNewCategory: (value: string) => void;
  onAddCategory: () => void;
  onRemoveCategory: (category: string) => void;
  onNewSupplier: (value: string) => void;
  onAddSupplier: () => void;
}) {
  return (
    <div className="wizard-step-surface planning-step-surface">
      {draft.planFilledFields.length ? <div className="planning-section planning-section-notice">Planning-autofill notice: selected plan values pre-filled this tender draft.</div> : null}
      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Procurement classification</h3>
            <span className="form-hint">Choose the procurement type, then search and select the matching category.</span>
          </div>
          <span className="status-badge">{selectedType.label}</span>
        </div>
        <div className="marketplace-category-grid">
          {createTenderSetup.procurementTypes.map((type) => (
            <button key={type.id} className={type.id === draft.procurementTypeId ? 'marketplace-category-card active' : 'marketplace-category-card'} type="button" onClick={() => onTypeChange(type.id)}>
              <strong>{type.label}</strong>
              <span>{type.description}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="planning-section wizard-section planning-controls-panel">
        <div className="scope-list-heading">
          <div>
            <h3>Category and method</h3>
            <span className="form-hint">Selected type: {selectedType.label}</span>
          </div>
        </div>
        <div className="planning-control-grid">
          <label>
            Category
            <select value={newCategory} onChange={(event) => onNewCategory(event.target.value)}>
              <option value="">Select category</option>
              {availableCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-secondary" type="button" onClick={onAddCategory}>
            Add Category
          </button>
          <label>
            Procurement method
            <select value={draft.method} onChange={(event) => onPatch('method', event.target.value)}>
              {createTenderSetup.procurementMethods.map((method) => (
                <option key={method} value={method}>
                  {method}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="market-row category-chip-row">
          {draft.categories.length ? (
            draft.categories.map((category) => (
              <button key={category} className="status-badge removable" type="button" onClick={() => onRemoveCategory(category)}>
                {category} x
              </button>
            ))
          ) : (
            <span className="form-hint">No categories added yet.</span>
          )}
        </div>
      </section>

      {draft.method === 'Invited Tender' ? (
        <section className="planning-section wizard-section">
          <div className="scope-list-heading">
            <div>
              <h3>Invited suppliers</h3>
              <span className="form-hint">Add suppliers eligible for this invitation-only package.</span>
            </div>
          </div>
          <div className="planning-control-grid">
            <label>
              Supplier name
              <input placeholder="Search or type supplier name" value={newSupplier} onChange={(event) => onNewSupplier(event.target.value)} />
            </label>
            <button className="btn btn-secondary" type="button" onClick={onAddSupplier}>
              Add Supplier
            </button>
          </div>
          <ul className="wizard-compact-list">
            {draft.invitedSuppliers.map((supplier) => (
              <li key={supplier}>{supplier}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function RequirementsStep({
  draft,
  templates,
  licenses,
  newDeliverable,
  newAttachment,
  onPatch,
  onToggleLicense,
  onAddLineItem,
  onUpdateLineItem,
  onNewDeliverable,
  onNewAttachment,
  onAddDeliverable,
  onAddAttachment
}: {
  draft: CreateTenderDraft;
  templates: CreateTenderRequirementTemplate[];
  licenses: string[];
  newDeliverable: string;
  newAttachment: string;
  onPatch: (patch: Partial<CreateTenderDraft>) => void;
  onToggleLicense: (license: string) => void;
  onAddLineItem: () => void;
  onUpdateLineItem: (itemId: string, patch: Partial<CreateTenderLineItem>) => void;
  onNewDeliverable: (value: string) => void;
  onNewAttachment: (value: string) => void;
  onAddDeliverable: () => void;
  onAddAttachment: () => void;
}) {
  if (draft.procurementTypeId === 'goods') {
    function importGoodsQuantitySchedule(file: File | undefined) {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const importedItems = parseGoodsQuantityCsv(String(reader.result || ''));
        if (!importedItems.length) return;
        onPatch({ commercialItems: [...draft.commercialItems, ...importedItems] });
      };
      reader.readAsText(file);
    }

    return (
      <div className="wizard-step-surface requirements-step-surface goods-requirements-step">
        <section className="planning-section wizard-section goods-requirements-hero">
          <div className="scope-list-heading">
            <div>
              <span className="section-kicker">Tender requirements</span>
              <h3>Goods Tender Requirements</h3>
            </div>
            <span className="status-badge">Quantity Schedule</span>
          </div>
        </section>

        <section className="planning-section wizard-section goods-requirements-section">
          <div>
            <h3>Quantity Schedule / BOQ</h3>
            <span className="form-hint">Editable table with row numbering and calculated totals.</span>
          </div>
          <div className="form-label">Quantity lines</div>
          <div className="requirement-table-wrap goods-quantity-table-wrap">
            <table className="requirement-table goods-quantity-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {draft.commercialItems.length ? (
                  draft.commercialItems.map((item, index) => (
                    <tr key={item.id}>
                      <td>{index + 1}</td>
                      <td>
                        <input
                          aria-label={`Item ${index + 1} description`}
                          value={item.description}
                          onChange={(event) => onUpdateLineItem(item.id, { description: event.target.value })}
                        />
                      </td>
                      <td>
                        <input aria-label={`Item ${index + 1} unit`} value={item.unit} onChange={(event) => onUpdateLineItem(item.id, { unit: event.target.value })} />
                      </td>
                      <td>
                        <input
                          aria-label={`Item ${index + 1} quantity`}
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) => onUpdateLineItem(item.id, { quantity: event.target.value })}
                        />
                      </td>
                      <td>
                        <input
                          aria-label={`Item ${index + 1} unit price`}
                          inputMode="decimal"
                          value={item.unitPrice ?? ''}
                          onChange={(event) => onUpdateLineItem(item.id, { unitPrice: event.target.value })}
                        />
                      </td>
                      <td aria-label={`Item ${index + 1} total`}>{getLineItemTotal(item)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="scope-empty goods-table-empty">No items added yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="requirement-table-actions goods-table-actions">
            <label className="btn btn-secondary scope-add goods-import-control">
              Import Excel
              <input type="file" accept=".csv,.txt" onChange={(event) => importGoodsQuantitySchedule(event.target.files?.[0])} />
            </label>
            <button className="btn btn-secondary scope-add" type="button" onClick={downloadGoodsQuantityTemplate}>
              Download Excel Template
            </button>
            <button className="btn btn-secondary scope-add" type="button" onClick={onAddLineItem}>
              Add Item
            </button>
          </div>
        </section>

        <section className="planning-section wizard-section goods-requirements-section">
          <div>
            <h3>Product Specification Builder</h3>
            <span className="form-hint">specification that suppliers must respond to.</span>
          </div>
          <div className="form-label">Product specification table</div>
          <div className="product-spec-builder">
            {draft.commercialItems.length ? (
              <div className="product-spec-item-grid">
                {draft.commercialItems.map((item, index) => {
                  const key = goodsSpecificationKey(item.id);
                  return (
                    <article key={item.id} className="product-spec-item-card">
                      <div className="product-spec-item-header">
                        <div>
                          <span className="section-kicker">Quantity schedule item {index + 1}</span>
                          <h4>{item.description || `Product item ${index + 1}`}</h4>
                          <p>
                            {item.quantity || 0} {item.unit || 'unit'}
                            {Number(item.quantity) === 1 ? '' : 's'} required
                          </p>
                        </div>
                      </div>
                      <label>
                        Product specification
                        <textarea
                          aria-label={`Product specification for item ${index + 1}`}
                          placeholder="Describe specifications suppliers must respond to."
                          value={draft.requirements[key] ?? ''}
                          onChange={(event) => onPatch({ requirements: { ...draft.requirements, [key]: event.target.value } })}
                        />
                      </label>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="scope-empty">Add goods items in the Quantity Schedule first. Each item will get its own specification table here.</div>
            )}
          </div>
        </section>

        <section className="planning-section wizard-section">
          <div className="scope-list-heading">
            <div>
              <h3>Regulatory licenses</h3>
              <span className="form-hint">Select mandatory licenses and declarations for supplier eligibility.</span>
            </div>
            <span className="status-badge">{draft.selectedLicenses.length} selected</span>
          </div>
          <div className="license-check-grid">
            {licenses.map((license) => (
              <label key={license}>
                <input type="checkbox" checked={draft.selectedLicenses.includes(license)} onChange={() => onToggleLicense(license)} /> {license}
              </label>
            ))}
          </div>
        </section>

        <section className="planning-section wizard-section">
          <div className="scope-list-heading">
            <div>
              <h3>Deliverables and attachments</h3>
              <span className="form-hint">Capture outputs and document requirements suppliers must include.</span>
            </div>
          </div>
          <div className="deliverable-attachment-grid">
            <div>
              <div className="market-row">
                <input aria-label="Deliverable" placeholder="Example: Installation report" value={newDeliverable} onChange={(event) => onNewDeliverable(event.target.value)} />
                <button className="btn btn-secondary" type="button" onClick={onAddDeliverable}>
                  Add Deliverable
                </button>
              </div>
              <ul className="wizard-compact-list">{draft.deliverables.map((deliverable) => <li key={deliverable}>{deliverable}</li>)}</ul>
            </div>
            <div>
              <div className="market-row">
                <input aria-label="Attachment" placeholder="Example: Manufacturer authorization" value={newAttachment} onChange={(event) => onNewAttachment(event.target.value)} />
                <button className="btn btn-secondary" type="button" onClick={onAddAttachment}>
                  Add Attachment
                </button>
              </div>
              <ul className="wizard-compact-list">{draft.attachments.map((attachment) => <li key={attachment}>{attachment}</li>)}</ul>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="wizard-step-surface requirements-step-surface">
      {templates.map((template) => (
        <section key={template.id} className="planning-section wizard-section">
          <div className="scope-list-heading">
            <div>
              <h3>{template.title}</h3>
              <span className="form-hint">{template.description}</span>
            </div>
          </div>
          <div className="requirement-control-grid">
            {template.controls.map((control) => (
              <label key={control.id}>
                {control.label}
                {control.kind === 'select' ? (
                  <select value={draft.requirements[control.id] ?? ''} onChange={(event) => onPatch({ requirements: { ...draft.requirements, [control.id]: event.target.value } })}>
                    <option value="">Select</option>
                    {control.options?.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <textarea
                    placeholder={`Describe ${control.label.toLowerCase()}`}
                    value={draft.requirements[control.id] ?? ''}
                    onChange={(event) => onPatch({ requirements: { ...draft.requirements, [control.id]: event.target.value } })}
                  />
                )}
              </label>
            ))}
          </div>
        </section>
      ))}

      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Regulatory licenses</h3>
            <span className="form-hint">Select mandatory licenses and declarations for supplier eligibility.</span>
          </div>
          <span className="status-badge">{draft.selectedLicenses.length} selected</span>
        </div>
        <div className="license-check-grid">
          {licenses.map((license) => (
            <label key={license}>
              <input type="checkbox" checked={draft.selectedLicenses.includes(license)} onChange={() => onToggleLicense(license)} /> {license}
            </label>
          ))}
        </div>
      </section>

      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Commercial items</h3>
            <span className="form-hint">Build line items that suppliers will price against.</span>
          </div>
          <button className="btn btn-secondary" type="button" onClick={onAddLineItem}>
            Add Commercial Item
          </button>
        </div>
        <div className="commercial-item-list">
          {draft.commercialItems.length ? (
            draft.commercialItems.map((item) => (
              <div key={item.id} className="procurement-tender-row commercial-item-row">
                <input aria-label="Item description" placeholder="Item description" value={item.description} onChange={(event) => onUpdateLineItem(item.id, { description: event.target.value })} />
                <input aria-label="Item quantity" placeholder="Qty" value={item.quantity} onChange={(event) => onUpdateLineItem(item.id, { quantity: event.target.value })} />
                <input aria-label="Item unit" placeholder="Unit" value={item.unit} onChange={(event) => onUpdateLineItem(item.id, { unit: event.target.value })} />
              </div>
            ))
          ) : (
            <p>No commercial items added yet.</p>
          )}
        </div>
      </section>

      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Deliverables and attachments</h3>
            <span className="form-hint">Capture outputs and document requirements suppliers must include.</span>
          </div>
        </div>
        <div className="deliverable-attachment-grid">
          <div>
            <div className="market-row">
              <input aria-label="Deliverable" placeholder="Example: Installation report" value={newDeliverable} onChange={(event) => onNewDeliverable(event.target.value)} />
              <button className="btn btn-secondary" type="button" onClick={onAddDeliverable}>
                Add Deliverable
              </button>
            </div>
            <ul className="wizard-compact-list">{draft.deliverables.map((deliverable) => <li key={deliverable}>{deliverable}</li>)}</ul>
          </div>
          <div>
            <div className="market-row">
              <input aria-label="Attachment" placeholder="Example: Manufacturer authorization" value={newAttachment} onChange={(event) => onNewAttachment(event.target.value)} />
              <button className="btn btn-secondary" type="button" onClick={onAddAttachment}>
                Add Attachment
              </button>
            </div>
            <ul className="wizard-compact-list">{draft.attachments.map((attachment) => <li key={attachment}>{attachment}</li>)}</ul>
          </div>
        </div>
      </section>
    </div>
  );
}

function EvaluationStep({
  draft,
  total,
  suggestions,
  onAddCriterion,
  onUpdateCriterion,
  onRemoveCriterion
}: {
  draft: CreateTenderDraft;
  total: number;
  suggestions: CreateTenderEvaluationCriterion[];
  onAddCriterion: (criterion: CreateTenderEvaluationCriterion) => void;
  onUpdateCriterion: (criterionId: string, patch: Partial<CreateTenderEvaluationCriterion>) => void;
  onRemoveCriterion: (criterionId: string) => void;
}) {
  return (
    <div className="wizard-step-surface evaluation-step-surface">
      <section className="planning-section wizard-section evaluation-balance-panel">
        <div>
          <span className={`status-badge ${total === 100 ? 'is-success' : 'is-warning'}`}>{total === 100 ? 'Balanced total: 100%' : `Unbalanced total: ${total}%`}</span>
          <h3>Evaluation weighting</h3>
          <p>Weights must total 100% before review.</p>
        </div>
        <div className="evaluation-score-meter" aria-label={`Evaluation criteria total ${total}%`}>
          <strong>{total}%</strong>
          <span>Score total</span>
        </div>
      </section>
      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Suggested criteria</h3>
            <span className="form-hint">Add criteria from the catalog, then tune weights and scoring notes.</span>
          </div>
        </div>
        <div className="marketplace-category-grid">
          {suggestions.map((criterion) => (
            <button key={criterion.id} className="marketplace-category-card" type="button" onClick={() => onAddCriterion(criterion)}>
              <strong>{criterion.label}</strong>
              <span>{criterion.notes}</span>
            </button>
          ))}
        </div>
      </section>
      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Evaluation criteria</h3>
            <span className="form-hint">Edit labels, weights, and subcriteria used during bid scoring.</span>
          </div>
        </div>
        <div className="criteria-row-list">
          {draft.evaluationCriteria.map((criterion) => (
            <div key={criterion.id} className="procurement-tender-row">
              <label>
                Criterion
                <input placeholder="Criterion name" value={criterion.label} onChange={(event) => onUpdateCriterion(criterion.id, { label: event.target.value })} />
              </label>
              <label>
                Weight
                <input type="number" placeholder="%" value={criterion.weight} onChange={(event) => onUpdateCriterion(criterion.id, { weight: Number(event.target.value) })} />
              </label>
              <label>
                Subcriteria / scoring notes
                <textarea placeholder="Add scoring notes or subcriteria" value={criterion.notes} onChange={(event) => onUpdateCriterion(criterion.id, { notes: event.target.value })} />
              </label>
              <button className="btn btn-secondary" type="button" onClick={() => onRemoveCriterion(criterion.id)}>
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ReviewStep({ draft, selectedTypeLabel, total }: { draft: CreateTenderDraft; selectedTypeLabel: string; total: number }) {
  return (
    <div className="wizard-step-surface review-step-surface">
      <section className="planning-section wizard-section review-hero-panel">
        <div>
          <span className="section-kicker">Tender package</span>
          <h3>{draft.title || 'Untitled tender'}</h3>
          <p>{draft.description || `${selectedTypeLabel} tender using ${draft.method || 'no method selected'}.`}</p>
        </div>
        <span className={`status-badge ${total === 100 ? 'is-success' : 'is-warning'}`}>Evaluation criteria ({total}%)</span>
        <dl>
          <dt>Reference</dt>
          <dd>{draft.reference}</dd>
          <dt>Procuring entity</dt>
          <dd>{draft.procuringEntity || 'Not set'}</dd>
          <dt>Funding source</dt>
          <dd>{draft.fundingSource === 'Other' ? draft.customFundingSource || 'Other' : draft.fundingSource || 'Not set'}</dd>
          <dt>Estimated budget</dt>
          <dd>{draft.estimatedBudget ? `${draft.currency} ${draft.estimatedBudget}` : 'Not set'}</dd>
          <dt>Location</dt>
          <dd>{draft.location || 'Not set'}</dd>
          <dt>Submission deadline</dt>
          <dd>{draft.submissionDate || 'Not set'}</dd>
          <dt>Opening date</dt>
          <dd>{draft.openingDate || 'Not set'}</dd>
          <dt>Clarification deadline</dt>
          <dd>{draft.clarificationDeadline || 'Not set'}</dd>
          <dt>Publication date</dt>
          <dd>{draft.publicationDate || 'Not set'}</dd>
          <dt>Contact</dt>
          <dd>{[draft.contact.name, draft.contact.role, draft.contact.email || draft.contact.phone].filter(Boolean).join(' / ') || 'Not set'}</dd>
        </dl>
      </section>
      <SummaryList title="Categories" items={draft.categories} />
      <SummaryList title="Requirements" items={Object.entries(draft.requirements).filter(([, value]) => Boolean(value)).map(([key, value]) => `${key}: ${value}`)} />
      <SummaryList title="Commercial items" items={draft.commercialItems.map((item) => `${item.description || 'Item'} - ${item.quantity || 'Qty'} ${item.unit || ''}`)} />
      <SummaryList title="Deliverables" items={draft.deliverables} />
      <SummaryList title="Attachments" items={draft.attachments} />
      <SummaryList title="Milestones" items={draft.milestones.map((milestone) => `${milestone.label}: ${milestone.dueDate || 'date pending'}`)} />
      <SummaryList title={`Evaluation criteria (${total}%)`} items={draft.evaluationCriteria.map((criterion) => `${criterion.label} - ${criterion.weight}%`)} />
    </div>
  );
}

function PublicationStep({
  draft,
  onPatch,
  confirmationsComplete
}: {
  draft: CreateTenderDraft;
  onPatch: (patch: Partial<CreateTenderDraft>) => void;
  confirmationsComplete: boolean;
}) {
  return (
    <div className="wizard-step-surface publication-step-surface">
      <section className="planning-section wizard-section publication-readiness-panel">
        <div>
          <h3>System evaluation preview</h3>
          <p>Ready for simulated rules check. Publication will create a frontend tender record visible in My Tenders and Marketplace.</p>
        </div>
        <span className={`status-badge ${confirmationsComplete ? 'is-success' : 'is-warning'}`}>{confirmationsComplete ? 'Ready to submit' : 'Confirmations required'}</span>
      </section>
      <section className="planning-section wizard-section">
        <div className="scope-list-heading">
          <div>
            <h3>Publication confirmations</h3>
            <span className="form-hint">Confirm the package before simulated system evaluation.</span>
          </div>
        </div>
        <div className="confirmation-check-list">
          {Object.entries(confirmationLabels).map(([id, label]) => (
            <label key={id}>
              <input
                type="checkbox"
                checked={draft.confirmations[id as CreateTenderConfirmationId]}
                onChange={(event) => onPatch({ confirmations: { ...draft.confirmations, [id]: event.target.checked } })}
              />{' '}
              {label}
            </label>
          ))}
        </div>
      </section>
      <div className="submit-strip">
        <span className="status-badge">{confirmationsComplete ? 'Ready to submit' : 'Confirmations required'}</span>
      </div>
    </div>
  );
}

function SummaryList({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="planning-section wizard-section summary-list-section">
      <h3>{title}</h3>
      {items.length ? (
        <ul className="wizard-compact-list">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p>Not provided yet.</p>
      )}
    </section>
  );
}

function normalizeDraftForType(draft: CreateTenderDraft, typeId: CreateTenderProcurementTypeId): CreateTenderDraft {
  return {
    ...draft,
    procurementTypeId: typeId,
    categories: draft.categories.filter((category) => createTenderSetup.categories[typeId].includes(category)),
    selectedLicenses: draft.selectedLicenses.filter((license) => createTenderSetup.regulatoryLicenses[typeId].includes(license)),
    evaluationCriteria: getSuggestedCriteria(typeId),
    updatedAt: new Date().toISOString()
  };
}

function hasMeaningfulDraft(draft: CreateTenderDraft) {
  return Boolean(
    draft.title ||
      draft.description ||
      draft.procuringEntity ||
      draft.fundingSource ||
      draft.estimatedBudget ||
      draft.contact.email ||
      draft.contact.phone ||
      draft.contact.name ||
      draft.submissionDate ||
      draft.categories.length ||
      Object.values(draft.requirements).some(Boolean) ||
      draft.deliverables.length
  );
}

function validateStep(step: number, draft: CreateTenderDraft, total: number) {
  if (step === 0 && (!draft.title.trim() || !draft.fundingSource || !draft.submissionDate || !draft.openingDate || (!draft.contact.email.trim() && !draft.contact.phone.trim()))) {
    return 'Please add the title, funding source, key dates, and one contact option before continuing.';
  }
  if (step === 1 && (!draft.procurementTypeId || !draft.categories.length || !draft.method)) return 'Please choose a procurement type, method, and at least one category before continuing.';
  if (step === 1 && draft.method === 'Invited Tender' && draft.invitedSuppliers.length === 0) return 'Please add at least one supplier for this invited tender.';
  if (step === 3 && total !== 100) return 'Please adjust the evaluation weights so they add up to 100% before review.';
  return '';
}

function readPlanningBridge(): PlanningBridge | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('procurex.planning.selectedTenderPlan');
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PlanningBridge;
  } catch {
    return null;
  }
}

function applyPlanningBridge(draft: CreateTenderDraft, bridge: PlanningBridge): CreateTenderDraft {
  const planFilledFields: string[] = [];
  const procurementTypeId = parseProcurementType(bridge.procurementType) ?? draft.procurementTypeId;
  const categories = [...new Set([...(bridge.categories ?? []), bridge.category].filter(Boolean) as string[])].filter((category) => createTenderSetup.categories[procurementTypeId].includes(category));
  const next: CreateTenderDraft = { ...draft, procurementTypeId };

  if (bridge.title) {
    next.title = bridge.title;
    planFilledFields.push('title');
  }
  if (bridge.description || bridge.objective) {
    next.description = bridge.description || bridge.objective || '';
    planFilledFields.push('description');
  }
  if (bridge.procuringEntity || bridge.entity || bridge.buyer) {
    next.procuringEntity = bridge.procuringEntity || bridge.entity || bridge.buyer || '';
    planFilledFields.push('procuringEntity');
  }
  if (bridge.location) {
    next.location = bridge.location;
    planFilledFields.push('location');
  }
  if (bridge.fundingSource) {
    next.fundingSource = bridge.fundingSource;
    planFilledFields.push('fundingSource');
  }
  if (bridge.currency) {
    next.currency = bridge.currency;
    planFilledFields.push('currency');
  }
  if (bridge.estimatedBudget || bridge.budget) {
    next.estimatedBudget = String(bridge.estimatedBudget || bridge.budget || '');
    planFilledFields.push('estimatedBudget');
  }
  if (bridge.clarificationDeadline) {
    next.clarificationDeadline = bridge.clarificationDeadline;
    planFilledFields.push('clarificationDeadline');
  }
  if (bridge.publicationDate) {
    next.publicationDate = bridge.publicationDate;
    planFilledFields.push('publicationDate');
  }
  if (bridge.method) {
    next.method = bridge.method;
    planFilledFields.push('method');
  }
  if (bridge.openingDate) {
    next.openingDate = bridge.openingDate;
    planFilledFields.push('openingDate');
  }
  if (bridge.closingDate || bridge.submissionDate) {
    next.submissionDate = bridge.closingDate || bridge.submissionDate || '';
    planFilledFields.push('submissionDate');
  }
  if (categories.length) {
    next.categories = categories;
    planFilledFields.push('categories');
  }

  return { ...next, planFilledFields, updatedAt: new Date().toISOString() };
}

function parseProcurementType(value?: string): CreateTenderProcurementTypeId | null {
  const normalized = value?.toLowerCase();
  if (normalized === 'goods' || normalized === 'works' || normalized === 'services' || normalized === 'consultancy') return normalized;
  if (normalized === 'service') return 'services';
  return null;
}
