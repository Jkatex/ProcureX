import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { useNotifications } from '@/features/notifications/hooks';
import { procurementApi } from '../../api';
import { createEmptyConsultancyRequirements, createEmptyServiceRequirements, createEmptyTenderDraft, createEmptyWorksRequirements, createTenderSetup, getSuggestedCriteria } from '../../createTenderConfig';
import { saveCreateTenderDraft, selectCreateTenderDraft, submitCreateTenderForEvaluation } from '../../slice';
import { downloadTenderDocument } from '../../tenderDocumentActions';
import { NotificationCard } from '@/shared/components/NotificationCard';
import { ProcurexWorkspaceChrome } from '@/shared/components/procurex/ProcurexWorkspaceChrome';
import type {
  CreateTenderConfirmationId,
  CreateTenderConsultancyAssignmentActivityRow,
  CreateTenderConsultancyDeliverableRow,
  CreateTenderDraft,
  CreateTenderDraftStatus,
  CreateTenderPayload,
  CreateTenderEligibilityRequirementRow,
  CreateTenderEvaluationCriterion,
  CreateTenderFinancialRequirementRow,
  CreateTenderConsultancyEntityBackgroundCard,
  CreateTenderConsultancyExternalReferenceRow,
  CreateTenderConsultancyKeyExpertRow,
  CreateTenderConsultancyReportingRequirementRow,
  CreateTenderConsultancyRequirements,
  CreateTenderConsultancyResponsibilityRow,
  CreateTenderConsultancySpecificObjectiveRow,
  CreateTenderConsultancySupportingDocumentRow,
  CreateTenderLineItem,
  CreateTenderProductSpecificationRow,
  CreateTenderProcurementTypeId,
  CreateTenderRegulatoryLicenseRequirementRow,
  CreateTenderRequirementTemplate,
  CreateTenderSampleRequirementRow,
  CreateTenderServiceBoqRow,
  CreateTenderServiceEnvironmentalSocialRequirementCard,
  CreateTenderServiceEquipmentRequirementRow,
  CreateTenderServicePersonnelRequirementRow,
  CreateTenderServiceRequirements,
  CreateTenderServiceSupportingDocumentRow,
  CreateTenderWorksBoqRow,
  CreateTenderWorksDrawingRow,
  CreateTenderWorksLumpSumPricingRow,
  CreateTenderWorksMilestoneRow,
  CreateTenderWorksRequirements,
  CreateTenderWorksSpecificationDocumentRow,
  TenderDetail,
  TenderDraftValidation
} from '../../types';

const steps = ['Basic Information', 'Procurement Planning', 'Tender Requirements', 'Evaluation Criteria and Weights', 'Review Tender', 'Tender Review and Publication'];

const goodsUnitOptions = ['Pcs', 'Unit', 'Set', 'Lot', 'Kg', 'Litre', 'Meter', 'Sqm', 'Day', 'Month'];
const evaluationTypes = [
  { value: 'scored', label: 'Scored' },
  { value: 'pass_fail', label: 'Pass / Fail' },
  { value: 'price_based', label: 'Price-based' },
  { value: 'document_check', label: 'Document check' },
  { value: 'specification_compliance', label: 'Specification compliance' },
  { value: 'sample_based', label: 'Sample-based' },
  { value: 'delivery_based', label: 'Delivery-based' },
  { value: 'warranty_support', label: 'Warranty / support' }
];
const financialRequirementTypes = [
  'Minimum Annual Turnover',
  'Average Annual Turnover',
  'Positive Net Worth',
  'Working Capital',
  'Access to Credit',
  'Bank Statement Requirement',
  'Audited Financial Statements'
];
const financialPeriods = ['Annual', 'Current', 'Last 12 Months', 'Last 3 Years', 'Last 5 Years'];
const financialEvidence = ['Audited accounts', 'Bank statement', 'Bank letter', 'Credit facility letter', 'Tax clearance', 'Management accounts'];
const eligibilityPresets = ['Certificate of incorporation', 'Tax clearance certificate', 'Manufacturer authorization', 'Past supply contracts', 'Audited financial statements'];
const worksContractTypes = ['Lump Sum Contract', 'Unit Price Contract', 'Fixed Price Contract', 'Framework Contract', 'Consultancy / Time-Based Contract', 'Other'];
const worksDocumentTypes = ['Architectural drawings', 'Structural drawings', 'Electrical drawings', 'Mechanical drawings', 'Geotechnical report', 'Environmental report', 'Other'];
const worksTechnicalSpecificationTitles = ['Applicable standards / codes', 'Material specifications', 'Workmanship standards', 'Engineering requirements', 'Equipment requirements', 'Others'];
const serviceCategoryOptions = ['Security', 'Cleaning', 'IT Support', 'Internet services', 'Vehicle maintenance', 'Generator maintenance', 'Maintenance', 'Catering', 'Transport / logistics', 'Training', 'Other'];
const serviceUnitOptions = ['Unit', 'Lot', 'Hour', 'Day', 'Month', 'Trip', 'Guard', 'Sqm', 'Vehicle', 'Visit'];
const serviceEducationLevels = ['Primary', 'Secondary', 'Certificate', 'Diploma', 'Bachelor Degree', 'Postgraduate', 'Professional certification'];
const serviceFrequencyOptions = ['Hourly', 'Daily', 'Weekly', 'Monthly', 'Quarterly', 'On demand'];
const serviceOwnershipTypes = ['Owned', 'Leased', 'Either owned or leased', 'Available on demand'];
const serviceEquipmentEvidence = ['Ownership proof', 'Lease agreement', 'Calibration certificate', 'Inspection certificate', 'Photo evidence'];
const serviceEvaluationMethods = ['Pass / fail', 'Scored', 'Document check', 'Physical inspection'];
const serviceResponseTypes = ['Upload evidence', 'Describe availability', 'Complete table', 'Confirm compliance'];
const serviceEsCategories = ['Worker safety', 'SEA/SH', 'Environmental protection', 'Labor compliance', 'Community health and safety'];
const serviceEsEvidence = ['Policy document', 'Method statement', 'Training record', 'Compliance certificate', 'Incident register'];
const consultancyDepartmentOptions = ['Procurement Management Unit', 'Finance', 'Planning', 'ICT', 'Engineering', 'Legal', 'User Department', 'Other'];
const consultancyPriorityOptions = ['High', 'Medium', 'Low'];
const consultancySupportTypes = ['Office access', 'Document access', 'Meeting coordination', 'Counterpart staff', 'Logistics', 'Data access', 'Other'];
const consultancyFrequencyOptions = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'On completion', 'Ad hoc'];
const consultancyReportTypes = ['Weekly progress report', 'Monthly report', 'Inception report', 'Draft report', 'Final report', 'Ad hoc report'];
const consultancyFormats = ['PDF', 'Word', 'Excel', 'PowerPoint', 'Hard copy', 'Soft copy', 'Other'];
const consultancyReviewers = ['Project Manager', 'Supervising Officer', 'Accounting Officer', 'Buyer', 'User Department', 'Other'];
const consultancyEducationLevels = ['Certificate', 'Diploma', 'Bachelor Degree', 'Masters Degree', 'PhD', 'Professional certification', 'Other'];
const consultancyFirmSectors = ['Public sector', 'Health', 'Education', 'Infrastructure', 'ICT', 'Finance', 'Environment', 'Energy', 'Water', 'Transport', 'Agriculture', 'Research'];
const consultancyAuthorities = ['Project Manager', 'Supervising Officer', 'Accounting Officer', 'User Department', 'Steering Committee', 'Tender Board', 'Other'];
const consultancyCommunicationMethods = ['Email', 'Procurement portal', 'Physical meetings', 'Virtual meetings', 'Phone', 'Official letters'];
const consultancyDocumentCategories = ['Existing reports', 'Policy documents', 'Architectural drawings', 'Baseline studies', 'Previous assessments', 'Other'];
const worksContractTypeDescriptions: Record<string, string> = {
  'Lump Sum Contract': 'A single total price is agreed for the whole work or project.',
  'Unit Price Contract': 'Payment is based on measured quantities completed.',
  'Fixed Price Contract': 'The supplier agrees to deliver goods or services at a fixed agreed price.',
  'Framework Contract': 'Used for repeated or recurring procurement over a defined period.',
  'Consultancy / Time-Based Contract': 'Payment is based on consultant time, milestones, or agreed service duration.'
};
const regulatoryLicenseCatalog = [
  { group: 'Food, Drugs and Cosmetics', license: 'Food Business Permit / Food Handling License', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
  { group: 'Food, Drugs and Cosmetics', license: 'Pharmaceutical Business License', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
  { group: 'Food, Drugs and Cosmetics', license: 'Medical Devices Registration Permit', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
  { group: 'Food, Drugs and Cosmetics', license: 'Cosmetics Registration Certificate', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)' },
  { group: 'Energy and Water (EWURA)', license: 'Petroleum Retail Outlet License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
  { group: 'Energy and Water (EWURA)', license: 'Petroleum Wholesale License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
  { group: 'Energy and Water (EWURA)', license: 'Electricity Generation License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
  { group: 'Energy and Water (EWURA)', license: 'Electricity Distribution and Supply License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
  { group: 'Energy and Water (EWURA)', license: 'Water Supply and Sanitation Services License', body: 'Energy and Water Utilities Regulatory Authority (EWURA)' },
  { group: 'Communications and Transport', license: 'Content Services License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
  { group: 'Communications and Transport', license: 'Network Facilities License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
  { group: 'Communications and Transport', license: 'Application Services License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
  { group: 'Communications and Transport', license: 'Electronic Communications Service License', body: 'Tanzania Communications Regulatory Authority (TCRA)' },
  { group: 'Communications and Transport', license: 'Shipping Agency License', body: 'Tanzania Shipping Agencies Corporation (TASAC)' },
  { group: 'Communications and Transport', license: 'Port Services License', body: 'Tanzania Shipping Agencies Corporation (TASAC)' },
  { group: 'Mining and Natural Resources', license: 'Reconnaissance License', body: 'Ministry of Minerals' },
  { group: 'Mining and Natural Resources', license: 'Prospecting License', body: 'Ministry of Minerals' },
  { group: 'Mining and Natural Resources', license: 'Primary Mining License', body: 'Ministry of Minerals' },
  { group: 'Mining and Natural Resources', license: 'Mining License', body: 'Ministry of Minerals' },
  { group: 'Mining and Natural Resources', license: 'Special Mining License', body: 'Ministry of Minerals' },
  { group: 'Mining and Natural Resources', license: "Explosives Dealer's License", body: 'Ministry of Minerals' },
  { group: 'Construction and Real Estate', license: 'Contractor Registration Certificate', body: 'Contractors Registration Board (CRB) and Local Government Authorities' },
  { group: 'Construction and Real Estate', license: 'Building Permit', body: 'Contractors Registration Board (CRB) and Local Government Authorities' },
  { group: 'Construction and Real Estate', license: 'Environmental Building Approval', body: 'Contractors Registration Board (CRB) and Local Government Authorities' },
  { group: 'Environmental and Safety', license: 'Environmental Impact Assessment Certificate', body: 'National Environment Management Council (NEMC)' },
  { group: 'Environmental and Safety', license: 'Environmental Compliance Certificate', body: 'National Environment Management Council (NEMC)' },
  { group: 'Environmental and Safety', license: 'Occupational Safety and Health Compliance Certificate', body: 'Occupational Safety and Health Authority (OSHA)' },
  { group: 'Finance and Banking', license: 'Banking Business License', body: 'Bank of Tanzania (BOT)' },
  { group: 'Finance and Banking', license: 'Financial Institution License', body: 'Bank of Tanzania (BOT)' },
  { group: 'Finance and Banking', license: 'Microfinance Business License', body: 'Bank of Tanzania (BOT)' },
  { group: 'Finance and Banking', license: 'Foreign Exchange Bureau License', body: 'Bank of Tanzania (BOT)' },
  { group: 'Finance and Banking', license: 'Capital Markets and Securities Dealer License', body: 'Capital Markets and Securities Authority (CMSA)' },
  { group: 'Finance and Banking', license: 'Investment Adviser License', body: 'Capital Markets and Securities Authority (CMSA)' },
  { group: 'Finance and Banking', license: 'Fund Manager License', body: 'Capital Markets and Securities Authority (CMSA)' },
  { group: 'Specialized Services', license: 'Hazardous Chemicals Handling Certificate', body: 'Government Chemist Laboratory Authority (GCLA)' },
  { group: 'Specialized Services', license: 'Weights and Measures Inspection Certificate', body: 'Weights and Measures Agency (WMA)' },
  { group: 'Specialized Services', license: 'Calibration Certificate', body: 'Weights and Measures Agency (WMA)' }
];

function createRowId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function getRegulatoryLicenseByName(licenseName: string) {
  return regulatoryLicenseCatalog.find((item) => item.license === licenseName) ?? regulatoryLicenseCatalog[0];
}

function createRegulatoryLicenseRow(licenseName: string): CreateTenderRegulatoryLicenseRequirementRow {
  const catalogItem = getRegulatoryLicenseByName(licenseName);
  return {
    id: createRowId('license'),
    license: catalogItem.license,
    body: catalogItem.body,
    mandatory: true,
    expiryRequired: true
  };
}

function downloadGoodsQuantityTemplate() {
  const csv = ['Item,Description,Unit,Qty', '1,,,'].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'goods-quantity-schedule-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function downloadProductSpecificationTemplate() {
  const csv = ['Item,Specification,Specific detail required', '1,Brand,HP/Dell/Lenovo or equivalent'].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'goods-product-specification-template.csv';
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
    quantity: row[3] || ''
  }));
}

function parseProductSpecificationCsv(text: string, items: CreateTenderLineItem[]): CreateTenderProductSpecificationRow[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((row) => row.some(Boolean));
  const dataRows = rows[0]?.join(' ').toLowerCase().includes('specification') ? rows.slice(1) : rows;

  return dataRows
    .map((row, index) => {
      const sourceToken = row[0] || '';
      const itemIndex = Math.max(Number(sourceToken) - 1, 0);
      const matchedItem =
        items[itemIndex] ??
        items.find((item) => item.description.toLowerCase() === sourceToken.toLowerCase()) ??
        items[0];
      if (!matchedItem || !row[1]) return null;
      return {
        id: createRowId(`spec-import-${index}`),
        sourceItemId: matchedItem.id,
        specificationName: row[1],
        acceptableRequirement: row[2] || ''
      };
    })
    .filter(Boolean) as CreateTenderProductSpecificationRow[];
}

function getServiceBoqTotal(row: CreateTenderServiceBoqRow) {
  const quantity = Number(row.quantity);
  const rate = Number(row.rate);
  if (!Number.isFinite(quantity) || !Number.isFinite(rate) || !row.quantity || !row.rate) return '';
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(quantity * rate);
}

function downloadWorksBoqTemplate() {
  const csv = ['No.,Description,Unit,Quantity', '1,,,'].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'works-boq-template.csv';
  link.click();
  URL.revokeObjectURL(url);
}

function parseWorksBoqCsv(text: string): CreateTenderWorksBoqRow[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((row) => row.some(Boolean));
  const dataRows = rows[0]?.join(' ').toLowerCase().includes('description') ? rows.slice(1) : rows;

  return dataRows.map((row, index) => ({
    id: `works-boq-import-${Date.now()}-${index}`,
    description: row[1] || row[0] || '',
    unit: row[2] || '',
    quantity: row[3] || '',
    rate: ''
  }));
}

function parseServiceBoqCsv(text: string): CreateTenderServiceBoqRow[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => parseCsvLine(line))
    .filter((row) => row.some(Boolean));
  const dataRows = rows[0]?.join(' ').toLowerCase().includes('description') ? rows.slice(1) : rows;

  return dataRows.map((row, index) => ({
    id: `service-boq-import-${Date.now()}-${index}`,
    description: row[1] || row[0] || '',
    unit: row[2] || '',
    quantity: row[3] || '',
    rate: row[4] || ''
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
  const [searchParams] = useSearchParams();
  const { notifyError, notifySuccess, notifyWarning } = useNotifications();
  const [draft, setDraft] = useState<CreateTenderDraft>(() => createEmptyTenderDraft());
  const [activeStep, setActiveStep] = useState(0);
  const [validationMessage, setValidationMessage] = useState('');
  const [isPersisting, setIsPersisting] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [loadedTenderId, setLoadedTenderId] = useState('');
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
  const evaluationSummary = getEvaluationSummary(draft.evaluationCriteria);
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
          ? evaluationSummary.message
            : activeStep === 4
              ? 'Buyer preview'
              : confirmationsComplete
                ? 'Evaluation complete'
                : 'Evaluation required';
  const activeStepBadgeClass =
    activeStep === 0
      ? contactVerified
        ? 'badge-success'
        : 'badge-warning'
    : activeStep === 3
      ? evaluationSummary.state === 'balanced'
        ? 'badge-success'
        : evaluationSummary.state === 'over'
          ? 'badge-error'
          : 'badge-warning'
          : 'badge-info';
  const draftId = searchParams.get('draftId') ?? '';
  const editTenderId = searchParams.get('tenderId') ?? '';
  const savedDraft = useAppSelector((state) => state.procurement.createTenderDrafts.find((item) => item.id === draftId));

  useEffect(() => {
    const bridge = readPlanningBridge();
    if (!bridge) return;

    setDraft((current) => {
      const next = applyPlanningBridge(current, bridge);
      return normalizeDraftForType(next, next.procurementTypeId);
    });
    if (bridge.startStep) setActiveStep(Math.min(Math.max(Number(bridge.startStep) - 1, 0), steps.length - 1));
  }, []);

  useEffect(() => {
    if (!draftId || !savedDraft || loadedTenderId === `draft:${draftId}`) return;
    setDraft(savedDraft);
    dispatch(selectCreateTenderDraft(draftId));
    setLoadedTenderId(`draft:${draftId}`);
    setActiveStep(getCreateTenderResumeStep(savedDraft));
    setValidationMessage('');
  }, [dispatch, draftId, loadedTenderId, savedDraft]);

  useEffect(() => {
    if (draftId || !editTenderId || loadedTenderId === editTenderId) return;
    let active = true;

    async function loadEditableTender() {
      setIsPersisting(true);
      setValidationMessage('');
      try {
        const tender = await procurementApi.getTenderDetail(editTenderId);
        if (!active) return;
        const editableDraft = draftFromTenderDetail(tender);
        setDraft(editableDraft);
        dispatch(saveCreateTenderDraft(editableDraft));
        setLoadedTenderId(editTenderId);
        setActiveStep(0);
      } catch (error) {
        if (!active) return;
        const message = getApiErrorMessage(error, 'Tender could not be loaded for amendment.');
        setValidationMessage(message);
        notifyError('Tender not loaded', message, {
          reason: 'ProcureX could not load the tender record for editing.'
        });
      } finally {
        if (active) setIsPersisting(false);
      }
    }

    void loadEditableTender();
    return () => {
      active = false;
    };
  }, [dispatch, editTenderId, loadedTenderId, notifyError]);

  function patchDraft(patch: Partial<CreateTenderDraft>) {
    setDraft((current) => ({
      ...current,
      ...patch,
      consultancyRequirements: patch.consultancyRequirements ? { ...(current.consultancyRequirements ?? createEmptyConsultancyRequirements()), ...patch.consultancyRequirements } : current.consultancyRequirements,
      serviceRequirements: patch.serviceRequirements ? { ...(current.serviceRequirements ?? createEmptyServiceRequirements()), ...patch.serviceRequirements } : current.serviceRequirements,
      worksRequirements: patch.worksRequirements ? { ...(current.worksRequirements ?? createEmptyWorksRequirements()), ...patch.worksRequirements } : current.worksRequirements,
      updatedAt: new Date().toISOString()
    }));
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
    setNewCategory('');
  }

  function selectCategory(category: string) {
    const selectedCategory = category.trim();
    if (selectedCategory && !draft.categories.includes(selectedCategory)) {
      patchDraft({ categories: [...draft.categories, selectedCategory] });
    }
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
    const item: CreateTenderLineItem = { id: createRowId('item'), description: '', quantity: '', unit: '', unitPrice: '' };
    patchDraft({ commercialItems: [...draft.commercialItems, item] });
  }

  function updateLineItem(itemId: string, patch: Partial<CreateTenderLineItem>) {
    patchDraft({ commercialItems: draft.commercialItems.map((item) => (item.id === itemId ? { ...item, ...patch } : item)) });
  }

  function removeLineItem(itemId: string) {
    patchDraft({
      commercialItems: draft.commercialItems.filter((item) => item.id !== itemId),
      productSpecifications: draft.productSpecifications.filter((row) => row.sourceItemId !== itemId),
      sampleRequirements: draft.sampleRequirements.filter((row) => row.relatedBoqItemId !== itemId)
    });
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

  async function persistTenderDraft(sourceDraft = draft) {
    const payload = createTenderPersistencePayload(sourceDraft);
    const response = isBackendTenderId(sourceDraft.id)
      ? await procurementApi.updateTender(sourceDraft.id, payload)
      : await procurementApi.createTender(payload);
    const saved: CreateTenderDraft = {
      ...sourceDraft,
      id: response.data.id,
      reference: response.data.reference,
      status: 'DRAFT',
      updatedAt: new Date().toISOString()
    };
    setDraft(saved);
    dispatch(saveCreateTenderDraft(saved));
    return { saved, response };
  }

  async function saveDraft() {
    if (!canSaveDraft) {
      setValidationMessage('Add a tender detail first, then you can save this draft.');
      notifyWarning('Tender draft not ready', 'Add at least one tender detail before saving.', {
        reason: 'ProcureX needs meaningful tender information before it can save this draft.'
      });
      return;
    }
    if (!draft.title.trim() || draft.title.trim().length < 5) {
      setValidationMessage('Add a tender title with at least 5 characters before saving.');
      notifyWarning('Tender title required', 'Add a clear tender title before saving the draft.', {
        reason: 'ProcureX needs a title before it can save this tender draft.'
      });
      return;
    }
    if (isPersisting) return;

    setIsPersisting(true);
    try {
      const { response } = await persistTenderDraft();
      const validationNote = getDraftValidationNote(response.validation);
      if (validationNote) {
        notifyWarning('Tender draft saved with validation notes', validationNote, {
          reason: 'The draft is safely stored, but these items may be needed before publication.',
          action: { label: 'Open My Tenders', to: '/procurement/my-tenders' }
        });
      } else {
        notifySuccess('Tender draft saved', 'Your tender draft was saved.', {
          reason: 'You can continue editing it from My Tenders after logout or from another browser session.',
          action: { label: 'Open My Tenders', to: '/procurement/my-tenders' }
        });
      }
      setValidationMessage('');
    } catch (error) {
      const message = getApiErrorMessage(error, 'Tender draft could not be saved.');
      setValidationMessage(message);
      notifyError('Tender draft not saved', message, {
        reason: 'ProcureX could not save this draft. Check your sign-in state and required fields, then try again.'
      });
    } finally {
      setIsPersisting(false);
    }
  }

  async function submitTender() {
    if (!confirmationsComplete) {
      setValidationMessage('Please review and tick each publication confirmation before submitting.');
      notifyWarning('Tender cannot be submitted yet', 'Complete all publication confirmations before submitting.', {
        reason: 'ProcureX blocks review submission until accuracy, compliance, evaluation, and publication confirmations are ticked.'
      });
      return;
    }
    if (draft.method === 'Invited Tender') {
      const message = 'Invited Tender review submission is not available yet. Select Open Tender before submitting.';
      setValidationMessage(message);
      notifyWarning('Invited tender review unavailable', message, {
        reason: 'This review path is currently limited to public marketplace tenders.'
      });
      return;
    }
    if (!parsePositiveNumber(draft.estimatedBudget)) {
      const message = 'Add a positive estimated budget before submitting this tender for review.';
      setValidationMessage(message);
      notifyWarning('Tender budget required', message, {
        reason: 'ProcureX requires a tender budget before a draft can be sent to admin review.'
      });
      setActiveStep(0);
      return;
    }
    if (isPersisting) return;

    setIsPersisting(true);
    try {
      const { saved } = await persistTenderDraft();
      const reviewResponse = await procurementApi.publishTender(saved.id);
      const now = new Date().toISOString();
      const submitted: CreateTenderDraft = {
        ...saved,
        reference: reviewResponse.data.reference,
        status: 'SUBMITTED',
        submittedAt: now,
        publishedAt: '',
        submissionDate: reviewResponse.data.closingDate || saved.submissionDate,
        updatedAt: now
      };
      setDraft(submitted);
      dispatch(submitCreateTenderForEvaluation(submitted));
      const warningCount = reviewResponse.validation?.warnings.length ?? 0;
      notifySuccess('Tender submitted for review', 'Your tender was saved and sent to admin review.', {
        reason: warningCount ? `${warningCount} review warning${warningCount === 1 ? '' : 's'} should be checked before final approval.` : 'It will appear in the admin Tender Review queue.'
      });
      navigate('/procurement/my-tenders');
    } catch (error) {
      const message = getApiErrorMessage(error, 'Tender could not be submitted for review.');
      setValidationMessage(message);
      notifyError('Tender not submitted', message, {
        reason: 'ProcureX could not send this tender to admin review.'
      });
    } finally {
      setIsPersisting(false);
    }
  }

  async function downloadTenderPdf() {
    if (isGeneratingPdf) return;

    setIsGeneratingPdf(true);
    try {
      await downloadTenderDocument(draftToTenderDetail(draft));
    } catch {
      notifyError('Tender PDF could not be generated', 'Try again after checking the tender details, or save the draft and retry.', {
        reason: 'The browser PDF generator could not create the consolidated tender pack.'
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  }

  return (
    <ProcurexWorkspaceChrome title="Procurement">
      <div className="procurement-app-page tender-wizard-page" data-create-tender-root>
        <section className="journey-hero compact">
          <div>
            <span className="badge badge-info">Procurement design</span>
            <h1>Create Tender Wizard</h1>
            <p>Build a tender package that matches the procurement nature, then submit it for admin review before marketplace publication.</p>
          </div>
          <div className="hero-action-stack">
            <button className="btn btn-secondary save-draft-button" type="button" onClick={saveDraft} disabled={!canSaveDraft || isPersisting} data-save-tender-draft>
              {isPersisting ? 'Saving...' : 'Save Draft'}
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

          <aside className="wizard-rail">
            {steps.map((step, index) => {
              const stateClass = index === activeStep ? 'active' : index < activeStep ? 'completed' : '';
              return (
                <a
                  key={step}
                  href={`#wizard-step-${index + 1}`}
                  className={`wizard-rail-step ${stateClass}`}
                  onClick={(event) => {
                    event.preventDefault();
                    goToStep(index);
                  }}
                >
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  <span>{step}</span>
                </a>
              );
            })}
          </aside>

          <div className="wizard-workspace">
            <section className={`journey-panel active ${activeStep === 3 ? 'evaluation-criteria-panel' : ''}`} id={`wizard-step-${activeStep + 1}`}>
              {validationMessage ? (
                <NotificationCard notification={{ tone: 'error', title: 'Action needed', message: validationMessage, reason: 'Review the current tender step and complete the missing information.', dismissible: false }} />
              ) : null}
              {planWarningFields.length ? <div className="planning-section planning-section-notice">Planning handoff fields were edited: {planWarningFields.join(', ')}.</div> : null}

              <div className="panel-heading">
                <div>
                  <span className="section-kicker">Step {activeStep + 1}</span>
                  <h2>{steps[activeStep]}</h2>
                </div>
                <span className={`badge ${activeStepBadgeClass}`}>{activeStepBadge}</span>
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
                    categorySearch={newCategory}
                    newSupplier={newSupplier}
                    onTypeChange={changeType}
                    onPatch={patchPlanAware}
                    onCategorySearch={setNewCategory}
                    onAddCategory={selectCategory}
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
                    onRemoveLineItem={removeLineItem}
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
                    onReplaceCriteria={(evaluationCriteria) => patchDraft({ evaluationCriteria })}
                  />
                ) : null}
                {activeStep === 4 ? <ReviewStep draft={draft} selectedType={selectedType} total={criteriaTotal} /> : null}
                {activeStep === 5 ? (
                  <PublicationStep
                    draft={draft}
                    onPatch={patchDraft}
                    confirmationsComplete={confirmationsComplete}
                    isPersisting={isPersisting}
                    isGeneratingPdf={isGeneratingPdf}
                    onDownloadPdf={downloadTenderPdf}
                    onSubmitTender={submitTender}
                  />
                ) : null}
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
                ) : null}
              </footer>
            </section>
          </div>
        </main>
      </div>
    </ProcurexWorkspaceChrome>
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
  return (
    <div className="basic-information-prototype wizard-step-surface">
      <section className="planning-section wizard-section">
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
        <h3>Tender details</h3>
        <span className="form-hint">Enter the tender title and key dates before preparing documents.</span>
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
              <label className="form-label" htmlFor="create-tender-estimated-budget">
                Estimated budget
              </label>
              <input
                id="create-tender-estimated-budget"
                className="form-input"
                aria-label="Estimated budget"
                inputMode="numeric"
                placeholder="Example: 250000000"
                value={draft.estimatedBudget}
                onChange={(event) => onPatch('estimatedBudget', event.target.value)}
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
  categorySearch,
  newSupplier,
  onTypeChange,
  onPatch,
  onCategorySearch,
  onAddCategory,
  onRemoveCategory,
  onNewSupplier,
  onAddSupplier
}: {
  draft: CreateTenderDraft;
  selectedType: { id: CreateTenderProcurementTypeId; label: string; description: string };
  availableCategories: string[];
  categorySearch: string;
  newSupplier: string;
  onTypeChange: (typeId: CreateTenderProcurementTypeId) => void;
  onPatch: (field: keyof CreateTenderDraft, value: CreateTenderDraft[keyof CreateTenderDraft]) => void;
  onCategorySearch: (value: string) => void;
  onAddCategory: (value: string) => void;
  onRemoveCategory: (category: string) => void;
  onNewSupplier: (value: string) => void;
  onAddSupplier: () => void;
}) {
  const normalizedSearch = categorySearch.trim().toLowerCase();
  const availableResults = availableCategories
    .filter((category) => !draft.categories.includes(category))
    .filter((category) => !normalizedSearch || category.toLowerCase().includes(normalizedSearch))
    .slice(0, 12);
  const resultOpen = Boolean(categorySearch.trim());

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
          <div className="form-group iam-searchable-selector tender-category-search">
            <label className="form-label" htmlFor="create-tender-category-search">
              Category
            </label>
            <div className="category-picker">
              <input
                id="create-tender-category-search"
                className="form-input"
                type="search"
                value={categorySearch}
                placeholder={`Search ${selectedType.label.toLowerCase()} categories`}
                onChange={(event) => onCategorySearch(event.target.value)}
              />
              <div className={resultOpen ? 'category-results open' : 'category-results'} role="listbox" aria-label={`${selectedType.label} categories`}>
                {availableResults.length ? (
                  availableResults.map((category) => (
                    <button className="category-result-option" type="button" key={category} onClick={() => onAddCategory(category)}>
                      {category}
                    </button>
                  ))
                ) : (
                  <span className="category-result-empty">No matching categories.</span>
                )}
              </div>
            </div>
          </div>
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
        <div className="selected-category-list category-chip-row">
          {draft.categories.length ? (
            draft.categories.map((category) => (
              <div className="selected-category-row" key={category}>
                <span>{category}</span>
                <button className="selected-category-remove" type="button" onClick={() => onRemoveCategory(category)} aria-label={`Remove ${category}`}>
                  Remove
                </button>
              </div>
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

type RegulatoryLicenseCatalogItem = (typeof regulatoryLicenseCatalog)[number];

function RegulatoryLicenseRequirementsPanel({
  rows,
  addOpen,
  addSearch,
  changeRowId,
  changeSearch,
  filteredAddLicenses,
  getChangeMatches,
  onToggleAdd,
  onAddSearch,
  onStartChange,
  onChangeSearch,
  onAddLicense,
  onUpdateLicense,
  onChangeLicense,
  onDeleteLicense
}: {
  rows: CreateTenderRegulatoryLicenseRequirementRow[];
  addOpen: boolean;
  addSearch: string;
  changeRowId: string | null;
  changeSearch: string;
  filteredAddLicenses: RegulatoryLicenseCatalogItem[];
  getChangeMatches: (row: CreateTenderRegulatoryLicenseRequirementRow) => RegulatoryLicenseCatalogItem[];
  onToggleAdd: () => void;
  onAddSearch: (value: string) => void;
  onStartChange: (rowId: string) => void;
  onChangeSearch: (value: string) => void;
  onAddLicense: (licenseName: string) => void;
  onUpdateLicense: (rowId: string, patch: Partial<CreateTenderRegulatoryLicenseRequirementRow>) => void;
  onChangeLicense: (rowId: string, licenseName: string) => void;
  onDeleteLicense: (rowId: string) => void;
}) {
  return (
    <section className="planning-section wizard-section scope-list-panel license-requirements-panel">
      <div className="scope-list-heading">
        <div>
          <h3>Regulatory license requirements</h3>
          <span className="form-hint">Search and select the licenses suppliers must hold for this tender. The issuing body is filled automatically.</span>
        </div>
        <button className="btn btn-secondary scope-add" type="button" onClick={onToggleAdd}>
          Add License Requirement
        </button>
      </div>
      <div className="license-requirement-list">
        {rows.length ? (
          rows.map((row) => {
            const changeMatches = getChangeMatches(row);
            return (
              <div className="license-requirement-row" key={row.id}>
                <div className="license-summary">
                  <span>License</span>
                  <strong>{row.license}</strong>
                  <small>{row.body}</small>
                  {changeRowId === row.id ? (
                    <div className="license-picker">
                      <input
                        className="form-input"
                        type="search"
                        aria-label="Search regulatory license"
                        placeholder="Search license"
                        value={changeSearch}
                        onChange={(event) => onChangeSearch(event.target.value)}
                      />
                      <div className="license-results open" role="listbox" aria-label="Matching licenses">
                        {changeMatches.length ? (
                          changeMatches.map((item) => (
                            <button className="license-result-option" type="button" role="option" key={item.license} onClick={() => onChangeLicense(row.id, item.license)}>
                              <strong>{item.license}</strong>
                              <span>{item.group} - {item.body}</span>
                            </button>
                          ))
                        ) : (
                          <div className="license-result-empty">No matching license</div>
                        )}
                      </div>
                    </div>
                  ) : null}
                </div>
                <div className="license-toggle-cell">
                  <span>Mandatory</span>
                  <label className="requirement-toggle">
                    <input
                      type="checkbox"
                      aria-label={`${row.license} Mandatory`}
                      checked={row.mandatory}
                      onChange={(event) => onUpdateLicense(row.id, { mandatory: event.target.checked })}
                    />
                    <span></span>
                  </label>
                </div>
                <div className="license-toggle-cell">
                  <span>Expiry required</span>
                  <label className="requirement-toggle">
                    <input
                      type="checkbox"
                      aria-label={`${row.license} Expiry required`}
                      checked={row.expiryRequired}
                      onChange={(event) => onUpdateLicense(row.id, { expiryRequired: event.target.checked })}
                    />
                    <span></span>
                  </label>
                </div>
                <div className="license-row-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => onStartChange(row.id)}>
                    Change
                  </button>
                  <button className="boq-row-action icon-delete-btn" type="button" aria-label="Remove license requirement" title="Remove license requirement" onClick={() => onDeleteLicense(row.id)}>
                    x
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="scope-empty">No regulatory license requirements added yet.</div>
        )}
      </div>
      {addOpen ? (
        <div className="license-add-picker">
          <input
            className="form-input"
            type="search"
            aria-label="Search all regulatory licenses"
            placeholder="Search all licenses"
            value={addSearch}
            onChange={(event) => onAddSearch(event.target.value)}
          />
          <div className="license-results open" role="listbox" aria-label="Available regulatory licenses">
            {filteredAddLicenses.length ? (
              filteredAddLicenses.map((item) => (
                <button className="license-result-option" type="button" role="option" key={item.license} onClick={() => onAddLicense(item.license)}>
                  <strong>{item.license}</strong>
                  <span>{item.group} - {item.body}</span>
                </button>
              ))
            ) : (
              <div className="license-result-empty">No matching license</div>
            )}
          </div>
        </div>
      ) : null}
    </section>
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
  onRemoveLineItem,
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
  onRemoveLineItem: (itemId: string) => void;
  onNewDeliverable: (value: string) => void;
  onNewAttachment: (value: string) => void;
  onAddDeliverable: () => void;
  onAddAttachment: () => void;
}) {
  const [specModal, setSpecModal] = useState<{ sourceItemId: string; name: string; detail: string; error: string } | null>(null);
  const [licenseAddOpen, setLicenseAddOpen] = useState(false);
  const [licenseAddSearch, setLicenseAddSearch] = useState('');
  const [licenseChangeRowId, setLicenseChangeRowId] = useState<string | null>(null);
  const [licenseChangeSearch, setLicenseChangeSearch] = useState('');
  const filteredAddLicenses = filterRegulatoryLicenses(licenseAddSearch, draft.regulatoryLicenseRequirements.map((row) => row.license));

  function filterRegulatoryLicenses(query: string, excluded: string[] = []) {
    const needle = query.trim().toLowerCase();
    return regulatoryLicenseCatalog
      .filter((item) => !excluded.includes(item.license))
      .filter((item) => {
        if (!needle) return true;
        return `${item.group} ${item.license} ${item.body}`.toLowerCase().includes(needle);
      });
  }

  function updateProductSpecification(rowId: string, patch: Partial<CreateTenderProductSpecificationRow>) {
    onPatch({
      productSpecifications: draft.productSpecifications.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    });
  }

  function deleteProductSpecification(rowId: string) {
    onPatch({ productSpecifications: draft.productSpecifications.filter((row) => row.id !== rowId) });
  }

  function saveProductSpecification() {
    if (!specModal) return;
    const specificationName = specModal.name.trim();
    if (!specificationName) {
      setSpecModal({ ...specModal, error: 'Specification name is required.' });
      return;
    }
    onPatch({
      productSpecifications: [
        ...draft.productSpecifications,
        {
          id: createRowId('product-spec'),
          sourceItemId: specModal.sourceItemId,
          specificationName,
          acceptableRequirement: specModal.detail.trim()
        }
      ]
    });
    setSpecModal(null);
  }

  function addSampleRequirement() {
    const sourceItem = draft.commercialItems[0] ?? { id: createRowId('item'), description: '', quantity: '', unit: '', unitPrice: '' };
    const row: CreateTenderSampleRequirementRow = {
      id: createRowId('sample'),
      relatedBoqItemId: sourceItem.id,
      sampleRequired: true,
      numberOfSamples: '',
      sampleDescription: '',
      deliveryLocation: '',
      deliveryDeadline: '',
      mandatory: true,
      returnableSample: false
    };
    onPatch({
      commercialItems: draft.commercialItems.length ? draft.commercialItems : [sourceItem],
      sampleRequirements: [...draft.sampleRequirements, row]
    });
  }

  function updateSampleRequirement(rowId: string, patch: Partial<CreateTenderSampleRequirementRow>) {
    onPatch({ sampleRequirements: draft.sampleRequirements.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function deleteSampleRequirement(rowId: string) {
    onPatch({ sampleRequirements: draft.sampleRequirements.filter((row) => row.id !== rowId) });
  }

  function addFinancialRequirement() {
    const row: CreateTenderFinancialRequirementRow = {
      id: createRowId('financial'),
      requirementType: '',
      minimumValue: '',
      period: '',
      evidenceRequired: '',
      mandatory: true
    };
    onPatch({ financialRequirements: [...draft.financialRequirements, row] });
  }

  function updateFinancialRequirement(rowId: string, patch: Partial<CreateTenderFinancialRequirementRow>) {
    onPatch({ financialRequirements: draft.financialRequirements.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function deleteFinancialRequirement(rowId: string) {
    onPatch({ financialRequirements: draft.financialRequirements.filter((row) => row.id !== rowId) });
  }

  function addEligibilityRequirement(preset = '') {
    const row: CreateTenderEligibilityRequirementRow = {
      id: createRowId('eligibility'),
      requirementName: preset,
      mandatory: true,
      requiresUpload: true,
      notes: ''
    };
    onPatch({ eligibilityRequirements: [...draft.eligibilityRequirements, row] });
  }

  function updateEligibilityRequirement(rowId: string, patch: Partial<CreateTenderEligibilityRequirementRow>) {
    onPatch({ eligibilityRequirements: draft.eligibilityRequirements.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function deleteEligibilityRequirement(rowId: string) {
    onPatch({ eligibilityRequirements: draft.eligibilityRequirements.filter((row) => row.id !== rowId) });
  }

  function patchRegulatoryLicenseRows(rows: CreateTenderRegulatoryLicenseRequirementRow[]) {
    onPatch({
      regulatoryLicenseRequirements: rows,
      selectedLicenses: rows.map((row) => row.license)
    });
  }

  function addRegulatoryLicenseRequirement(licenseName: string) {
    if (draft.regulatoryLicenseRequirements.some((row) => row.license === licenseName)) return;
    patchRegulatoryLicenseRows([...draft.regulatoryLicenseRequirements, createRegulatoryLicenseRow(licenseName)]);
    setLicenseAddOpen(false);
    setLicenseAddSearch('');
  }

  function updateRegulatoryLicenseRequirement(rowId: string, patch: Partial<CreateTenderRegulatoryLicenseRequirementRow>) {
    patchRegulatoryLicenseRows(draft.regulatoryLicenseRequirements.map((row) => (row.id === rowId ? { ...row, ...patch } : row)));
  }

  function changeRegulatoryLicenseRequirement(rowId: string, licenseName: string) {
    if (draft.regulatoryLicenseRequirements.some((row) => row.id !== rowId && row.license === licenseName)) return;
    const catalogItem = getRegulatoryLicenseByName(licenseName);
    patchRegulatoryLicenseRows(
      draft.regulatoryLicenseRequirements.map((row) => (row.id === rowId ? { ...row, license: catalogItem.license, body: catalogItem.body } : row))
    );
    setLicenseChangeRowId(null);
    setLicenseChangeSearch('');
  }

  function deleteRegulatoryLicenseRequirement(rowId: string) {
    patchRegulatoryLicenseRows(draft.regulatoryLicenseRequirements.filter((row) => row.id !== rowId));
  }

  const regulatoryLicensePanel = (
    <RegulatoryLicenseRequirementsPanel
      rows={draft.regulatoryLicenseRequirements}
      addOpen={licenseAddOpen}
      addSearch={licenseAddSearch}
      changeRowId={licenseChangeRowId}
      changeSearch={licenseChangeSearch}
      filteredAddLicenses={filteredAddLicenses}
      getChangeMatches={(row) =>
        filterRegulatoryLicenses(
          licenseChangeSearch,
          draft.regulatoryLicenseRequirements.filter((item) => item.id !== row.id).map((item) => item.license)
        )
      }
      onToggleAdd={() => {
        setLicenseAddOpen((current) => !current);
        setLicenseAddSearch('');
      }}
      onAddSearch={setLicenseAddSearch}
      onStartChange={(rowId) => {
        setLicenseAddOpen(false);
        setLicenseAddSearch('');
        setLicenseChangeRowId(rowId);
        setLicenseChangeSearch('');
      }}
      onChangeSearch={setLicenseChangeSearch}
      onAddLicense={addRegulatoryLicenseRequirement}
      onUpdateLicense={updateRegulatoryLicenseRequirement}
      onChangeLicense={changeRegulatoryLicenseRequirement}
      onDeleteLicense={deleteRegulatoryLicenseRequirement}
    />
  );

  if (draft.procurementTypeId === 'works') {
    return (
      <WorksRequirementsStep
        draft={draft}
        onPatch={onPatch}
        onAddFinancialRequirement={addFinancialRequirement}
        onUpdateFinancialRequirement={updateFinancialRequirement}
        onDeleteFinancialRequirement={deleteFinancialRequirement}
        regulatoryLicensePanel={regulatoryLicensePanel}
      />
    );
  }

  if (draft.procurementTypeId === 'services') {
    return (
      <ServicesRequirementsStep
        draft={draft}
        onPatch={onPatch}
        onAddFinancialRequirement={addFinancialRequirement}
        onUpdateFinancialRequirement={updateFinancialRequirement}
        onDeleteFinancialRequirement={deleteFinancialRequirement}
        regulatoryLicensePanel={regulatoryLicensePanel}
      />
    );
  }

  if (draft.procurementTypeId === 'consultancy') {
    return (
      <ConsultancyRequirementsStep
        draft={draft}
        onPatch={onPatch}
        onAddFinancialRequirement={addFinancialRequirement}
        onUpdateFinancialRequirement={updateFinancialRequirement}
        onDeleteFinancialRequirement={deleteFinancialRequirement}
        regulatoryLicensePanel={regulatoryLicensePanel}
      />
    );
  }

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

    function importProductSpecifications(file: File | undefined) {
      if (!file || !draft.commercialItems.length) return;
      const reader = new FileReader();
      reader.onload = () => {
        const importedRows = parseProductSpecificationCsv(String(reader.result || ''), draft.commercialItems);
        if (!importedRows.length) return;
        onPatch({ productSpecifications: [...draft.productSpecifications, ...importedRows] });
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
            <span className="form-hint">Define the items and quantities bidders must price in their submissions.</span>
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
                  <th aria-label="Actions"></th>
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
                        <select aria-label={`Item ${index + 1} unit`} value={item.unit} onChange={(event) => onUpdateLineItem(item.id, { unit: event.target.value })}>
                          <option value="">Select unit</option>
                          {goodsUnitOptions.map((unit) => (
                            <option key={unit} value={unit}>
                              {unit}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Item ${index + 1} quantity`}
                          inputMode="decimal"
                          value={item.quantity}
                          onChange={(event) => onUpdateLineItem(item.id, { quantity: event.target.value })}
                        />
                      </td>
                      <td className="requirement-table-action-cell">
                        <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Delete item ${index + 1}`} onClick={() => onRemoveLineItem(item.id)}>
                          x
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>
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
          <div className="product-spec-builder" data-product-spec-builder="productSpecificationTemplate">
            <div className="product-spec-toolbar">
              <label className="btn btn-secondary scope-add goods-import-control">
                Import CSV
                <input type="file" accept=".csv,.txt" onChange={(event) => importProductSpecifications(event.target.files?.[0])} />
              </label>
              <button className="btn btn-secondary scope-add" type="button" onClick={downloadProductSpecificationTemplate}>
                Download CSV Template
              </button>
            </div>
            <div className="product-spec-item-grid">
              {draft.commercialItems.length ? (
                draft.commercialItems.map((item, index) => {
                  const itemRows = draft.productSpecifications.filter((row) => row.sourceItemId === item.id);
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
                        <button
                          className="btn btn-secondary scope-add"
                          type="button"
                          onClick={() => setSpecModal({ sourceItemId: item.id, name: '', detail: '', error: '' })}
                        >
                          Add Specification
                        </button>
                      </div>
                      <div className="product-spec-sheet-wrap">
                        <table className="product-spec-sheet product-spec-item-sheet">
                          <thead>
                            <tr>
                              <th>Specification <span className="required-dot">*</span></th>
                              <th>Specific detail required</th>
                              <th aria-label="Actions"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {itemRows.length ? (
                              itemRows.map((row, rowIndex) => (
                                <tr key={row.id}>
                                  <td>
                                    <input
                                      className="form-input"
                                      aria-label={`Specification name ${rowIndex + 1}`}
                                      value={row.specificationName}
                                      onChange={(event) => updateProductSpecification(row.id, { specificationName: event.target.value })}
                                    />
                                  </td>
                                  <td>
                                    <textarea
                                      className="form-input"
                                      rows={3}
                                      aria-label={`Specific detail required ${rowIndex + 1}`}
                                      value={row.acceptableRequirement}
                                      onChange={(event) => updateProductSpecification(row.id, { acceptableRequirement: event.target.value })}
                                    />
                                  </td>
                                  <td>
                                    <button className="boq-row-action icon-delete-btn" type="button" aria-label="Delete specification" onClick={() => deleteProductSpecification(row.id)}>
                                      x
                                    </button>
                                  </td>
                                </tr>
                              ))
                            ) : (
                              <tr>
                                <td colSpan={3}>
                                  <div className="scope-empty">No specifications added for this item yet.</div>
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="scope-empty">Add goods items in the Quantity Schedule first. Each item will get its own specification table here.</div>
              )}
            </div>
            <div className="product-spec-modal" role="dialog" aria-modal="true" aria-labelledby="product-spec-modal-title" hidden={!specModal}>
              <div className="product-spec-modal-card">
                <div className="product-spec-modal-heading">
                  <div>
                    <span className="section-kicker">Item specification</span>
                    <h4 id="product-spec-modal-title">Add Specification</h4>
                    <p>{draft.commercialItems.find((item) => item.id === specModal?.sourceItemId)?.description || 'Product item'}</p>
                  </div>
                  <button className="boq-row-action icon-delete-btn" type="button" aria-label="Cancel add specification" onClick={() => setSpecModal(null)}>
                    x
                  </button>
                </div>
                <label>
                  <span className="form-label">Specification name</span>
                  <input
                    className="form-input"
                    type="text"
                    aria-label="Specification name"
                    placeholder="Example: Brand, Processor, Warranty"
                    value={specModal?.name ?? ''}
                    onChange={(event) => specModal && setSpecModal({ ...specModal, name: event.target.value, error: '' })}
                  />
                </label>
                <label>
                  <span className="form-label">Specific detail required</span>
                  <textarea
                    className="form-input"
                    rows={4}
                    aria-label="Specific detail required"
                    placeholder="Optional, e.g. HP/Dell/Lenovo or equivalent, Core i5 or above"
                    value={specModal?.detail ?? ''}
                    onChange={(event) => specModal && setSpecModal({ ...specModal, detail: event.target.value })}
                  />
                </label>
                {specModal?.error ? <span className="form-hint error">{specModal.error}</span> : null}
                <div className="product-spec-modal-actions">
                  <button className="btn btn-secondary" type="button" onClick={() => setSpecModal(null)}>
                    Cancel
                  </button>
                  <button className="btn btn-primary" type="button" onClick={saveProductSpecification}>
                    Save Specification
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="planning-section wizard-section goods-requirements-section">
          <div className="scope-list-heading">
            <div>
              <h3>Sample Requirements</h3>
              <span className="form-hint">Enable samples only when buyers need physical samples before evaluation or award.</span>
            </div>
          </div>
          <div className="sample-requirement-choice-group" role="radiogroup" aria-label="Require Samples?">
            <span className="form-label">Require Samples?</span>
            <div className="sample-requirement-choice-row">
              {(['Yes', 'No'] as const).map((option) => {
                const checked = (draft.requirements.requireSamples ?? 'No') === option;
                return (
                  <label key={option} className={`sample-requirement-choice ${checked ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="requireSamples"
                      value={option}
                      checked={checked}
                      onChange={() => onPatch({ requirements: { ...draft.requirements, requireSamples: option } })}
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {draft.requirements.requireSamples === 'Yes' ? (
            <>
              <div className="form-label">Sample requirement design</div>
              <div className="requirement-table-wrap">
                <table className="requirement-table">
                    <thead>
                      <tr>
                        <th>Related BOQ Item</th>
                        <th>Sample Required</th>
                        <th>Number of Samples</th>
                        <th>Sample Description</th>
                        <th>Delivery Location</th>
                        <th>Delivery Deadline</th>
                        <th>Mandatory</th>
                        <th>Returnable Sample?</th>
                        <th aria-label="Actions"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {draft.sampleRequirements.length ? (
                        draft.sampleRequirements.map((row, index) => (
                          <tr key={row.id}>
                            <td>
                              <select
                                aria-label={`Related BOQ Item ${index + 1}`}
                                value={row.relatedBoqItemId}
                                onChange={(event) => updateSampleRequirement(row.id, { relatedBoqItemId: event.target.value })}
                              >
                                {draft.commercialItems.map((item, itemIndex) => (
                                  <option key={item.id} value={item.id}>
                                    {item.description || `Product item ${itemIndex + 1}`}
                                  </option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <label className="requirement-toggle" title="Sample Required">
                                <input
                                  type="checkbox"
                                  aria-label={`Sample Required ${index + 1}`}
                                  checked={row.sampleRequired}
                                  onChange={(event) => updateSampleRequirement(row.id, { sampleRequired: event.target.checked })}
                                />
                                <span></span>
                              </label>
                            </td>
                            <td>
                              <input
                                aria-label={`Number of Samples ${index + 1}`}
                                inputMode="numeric"
                                value={row.numberOfSamples}
                                onChange={(event) => updateSampleRequirement(row.id, { numberOfSamples: event.target.value })}
                              />
                            </td>
                            <td>
                              <textarea
                                aria-label={`Sample Description ${index + 1}`}
                                value={row.sampleDescription}
                                onChange={(event) => updateSampleRequirement(row.id, { sampleDescription: event.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`Delivery Location ${index + 1}`}
                                value={row.deliveryLocation}
                                onChange={(event) => updateSampleRequirement(row.id, { deliveryLocation: event.target.value })}
                              />
                            </td>
                            <td>
                              <input
                                aria-label={`Delivery Deadline ${index + 1}`}
                                type="date"
                                value={row.deliveryDeadline}
                                onChange={(event) => updateSampleRequirement(row.id, { deliveryDeadline: event.target.value })}
                              />
                            </td>
                            <td>
                              <label className="requirement-toggle" title="Mandatory">
                                <input
                                  type="checkbox"
                                  aria-label={`Mandatory sample ${index + 1}`}
                                  checked={row.mandatory}
                                  onChange={(event) => updateSampleRequirement(row.id, { mandatory: event.target.checked })}
                                />
                                <span></span>
                              </label>
                            </td>
                            <td>
                              <label className="requirement-toggle" title="Returnable Sample?">
                                <input
                                  type="checkbox"
                                  aria-label={`Returnable Sample ${index + 1}`}
                                  checked={row.returnableSample}
                                  onChange={(event) => updateSampleRequirement(row.id, { returnableSample: event.target.checked })}
                                />
                                <span></span>
                              </label>
                            </td>
                            <td className="requirement-table-action-cell">
                              <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Delete sample requirement ${index + 1}`} onClick={() => deleteSampleRequirement(row.id)}>
                                x
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={9}>
                            <div className="scope-empty">No sample requirements added yet.</div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {!draft.commercialItems.length ? <span className="sample-source-hint">Adding a sample requirement will create a blank quantity item for you to complete.</span> : null}
                <div className="requirement-table-actions">
                  <button className="btn btn-secondary scope-add" type="button" onClick={addSampleRequirement}>
                    Add Sample Requirement
                  </button>
                </div>
              </>
          ) : null}
        </section>

        <section className="planning-section wizard-section goods-requirements-section">
          <div className="scope-list-heading">
            <div>
              <h3>Financial Capacity Requirements</h3>
              <span className="form-hint">Structured financial rules used to verify whether bidders can sustain the contract.</span>
            </div>
            <button className="btn btn-secondary scope-add" type="button" onClick={addFinancialRequirement}>
              Add Financial Requirement
            </button>
          </div>
          <div className="requirement-table-wrap">
            <table className="requirement-table">
              <thead>
                <tr>
                  <th>Requirement type</th>
                  <th>Minimum value</th>
                  <th>Period</th>
                  <th>Evidence required</th>
                  <th>Mandatory</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {draft.financialRequirements.length ? (
                  draft.financialRequirements.map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        <select
                          aria-label={`Requirement type ${index + 1}`}
                          value={row.requirementType}
                          onChange={(event) => updateFinancialRequirement(row.id, { requirementType: event.target.value })}
                        >
                          <option value="">Select</option>
                          {financialRequirementTypes.map((type) => (
                            <option key={type} value={type}>
                              {type}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          aria-label={`Minimum value ${index + 1}`}
                          inputMode="decimal"
                          value={row.minimumValue}
                          onChange={(event) => updateFinancialRequirement(row.id, { minimumValue: event.target.value })}
                        />
                      </td>
                      <td>
                        <select aria-label={`Period ${index + 1}`} value={row.period} onChange={(event) => updateFinancialRequirement(row.id, { period: event.target.value })}>
                          <option value="">Select</option>
                          {financialPeriods.map((period) => (
                            <option key={period} value={period}>
                              {period}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <select
                          aria-label={`Evidence required ${index + 1}`}
                          value={row.evidenceRequired}
                          onChange={(event) => updateFinancialRequirement(row.id, { evidenceRequired: event.target.value })}
                        >
                          <option value="">Select</option>
                          {financialEvidence.map((evidence) => (
                            <option key={evidence} value={evidence}>
                              {evidence}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Mandatory financial requirement ${index + 1}`}
                          checked={row.mandatory}
                          onChange={(event) => updateFinancialRequirement(row.id, { mandatory: event.target.checked })}
                        />
                      </td>
                      <td>
                        <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Delete financial requirement ${index + 1}`} onClick={() => deleteFinancialRequirement(row.id)}>
                          x
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="scope-empty">No financial requirements added yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {regulatoryLicensePanel}

        <section className="planning-section wizard-section goods-requirements-section">
          <div className="scope-list-heading">
            <div>
              <h3>Other Eligibility Requirements</h3>
              <span className="form-hint">Use add/remove requirement cards for supplier eligibility documents and notes.</span>
            </div>
            <button className="btn btn-secondary scope-add" type="button" onClick={() => addEligibilityRequirement()}>
              Add Requirement
            </button>
          </div>
          <div className="category-chip-row">
            {eligibilityPresets.map((preset) => (
              <button className="status-badge removable" type="button" key={preset} onClick={() => addEligibilityRequirement(preset)}>
                {preset}
              </button>
            ))}
          </div>
          {draft.eligibilityRequirements.length ? (
            <div className="product-spec-item-grid">
              {draft.eligibilityRequirements.map((row, index) => (
                <article key={row.id} className="product-spec-item-card">
                  <div className="product-spec-item-header">
                    <div>
                      <span className="section-kicker">Eligibility requirement {index + 1}</span>
                      <h4>{row.requirementName || 'New requirement'}</h4>
                    </div>
                    <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Delete eligibility requirement ${index + 1}`} onClick={() => deleteEligibilityRequirement(row.id)}>
                      x
                    </button>
                  </div>
                  <div className="form-grid two">
                    <label>
                      Requirement name
                      <input
                        aria-label={`Requirement name ${index + 1}`}
                        value={row.requirementName}
                        onChange={(event) => updateEligibilityRequirement(row.id, { requirementName: event.target.value })}
                      />
                    </label>
                    <label>
                      Notes
                      <textarea aria-label={`Eligibility notes ${index + 1}`} value={row.notes} onChange={(event) => updateEligibilityRequirement(row.id, { notes: event.target.value })} />
                    </label>
                    <label>
                      <input type="checkbox" checked={row.mandatory} onChange={(event) => updateEligibilityRequirement(row.id, { mandatory: event.target.checked })} /> Mandatory
                    </label>
                    <label>
                      <input type="checkbox" checked={row.requiresUpload} onChange={(event) => updateEligibilityRequirement(row.id, { requiresUpload: event.target.checked })} /> Requires upload
                    </label>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="scope-empty">No other eligibility requirements added yet.</div>
          )}
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

function ConsultancyRequirementsStep({
  draft,
  onPatch,
  onAddFinancialRequirement,
  onUpdateFinancialRequirement,
  onDeleteFinancialRequirement,
  regulatoryLicensePanel
}: {
  draft: CreateTenderDraft;
  onPatch: (patch: Partial<CreateTenderDraft>) => void;
  onAddFinancialRequirement: () => void;
  onUpdateFinancialRequirement: (rowId: string, patch: Partial<CreateTenderFinancialRequirementRow>) => void;
  onDeleteFinancialRequirement: (rowId: string) => void;
  regulatoryLicensePanel: ReactNode;
}) {
  const consultancy = draft.consultancyRequirements ?? createEmptyConsultancyRequirements();

  function patchConsultancy(patch: Partial<CreateTenderConsultancyRequirements>) {
    onPatch({ consultancyRequirements: patch as CreateTenderConsultancyRequirements });
  }

  function addEntityBackground() {
    patchConsultancy({ entityBackgroundCards: [...consultancy.entityBackgroundCards, { id: createRowId('consultancy-background'), organizationBackground: '', departmentUnit: '' }] });
  }

  function updateEntityBackground(rowId: string, patch: Partial<CreateTenderConsultancyEntityBackgroundCard>) {
    patchConsultancy({ entityBackgroundCards: consultancy.entityBackgroundCards.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addSpecificObjective() {
    patchConsultancy({ specificObjectiveRows: [...consultancy.specificObjectiveRows, { id: createRowId('consultancy-objective'), objectiveTitle: '', objectiveDescription: '', priorityLevel: '' }] });
  }

  function updateSpecificObjective(rowId: string, patch: Partial<CreateTenderConsultancySpecificObjectiveRow>) {
    patchConsultancy({ specificObjectiveRows: consultancy.specificObjectiveRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addAssignmentActivity() {
    patchConsultancy({
      assignmentActivityRows: [...consultancy.assignmentActivityRows, { id: createRowId('consultancy-activity'), activityTitle: '', detailedDescription: '', expectedOutput: '', location: '', duration: '' }]
    });
  }

  function updateAssignmentActivity(rowId: string, patch: Partial<CreateTenderConsultancyAssignmentActivityRow>) {
    patchConsultancy({ assignmentActivityRows: consultancy.assignmentActivityRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addResponsibility(type: 'clientResponsibilityRows' | 'consultantResponsibilityRows') {
    patchConsultancy({ [type]: [...consultancy[type], { id: createRowId(type), title: '', description: '', supportType: '' }] } as Partial<CreateTenderConsultancyRequirements>);
  }

  function updateResponsibility(type: 'clientResponsibilityRows' | 'consultantResponsibilityRows', rowId: string, patch: Partial<CreateTenderConsultancyResponsibilityRow>) {
    patchConsultancy({ [type]: consultancy[type].map((row) => (row.id === rowId ? { ...row, ...patch } : row)) } as Partial<CreateTenderConsultancyRequirements>);
  }

  function addConsultancyDeliverable() {
    patchConsultancy({
      deliverableRows: [
        ...consultancy.deliverableRows,
        { id: createRowId('consultancy-deliverable'), deliverableName: '', description: '', submissionTimeline: '', formatRequired: '', reviewer: '', mandatory: true }
      ]
    });
  }

  function updateConsultancyDeliverable(rowId: string, patch: Partial<CreateTenderConsultancyDeliverableRow>) {
    patchConsultancy({ deliverableRows: consultancy.deliverableRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addReportingRequirement() {
    patchConsultancy({
      reportingRequirementRows: [...consultancy.reportingRequirementRows, { id: createRowId('consultancy-report'), reportType: '', frequency: '', submissionFormat: '', submissionChannel: '' }]
    });
  }

  function updateReportingRequirement(rowId: string, patch: Partial<CreateTenderConsultancyReportingRequirementRow>) {
    patchConsultancy({ reportingRequirementRows: consultancy.reportingRequirementRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addKeyExpert() {
    patchConsultancy({
      keyExpertRows: [...consultancy.keyExpertRows, { id: createRowId('consultancy-key-expert'), positionTitle: '', minimumQualification: '', yearsOfExperience: '', certifications: '', quantityRequired: '', mandatory: true }]
    });
  }

  function updateKeyExpert(rowId: string, patch: Partial<CreateTenderConsultancyKeyExpertRow>) {
    patchConsultancy({ keyExpertRows: consultancy.keyExpertRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addSupportingDocument() {
    patchConsultancy({ supportingDocumentRows: [...consultancy.supportingDocumentRows, { id: createRowId('consultancy-document'), documentTitle: '', category: '', uploadName: '', confidential: false }] });
  }

  function updateSupportingDocument(rowId: string, patch: Partial<CreateTenderConsultancySupportingDocumentRow>) {
    patchConsultancy({ supportingDocumentRows: consultancy.supportingDocumentRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addExternalReference() {
    patchConsultancy({ externalReferenceRows: [...consultancy.externalReferenceRows, { id: createRowId('consultancy-reference'), referenceName: '', url: '', description: '' }] });
  }

  function updateExternalReference(rowId: string, patch: Partial<CreateTenderConsultancyExternalReferenceRow>) {
    patchConsultancy({ externalReferenceRows: consultancy.externalReferenceRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addStringItem(key: 'individualProfessionalCertifications' | 'firmSectorExperience' | 'communicationMethods') {
    patchConsultancy({ [key]: [...consultancy[key], ''] } as Partial<CreateTenderConsultancyRequirements>);
  }

  function updateStringItem(key: 'individualProfessionalCertifications' | 'firmSectorExperience' | 'communicationMethods', index: number, value: string) {
    patchConsultancy({ [key]: consultancy[key].map((item, itemIndex) => (itemIndex === index ? value : item)) } as Partial<CreateTenderConsultancyRequirements>);
  }

  const renderStringList = (key: 'individualProfessionalCertifications' | 'firmSectorExperience' | 'communicationMethods', label: string, options: string[]) => (
    <div className="repeatable-list-control">
      <div className="scope-list-heading compact">
        <span className="form-label">{label}</span>
        <button className="btn btn-secondary" type="button" onClick={() => addStringItem(key)}>
          Add
        </button>
      </div>
      {consultancy[key].length ? (
        consultancy[key].map((item, index) => (
          <select key={`${key}-${index}`} className="form-input" value={item} onChange={(event) => updateStringItem(key, index, event.target.value)} aria-label={`${label} ${index + 1}`}>
            <option value="">Select</option>
            {options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        ))
      ) : (
        <span className="scope-empty">No {label.toLowerCase()} added yet.</span>
      )}
    </div>
  );

  return (
    <div className="wizard-step-surface requirements-step-surface consultancy-requirements-step">
      <div className="consultancy-tor-workspace">
        <div className="consultancy-tor-main">
          <div className="consultancy-tor-header">
            <div>
              <span className="section-kicker">Structured assignment-definition workspace</span>
              <h3>Consultancy Procurement TOR</h3>
            </div>
            <span className="badge badge-info">Financial Proposal</span>
          </div>

          <div className="requirement-section-grid">
            <article className="requirement-block" id="requirement-section-consultancyIntroduction">
              <div>
                <h4>1. Introduction</h4>
                <span className="form-hint">Provides assignment background, procuring entity context, project background, and the problem statement.</span>
              </div>
              <div className="requirement-control-grid">
                <div className="requirement-control requirement-control-wide">
                  <div className="scope-list-heading">
                    <span className="form-label">1.1 Procuring Entity Background</span>
                    <button className="btn btn-secondary" type="button" onClick={addEntityBackground}>
                      Add Entity Background
                    </button>
                  </div>
                  {consultancy.entityBackgroundCards.length ? (
                    <div className="requirement-card-list">
                      {consultancy.entityBackgroundCards.map((row, index) => (
                        <article key={row.id} className="requirement-repeater-card">
                          <label>
                            <span className="form-label">Organization Background</span>
                            <textarea className="form-input" value={row.organizationBackground} onChange={(event) => updateEntityBackground(row.id, { organizationBackground: event.target.value })} aria-label={`Organization Background ${index + 1}`} />
                          </label>
                          <label>
                            <span className="form-label">Department / Unit</span>
                            <select className="form-input" value={row.departmentUnit} onChange={(event) => updateEntityBackground(row.id, { departmentUnit: event.target.value })} aria-label={`Department / Unit ${index + 1}`}>
                              <option value="">Select</option>
                              {consultancyDepartmentOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="scope-empty">No procuring entity background captured yet.</div>
                  )}
                </div>
                <div className="requirement-control requirement-control-wide">
                  <div className="scope-list-heading">
                    <span className="form-label">1.2 Project Background</span>
                  </div>
                  <div className="requirement-accordion">
                    <details className="requirement-accordion-item" open>
                      <summary>Project Name</summary>
                      <input className="form-input" value={consultancy.projectName} onChange={(event) => patchConsultancy({ projectName: event.target.value })} aria-label="Project Name" />
                    </details>
                    <details className="requirement-accordion-item">
                      <summary>Background Narrative</summary>
                      <textarea className="form-input requirement-rich-input" rows={5} value={consultancy.backgroundNarrative} onChange={(event) => patchConsultancy({ backgroundNarrative: event.target.value })} aria-label="Background Narrative" />
                    </details>
                    <details className="requirement-accordion-item">
                      <summary>Existing Challenges</summary>
                      <textarea className="form-input requirement-rich-input" rows={5} value={consultancy.existingChallenges} onChange={(event) => patchConsultancy({ existingChallenges: event.target.value })} aria-label="Existing Challenges" />
                    </details>
                    <details className="requirement-accordion-item">
                      <summary>Current Situation</summary>
                      <textarea className="form-input requirement-rich-input" rows={5} value={consultancy.currentSituation} onChange={(event) => patchConsultancy({ currentSituation: event.target.value })} aria-label="Current Situation" />
                    </details>
                    <details className="requirement-accordion-item">
                      <summary>Related Initiatives</summary>
                      <textarea className="form-input requirement-rich-input" rows={5} value={consultancy.relatedInitiatives} onChange={(event) => patchConsultancy({ relatedInitiatives: event.target.value })} aria-label="Related Initiatives" />
                    </details>
                  </div>
                </div>
                <div className="requirement-control requirement-control-wide">
                  <div className="scope-list-heading">
                    <span className="form-label">1.3 Problem Statement</span>
                  </div>
                  <div className="requirement-accordion">
                    <details className="requirement-accordion-item" open>
                      <summary>Main Problem Description</summary>
                      <textarea className="form-input requirement-rich-input" rows={5} value={consultancy.mainProblemDescription} onChange={(event) => patchConsultancy({ mainProblemDescription: event.target.value })} aria-label="Main Problem Description" />
                    </details>
                    <details className="requirement-accordion-item">
                      <summary>Expected Impact</summary>
                      <textarea className="form-input requirement-rich-input" rows={5} value={consultancy.expectedImpact} onChange={(event) => patchConsultancy({ expectedImpact: event.target.value })} aria-label="Expected Impact" />
                    </details>
                  </div>
                </div>
              </div>
            </article>

            <article className="requirement-block" id="requirement-section-consultancyObjectives">
              <div>
                <h4>2. Objectives of the Consultancy</h4>
                <span className="form-hint">Defines the general objective and specific outcomes expected from the assignment.</span>
              </div>
              <div className="requirement-control-grid">
                <label className="requirement-control requirement-control-wide">
                  <span className="form-label">2.1 General Objective</span>
                  <textarea className="form-input" value={consultancy.generalObjective} onChange={(event) => patchConsultancy({ generalObjective: event.target.value })} aria-label="General Objective" />
                </label>
                <div className="requirement-control requirement-control-wide">
                  <div className="scope-list-heading">
                    <span className="form-label">2.2 Specific Objectives</span>
                    <button className="btn btn-secondary" type="button" onClick={addSpecificObjective}>
                      Add Objective
                    </button>
                  </div>
                  {consultancy.specificObjectiveRows.length ? (
                    <div className="requirement-card-list">
                      {consultancy.specificObjectiveRows.map((row, index) => (
                        <article key={row.id} className="requirement-repeater-card">
                          <input className="form-input" placeholder="Objective Title" value={row.objectiveTitle} onChange={(event) => updateSpecificObjective(row.id, { objectiveTitle: event.target.value })} aria-label={`Objective Title ${index + 1}`} />
                          <textarea className="form-input" placeholder="Objective Description" value={row.objectiveDescription} onChange={(event) => updateSpecificObjective(row.id, { objectiveDescription: event.target.value })} aria-label={`Objective Description ${index + 1}`} />
                          <select className="form-input" value={row.priorityLevel} onChange={(event) => updateSpecificObjective(row.id, { priorityLevel: event.target.value })} aria-label={`Priority Level ${index + 1}`}>
                            <option value="">Priority Level</option>
                            {consultancyPriorityOptions.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="scope-empty">No specific objectives added yet.</div>
                  )}
                </div>
              </div>
            </article>

            <article className="requirement-block" id="requirement-section-consultancyScopeServices">
              <div>
                <h4>3. Scope of Consultancy Services</h4>
                <span className="form-hint">Defines assignment activities and assignment boundaries.</span>
              </div>
              <div className="requirement-control requirement-control-wide">
                <div className="scope-list-heading">
                  <span className="form-label">3.1 Assignment Activities</span>
                  <button className="btn btn-secondary" type="button" onClick={addAssignmentActivity}>
                    Add Activity
                  </button>
                </div>
                <div className="requirement-table-wrap">
                  <table className="requirement-table">
                    <thead>
                      <tr>
                        <th>Activity Title</th>
                        <th>Detailed Description</th>
                        <th>Expected Output</th>
                        <th>Location</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultancy.assignmentActivityRows.length ? (
                        consultancy.assignmentActivityRows.map((row, index) => (
                          <tr key={row.id}>
                            <td><input className="form-input" value={row.activityTitle} onChange={(event) => updateAssignmentActivity(row.id, { activityTitle: event.target.value })} aria-label={`Activity Title ${index + 1}`} /></td>
                            <td><textarea className="form-input" value={row.detailedDescription} onChange={(event) => updateAssignmentActivity(row.id, { detailedDescription: event.target.value })} aria-label={`Detailed Description ${index + 1}`} /></td>
                            <td><input className="form-input" value={row.expectedOutput} onChange={(event) => updateAssignmentActivity(row.id, { expectedOutput: event.target.value })} aria-label={`Expected Output ${index + 1}`} /></td>
                            <td><input className="form-input" value={row.location} onChange={(event) => updateAssignmentActivity(row.id, { location: event.target.value })} aria-label={`Activity Location ${index + 1}`} /></td>
                            <td><input className="form-input" type="number" value={row.duration} onChange={(event) => updateAssignmentActivity(row.id, { duration: event.target.value })} aria-label={`Activity Duration ${index + 1}`} /></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={5}>No assignment activities added yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <label>
                  <span className="form-label">3.2 Assignment Boundaries - Out-of-Scope Activities</span>
                  <textarea className="form-input" value={consultancy.outOfScopeActivities} onChange={(event) => patchConsultancy({ outOfScopeActivities: event.target.value })} aria-label="Out-of-Scope Activities" />
                </label>
              </div>
            </article>

            <article className="requirement-block" id="requirement-section-consultancyResponsibilities">
              <div>
                <h4>4. Duties and Responsibilities of the Parties</h4>
                <span className="form-hint">Defines obligations of the client and consultant.</span>
              </div>
              {(['clientResponsibilityRows', 'consultantResponsibilityRows'] as const).map((key) => (
                <div key={key} className="requirement-control requirement-control-wide">
                  <div className="scope-list-heading">
                    <span className="form-label">{key === 'clientResponsibilityRows' ? '4.1 Client Responsibilities' : '4.2 Consultant Responsibilities'}</span>
                    <button className="btn btn-secondary" type="button" onClick={() => addResponsibility(key)}>
                      {key === 'clientResponsibilityRows' ? 'Add Client Responsibility' : 'Add Consultant Responsibility'}
                    </button>
                  </div>
                  {consultancy[key].length ? (
                    <div className="requirement-card-list">
                      {consultancy[key].map((row, index) => (
                        <article key={row.id} className="requirement-repeater-card">
                          <input className="form-input" placeholder={key === 'clientResponsibilityRows' ? 'Responsibility Title' : 'Responsibility'} value={row.title} onChange={(event) => updateResponsibility(key, row.id, { title: event.target.value })} aria-label={`${key === 'clientResponsibilityRows' ? 'Client' : 'Consultant'} Responsibility ${index + 1}`} />
                          <textarea className="form-input" placeholder="Description" value={row.description} onChange={(event) => updateResponsibility(key, row.id, { description: event.target.value })} aria-label={`${key === 'clientResponsibilityRows' ? 'Client' : 'Consultant'} Responsibility Description ${index + 1}`} />
                          <select className="form-input" value={row.supportType} onChange={(event) => updateResponsibility(key, row.id, { supportType: event.target.value })} aria-label={`${key === 'clientResponsibilityRows' ? 'Client' : 'Consultant'} Responsibility Support Type ${index + 1}`}>
                            <option value="">Support Type</option>
                            {consultancySupportTypes.map((option) => (
                              <option key={option} value={option}>
                                {option}
                              </option>
                            ))}
                          </select>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="scope-empty">No {key === 'clientResponsibilityRows' ? 'client' : 'consultant'} responsibilities added yet.</div>
                  )}
                </div>
              ))}
            </article>

            <article className="requirement-block" id="requirement-section-consultancyDeliverablesTimeline">
              <div>
                <h4>5. Deliverables and Timeline</h4>
                <span className="form-hint">Defines expected outputs and reporting requirements.</span>
              </div>
              <div className="requirement-control requirement-control-wide">
                <div className="scope-list-heading">
                  <span className="form-label">5.1 Deliverables</span>
                  <button className="btn btn-secondary" type="button" onClick={addConsultancyDeliverable}>
                    Add Deliverable
                  </button>
                </div>
                <div className="requirement-table-wrap">
                  <table className="requirement-table">
                    <thead>
                      <tr>
                        <th>Deliverable Name</th>
                        <th>Description</th>
                        <th>Submission Timeline</th>
                        <th>Format Required</th>
                        <th>Reviewer</th>
                        <th>Mandatory</th>
                      </tr>
                    </thead>
                    <tbody>
                      {consultancy.deliverableRows.length ? (
                        consultancy.deliverableRows.map((row, index) => (
                          <tr key={row.id}>
                            <td><input className="form-input" value={row.deliverableName} onChange={(event) => updateConsultancyDeliverable(row.id, { deliverableName: event.target.value })} aria-label={`Deliverable Name ${index + 1}`} /></td>
                            <td><textarea className="form-input" value={row.description} onChange={(event) => updateConsultancyDeliverable(row.id, { description: event.target.value })} aria-label={`Deliverable Description ${index + 1}`} /></td>
                            <td><input className="form-input" value={row.submissionTimeline} onChange={(event) => updateConsultancyDeliverable(row.id, { submissionTimeline: event.target.value })} aria-label={`Submission Timeline ${index + 1}`} /></td>
                            <td><select className="form-input" value={row.formatRequired} onChange={(event) => updateConsultancyDeliverable(row.id, { formatRequired: event.target.value })} aria-label={`Format Required ${index + 1}`}><option value="">Select</option>{consultancyFormats.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                            <td><select className="form-input" value={row.reviewer} onChange={(event) => updateConsultancyDeliverable(row.id, { reviewer: event.target.value })} aria-label={`Reviewer ${index + 1}`}><option value="">Select</option>{consultancyReviewers.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                            <td><input type="checkbox" checked={row.mandatory} onChange={(event) => updateConsultancyDeliverable(row.id, { mandatory: event.target.checked })} aria-label={`Deliverable Mandatory ${index + 1}`} /></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={6}>No deliverables added yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="requirement-control requirement-control-wide">
                <div className="scope-list-heading">
                  <span className="form-label">5.2 Reporting Requirements</span>
                  <button className="btn btn-secondary" type="button" onClick={addReportingRequirement}>
                    Add Reporting Requirement
                  </button>
                </div>
                <div className="requirement-table-wrap">
                  <table className="requirement-table">
                    <thead><tr><th>Report Type</th><th>Frequency</th><th>Submission Format</th><th>Submission Channel</th></tr></thead>
                    <tbody>
                      {consultancy.reportingRequirementRows.length ? (
                        consultancy.reportingRequirementRows.map((row, index) => (
                          <tr key={row.id}>
                            <td><select className="form-input" value={row.reportType} onChange={(event) => updateReportingRequirement(row.id, { reportType: event.target.value })} aria-label={`Report Type ${index + 1}`}><option value="">Select</option>{consultancyReportTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                            <td><select className="form-input" value={row.frequency} onChange={(event) => updateReportingRequirement(row.id, { frequency: event.target.value })} aria-label={`Reporting Frequency ${index + 1}`}><option value="">Select</option>{consultancyFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                            <td><select className="form-input" value={row.submissionFormat} onChange={(event) => updateReportingRequirement(row.id, { submissionFormat: event.target.value })} aria-label={`Submission Format ${index + 1}`}><option value="">Select</option>{consultancyFormats.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                            <td><input className="form-input" value={row.submissionChannel} onChange={(event) => updateReportingRequirement(row.id, { submissionChannel: event.target.value })} aria-label={`Submission Channel ${index + 1}`} /></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4}>No reporting requirements added yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </article>

            <article className="requirement-block" id="requirement-section-consultancyQualificationsExperience">
              <div>
                <h4>6. Required Qualifications and Experience</h4>
                <span className="form-hint">Separates requirements for individual consultants or sole proprietors from consulting firms.</span>
              </div>
              <div className="requirement-control-grid">
                <article className="requirement-control requirement-repeater-card">
                  <span className="form-label">6.1 Individual / Sole Proprietor</span>
                  {renderStringList('individualProfessionalCertifications', 'Professional Registration / Certifications', ['CPA', 'PE', 'PMP', 'CISA', 'Registered Engineer', 'Registered Architect', 'Other'])}
                  <label><span className="form-label">CV</span><select className="form-input" value={consultancy.individualCvRequired} onChange={(event) => patchConsultancy({ individualCvRequired: event.target.value })} aria-label="Individual CV"><option>Required</option><option>Not required</option></select></label>
                  <label><span className="form-label">Years of Experience</span><input className="form-input" type="number" value={consultancy.individualYearsExperience} onChange={(event) => patchConsultancy({ individualYearsExperience: event.target.value })} aria-label="Individual Years of Experience" /></label>
                  <label><span className="form-label">Number of Similar Assignments</span><input className="form-input" type="number" value={consultancy.individualSimilarAssignmentsCount} onChange={(event) => patchConsultancy({ individualSimilarAssignmentsCount: event.target.value })} aria-label="Individual Similar Assignments" /></label>
                  <label><span className="form-label">Similar Assignment Evidence</span><select className="form-input" value={consultancy.individualSimilarAssignmentsEvidenceRequired} onChange={(event) => patchConsultancy({ individualSimilarAssignmentsEvidenceRequired: event.target.value })} aria-label="Individual Similar Assignment Evidence"><option>Required</option><option>Not required</option></select></label>
                </article>
                <article className="requirement-control requirement-repeater-card">
                  <span className="form-label">6.2 Consulting Firm - Firm Experience</span>
                  <label><span className="form-label">Minimum Years Experience</span><input className="form-input" type="number" value={consultancy.firmMinimumYearsExperience} onChange={(event) => patchConsultancy({ firmMinimumYearsExperience: event.target.value })} aria-label="Firm Minimum Years Experience" /></label>
                  <label><span className="form-label">Number of Similar Assignments</span><input className="form-input" type="number" value={consultancy.firmRequiredSimilarAssignments} onChange={(event) => patchConsultancy({ firmRequiredSimilarAssignments: event.target.value })} aria-label="Firm Similar Assignments" /></label>
                  {renderStringList('firmSectorExperience', 'Sector Experience', consultancyFirmSectors)}
                  <label><span className="form-label">Similar Assignments Evidence</span><select className="form-input" value={consultancy.firmRequiredEvidence} onChange={(event) => patchConsultancy({ firmRequiredEvidence: event.target.value })} aria-label="Firm Similar Assignments Evidence"><option>Required</option><option>Not required</option></select></label>
                </article>
                <div className="requirement-control requirement-control-wide">
                  <div className="scope-list-heading">
                    <span className="form-label">Consulting Firm - Key Personnel</span>
                    <button className="btn btn-secondary" type="button" onClick={addKeyExpert}>
                      Add Key Personnel
                    </button>
                  </div>
                  <div className="requirement-table-wrap">
                    <table className="requirement-table">
                      <thead><tr><th>Position Title</th><th>Minimum Qualification</th><th>Years</th><th>Certifications</th><th>Quantity</th><th>Mandatory</th></tr></thead>
                      <tbody>
                        {consultancy.keyExpertRows.length ? (
                          consultancy.keyExpertRows.map((row, index) => (
                            <tr key={row.id}>
                              <td><input className="form-input" value={row.positionTitle} onChange={(event) => updateKeyExpert(row.id, { positionTitle: event.target.value })} aria-label={`Key Personnel Position Title ${index + 1}`} /></td>
                              <td><select className="form-input" value={row.minimumQualification} onChange={(event) => updateKeyExpert(row.id, { minimumQualification: event.target.value })} aria-label={`Key Personnel Minimum Qualification ${index + 1}`}><option value="">Select</option>{consultancyEducationLevels.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                              <td><input className="form-input" type="number" value={row.yearsOfExperience} onChange={(event) => updateKeyExpert(row.id, { yearsOfExperience: event.target.value })} aria-label={`Key Personnel Years of Experience ${index + 1}`} /></td>
                              <td><input className="form-input" value={row.certifications} onChange={(event) => updateKeyExpert(row.id, { certifications: event.target.value })} aria-label={`Key Personnel Certifications ${index + 1}`} /></td>
                              <td><input className="form-input" type="number" value={row.quantityRequired} onChange={(event) => updateKeyExpert(row.id, { quantityRequired: event.target.value })} aria-label={`Key Personnel Quantity Required ${index + 1}`} /></td>
                              <td><input type="checkbox" checked={row.mandatory} onChange={(event) => updateKeyExpert(row.id, { mandatory: event.target.checked })} aria-label={`Key Personnel Mandatory ${index + 1}`} /></td>
                            </tr>
                          ))
                        ) : (
                          <tr><td colSpan={6}>No key personnel added yet.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div className="requirement-control requirement-control-wide">{regulatoryLicensePanel}</div>
              </div>
            </article>

            <article className="requirement-block" id="requirement-section-financialCapacity">
              <div className="scope-list-heading">
                <div>
                  <h4>Financial Capacity</h4>
                  <span className="form-hint">Add minimum financial evidence required for consultant eligibility.</span>
                </div>
                <button className="btn btn-secondary" type="button" onClick={onAddFinancialRequirement}>
                  Add Financial Requirement
                </button>
              </div>
              <div className="requirement-table-wrap">
                <table className="requirement-table">
                  <thead><tr><th>Requirement type</th><th>Minimum value</th><th>Period</th><th>Evidence</th><th>Mandatory</th><th></th></tr></thead>
                  <tbody>
                    {draft.financialRequirements.length ? (
                      draft.financialRequirements.map((row, index) => (
                        <tr key={row.id}>
                          <td><select className="form-input" value={row.requirementType} onChange={(event) => onUpdateFinancialRequirement(row.id, { requirementType: event.target.value })} aria-label={`Consultancy requirement type ${index + 1}`}><option value="">Select</option>{financialRequirementTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                          <td><input className="form-input" value={row.minimumValue} onChange={(event) => onUpdateFinancialRequirement(row.id, { minimumValue: event.target.value })} aria-label={`Consultancy minimum value ${index + 1}`} /></td>
                          <td><select className="form-input" value={row.period} onChange={(event) => onUpdateFinancialRequirement(row.id, { period: event.target.value })} aria-label={`Consultancy financial period ${index + 1}`}><option value="">Select</option>{financialPeriods.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                          <td><select className="form-input" value={row.evidenceRequired} onChange={(event) => onUpdateFinancialRequirement(row.id, { evidenceRequired: event.target.value })} aria-label={`Consultancy evidence required ${index + 1}`}><option value="">Select</option>{financialEvidence.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                          <td><input type="checkbox" checked={row.mandatory} onChange={(event) => onUpdateFinancialRequirement(row.id, { mandatory: event.target.checked })} aria-label={`Consultancy financial mandatory ${index + 1}`} /></td>
                          <td><button className="boq-row-action icon-delete-btn" type="button" onClick={() => onDeleteFinancialRequirement(row.id)} aria-label="Delete consultancy financial requirement">x</button></td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan={6}>No financial requirements added yet.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </article>

            <article className="requirement-block" id="requirement-section-consultancyInstitutionalArrangements">
              <div>
                <h4>7. Institutional and Organizational Arrangements</h4>
                <span className="form-hint">Defines reporting hierarchy, coordination arrangements, and administrative support.</span>
              </div>
              <div className="requirement-control-grid">
                <label><span className="form-label">Consultant Reports To</span><select className="form-input" value={consultancy.consultantReportsTo} onChange={(event) => patchConsultancy({ consultantReportsTo: event.target.value })} aria-label="Consultant Reports To"><option value="">Select</option>{consultancyAuthorities.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label><span className="form-label">Supervising Officer</span><select className="form-input" value={consultancy.supervisingOfficer} onChange={(event) => patchConsultancy({ supervisingOfficer: event.target.value })} aria-label="Supervising Officer"><option value="">Select</option>{consultancyAuthorities.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label><span className="form-label">Approval Authority</span><select className="form-input" value={consultancy.approvalAuthority} onChange={(event) => patchConsultancy({ approvalAuthority: event.target.value })} aria-label="Approval Authority"><option value="">Select</option>{consultancyAuthorities.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label><span className="form-label">Meeting Frequency</span><select className="form-input" value={consultancy.meetingFrequency} onChange={(event) => patchConsultancy({ meetingFrequency: event.target.value })} aria-label="Meeting Frequency"><option value="">Select</option>{consultancyFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                <label className="requirement-control-wide"><span className="form-label">Coordination Mechanism</span><textarea className="form-input" value={consultancy.coordinationMechanism} onChange={(event) => patchConsultancy({ coordinationMechanism: event.target.value })} aria-label="Coordination Mechanism" /></label>
                <div className="requirement-control-wide">{renderStringList('communicationMethods', 'Communication Method', consultancyCommunicationMethods)}</div>
                <label className="confirm-action"><input type="checkbox" className="confirm-action-input" checked={consultancy.officeSpaceProvided} onChange={(event) => patchConsultancy({ officeSpaceProvided: event.target.checked })} /> <span>Office Space Provided</span></label>
                <label className="confirm-action"><input type="checkbox" className="confirm-action-input" checked={consultancy.accessToFacilities} onChange={(event) => patchConsultancy({ accessToFacilities: event.target.checked })} /> <span>Access to Facilities</span></label>
                <label className="confirm-action"><input type="checkbox" className="confirm-action-input" checked={consultancy.accessToDocuments} onChange={(event) => patchConsultancy({ accessToDocuments: event.target.checked })} /> <span>Access to Documents</span></label>
              </div>
            </article>

            <article className="requirement-block" id="requirement-section-consultancyAttachmentsReferences">
              <div>
                <h4>8. Attachments and Reference Documents</h4>
                <span className="form-hint">Supports consultants with background materials, policy documents, studies, drawings, and external references.</span>
              </div>
              <div className="requirement-control requirement-control-wide">
                <div className="scope-list-heading">
                  <span className="form-label">8.1 Supporting Documents</span>
                  <button className="btn btn-secondary" type="button" onClick={addSupportingDocument}>
                    Add Supporting Document
                  </button>
                </div>
                <div className="requirement-table-wrap">
                  <table className="requirement-table">
                    <thead><tr><th>Document Title</th><th>File Upload</th><th>Category</th><th>Confidential</th></tr></thead>
                    <tbody>
                      {consultancy.supportingDocumentRows.length ? (
                        consultancy.supportingDocumentRows.map((row, index) => (
                          <tr key={row.id}>
                            <td><input className="form-input" value={row.documentTitle} onChange={(event) => updateSupportingDocument(row.id, { documentTitle: event.target.value })} aria-label={`Consultancy Document Title ${index + 1}`} /></td>
                            <td><input className="form-input" value={row.uploadName} onChange={(event) => updateSupportingDocument(row.id, { uploadName: event.target.value })} aria-label={`Consultancy File Upload ${index + 1}`} placeholder="Filename" /></td>
                            <td><select className="form-input" value={row.category} onChange={(event) => updateSupportingDocument(row.id, { category: event.target.value })} aria-label={`Consultancy Document Category ${index + 1}`}><option value="">Select</option>{consultancyDocumentCategories.map((option) => <option key={option} value={option}>{option}</option>)}</select></td>
                            <td><input type="checkbox" checked={row.confidential} onChange={(event) => updateSupportingDocument(row.id, { confidential: event.target.checked })} aria-label={`Consultancy Document Confidential ${index + 1}`} /></td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan={4}>No supporting documents added yet.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="requirement-control requirement-control-wide">
                <div className="scope-list-heading">
                  <span className="form-label">8.2 External References</span>
                  <button className="btn btn-secondary" type="button" onClick={addExternalReference}>
                    Add External Reference
                  </button>
                </div>
                {consultancy.externalReferenceRows.length ? (
                  <div className="requirement-card-list">
                    {consultancy.externalReferenceRows.map((row, index) => (
                      <article key={row.id} className="requirement-repeater-card">
                        <input className="form-input" placeholder="Reference Name" value={row.referenceName} onChange={(event) => updateExternalReference(row.id, { referenceName: event.target.value })} aria-label={`External Reference Name ${index + 1}`} />
                        <input className="form-input" placeholder="URL" value={row.url} onChange={(event) => updateExternalReference(row.id, { url: event.target.value })} aria-label={`External Reference URL ${index + 1}`} />
                        <textarea className="form-input" placeholder="Description" value={row.description} onChange={(event) => updateExternalReference(row.id, { description: event.target.value })} aria-label={`External Reference Description ${index + 1}`} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="scope-empty">No external references added yet.</div>
                )}
              </div>
            </article>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServicesRequirementsStep({
  draft,
  onPatch,
  onAddFinancialRequirement,
  onUpdateFinancialRequirement,
  onDeleteFinancialRequirement,
  regulatoryLicensePanel
}: {
  draft: CreateTenderDraft;
  onPatch: (patch: Partial<CreateTenderDraft>) => void;
  onAddFinancialRequirement: () => void;
  onUpdateFinancialRequirement: (rowId: string, patch: Partial<CreateTenderFinancialRequirementRow>) => void;
  onDeleteFinancialRequirement: (rowId: string) => void;
  regulatoryLicensePanel: ReactNode;
}) {
  const services = draft.serviceRequirements ?? createEmptyServiceRequirements();
  const showDeliverables = ['IT Support', 'Training', 'Other'].includes(services.serviceCategory);
  const showItSupport = ['IT Support', 'Internet services'].includes(services.serviceCategory);
  const showMaintenance = ['Vehicle maintenance', 'Generator maintenance', 'Maintenance'].includes(services.serviceCategory);
  const showEquipment = ['Security', 'Cleaning', 'Vehicle maintenance', 'Generator maintenance', 'Maintenance', 'Catering', 'Transport / logistics'].includes(services.serviceCategory);
  const showRiskInsurance = ['Security', 'Vehicle maintenance', 'Generator maintenance', 'Maintenance', 'Transport / logistics'].includes(services.serviceCategory);

  function patchServices(patch: Partial<CreateTenderServiceRequirements>) {
    onPatch({ serviceRequirements: patch as CreateTenderServiceRequirements });
  }

  function updateList(key: keyof Pick<CreateTenderServiceRequirements, 'serviceLocations' | 'serviceDeliverables' | 'serviceMilestones' | 'foodCertifications' | 'insuranceCovers'>, index: number, value: string) {
    patchServices({ [key]: services[key].map((item, itemIndex) => (itemIndex === index ? value : item)) } as Partial<CreateTenderServiceRequirements>);
  }

  function addListItem(key: keyof Pick<CreateTenderServiceRequirements, 'serviceLocations' | 'serviceDeliverables' | 'serviceMilestones' | 'foodCertifications' | 'insuranceCovers'>) {
    patchServices({ [key]: [...services[key], ''] } as Partial<CreateTenderServiceRequirements>);
  }

  function removeListItem(key: keyof Pick<CreateTenderServiceRequirements, 'serviceLocations' | 'serviceDeliverables' | 'serviceMilestones' | 'foodCertifications' | 'insuranceCovers'>, index: number) {
    patchServices({ [key]: services[key].filter((_, itemIndex) => itemIndex !== index) } as Partial<CreateTenderServiceRequirements>);
  }

  function addServiceBoqRow() {
    patchServices({ serviceBoqRows: [...services.serviceBoqRows, { id: createRowId('service-boq'), description: '', unit: 'Unit', quantity: '', rate: '' }] });
  }

  function updateServiceBoqRow(rowId: string, patch: Partial<CreateTenderServiceBoqRow>) {
    patchServices({ serviceBoqRows: services.serviceBoqRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function importServiceBoq(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const importedRows = parseServiceBoqCsv(String(reader.result || ''));
      if (importedRows.length) patchServices({ serviceBoqRows: [...services.serviceBoqRows, ...importedRows] });
    };
    reader.readAsText(file);
  }

  function addPersonnelRow() {
    patchServices({
      personnelRequirementRows: [
        ...services.personnelRequirementRows,
        { id: createRowId('service-personnel'), position: '', minimumEducation: '', minimumYearsExperience: '', cvRequired: true, mandatory: true }
      ]
    });
  }

  function updatePersonnelRow(rowId: string, patch: Partial<CreateTenderServicePersonnelRequirementRow>) {
    patchServices({ personnelRequirementRows: services.personnelRequirementRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addEquipmentRow() {
    patchServices({
      equipmentRequirementRows: [
        ...services.equipmentRequirementRows,
        { id: createRowId('service-equipment'), equipmentName: '', quantity: '', ownershipRequirement: '', technicalSpecification: '', evidenceRequired: [], mandatory: true, evaluationMethod: '', supplierResponseType: '' }
      ]
    });
  }

  function updateEquipmentRow(rowId: string, patch: Partial<CreateTenderServiceEquipmentRequirementRow>) {
    patchServices({ equipmentRequirementRows: services.equipmentRequirementRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function toggleEquipmentEvidence(row: CreateTenderServiceEquipmentRequirementRow, evidence: string) {
    const evidenceRequired = row.evidenceRequired.includes(evidence) ? row.evidenceRequired.filter((item) => item !== evidence) : [...row.evidenceRequired, evidence];
    updateEquipmentRow(row.id, { evidenceRequired });
  }

  function addEsCard() {
    patchServices({ esRequirementCards: [...services.esRequirementCards, { id: createRowId('service-es'), category: '', description: '', evidenceRequired: [], mandatory: true }] });
  }

  function updateEsCard(rowId: string, patch: Partial<CreateTenderServiceEnvironmentalSocialRequirementCard>) {
    patchServices({ esRequirementCards: services.esRequirementCards.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function toggleEsEvidence(row: CreateTenderServiceEnvironmentalSocialRequirementCard, evidence: string) {
    const evidenceRequired = row.evidenceRequired.includes(evidence) ? row.evidenceRequired.filter((item) => item !== evidence) : [...row.evidenceRequired, evidence];
    updateEsCard(row.id, { evidenceRequired });
  }

  function addSupportingDocumentRow() {
    patchServices({ supportingDocumentRows: [...services.supportingDocumentRows, { id: createRowId('service-document'), documentName: '', mandatory: true }] });
  }

  function updateSupportingDocumentRow(rowId: string, patch: Partial<CreateTenderServiceSupportingDocumentRow>) {
    patchServices({ supportingDocumentRows: services.supportingDocumentRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function renderList(key: 'serviceLocations' | 'serviceDeliverables' | 'serviceMilestones' | 'foodCertifications' | 'insuranceCovers', label: string, addLabel: string, emptyText: string) {
    const values = services[key];
    return (
      <div className="requirement-control requirement-control-wide">
        <span className="form-label">{label}</span>
        <div className="requirement-list">
          {values.length ? (
            values.map((value, index) => (
              <div className="requirement-list-row" key={`${key}-${index}`}>
                <input className="form-input requirement-list-input" aria-label={`${label} ${index + 1}`} value={value} onChange={(event) => updateList(key, index, event.target.value)} />
                <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove ${label} ${index + 1}`} onClick={() => removeListItem(key, index)}>
                  x
                </button>
              </div>
            ))
          ) : (
            <div className="scope-empty">{emptyText}</div>
          )}
        </div>
        <div className="requirement-table-actions">
          <button className="btn btn-secondary scope-add" type="button" onClick={() => addListItem(key)}>
            {addLabel}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="wizard-step-surface requirements-step-surface services-requirements-step">
      <div className="requirement-type-header">
        <div>
          <span className="section-kicker">Tender requirements</span>
          <h3>Service Tender Requirements</h3>
        </div>
        <span className="badge badge-info">Service Commercial Schedule</span>
      </div>

      <div className="requirement-section-grid">
        <article className="requirement-block" id="requirement-section-serviceDefinition">
          <div>
            <h4>Service Definition</h4>
            <span className="form-hint">Core mandatory details for the service being procured.</span>
          </div>
          <div className="requirement-control-grid">
            <label className="requirement-control">
              <span className="form-label">Service category</span>
              <select className="form-input" aria-label="Service category" value={services.serviceCategory} onChange={(event) => patchServices({ serviceCategory: event.target.value })}>
                <option value="">Select service category</option>
                {serviceCategoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label className="requirement-control">
              <span className="form-label">Duration</span>
              <input className="form-input" aria-label="Duration" value={services.duration} onChange={(event) => patchServices({ duration: event.target.value })} />
            </label>
            <label className="requirement-control requirement-control-wide">
              <span className="form-label">Scope of services</span>
              <textarea className="form-input" aria-label="Scope of services" value={services.scopeOfServices} onChange={(event) => patchServices({ scopeOfServices: event.target.value })} />
            </label>
            {renderList('serviceLocations', 'Service locations', 'Add Service Location', 'No service locations added yet.')}
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-serviceBoq">
          <div>
            <h4>Bill of Quantities (BOQ)</h4>
            <span className="form-hint">Line-item BOQ schedule for the service items suppliers should price.</span>
          </div>
          <div className="requirement-table-wrap">
            <table className="requirement-table">
              <thead>
                <tr>
                  <th>No.</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Quantity</th>
                  <th>Rate</th>
                  <th>Total amount</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {services.serviceBoqRows.length ? (
                  services.serviceBoqRows.map((row, index) => (
                    <tr key={row.id}>
                      <td>{index + 1}</td>
                      <td><input className="form-input" aria-label={`Service BOQ description ${index + 1}`} value={row.description} onChange={(event) => updateServiceBoqRow(row.id, { description: event.target.value })} /></td>
                      <td>
                        <select className="form-input" aria-label={`Service BOQ unit ${index + 1}`} value={row.unit} onChange={(event) => updateServiceBoqRow(row.id, { unit: event.target.value })}>
                          <option value=""></option>
                          {serviceUnitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                        </select>
                      </td>
                      <td><input className="form-input" aria-label={`Service BOQ quantity ${index + 1}`} inputMode="decimal" value={row.quantity} onChange={(event) => updateServiceBoqRow(row.id, { quantity: event.target.value })} /></td>
                      <td><input className="form-input" aria-label={`Service BOQ rate ${index + 1}`} inputMode="decimal" value={row.rate} onChange={(event) => updateServiceBoqRow(row.id, { rate: event.target.value })} /></td>
                      <td><span className="requirement-auto-value">{getServiceBoqTotal(row)}</span></td>
                      <td className="requirement-table-action-cell">
                        <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove service BOQ line ${index + 1}`} onClick={() => patchServices({ serviceBoqRows: services.serviceBoqRows.filter((item) => item.id !== row.id) })}>x</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={7}><div className="scope-empty">No BOQ lines added yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="requirement-table-actions">
            <label className="btn btn-secondary scope-add goods-import-control">
              Import Excel
              <input type="file" accept=".csv,.txt" aria-label="Import service BOQ" onChange={(event) => importServiceBoq(event.target.files?.[0])} />
            </label>
            <button className="btn btn-secondary scope-add" type="button" onClick={addServiceBoqRow}>Add BOQ Line</button>
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-financialCapacity">
          <div className="scope-list-heading">
            <div>
              <h4>Financial Capacity Requirements</h4>
              <span className="form-hint">Structured financial rules used to verify whether bidders can sustain the contract.</span>
            </div>
            <button className="btn btn-secondary scope-add" type="button" onClick={onAddFinancialRequirement}>Add Financial Requirement</button>
          </div>
          <div className="requirement-table-wrap">
            <table className="requirement-table">
              <thead>
                <tr>
                  <th>Requirement type</th>
                  <th>Minimum value</th>
                  <th>Period</th>
                  <th>Evidence required</th>
                  <th>Mandatory</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {draft.financialRequirements.length ? (
                  draft.financialRequirements.map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        <select className="form-input" aria-label={`Requirement type ${index + 1}`} value={row.requirementType} onChange={(event) => onUpdateFinancialRequirement(row.id, { requirementType: event.target.value })}>
                          <option value="">Select</option>
                          {financialRequirementTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </td>
                      <td><input className="form-input" aria-label={`Minimum value ${index + 1}`} inputMode="decimal" value={row.minimumValue} onChange={(event) => onUpdateFinancialRequirement(row.id, { minimumValue: event.target.value })} /></td>
                      <td>
                        <select className="form-input" aria-label={`Period ${index + 1}`} value={row.period} onChange={(event) => onUpdateFinancialRequirement(row.id, { period: event.target.value })}>
                          <option value="">Select</option>
                          {financialPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-input" aria-label={`Evidence required ${index + 1}`} value={row.evidenceRequired} onChange={(event) => onUpdateFinancialRequirement(row.id, { evidenceRequired: event.target.value })}>
                          <option value="">Select</option>
                          {financialEvidence.map((evidence) => <option key={evidence} value={evidence}>{evidence}</option>)}
                        </select>
                      </td>
                      <td><input type="checkbox" aria-label={`Mandatory financial requirement ${index + 1}`} checked={row.mandatory} onChange={(event) => onUpdateFinancialRequirement(row.id, { mandatory: event.target.checked })} /></td>
                      <td className="requirement-table-action-cell"><button className="boq-row-action icon-delete-btn" type="button" aria-label={`Delete financial requirement ${index + 1}`} onClick={() => onDeleteFinancialRequirement(row.id)}>x</button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6}><div className="scope-empty">No financial requirements added yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-staffingRequirements">
          <div className="scope-list-heading">
            <div>
              <h4>Personnel Requirements</h4>
              <span className="form-hint">Position-based personnel requirements for labor-based and professional services.</span>
            </div>
            <button className="btn btn-secondary scope-add" type="button" onClick={addPersonnelRow}>Add Personnel Requirement</button>
          </div>
          <div className="requirement-table-wrap">
            <table className="requirement-table">
              <thead>
                <tr>
                  <th>Role / position</th>
                  <th>Minimum education</th>
                  <th>Experience(Years)</th>
                  <th>CV required</th>
                  <th>Mandatory</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {services.personnelRequirementRows.length ? (
                  services.personnelRequirementRows.map((row, index) => (
                    <tr key={row.id}>
                      <td><input className="form-input" aria-label={`Personnel position ${index + 1}`} value={row.position} onChange={(event) => updatePersonnelRow(row.id, { position: event.target.value })} /></td>
                      <td>
                        <select className="form-input" aria-label={`Minimum education ${index + 1}`} value={row.minimumEducation} onChange={(event) => updatePersonnelRow(row.id, { minimumEducation: event.target.value })}>
                          <option value=""></option>
                          {serviceEducationLevels.map((level) => <option key={level} value={level}>{level}</option>)}
                        </select>
                      </td>
                      <td><input className="form-input" aria-label={`Personnel experience ${index + 1}`} inputMode="numeric" value={row.minimumYearsExperience} onChange={(event) => updatePersonnelRow(row.id, { minimumYearsExperience: event.target.value })} /></td>
                      <td><input type="checkbox" aria-label={`CV required ${index + 1}`} checked={row.cvRequired} onChange={(event) => updatePersonnelRow(row.id, { cvRequired: event.target.checked })} /></td>
                      <td><input type="checkbox" aria-label={`Personnel mandatory ${index + 1}`} checked={row.mandatory} onChange={(event) => updatePersonnelRow(row.id, { mandatory: event.target.checked })} /></td>
                      <td className="requirement-table-action-cell"><button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove personnel requirement ${index + 1}`} onClick={() => patchServices({ personnelRequirementRows: services.personnelRequirementRows.filter((item) => item.id !== row.id) })}>x</button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={6}><div className="scope-empty">No personnel requirements added yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {services.serviceCategory === 'Security' ? (
          <article className="requirement-block" id="requirement-section-securityRequirements">
            <div>
              <h4>Security Service Requirements</h4>
              <span className="form-hint">Shown for security tenders: guards, shifts, patrols, weapons, and control room requirements.</span>
            </div>
            <div className="requirement-control-grid">
              <label className="requirement-control"><span className="form-label">Number of guards</span><input className="form-input" aria-label="Number of guards" inputMode="numeric" value={services.numberOfGuards} onChange={(event) => patchServices({ numberOfGuards: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Shift schedule</span><input className="form-input" aria-label="Shift schedule" value={services.shiftSchedule} onChange={(event) => patchServices({ shiftSchedule: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Patrol frequency</span><select className="form-input" aria-label="Patrol frequency" value={services.patrolFrequency} onChange={(event) => patchServices({ patrolFrequency: event.target.value })}><option value=""></option>{serviceFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="requirement-control"><span className="form-label">Weapons requirement</span><textarea className="form-input" aria-label="Weapons requirement" value={services.weaponRequirement} onChange={(event) => patchServices({ weaponRequirement: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Control room requirement</span><textarea className="form-input" aria-label="Control room requirement" value={services.controlRoomRequirement} onChange={(event) => patchServices({ controlRoomRequirement: event.target.value })} /></label>
            </div>
          </article>
        ) : null}

        {services.serviceCategory === 'Cleaning' ? (
          <article className="requirement-block" id="requirement-section-cleaningRequirements">
            <div>
              <h4>Cleaning Service Requirements</h4>
              <span className="form-hint">Shown for cleaning tenders: schedules, materials, areas, and waste disposal.</span>
            </div>
            <div className="requirement-control-grid">
              <label className="requirement-control"><span className="form-label">Cleaning areas</span><textarea className="form-input" aria-label="Cleaning areas" value={services.cleaningAreas} onChange={(event) => patchServices({ cleaningAreas: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Cleaning frequency</span><select className="form-input" aria-label="Cleaning frequency" value={services.cleaningFrequency} onChange={(event) => patchServices({ cleaningFrequency: event.target.value })}><option value=""></option>{serviceFrequencyOptions.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
              <label className="requirement-control"><span className="form-label">Cleaning materials</span><textarea className="form-input" aria-label="Cleaning materials" value={services.cleaningMaterials} onChange={(event) => patchServices({ cleaningMaterials: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Waste disposal requirements</span><textarea className="form-input" aria-label="Waste disposal requirements" value={services.wasteDisposalRequirements} onChange={(event) => patchServices({ wasteDisposalRequirements: event.target.value })} /></label>
            </div>
          </article>
        ) : null}

        {showDeliverables ? (
          <article className="requirement-block" id="requirement-section-deliverablesSection">
            <div>
              <h4>Deliverables and Reports</h4>
              <span className="form-hint">Shown for IT implementation, research, audits, and training services.</span>
            </div>
            <div className="requirement-control-grid">
              {renderList('serviceDeliverables', 'Deliverables', 'Add Deliverable', 'No deliverables added yet.')}
              {renderList('serviceMilestones', 'Milestones', 'Add Milestone', 'No milestones added yet.')}
              <label className="requirement-control requirement-control-wide"><span className="form-label">Reporting requirements</span><textarea className="form-input" aria-label="Reporting requirements" value={services.reportingRequirements} onChange={(event) => patchServices({ reportingRequirements: event.target.value })} /></label>
            </div>
          </article>
        ) : null}

        {showItSupport ? (
          <article className="requirement-block" id="requirement-section-itSupportRequirements">
            <div>
              <h4>IT Support / Internet Requirements</h4>
              <span className="form-hint">Shown for IT support and internet services: SLA, uptime, and response requirements.</span>
            </div>
            <div className="requirement-control-grid">
              <label className="requirement-control"><span className="form-label">SLA requirement</span><textarea className="form-input" aria-label="SLA requirement" value={services.slaRequirement} onChange={(event) => patchServices({ slaRequirement: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Uptime requirement</span><input className="form-input" aria-label="Uptime requirement" value={services.uptimeRequirement} onChange={(event) => patchServices({ uptimeRequirement: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Response time</span><input className="form-input" aria-label="Response time" value={services.responseTime} onChange={(event) => patchServices({ responseTime: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Support hours</span><input className="form-input" aria-label="Support hours" value={services.supportHours} onChange={(event) => patchServices({ supportHours: event.target.value })} /></label>
            </div>
          </article>
        ) : null}

        {showMaintenance ? (
          <article className="requirement-block" id="requirement-section-maintenanceRequirements">
            <div>
              <h4>Maintenance Requirements</h4>
              <span className="form-hint">Shown for maintenance tenders: tools, spare parts, technicians, and service schedule.</span>
            </div>
            <div className="requirement-control-grid">
              <label className="requirement-control"><span className="form-label">Maintenance schedule</span><textarea className="form-input" aria-label="Maintenance schedule" value={services.maintenanceSchedule} onChange={(event) => patchServices({ maintenanceSchedule: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Spare parts requirement</span><textarea className="form-input" aria-label="Spare parts requirement" value={services.sparePartsRequirement} onChange={(event) => patchServices({ sparePartsRequirement: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Technician requirements</span><textarea className="form-input" aria-label="Technician requirements" value={services.technicianRequirements} onChange={(event) => patchServices({ technicianRequirements: event.target.value })} /></label>
            </div>
          </article>
        ) : null}

        {services.serviceCategory === 'Catering' ? (
          <article className="requirement-block" id="requirement-section-cateringRequirements">
            <div>
              <h4>Catering Requirements</h4>
              <span className="form-hint">Shown for catering tenders: menus, hygiene, and food certifications.</span>
            </div>
            <div className="requirement-control-grid">
              <label className="requirement-control"><span className="form-label">Menu requirements</span><textarea className="form-input" aria-label="Menu requirements" value={services.menuRequirements} onChange={(event) => patchServices({ menuRequirements: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Hygiene requirements</span><textarea className="form-input" aria-label="Hygiene requirements" value={services.hygieneRequirements} onChange={(event) => patchServices({ hygieneRequirements: event.target.value })} /></label>
              {renderList('foodCertifications', 'Food certifications', 'Add Certification', 'No food certifications added yet.')}
            </div>
          </article>
        ) : null}

        {services.serviceCategory === 'Transport / logistics' ? (
          <article className="requirement-block" id="requirement-section-transportRequirements">
            <div>
              <h4>Transport / Logistics Requirements</h4>
              <span className="form-hint">Shown for transport and logistics tenders: fleet, insurance, and driver licenses.</span>
            </div>
            <div className="requirement-control-grid">
              <label className="requirement-control"><span className="form-label">Fleet requirements</span><textarea className="form-input" aria-label="Fleet requirements" value={services.fleetRequirements} onChange={(event) => patchServices({ fleetRequirements: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Driver license requirements</span><textarea className="form-input" aria-label="Driver license requirements" value={services.driverLicenseRequirements} onChange={(event) => patchServices({ driverLicenseRequirements: event.target.value })} /></label>
              <label className="requirement-control"><span className="form-label">Route / coverage requirements</span><textarea className="form-input" aria-label="Route / coverage requirements" value={services.routeCoverage} onChange={(event) => patchServices({ routeCoverage: event.target.value })} /></label>
            </div>
          </article>
        ) : null}

        {showEquipment ? (
          <article className="requirement-block" id="requirement-section-equipmentRequirements">
            <div className="scope-list-heading">
              <div>
                <h4>Equipment Requirements</h4>
                <span className="form-hint">Shown only for service categories where equipment is normally needed.</span>
              </div>
              <button className="btn btn-secondary scope-add" type="button" onClick={addEquipmentRow}>Add Equipment</button>
            </div>
            <div className="requirement-card-list">
              {services.equipmentRequirementRows.length ? (
                services.equipmentRequirementRows.map((row, index) => (
                  <article className="requirement-repeater-card" key={row.id}>
                    <div className="requirement-card-heading">
                      <strong>{row.equipmentName || `Equipment ${index + 1}`}</strong>
                      <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove equipment ${index + 1}`} onClick={() => patchServices({ equipmentRequirementRows: services.equipmentRequirementRows.filter((item) => item.id !== row.id) })}>x</button>
                    </div>
                    <div className="requirement-card-grid">
                      <label className="requirement-card-field"><span className="form-label">Equipment name</span><input className="form-input" aria-label={`Equipment name ${index + 1}`} value={row.equipmentName} onChange={(event) => updateEquipmentRow(row.id, { equipmentName: event.target.value })} /></label>
                      <label className="requirement-card-field"><span className="form-label">Minimum qty</span><input className="form-input" aria-label={`Equipment quantity ${index + 1}`} inputMode="numeric" value={row.quantity} onChange={(event) => updateEquipmentRow(row.id, { quantity: event.target.value })} /></label>
                      <label className="requirement-card-field"><span className="form-label">Ownership type</span><select className="form-input" aria-label={`Ownership type ${index + 1}`} value={row.ownershipRequirement} onChange={(event) => updateEquipmentRow(row.id, { ownershipRequirement: event.target.value })}><option value=""></option>{serviceOwnershipTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                      <label className="requirement-card-field"><span className="form-label">Evaluation method</span><select className="form-input" aria-label={`Equipment evaluation method ${index + 1}`} value={row.evaluationMethod} onChange={(event) => updateEquipmentRow(row.id, { evaluationMethod: event.target.value })}><option value=""></option>{serviceEvaluationMethods.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                      <label className="requirement-card-field"><span className="form-label">Response type</span><select className="form-input" aria-label={`Equipment response type ${index + 1}`} value={row.supplierResponseType} onChange={(event) => updateEquipmentRow(row.id, { supplierResponseType: event.target.value })}><option value=""></option>{serviceResponseTypes.map((option) => <option key={option} value={option}>{option}</option>)}</select></label>
                      <label className="requirement-card-field"><span className="form-label">Technical specification</span><textarea className="form-input" aria-label={`Equipment technical specification ${index + 1}`} value={row.technicalSpecification} onChange={(event) => updateEquipmentRow(row.id, { technicalSpecification: event.target.value })} /></label>
                    </div>
                    <div className="requirement-multi-select" aria-label={`Equipment evidence required ${index + 1}`}>
                      {serviceEquipmentEvidence.map((evidence) => (
                        <label key={evidence}><input type="checkbox" checked={row.evidenceRequired.includes(evidence)} onChange={() => toggleEquipmentEvidence(row, evidence)} /> {evidence}</label>
                      ))}
                    </div>
                    <label><input type="checkbox" checked={row.mandatory} onChange={(event) => updateEquipmentRow(row.id, { mandatory: event.target.checked })} /> Mandatory</label>
                  </article>
                ))
              ) : (
                <div className="scope-empty">No equipment requirements added yet.</div>
              )}
            </div>
          </article>
        ) : null}

        <article className="requirement-block" id="requirement-section-environmentalSocialRequirements">
          <div className="scope-list-heading">
            <div>
              <h4>Environmental and Social Requirements</h4>
              <span className="form-hint">Categorized compliance requirements for worker safety, SEA/SH, environment, and labor compliance.</span>
            </div>
            <button className="btn btn-secondary scope-add" type="button" onClick={addEsCard}>Add ES Requirement</button>
          </div>
          <div className="requirement-card-list">
            {services.esRequirementCards.length ? (
              services.esRequirementCards.map((row, index) => (
                <article className="requirement-repeater-card" key={row.id}>
                  <div className="requirement-card-heading">
                    <strong>{row.category ? `ES requirement for ${row.category}` : `ES requirement ${index + 1}`}</strong>
                    <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove ES requirement ${index + 1}`} onClick={() => patchServices({ esRequirementCards: services.esRequirementCards.filter((item) => item.id !== row.id) })}>x</button>
                  </div>
                  <div className="requirement-card-grid">
                    <label className="requirement-card-field"><span className="form-label">Category</span><select className="form-input" aria-label={`ES category ${index + 1}`} value={row.category} onChange={(event) => updateEsCard(row.id, { category: event.target.value })}><option value=""></option>{serviceEsCategories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label>
                    <label className="requirement-card-field"><span className="form-label">Description</span><textarea className="form-input" aria-label={`ES description ${index + 1}`} value={row.description} onChange={(event) => updateEsCard(row.id, { description: event.target.value })} /></label>
                  </div>
                  <div className="requirement-multi-select" aria-label={`ES evidence required ${index + 1}`}>
                    {serviceEsEvidence.map((evidence) => (
                      <label key={evidence}><input type="checkbox" checked={row.evidenceRequired.includes(evidence)} onChange={() => toggleEsEvidence(row, evidence)} /> {evidence}</label>
                    ))}
                  </div>
                  <label><input type="checkbox" checked={row.mandatory} onChange={(event) => updateEsCard(row.id, { mandatory: event.target.checked })} /> Mandatory</label>
                </article>
              ))
            ) : (
              <div className="scope-empty">No environmental or social requirements added yet.</div>
            )}
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-supportingDocuments">
          <div className="scope-list-heading">
            <div>
              <h4>Supporting Documents</h4>
              <span className="form-hint">Define submission documents suppliers must upload or respond to.</span>
            </div>
            <button className="btn btn-secondary scope-add" type="button" onClick={addSupportingDocumentRow}>Add Required Document</button>
          </div>
          <div className="requirement-table-wrap">
            <table className="requirement-table">
              <thead>
                <tr>
                  <th>Document name</th>
                  <th>Mandatory</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {services.supportingDocumentRows.length ? (
                  services.supportingDocumentRows.map((row, index) => (
                    <tr key={row.id}>
                      <td><input className="form-input" aria-label={`Supporting document ${index + 1}`} value={row.documentName} onChange={(event) => updateSupportingDocumentRow(row.id, { documentName: event.target.value })} /></td>
                      <td><input type="checkbox" aria-label={`Supporting document mandatory ${index + 1}`} checked={row.mandatory} onChange={(event) => updateSupportingDocumentRow(row.id, { mandatory: event.target.checked })} /></td>
                      <td className="requirement-table-action-cell"><button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove supporting document ${index + 1}`} onClick={() => patchServices({ supportingDocumentRows: services.supportingDocumentRows.filter((item) => item.id !== row.id) })}>x</button></td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={3}><div className="scope-empty">No supporting documents added yet.</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </article>

        {showRiskInsurance ? (
          <>
            <article className="requirement-block" id="requirement-section-insuranceRequirements">
              <div>
                <h4>Insurance Requirements</h4>
                <span className="form-hint">Shown for higher-risk services where insurance evidence is important.</span>
              </div>
              <div className="requirement-control-grid">
                {renderList('insuranceCovers', 'Required insurance covers', 'Add Insurance Cover', 'No insurance covers added yet.')}
                <label className="requirement-control requirement-control-wide"><span className="form-label">Insurance notes</span><textarea className="form-input" aria-label="Insurance notes" value={services.insuranceNotes} onChange={(event) => patchServices({ insuranceNotes: event.target.value })} /></label>
              </div>
            </article>
            <article className="requirement-block" id="requirement-section-riskSafetyRequirements">
              <div>
                <h4>Risk and Safety Requirements</h4>
                <span className="form-hint">Shown for technical, field, maintenance, transport, and security services.</span>
              </div>
              <div className="requirement-control-grid">
                <label className="requirement-control"><span className="form-label">Risk assessment requirement</span><textarea className="form-input" aria-label="Risk assessment requirement" value={services.riskAssessmentRequirement} onChange={(event) => patchServices({ riskAssessmentRequirement: event.target.value })} /></label>
                <label className="requirement-control"><span className="form-label">Safety plan requirement</span><textarea className="form-input" aria-label="Safety plan requirement" value={services.safetyPlanRequirement} onChange={(event) => patchServices({ safetyPlanRequirement: event.target.value })} /></label>
                <label className="requirement-control"><span className="form-label">PPE requirements</span><textarea className="form-input" aria-label="PPE requirements" value={services.ppeRequirements} onChange={(event) => patchServices({ ppeRequirements: event.target.value })} /></label>
              </div>
            </article>
          </>
        ) : null}
        {regulatoryLicensePanel}
      </div>
    </div>
  );
}

function WorksRequirementsStep({
  draft,
  onPatch,
  onAddFinancialRequirement,
  onUpdateFinancialRequirement,
  onDeleteFinancialRequirement,
  regulatoryLicensePanel
}: {
  draft: CreateTenderDraft;
  onPatch: (patch: Partial<CreateTenderDraft>) => void;
  onAddFinancialRequirement: () => void;
  onUpdateFinancialRequirement: (rowId: string, patch: Partial<CreateTenderFinancialRequirementRow>) => void;
  onDeleteFinancialRequirement: (rowId: string) => void;
  regulatoryLicensePanel: ReactNode;
}) {
  const works = draft.worksRequirements ?? createEmptyWorksRequirements();

  function patchWorks(patch: Partial<CreateTenderWorksRequirements>) {
    onPatch({ worksRequirements: patch as CreateTenderWorksRequirements });
  }

  function updateActivity(index: number, value: string) {
    patchWorks({ mainConstructionActivities: works.mainConstructionActivities.map((item, itemIndex) => (itemIndex === index ? value : item)) });
  }

  function addSpecificationDocument() {
    patchWorks({
      technicalSpecificationDocuments: [
        ...works.technicalSpecificationDocuments,
        { id: createRowId('works-spec-document'), documentTitle: '', customDocumentTitle: '', uploadName: '' }
      ]
    });
  }

  function updateSpecificationDocument(rowId: string, patch: Partial<CreateTenderWorksSpecificationDocumentRow>) {
    patchWorks({
      technicalSpecificationDocuments: works.technicalSpecificationDocuments.map((row) => (row.id === rowId ? { ...row, ...patch } : row))
    });
  }

  function addDrawing() {
    patchWorks({
      drawingDesignRows: [
        ...works.drawingDesignRows,
        { id: createRowId('works-drawing'), documentType: '', otherDocumentName: '', uploadName: '' }
      ]
    });
  }

  function updateDrawing(rowId: string, patch: Partial<CreateTenderWorksDrawingRow>) {
    patchWorks({ drawingDesignRows: works.drawingDesignRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addLumpSumPricingRow() {
    patchWorks({
      lumpSumPricingRows: [
        ...works.lumpSumPricingRows,
        { id: createRowId('works-lump-sum'), section: '', description: '', amount: '' }
      ]
    });
  }

  function updateLumpSumPricingRow(rowId: string, patch: Partial<CreateTenderWorksLumpSumPricingRow>) {
    patchWorks({ lumpSumPricingRows: works.lumpSumPricingRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function addWorksBoqRow() {
    patchWorks({
      boqRows: [
        ...works.boqRows,
        { id: createRowId('works-boq'), description: '', unit: 'Unit', quantity: '', rate: '' }
      ]
    });
  }

  function updateWorksBoqRow(rowId: string, patch: Partial<CreateTenderWorksBoqRow>) {
    patchWorks({ boqRows: works.boqRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  function importWorksBoq(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const importedRows = parseWorksBoqCsv(String(reader.result || ''));
      if (!importedRows.length) return;
      patchWorks({ boqRows: [...works.boqRows, ...importedRows] });
    };
    reader.readAsText(file);
  }

  function addWorksMilestone() {
    patchWorks({
      worksMilestoneRows: [
        ...works.worksMilestoneRows,
        { id: createRowId('works-milestone'), milestone: '', targetDate: '' }
      ]
    });
  }

  function updateWorksMilestone(rowId: string, patch: Partial<CreateTenderWorksMilestoneRow>) {
    patchWorks({ worksMilestoneRows: works.worksMilestoneRows.map((row) => (row.id === rowId ? { ...row, ...patch } : row)) });
  }

  return (
    <div className="wizard-step-surface requirements-step-surface works-requirements-step">
      <div className="requirement-type-header">
        <div>
          <span className="section-kicker">Tender requirements</span>
          <h3>Works Tender Requirements</h3>
        </div>
        <span className="badge badge-info">Bill of Quantities</span>
      </div>

      <div className="requirement-section-grid">
        <article className="requirement-block" id="requirement-section-generalInformation">
          <div>
            <h4>1. Project Overview</h4>
            <span className="form-hint">Capture the purpose, buyer context, objective, and location of the works.</span>
          </div>
          <div className="requirement-control-grid">
            <label className="requirement-control">
              <span className="form-label">Project title</span>
              <input className="form-input" value={works.projectName} onChange={(event) => patchWorks({ projectName: event.target.value })} aria-label="Project title" />
            </label>
            <label className="requirement-control">
              <span className="form-label">Procuring entity</span>
              <input className="form-input" value={works.procuringEntity} onChange={(event) => patchWorks({ procuringEntity: event.target.value })} aria-label="Procuring entity" />
            </label>
            <label className="requirement-control">
              <span className="form-label">Project location</span>
              <input className="form-input" value={works.location} onChange={(event) => patchWorks({ location: event.target.value })} aria-label="Project location" />
            </label>
            <label className="requirement-control">
              <span className="form-label">Contract type</span>
              <select className="form-input" value={works.contractType} onChange={(event) => patchWorks({ contractType: event.target.value })} aria-label="Contract type">
                <option value=""></option>
                {worksContractTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              {worksContractTypeDescriptions[works.contractType] ? <span className="form-hint">{worksContractTypeDescriptions[works.contractType]}</span> : null}
            </label>
            {works.contractType === 'Other' ? (
              <label className="requirement-control">
                <span className="form-label">Custom contract type</span>
                <input className="form-input" value={works.customContractType} onChange={(event) => patchWorks({ customContractType: event.target.value })} aria-label="Custom contract type" />
              </label>
            ) : null}
            <label className="requirement-control">
              <span className="form-label">Completion period</span>
              <input className="form-input" value={works.completionPeriod} onChange={(event) => patchWorks({ completionPeriod: event.target.value })} aria-label="Completion period" />
            </label>
          </div>
        </article>

        <article className="requirement-block scope-description-block" id="requirement-section-scopeDescription">
          <div className="scope-description-heading">
            <h4>2. Scope Description</h4>
            <p>Summarize the works, major construction activities, and any project notes.</p>
          </div>
          <div className="scope-field-group">
            <span className="form-label">Scope Summary</span>
            <span className="form-hint">Summarize the overall scope of the project including what the contractor is expected to do.</span>
            <textarea
              className="form-input"
              rows={6}
              maxLength={1000}
              placeholder="Example: Construction of a 3-floor academic building including structural works, electrical installation, plumbing, roofing, doors and windows, finishing works and external works."
              value={works.scopeSummary}
              onChange={(event) => patchWorks({ scopeSummary: event.target.value })}
              aria-label="Scope Summary"
            />
            <span className="requirement-character-counter">{works.scopeSummary.length}/1000</span>
          </div>
          <div className="scope-field-group scope-activity-group">
            <div className="scope-activity-heading">
              <div>
                <span className="form-label">Main Activities</span>
                <span className="form-hint">List the major construction activities to be carried out.</span>
              </div>
              <button className="btn btn-secondary scope-add scope-activity-add" type="button" onClick={() => patchWorks({ mainConstructionActivities: [...works.mainConstructionActivities, ''] })}>
                + Add Activity
              </button>
            </div>
            <div className="scope-activity-list">
              {works.mainConstructionActivities.length ? (
                works.mainConstructionActivities.map((activity, index) => (
                  <div className="scope-activity-row" key={`works-activity-${index}`}>
                    <span className="scope-activity-handle" aria-hidden="true">::</span>
                    <input
                      className="scope-activity-input"
                      value={activity}
                      placeholder={['Example: Site preparation', 'Example: Excavation and foundation works', 'Example: Structural works', 'Example: Roofing, electrical, plumbing, or finishing works'][index % 4]}
                      onChange={(event) => updateActivity(index, event.target.value)}
                      aria-label={`Main Activities item ${index + 1}`}
                    />
                    <button
                      className="boq-row-action icon-delete-btn scope-activity-delete"
                      type="button"
                      aria-label={`Remove Main Activities ${index + 1}`}
                      onClick={() => patchWorks({ mainConstructionActivities: works.mainConstructionActivities.filter((_, itemIndex) => itemIndex !== index) })}
                    >
                      x
                    </button>
                  </div>
                ))
              ) : (
                <div className="scope-empty">Add the key works activities expected, such as site preparation, foundation works, structural works, roofing, electrical installation, plumbing, finishing, or external works.</div>
              )}
            </div>
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-technicalSpecifications">
          <div>
            <h4>3. Technical Specifications</h4>
            <span className="form-hint">Detailed technical requirements and mandatory specification documents.</span>
          </div>
          <div className="requirement-control requirement-control-wide">
            <span className="form-label">Technical specification documents</span>
            <div className="requirement-table-wrap">
              <table className="requirement-table">
                <thead>
                  <tr>
                    <th>Document title</th>
                    <th>Upload document</th>
                    <th aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {works.technicalSpecificationDocuments.length ? (
                    works.technicalSpecificationDocuments.map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <select className="form-input" value={row.documentTitle} onChange={(event) => updateSpecificationDocument(row.id, { documentTitle: event.target.value })} aria-label={`Document title ${index + 1}`}>
                            <option value=""></option>
                            {worksTechnicalSpecificationTitles.map((title) => (
                              <option key={title} value={title}>{title}</option>
                            ))}
                          </select>
                          {row.documentTitle === 'Others' ? (
                            <input className="form-input" value={row.customDocumentTitle} onChange={(event) => updateSpecificationDocument(row.id, { customDocumentTitle: event.target.value })} aria-label={`Custom specification document title ${index + 1}`} placeholder="Write document title" />
                          ) : null}
                        </td>
                        <td>
                          <label className="btn btn-secondary scope-add goods-import-control">
                            Upload document
                            <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx" aria-label={`Upload document ${index + 1}`} onChange={(event) => updateSpecificationDocument(row.id, { uploadName: event.target.files?.[0]?.name ?? '' })} />
                          </label>
                          {row.uploadName ? <span className="form-hint">{row.uploadName}</span> : null}
                        </td>
                        <td className="requirement-table-action-cell">
                          <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove specification document ${index + 1}`} onClick={() => patchWorks({ technicalSpecificationDocuments: works.technicalSpecificationDocuments.filter((item) => item.id !== row.id) })}>
                            x
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}><div className="scope-empty">No specification documents added yet.</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="requirement-table-actions">
              <button className="btn btn-secondary scope-add" type="button" onClick={addSpecificationDocument}>Add Specification Document</button>
            </div>
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-drawingsDesignDocuments">
          <div>
            <h4>4. Drawings and Design Documents</h4>
            <span className="form-hint">Reference drawings, revisions, design consultants, and CAD/PDF uploads.</span>
          </div>
          <div className="requirement-control requirement-control-wide">
            <span className="form-label">Drawings and design documents</span>
            <div className="requirement-table-wrap">
              <table className="requirement-table">
                <thead>
                  <tr>
                    <th>Document type</th>
                    <th>Other document name</th>
                    <th>CAD / PDF upload</th>
                    <th aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {works.drawingDesignRows.length ? (
                    works.drawingDesignRows.map((row, index) => (
                      <tr key={row.id}>
                        <td>
                          <select className="form-input" value={row.documentType} onChange={(event) => updateDrawing(row.id, { documentType: event.target.value })} aria-label={`Document type ${index + 1}`}>
                            <option value=""></option>
                            {worksDocumentTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </td>
                        <td>
                          {row.documentType === 'Other' ? (
                            <input className="form-input" value={row.otherDocumentName} onChange={(event) => updateDrawing(row.id, { otherDocumentName: event.target.value })} aria-label={`Other document name ${index + 1}`} placeholder="Write document name" />
                          ) : (
                            <span className="requirement-auto-value">-</span>
                          )}
                        </td>
                        <td>
                          <label className="btn btn-secondary scope-add goods-import-control">
                            CAD / PDF upload
                            <input type="file" accept=".pdf,.dwg,.dxf,.jpg,.jpeg,.png" aria-label={`CAD / PDF upload ${index + 1}`} onChange={(event) => updateDrawing(row.id, { uploadName: event.target.files?.[0]?.name ?? '' })} />
                          </label>
                          {row.uploadName ? <span className="form-hint">{row.uploadName}</span> : null}
                        </td>
                        <td className="requirement-table-action-cell">
                          <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove drawing ${index + 1}`} onClick={() => patchWorks({ drawingDesignRows: works.drawingDesignRows.filter((item) => item.id !== row.id) })}>
                            x
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4}><div className="scope-empty">No drawings or design documents added yet.</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="requirement-table-actions">
              <button className="btn btn-secondary scope-add" type="button" onClick={addDrawing}>Add Drawing</button>
            </div>
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-boqRequirements">
          <div>
            <h4>5. Bill of Quantities (BoQ) / Pricing Schedule</h4>
            <span className="form-hint">Commercial breakdown of works. Lump Sum uses summary pricing; Unit Price uses detailed measured items.</span>
          </div>
          {works.contractType === 'Lump Sum Contract' ? (
            <div className="requirement-control requirement-control-wide">
              <span className="form-label">Summary pricing schedule</span>
              <div className="requirement-table-wrap">
                <table className="requirement-table">
                  <thead>
                    <tr>
                      <th>Section</th>
                      <th>Description</th>
                      <th aria-label="Actions"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {works.lumpSumPricingRows.length ? (
                      works.lumpSumPricingRows.map((row, index) => (
                        <tr key={row.id}>
                          <td><input className="form-input" value={row.section} onChange={(event) => updateLumpSumPricingRow(row.id, { section: event.target.value })} aria-label={`Section ${index + 1}`} /></td>
                          <td><textarea className="form-input" value={row.description} onChange={(event) => updateLumpSumPricingRow(row.id, { description: event.target.value })} aria-label={`Description ${index + 1}`} /></td>
                          <td className="requirement-table-action-cell">
                            <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove pricing section ${index + 1}`} onClick={() => patchWorks({ lumpSumPricingRows: works.lumpSumPricingRows.filter((item) => item.id !== row.id) })}>x</button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={3}><div className="scope-empty">No summary pricing sections added yet.</div></td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="requirement-table-actions">
                <button className="btn btn-secondary scope-add" type="button" onClick={addLumpSumPricingRow}>Add Pricing Section</button>
              </div>
            </div>
          ) : null}
          <div className="requirement-control requirement-control-wide">
            <span className="form-label">Bill of Quantities table</span>
            <div className="requirement-table-wrap">
              <table className="requirement-table">
                <thead>
                  <tr>
                    <th>No.</th>
                    <th>Description</th>
                    <th>Unit</th>
                    <th>Quantity</th>
                    <th aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {works.boqRows.length ? (
                    works.boqRows.map((row, index) => (
                      <tr key={row.id}>
                        <td><span className="requirement-auto-value">{index + 1}</span></td>
                        <td><input className="form-input" value={row.description} onChange={(event) => updateWorksBoqRow(row.id, { description: event.target.value })} aria-label={`BOQ description ${index + 1}`} /></td>
                        <td>
                          <select className="form-input" value={row.unit} onChange={(event) => updateWorksBoqRow(row.id, { unit: event.target.value })} aria-label={`BOQ unit ${index + 1}`}>
                            <option value=""></option>
                            {goodsUnitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}
                          </select>
                        </td>
                        <td><input className="form-input" inputMode="decimal" value={row.quantity} onChange={(event) => updateWorksBoqRow(row.id, { quantity: event.target.value })} aria-label={`BOQ quantity ${index + 1}`} /></td>
                        <td className="requirement-table-action-cell">
                          <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove BOQ line ${index + 1}`} onClick={() => patchWorks({ boqRows: works.boqRows.filter((item) => item.id !== row.id) })}>x</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5}><div className="scope-empty">No BOQ lines added yet.</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="requirement-table-actions">
              <label className="btn btn-secondary scope-add goods-import-control">
                Import Excel
                <input type="file" accept=".csv,.txt" aria-label="Import works BOQ" onChange={(event) => importWorksBoq(event.target.files?.[0])} />
              </label>
              <button className="btn btn-secondary scope-add" type="button" onClick={downloadWorksBoqTemplate}>Download Excel Template</button>
              <button className="btn btn-secondary scope-add" type="button" onClick={addWorksBoqRow}>Add BOQ Line</button>
            </div>
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-timeScheduleMilestones">
          <div>
            <h4>6. Time Schedule and Milestones</h4>
            <span className="form-hint">Capture expected timelines, milestone triggers, and optional work program uploads.</span>
          </div>
          <div className="requirement-control-grid">
            <label className="requirement-control">
              <span className="form-label">Commencement date</span>
              <input className="form-input" type="date" value={works.commencementDate} onChange={(event) => patchWorks({ commencementDate: event.target.value })} aria-label="Commencement date" />
            </label>
            <label className="requirement-control">
              <span className="form-label">Completion period</span>
              <input className="form-input" value={works.worksCompletionPeriod} onChange={(event) => patchWorks({ worksCompletionPeriod: event.target.value })} aria-label="Works completion period" />
            </label>
          </div>
          <div className="requirement-control requirement-control-wide">
            <span className="form-label">Works milestones</span>
            <div className="requirement-table-wrap">
              <table className="requirement-table">
                <thead>
                  <tr>
                    <th>Milestone</th>
                    <th>Target date</th>
                    <th aria-label="Actions"></th>
                  </tr>
                </thead>
                <tbody>
                  {works.worksMilestoneRows.length ? (
                    works.worksMilestoneRows.map((row, index) => (
                      <tr key={row.id}>
                        <td><input className="form-input" value={row.milestone} onChange={(event) => updateWorksMilestone(row.id, { milestone: event.target.value })} aria-label={`Works milestone ${index + 1}`} /></td>
                        <td><input className="form-input" type="date" value={row.targetDate} onChange={(event) => updateWorksMilestone(row.id, { targetDate: event.target.value })} aria-label={`Target date ${index + 1}`} /></td>
                        <td className="requirement-table-action-cell">
                          <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Remove works milestone ${index + 1}`} onClick={() => patchWorks({ worksMilestoneRows: works.worksMilestoneRows.filter((item) => item.id !== row.id) })}>x</button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3}><div className="scope-empty">No works milestones added yet.</div></td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="requirement-table-actions">
              <button className="btn btn-secondary scope-add" type="button" onClick={addWorksMilestone}>Add Milestone</button>
            </div>
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-siteInformation">
          <div>
            <h4>7. Site Visit</h4>
            <span className="form-hint">Important works-procurement context for access, utilities, infrastructure, and ground conditions.</span>
          </div>
          <div className="requirement-control-grid">
            <div className="requirement-control">
              <span className="form-label">Site visit requirement</span>
              <div className="sample-requirement-choice-row">
                {(['Mandatory', 'Not mandatory'] as const).map((option) => (
                  <label key={option} className={`sample-requirement-choice ${works.siteVisitRequirement === option ? 'is-selected' : ''}`}>
                    <input
                      type="radio"
                      name="siteVisitRequirement"
                      value={option}
                      checked={works.siteVisitRequirement === option}
                      onChange={() => patchWorks(option === 'Mandatory' ? { siteVisitRequirement: option } : { siteVisitRequirement: option, siteSurveyUploadName: '' })}
                    />
                    <span>{option}</span>
                  </label>
                ))}
              </div>
            </div>
            {works.siteVisitRequirement === 'Mandatory' ? (
              <div className="requirement-control">
                <span className="form-label">Site survey</span>
                <label className="btn btn-secondary scope-add goods-import-control">
                  Upload Site survey
                  <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.dwg,.dxf" aria-label="Upload Site survey" onChange={(event) => patchWorks({ siteSurveyUploadName: event.target.files?.[0]?.name ?? '' })} />
                </label>
                {works.siteSurveyUploadName ? <span className="form-hint">{works.siteSurveyUploadName}</span> : null}
              </div>
            ) : null}
          </div>
        </article>

        <article className="requirement-block technical-capacity-block" id="requirement-section-technicalCapacity">
          <div>
            <h4>Technical Capacity</h4>
            <span className="form-hint">Turn each technical capacity evidence requirement on or off.</span>
          </div>
          <div className="technical-capacity-list">
            <div className="technical-capacity-row">
              <div>
                <strong>Similar completed projects</strong>
                <span>Require bidders to submit evidence of similar completed works.</span>
              </div>
              <label className="requirement-toggle">
                <input type="checkbox" checked={works.similarCompletedProjectsRequired} onChange={(event) => patchWorks({ similarCompletedProjectsRequired: event.target.checked })} aria-label="Similar completed projects" />
                <span></span>
              </label>
            </div>
            <div className="technical-capacity-row">
              <div>
                <strong>Key personnel CVs</strong>
                <span>Require CVs for proposed key personnel.</span>
              </div>
              <label className="requirement-toggle">
                <input type="checkbox" checked={works.keyPersonnelCvsRequired} onChange={(event) => patchWorks({ keyPersonnelCvsRequired: event.target.checked })} aria-label="Key personnel CVs" />
                <span></span>
              </label>
            </div>
            <div className="technical-capacity-row">
              <div>
                <strong>Bank statements</strong>
                <span>Require bank statements as financial capacity evidence.</span>
              </div>
              <label className="requirement-toggle">
                <input type="checkbox" checked={works.bankStatementsRequired} onChange={(event) => patchWorks({ bankStatementsRequired: event.target.checked })} aria-label="Bank statements" />
                <span></span>
              </label>
            </div>
            {works.bankStatementsRequired ? (
              <div className="technical-capacity-detail-row">
                <span className="form-label">Bank statement period</span>
                <span className="form-hint">Describe how far back the bank statements should cover.</span>
                <textarea className="form-input" placeholder="Example: Submit bank statements covering the last 6 months." value={works.bankStatementPeriod} onChange={(event) => patchWorks({ bankStatementPeriod: event.target.value })} aria-label="Bank statement period" />
              </div>
            ) : null}
          </div>
        </article>

        <article className="requirement-block" id="requirement-section-financialCapacity">
          <div className="scope-list-heading">
            <div>
              <h4>Financial Capacity Requirements</h4>
              <span className="form-hint">Structured financial rules used to verify whether bidders can sustain the contract.</span>
            </div>
            <button className="btn btn-secondary scope-add" type="button" onClick={onAddFinancialRequirement}>Add Financial Requirement</button>
          </div>
          <div className="requirement-table-wrap">
            <table className="requirement-table">
              <thead>
                <tr>
                  <th>Requirement type</th>
                  <th>Minimum value</th>
                  <th>Period</th>
                  <th>Evidence required</th>
                  <th>Mandatory</th>
                  <th aria-label="Actions"></th>
                </tr>
              </thead>
              <tbody>
                {draft.financialRequirements.length ? (
                  draft.financialRequirements.map((row, index) => (
                    <tr key={row.id}>
                      <td>
                        <select className="form-input" aria-label={`Requirement type ${index + 1}`} value={row.requirementType} onChange={(event) => onUpdateFinancialRequirement(row.id, { requirementType: event.target.value })}>
                          <option value="">Select</option>
                          {financialRequirementTypes.map((type) => <option key={type} value={type}>{type}</option>)}
                        </select>
                      </td>
                      <td><input className="form-input" aria-label={`Minimum value ${index + 1}`} inputMode="decimal" value={row.minimumValue} onChange={(event) => onUpdateFinancialRequirement(row.id, { minimumValue: event.target.value })} /></td>
                      <td>
                        <select className="form-input" aria-label={`Period ${index + 1}`} value={row.period} onChange={(event) => onUpdateFinancialRequirement(row.id, { period: event.target.value })}>
                          <option value="">Select</option>
                          {financialPeriods.map((period) => <option key={period} value={period}>{period}</option>)}
                        </select>
                      </td>
                      <td>
                        <select className="form-input" aria-label={`Evidence required ${index + 1}`} value={row.evidenceRequired} onChange={(event) => onUpdateFinancialRequirement(row.id, { evidenceRequired: event.target.value })}>
                          <option value="">Select</option>
                          {financialEvidence.map((evidence) => <option key={evidence} value={evidence}>{evidence}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="checkbox" aria-label={`Mandatory financial requirement ${index + 1}`} checked={row.mandatory} onChange={(event) => onUpdateFinancialRequirement(row.id, { mandatory: event.target.checked })} />
                      </td>
                      <td className="requirement-table-action-cell">
                        <button className="boq-row-action icon-delete-btn" type="button" aria-label={`Delete financial requirement ${index + 1}`} onClick={() => onDeleteFinancialRequirement(row.id)}>x</button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}><div className="scope-empty">No financial requirements added yet.</div></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
        {regulatoryLicensePanel}
      </div>
    </div>
  );
}

function EvaluationStep({
  draft,
  total,
  suggestions,
  onAddCriterion,
  onUpdateCriterion,
  onRemoveCriterion,
  onReplaceCriteria
}: {
  draft: CreateTenderDraft;
  total: number;
  suggestions: CreateTenderEvaluationCriterion[];
  onAddCriterion: (criterion: CreateTenderEvaluationCriterion) => void;
  onUpdateCriterion: (criterionId: string, patch: Partial<CreateTenderEvaluationCriterion>) => void;
  onRemoveCriterion: (criterionId: string) => void;
  onReplaceCriteria: (criteria: CreateTenderEvaluationCriterion[]) => void;
}) {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual');
  const [editingCriterionId, setEditingCriterionId] = useState<string | null>(null);
  const [subcriteriaPicker, setSubcriteriaPicker] = useState<Record<string, string>>({});
  const [customSubcriteria, setCustomSubcriteria] = useState<Record<string, string>>({});

  if (draft.procurementTypeId === 'goods' || draft.procurementTypeId === 'works' || draft.procurementTypeId === 'services' || draft.procurementTypeId === 'consultancy') {
    const summary = getEvaluationSummary(draft.evaluationCriteria);
    const selectedIds = new Set(draft.evaluationCriteria.map((criterion) => criterion.id));
    const availableSuggestions = suggestions.filter((criterion) => !selectedIds.has(criterion.id));

    const updateWeight = (criterionId: string, value: number) => {
      if (mode !== 'auto') {
        onUpdateCriterion(criterionId, { weight: value });
        return;
      }
      onReplaceCriteria(autoBalanceCriteria(draft.evaluationCriteria, criterionId, value));
    };

    const updateCriterionSubcriteria = (criterion: CreateTenderEvaluationCriterion, nextSubcriteria: string[]) => {
      onUpdateCriterion(criterion.id, { subcriteria: normalizeTextList(nextSubcriteria) });
    };

    const addSelectedSubcriterion = (criterion: CreateTenderEvaluationCriterion) => {
      const value = (subcriteriaPicker[criterion.id] || '').trim();
      if (!value) return;
      const existing = normalizeTextList(criterion.subcriteria);
      if (!existing.some((item) => item.toLowerCase() === value.toLowerCase())) {
        updateCriterionSubcriteria(criterion, [...existing, value]);
      }
      setSubcriteriaPicker((current) => ({ ...current, [criterion.id]: '' }));
    };

    const addCustomSubcriterion = (criterion: CreateTenderEvaluationCriterion) => {
      const value = (customSubcriteria[criterion.id] || '').trim();
      if (!value) return;
      const existing = normalizeTextList(criterion.subcriteria);
      if (!existing.some((item) => item.toLowerCase() === value.toLowerCase())) {
        updateCriterionSubcriteria(criterion, [...existing, value]);
      }
      setCustomSubcriteria((current) => ({ ...current, [criterion.id]: '' }));
    };

    const addCustomCriterion = () => {
      onAddCriterion({
        id: createRowId(`${draft.procurementTypeId}-custom-criterion`),
        label: 'Custom Criterion',
        category: 'Custom',
        weight: 0,
        maxScore: 0,
        notes: '',
        description: '',
        evaluationType: 'scored',
        mandatory: false,
        passFailGate: false,
        evidenceRequired: [],
        scoringGuide: [],
        subcriteria: [],
        custom: true,
        suggestedFor: [draft.procurementTypeId]
      });
    };

    return (
      <div className="wizard-step-surface evaluation-step-surface">
        <div className="evaluation-builder" data-evaluation-builder>
          <div className="evaluation-builder-header">
            <div>
              <span className="section-kicker">Evaluation setup</span>
              <h3>Criteria suggestion library</h3>
            </div>
            <span className={`badge ${summary.state === 'balanced' ? 'badge-success' : summary.state === 'over' ? 'badge-error' : 'badge-warning'}`}>{summary.message}</span>
          </div>

          <div className={`evaluation-weight-panel ${summary.state}`}>
            <div className="evaluation-weight-status">
              <span>Total Weight: <strong>{summary.total}%</strong></span>
              <span>{summary.message}</span>
            </div>
            <div className="evaluation-progress-track" aria-label={`Evaluation criteria total ${summary.total}%`}>
              <span style={{ width: `${Math.min(summary.total, 100)}%` }} />
            </div>
          </div>

          <div className="evaluation-toolbar">
            <label>
              <span className="form-label">Balancing mode</span>
              <select className="form-input" value={mode} onChange={(event) => setMode(event.target.value as 'manual' | 'auto')}>
                <option value="manual">Manual</option>
                <option value="auto">Auto-balance</option>
              </select>
            </label>
            <button className="btn btn-primary" type="button" onClick={addCustomCriterion}>
              Add Custom Criterion
            </button>
          </div>

          <div className="evaluation-builder-grid">
            <section className="evaluation-selected-panel">
              <div className="scope-list-heading">
                <div>
                  <h3>Selected criteria</h3>
                  <span className="form-hint">Buyer-controlled labels, weights, and selectable subcriteria.</span>
                </div>
                <div className="evaluation-selected-heading-meta">
                  <span>Weight</span>
                  <span className="badge badge-info">{draft.evaluationCriteria.length} criteria</span>
                </div>
              </div>
              <div className="evaluation-criteria-list" data-evaluation-criteria-list>
                {draft.evaluationCriteria.length ? (
                  draft.evaluationCriteria.map((criterion) => {
                    const selectedSubcriteria = normalizeTextList(criterion.subcriteria);
                    const catalogSubcriteria = normalizeTextList(suggestions.find((item) => item.id === criterion.id)?.subcriteria);
                    const availableSubcriteria = catalogSubcriteria.filter((item) => !selectedSubcriteria.some((selected) => selected.toLowerCase() === item.toLowerCase()));
                    const isEditing = editingCriterionId === criterion.id;

                    return (
                      <article key={criterion.id} className="evaluation-selected-card" data-evaluation-criterion={criterion.id}>
                        <div className="evaluation-selected-main">
                          <div className="evaluation-selected-copy">
                            <strong>{criterion.label}</strong>
                            <div className="evaluation-subcriteria-preview">
                              {selectedSubcriteria.length ? (
                                selectedSubcriteria.map((item) => (
                                  <span key={item} className="evaluation-subcriterion-chip">
                                    {item}
                                  </span>
                                ))
                              ) : (
                                <span className="requirement-tag-empty">No subcriteria selected</span>
                              )}
                            </div>
                          </div>
                          <div className="evaluation-selected-actions">
                            <div className="requirement-input-affix evaluation-weight-cell">
                              <input
                                className="form-input evaluation-weight-input"
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={criterion.weight}
                                onChange={(event) => updateWeight(criterion.id, Number(event.target.value))}
                                aria-label="Weight"
                              />
                              <span>%</span>
                            </div>
                            <div className="evaluation-card-action-stack">
                              <button className="btn btn-secondary" type="button" onClick={() => setEditingCriterionId(criterion.id)}>
                                Edit
                              </button>
                              <button className="boq-row-action icon-delete-btn" type="button" onClick={() => onRemoveCriterion(criterion.id)} aria-label="Delete criteria" title="Delete criteria">
                                <svg className="trash-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                  <path d="M3 6h18" />
                                  <path d="M8 6V4h8v2" />
                                  <path d="M19 6l-1 14H6L5 6" />
                                  <path d="M10 11v5" />
                                  <path d="M14 11v5" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>

                        {isEditing ? (
                          <div className="evaluation-edit-menu" data-evaluation-edit-menu>
                            <button className="boq-row-action evaluation-edit-close" type="button" onClick={() => setEditingCriterionId(null)} aria-label="Close edit menu" title="Close">
                              x
                            </button>
                            <div className="evaluation-edit-grid">
                              <label>
                                <span className="form-label">Criterion name</span>
                                <input className="form-input" value={criterion.label} onChange={(event) => onUpdateCriterion(criterion.id, { label: event.target.value })} aria-label="Criterion name" />
                              </label>
                              <label>
                                <span className="form-label">Category</span>
                                <input className="form-input" value={criterion.category ?? ''} onChange={(event) => onUpdateCriterion(criterion.id, { category: event.target.value })} aria-label="Criterion category" />
                              </label>
                              <label>
                                <span className="form-label">Evaluation type</span>
                                <select className="form-input" value={criterion.evaluationType ?? 'scored'} onChange={(event) => onUpdateCriterion(criterion.id, { evaluationType: event.target.value })} aria-label="Evaluation type">
                                  {evaluationTypes.map((type) => (
                                    <option key={type.value} value={type.value}>
                                      {type.label}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label>
                                <span className="form-label">Max score</span>
                                <input className="form-input" type="number" min="0" max="100" step="0.01" value={criterion.maxScore ?? criterion.weight} onChange={(event) => onUpdateCriterion(criterion.id, { maxScore: Number(event.target.value) })} aria-label="Criterion max score" />
                              </label>
                              <label className="wide">
                                <span className="form-label">Description</span>
                                <textarea className="form-input" rows={2} value={criterion.description ?? ''} onChange={(event) => onUpdateCriterion(criterion.id, { description: event.target.value })} aria-label="Criterion description" />
                              </label>
                              <label className="confirm-action evaluation-toggle-field">
                                <input type="checkbox" className="confirm-action-input" checked={Boolean(criterion.mandatory)} onChange={(event) => onUpdateCriterion(criterion.id, { mandatory: event.target.checked })} />
                                <span>Mandatory criterion</span>
                              </label>
                              <label className="confirm-action evaluation-toggle-field">
                                <input type="checkbox" className="confirm-action-input" checked={Boolean(criterion.passFailGate)} onChange={(event) => onUpdateCriterion(criterion.id, { passFailGate: event.target.checked })} />
                                <span>Failure blocks ranking</span>
                              </label>
                              <label className="wide">
                                <span className="form-label">Evidence required</span>
                                <textarea className="form-input" rows={2} value={normalizeTextList(criterion.evidenceRequired).join('\n')} onChange={(event) => onUpdateCriterion(criterion.id, { evidenceRequired: normalizeTextList(event.target.value) })} aria-label="Evidence required" />
                              </label>
                              <label className="wide">
                                <span className="form-label">Scoring guide</span>
                                <textarea className="form-input" rows={3} value={normalizeTextList(criterion.scoringGuide).join('\n')} onChange={(event) => onUpdateCriterion(criterion.id, { scoringGuide: normalizeTextList(event.target.value) })} aria-label="Scoring guide" />
                              </label>
                            </div>

                            <div className="evaluation-subcriteria-control">
                              <span className="form-label">Subcriteria</span>
                              <div className="evaluation-subcriteria-list">
                                {selectedSubcriteria.length ? (
                                  selectedSubcriteria.map((item) => (
                                    <span key={item} className="evaluation-subcriterion-chip">
                                      {item}
                                      <button
                                        type="button"
                                        onClick={() => updateCriterionSubcriteria(criterion, selectedSubcriteria.filter((selected) => selected !== item))}
                                        aria-label={`Remove ${item}`}
                                      >
                                        x
                                      </button>
                                    </span>
                                  ))
                                ) : (
                                  <span className="requirement-tag-empty">No subcriteria selected</span>
                                )}
                              </div>
                              <div className="evaluation-subcriteria-add-row">
                                <select
                                  className="form-input"
                                  value={subcriteriaPicker[criterion.id] ?? ''}
                                  onChange={(event) => setSubcriteriaPicker((current) => ({ ...current, [criterion.id]: event.target.value }))}
                                  aria-label="Select subcriterion"
                                  disabled={!availableSubcriteria.length}
                                >
                                  <option value="">Choose subcriterion</option>
                                  {availableSubcriteria.map((item) => (
                                    <option key={item} value={item}>
                                      {item}
                                    </option>
                                  ))}
                                </select>
                                <button className="btn btn-secondary" type="button" onClick={() => addSelectedSubcriterion(criterion)} disabled={!availableSubcriteria.length}>
                                  Add
                                </button>
                              </div>
                              <div className="evaluation-subcriteria-add-row">
                                <input
                                  className="form-input"
                                  placeholder="Custom subcriterion"
                                  value={customSubcriteria[criterion.id] ?? ''}
                                  onChange={(event) => setCustomSubcriteria((current) => ({ ...current, [criterion.id]: event.target.value }))}
                                  aria-label="Custom subcriterion"
                                />
                                <button className="btn btn-secondary" type="button" onClick={() => addCustomSubcriterion(criterion)}>
                                  Add Custom
                                </button>
                              </div>
                            </div>
                            <div className="evaluation-edit-actions">
                              <button className="btn btn-secondary" type="button" onClick={() => setEditingCriterionId(null)}>
                                Cancel
                              </button>
                              <button className="btn btn-primary" type="button" onClick={() => setEditingCriterionId(null)}>
                                Save Changes
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </article>
                    );
                  })
                ) : (
                  <div className="scope-empty">No evaluation criteria selected yet.</div>
                )}
              </div>
            </section>
          </div>

          <div className="evaluation-suggestions-row">
            <section className="evaluation-suggestions-panel">
              <div className="scope-list-heading">
                <div>
                  <h3>Suggested criteria</h3>
                  <span className="form-hint">Suggestions are guidance only and can be removed after adding.</span>
                </div>
              </div>
              <div className="evaluation-suggestion-list" data-evaluation-suggestion-list>
                {availableSuggestions.length ? (
                  availableSuggestions.map((criterion) => (
                    <button key={criterion.id} className="evaluation-suggestion" type="button" onClick={() => onAddCriterion({ ...criterion, subcriteria: [...(criterion.subcriteria ?? [])], evidenceRequired: [...(criterion.evidenceRequired ?? [])], maxScore: criterion.maxScore ?? criterion.weight })}>
                      <span>+</span>
                      <strong>{criterion.label}</strong>
                      <small>{normalizeTextList(criterion.subcriteria).slice(0, 3).join(', ')}</small>
                    </button>
                  ))
                ) : (
                  <div className="scope-empty">All suggested criteria have been added.</div>
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    );
  }

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

function ReviewStep({
  draft,
  selectedType,
  total
}: {
  draft: CreateTenderDraft;
  selectedType: { id: CreateTenderProcurementTypeId; label: string; description: string };
  total: number;
}) {
  const itemLabel = (itemId: string) => {
    const index = draft.commercialItems.findIndex((item) => item.id === itemId);
    const item = draft.commercialItems[index];
    return item ? item.description || `Product item ${index + 1}` : 'Unknown BOQ item';
  };
  const fundingSource = draft.fundingSource === 'Other' ? draft.customFundingSource || 'Other' : draft.fundingSource;
  const requirementEntries = Object.entries(draft.requirements).filter(([, value]) => Boolean(value));
  const consultancy = draft.consultancyRequirements ?? createEmptyConsultancyRequirements();
  const services = draft.serviceRequirements ?? createEmptyServiceRequirements();
  const works = draft.worksRequirements ?? createEmptyWorksRequirements();
  const licenseRows = draft.regulatoryLicenseRequirements.length
    ? draft.regulatoryLicenseRequirements.map((row) => [
        { label: 'License', value: row.license },
        { label: 'Issuing body', value: row.body },
        { label: 'Mandatory', value: row.mandatory ? 'Yes' : 'No' },
        { label: 'Expiry validation', value: row.expiryRequired ? 'Yes' : 'No' }
      ])
    : draft.selectedLicenses.map((license) => [{ label: 'License', value: license }]);
  const serviceBoqTotal = services.serviceBoqRows.reduce((sum, row) => sum + Number(row.quantity || 0) * Number(row.rate || 0), 0);
  const reviewCommercialBadge = selectedType.id === 'works' || selectedType.id === 'goods' ? 'Unpriced schedule' : formatReviewMoney(serviceBoqTotal, draft.currency);

  return (
    <div className="wizard-step-surface review-step-surface">
      <div className="tender-review-workspace">
        <section className="tender-review-panel">
          <div className="scope-list-heading">
            <div>
              <h3>Tender information</h3>
              <span className="form-hint">Basic details, contact, procurement type, category, method, and visibility.</span>
            </div>
          </div>
          <div className="tender-review-field-grid">
            {renderReviewField('Tender title', draft.title)}
            {renderReviewField('Procurement type', selectedType.label)}
            {renderReviewField('Categories', draft.categories)}
            {renderReviewField('Procurement method', draft.method)}
            {renderReviewField('Funding source', fundingSource)}
            {renderReviewField('Visibility', getReviewVisibility(draft.method))}
            {renderReviewField('Invited suppliers', draft.invitedSuppliers)}
            {renderReviewField('Location', draft.location)}
            {renderReviewField('Contact person / department', draft.contact.name)}
            {renderReviewField('Phone', draft.contact.phone)}
            {renderReviewField('Email', draft.contact.email)}
            {renderReviewField('Estimated budget', draft.estimatedBudget ? `${draft.currency} ${draft.estimatedBudget}` : '')}
          </div>
        </section>

        <section className="tender-review-panel">
          <div className="scope-list-heading">
            <div>
              <h3>Tender requirements</h3>
              <span className="form-hint">Structured requirement fields and procurement-specific response controls.</span>
            </div>
          </div>
          {selectedType.id === 'works' ? (
            renderWorksReviewRequirements(works, draft.financialRequirements)
          ) : selectedType.id === 'services' ? (
            renderServiceReviewRequirements(services, draft.financialRequirements)
          ) : selectedType.id === 'consultancy' ? (
            renderConsultancyReviewRequirements(consultancy, draft.financialRequirements, licenseRows)
          ) : (
            <div className="tender-review-section-stack">
              <article className="tender-review-section">
                <h4>Requirement fields</h4>
                {requirementEntries.length ? (
                  <div className="tender-review-field-grid">
                    {requirementEntries.map(([key, value]) => renderReviewField(key === 'requireSamples' ? 'Require Samples?' : formatReviewLabel(key), value))}
                  </div>
                ) : (
                  <div className="scope-empty">No structured requirement fields were configured.</div>
                )}
              </article>
              <article className="tender-review-section">
                <h4>Product specifications</h4>
                {renderReviewTextList(
                  draft.productSpecifications.map((row) => `${itemLabel(row.sourceItemId)} - ${row.specificationName}${row.acceptableRequirement ? `: ${row.acceptableRequirement}` : ''}`),
                  'No product specifications added yet.'
                )}
              </article>
              <article className="tender-review-section">
                <h4>Sample requirements</h4>
                {renderReviewTextList(
                  draft.sampleRequirements.map((row) => `${itemLabel(row.relatedBoqItemId)} - ${row.numberOfSamples || 'Sample count pending'}${row.deliveryDeadline ? ` by ${row.deliveryDeadline}` : ''}`),
                  'No sample requirements added yet.'
                )}
              </article>
              <article className="tender-review-section">
                <h4>Financial capacity</h4>
                {renderReviewTextList(
                  draft.financialRequirements.map((row) =>
                    [row.requirementType || 'Financial requirement', row.minimumValue ? `minimum ${row.minimumValue}` : '', row.period, row.evidenceRequired].filter(Boolean).join(' - ')
                  ),
                  'No financial capacity requirements added yet.'
                )}
              </article>
              <article className="tender-review-section">
                <h4>Other eligibility</h4>
                {renderReviewTextList(
                  draft.eligibilityRequirements.map((row) =>
                    `${row.requirementName || 'Eligibility requirement'}${row.mandatory ? ' - mandatory' : ''}${row.requiresUpload ? ' - upload required' : ''}${row.notes ? ` - ${row.notes}` : ''}`
                  ),
                  'No eligibility requirements added yet.'
                )}
              </article>
            </div>
          )}
        </section>

        {selectedType.id === 'consultancy' ? null : (
          <section className="tender-review-panel">
            <div className="scope-list-heading">
              <div>
                <h3>Regulatory license requirements</h3>
                <span className="form-hint">Licenses required for supplier eligibility.</span>
              </div>
            </div>
            {licenseRows.length ? renderReviewObjectRows(licenseRows) : <div className="scope-empty">No regulatory licenses selected.</div>}
          </section>
        )}

        <section className="tender-review-panel">
          <div className="scope-list-heading">
            <div>
              <h3>{getReviewCommercialTitle(selectedType.id)}</h3>
              <span className="form-hint">{selectedType.id === 'works' || selectedType.id === 'goods' ? 'Commercial schedule bidders will price during submission.' : 'Commercial schedule and estimated amount.'}</span>
            </div>
            <span className="badge badge-info">{reviewCommercialBadge}</span>
          </div>
          {selectedType.id === 'works' ? (
            works.boqRows.length || works.lumpSumPricingRows.length ? (
              renderReviewObjectRows([
                ...works.lumpSumPricingRows.map((row, index) => [
                  { label: 'Code', value: `LS-${index + 1}` },
                  { label: 'Requirement', value: row.section || 'Pricing section' },
                  { label: 'Qty / Duration', value: row.description },
                  { label: 'Unit', value: 'Lump sum' }
                ]),
                ...works.boqRows.map((row, index) => [
                  { label: 'Code', value: String(index + 1) },
                  { label: 'Requirement', value: row.description || 'BOQ line' },
                  { label: 'Qty / Duration', value: row.quantity },
                  { label: 'Unit', value: row.unit }
                ])
              ])
            ) : (
              <div className="scope-empty">{getReviewCommercialEmptyText(selectedType.id)}</div>
            )
          ) : selectedType.id === 'services' ? (
            services.serviceBoqRows.length ? (
              renderReviewObjectRows(
                services.serviceBoqRows.map((row, index) => [
                  { label: 'Code', value: String(index + 1) },
                  { label: 'Requirement', value: row.description || 'Service BOQ line' },
                  { label: 'Qty / Duration', value: row.quantity },
                  { label: 'Unit', value: row.unit },
                  { label: 'Rate / Fee', value: row.rate }
                ])
              )
            ) : (
              <div className="scope-empty">{getReviewCommercialEmptyText(selectedType.id)}</div>
            )
          ) : draft.commercialItems.length ? (
            renderReviewObjectRows(
              draft.commercialItems.map((item, index) => [
                { label: 'Code', value: String(index + 1) },
                { label: 'Requirement', value: item.description || 'Item' },
                { label: 'Qty / Duration', value: item.quantity },
                { label: 'Unit', value: item.unit }
              ])
            )
          ) : (
            <div className="scope-empty">{getReviewCommercialEmptyText(selectedType.id)}</div>
          )}
        </section>

        <section className="tender-review-panel">
          <div className="scope-list-heading">
            <div>
              <h3>Deliverables and attachments</h3>
              <span className="form-hint">Outputs and required supporting documents.</span>
            </div>
          </div>
          <div className="tender-review-two-column">
            <div>
              <h4>Deliverables</h4>
              {renderReviewTextList(draft.deliverables, 'No deliverables added yet.')}
            </div>
            <div>
              <h4>Required attachments</h4>
              {renderReviewTextList(draft.attachments, 'No required attachments added yet.')}
            </div>
          </div>
        </section>

        <section className="tender-review-panel">
          <div className="scope-list-heading">
            <div>
              <h3>Evaluation criteria and timeline</h3>
              <span className="form-hint">Evaluation weights and publication milestones.</span>
            </div>
            <span className={`badge ${total === 100 ? 'badge-success' : 'badge-warning'}`}>{total === 100 ? 'Balanced' : `Add ${100 - total}% remaining`}</span>
          </div>
          <div className="tender-review-two-column">
            <div>
              <h4>Evaluation criteria</h4>
              {renderReviewEvaluation(draft.evaluationCriteria)}
            </div>
            <div>
              <h4>Timeline</h4>
              <div className="tender-review-field-grid">
                {renderReviewField('Publication', draft.publicationDate)}
                {renderReviewField('Clarification deadline', draft.clarificationDeadline)}
                {renderReviewField('Bid submission deadline', draft.submissionDate)}
                {renderReviewField('Opening session', draft.openingDate)}
                {draft.milestones.map((milestone) => renderReviewField(milestone.label, milestone.dueDate))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function PublicationStep({
  draft,
  onPatch,
  confirmationsComplete,
  isPersisting,
  isGeneratingPdf,
  onDownloadPdf,
  onSubmitTender
}: {
  draft: CreateTenderDraft;
  onPatch: (patch: Partial<CreateTenderDraft>) => void;
  confirmationsComplete: boolean;
  isPersisting: boolean;
  isGeneratingPdf: boolean;
  onDownloadPdf: () => void | Promise<void>;
  onSubmitTender: () => void | Promise<void>;
}) {
  const setConfirmationGroup = (patch: Partial<Record<CreateTenderConfirmationId, boolean>>) => {
    onPatch({ confirmations: { ...draft.confirmations, ...patch } });
  };

  return (
    <div className="wizard-step-surface publication-step-surface">
      <div className="system-evaluation-workspace system-evaluation-submit-flow" data-system-evaluation-wrap>
        <section className="system-evaluation-submit-card">
          <div className="system-evaluation-submit-header">
            <div>
              <span className="section-kicker">Review submission</span>
              <h3>Submit Tender for Review</h3>
            </div>
            <span className={`badge ${confirmationsComplete ? 'badge-success' : 'badge-info'}`}>{confirmationsComplete ? 'Ready for review' : 'Ready to submit'}</span>
          </div>
          <div className="system-evaluation-description">
            <strong>Description</strong>
            <p>Your tender will be checked by an admin for correctness, completeness, clarity, and publication readiness before it appears in the marketplace.</p>
          </div>
          <div className="system-evaluation-outcome-grid">
            <article className="system-evaluation-outcome-card outcome-pass">
              <h4>If the tender passes review:</h4>
              <ul>
                <li>It will be published automatically to the marketplace.</li>
                <li>You will receive a success notification.</li>
              </ul>
            </article>
            <article className="system-evaluation-outcome-card outcome-return">
              <h4>If the tender does not pass:</h4>
              <ul>
                <li>It will return to your dashboard as a draft.</li>
                <li>You will receive admin comments and required changes.</li>
              </ul>
            </article>
          </div>
          <div className="system-evaluation-confirmations">
            <label>
              <input type="checkbox" checked={draft.confirmations.accuracy && draft.confirmations.compliance} onChange={(event) => setConfirmationGroup({ accuracy: event.target.checked, compliance: event.target.checked })} />
              <span>I confirm the tender information is complete and accurate.</span>
            </label>
            <label>
              <input type="checkbox" checked={draft.confirmations.evaluation} onChange={(event) => setConfirmationGroup({ evaluation: event.target.checked })} />
              <span>I understand the tender will be reviewed before publication.</span>
            </label>
            <label>
              <input type="checkbox" checked={draft.confirmations.publication} onChange={(event) => setConfirmationGroup({ publication: event.target.checked })} />
              <span>I understand rejected tenders will return as draft with comments.</span>
            </label>
          </div>
          <div className="submit-strip buyer-review-submit system-evaluation-publish">
            <div>
              <strong>Actions</strong>
              <span data-system-publish-note>Submit the tender for admin review. The creation wizard will close after submission.</span>
            </div>
            <div className="system-evaluation-action-buttons">
              <button className="btn btn-secondary" type="button" onClick={onDownloadPdf} disabled={isGeneratingPdf || isPersisting}>
                {isGeneratingPdf ? 'Generating PDF...' : 'Download Tender PDF'}
              </button>
              <button className="btn btn-primary" type="button" onClick={onSubmitTender} disabled={!confirmationsComplete || isPersisting}>
                {isPersisting ? 'Submitting...' : 'Submit Tender for Review'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

function renderConsultancyReviewRequirements(consultancy: CreateTenderConsultancyRequirements, financialRequirements: CreateTenderFinancialRequirementRow[], licenseRows: Array<Array<{ label: string; value: string }>>) {
  return (
    <div className="tender-review-section-stack">
      <article className="tender-review-section">
        <h4>Consultancy TOR introduction</h4>
        <div className="tender-review-field-grid">
          {renderReviewField('Project name', consultancy.projectName)}
          {renderReviewField('Background narrative', consultancy.backgroundNarrative)}
          {renderReviewField('Problem statement', consultancy.mainProblemDescription)}
          {renderReviewField('Expected impact', consultancy.expectedImpact)}
        </div>
        {renderReviewTextList(
          consultancy.entityBackgroundCards.map((row) => [row.organizationBackground, row.departmentUnit].filter(Boolean).join(' - ')),
          'No procuring entity background captured yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Objectives</h4>
        <div className="tender-review-field-grid">{renderReviewField('General objective', consultancy.generalObjective)}</div>
        {renderReviewTextList(
          consultancy.specificObjectiveRows.map((row) => [row.objectiveTitle || 'Objective', row.objectiveDescription, row.priorityLevel].filter(Boolean).join(' - ')),
          'No specific objectives added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Scope of consultancy services</h4>
        {renderReviewTextList(
          consultancy.assignmentActivityRows.map((row) => [row.activityTitle || 'Activity', row.expectedOutput, row.location, row.duration ? `${row.duration} days` : ''].filter(Boolean).join(' - ')),
          'No assignment activities added yet.'
        )}
        <div className="tender-review-field-grid">{renderReviewField('Out-of-scope activities', consultancy.outOfScopeActivities)}</div>
      </article>
      <article className="tender-review-section">
        <h4>Duties and responsibilities</h4>
        {renderReviewTextList(
          [
            ...consultancy.clientResponsibilityRows.map((row) => `Client: ${[row.title || 'Responsibility', row.description, row.supportType].filter(Boolean).join(' - ')}`),
            ...consultancy.consultantResponsibilityRows.map((row) => `Consultant: ${[row.title || 'Responsibility', row.description, row.supportType].filter(Boolean).join(' - ')}`)
          ],
          'No responsibilities added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Deliverables and reporting</h4>
        {renderReviewTextList(
          [
            ...consultancy.deliverableRows.map((row) => [row.deliverableName || 'Deliverable', row.submissionTimeline, row.formatRequired, row.reviewer].filter(Boolean).join(' - ')),
            ...consultancy.reportingRequirementRows.map((row) => [row.reportType || 'Report', row.frequency, row.submissionFormat, row.submissionChannel].filter(Boolean).join(' - '))
          ],
          'No deliverables or reporting requirements added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Qualifications and experience</h4>
        <div className="tender-review-field-grid">
          {renderReviewField('Individual years of experience', consultancy.individualYearsExperience)}
          {renderReviewField('Individual similar assignments', consultancy.individualSimilarAssignmentsCount)}
          {renderReviewField('Firm minimum years', consultancy.firmMinimumYearsExperience)}
          {renderReviewField('Firm similar assignments', consultancy.firmRequiredSimilarAssignments)}
        </div>
        {renderReviewTextList(
          consultancy.keyExpertRows.map((row) => [row.positionTitle || 'Key expert', row.minimumQualification, row.yearsOfExperience ? `${row.yearsOfExperience} years` : '', row.certifications].filter(Boolean).join(' - ')),
          'No key experts added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Regulatory license requirements</h4>
        {licenseRows.length ? renderReviewObjectRows(licenseRows) : <div className="scope-empty">No regulatory licenses selected.</div>}
      </article>
      <article className="tender-review-section">
        <h4>Financial capacity</h4>
        {renderReviewTextList(
          financialRequirements.map((row) =>
            [row.requirementType || 'Financial requirement', row.minimumValue ? `minimum ${row.minimumValue}` : '', row.period, row.evidenceRequired].filter(Boolean).join(' - ')
          ),
          'No financial capacity requirements added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Institutional arrangements</h4>
        <div className="tender-review-field-grid">
          {renderReviewField('Consultant reports to', consultancy.consultantReportsTo)}
          {renderReviewField('Supervising officer', consultancy.supervisingOfficer)}
          {renderReviewField('Approval authority', consultancy.approvalAuthority)}
          {renderReviewField('Meeting frequency', consultancy.meetingFrequency)}
          {renderReviewField('Coordination mechanism', consultancy.coordinationMechanism)}
          {renderReviewField('Communication methods', consultancy.communicationMethods)}
        </div>
      </article>
      <article className="tender-review-section">
        <h4>Attachments and reference documents</h4>
        {renderReviewTextList(
          [
            ...consultancy.supportingDocumentRows.map((row) => [row.documentTitle || 'Supporting document', row.uploadName, row.category].filter(Boolean).join(' - ')),
            ...consultancy.externalReferenceRows.map((row) => [row.referenceName || 'External reference', row.url, row.description].filter(Boolean).join(' - '))
          ],
          'No supporting documents or external references added yet.'
        )}
      </article>
    </div>
  );
}

function renderWorksReviewRequirements(works: CreateTenderWorksRequirements, financialRequirements: CreateTenderFinancialRequirementRow[]) {
  return (
    <div className="tender-review-section-stack">
      <article className="tender-review-section">
        <h4>Project overview</h4>
        <div className="tender-review-field-grid">
          {renderReviewField('Project title', works.projectName)}
          {renderReviewField('Procuring entity', works.procuringEntity)}
          {renderReviewField('Project location', works.location)}
          {renderReviewField('Contract type', works.contractType === 'Other' ? works.customContractType || 'Other' : works.contractType)}
          {renderReviewField('Completion period', works.completionPeriod)}
        </div>
      </article>
      <article className="tender-review-section">
        <h4>Scope description</h4>
        <div className="tender-review-field-grid">{renderReviewField('Scope Summary', works.scopeSummary)}</div>
        {renderReviewTextList(works.mainConstructionActivities, 'No main activities added yet.')}
      </article>
      <article className="tender-review-section">
        <h4>Technical specifications</h4>
        {renderReviewTextList(
          works.technicalSpecificationDocuments.map((row) => [row.documentTitle === 'Others' ? row.customDocumentTitle || 'Others' : row.documentTitle, row.uploadName].filter(Boolean).join(' - ')),
          'No specification documents added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Drawings and design documents</h4>
        {renderReviewTextList(
          works.drawingDesignRows.map((row) => [row.documentType === 'Other' ? row.otherDocumentName || 'Other' : row.documentType, row.uploadName].filter(Boolean).join(' - ')),
          'No drawings or design documents added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Time schedule and milestones</h4>
        <div className="tender-review-field-grid">
          {renderReviewField('Commencement date', works.commencementDate)}
          {renderReviewField('Completion period', works.worksCompletionPeriod)}
          {renderReviewField('Site visit requirement', works.siteVisitRequirement)}
          {renderReviewField('Site survey', works.siteSurveyUploadName)}
        </div>
        {renderReviewTextList(
          works.worksMilestoneRows.map((row) => [row.milestone || 'Milestone', row.targetDate].filter(Boolean).join(' - ')),
          'No works milestones added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Technical capacity</h4>
        {renderReviewTextList(
          [
            works.similarCompletedProjectsRequired ? 'Similar completed projects required' : '',
            works.keyPersonnelCvsRequired ? 'Key personnel CVs required' : '',
            works.bankStatementsRequired ? `Bank statements required${works.bankStatementPeriod ? ` - ${works.bankStatementPeriod}` : ''}` : ''
          ],
          'No technical capacity evidence toggled yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Financial capacity</h4>
        {renderReviewTextList(
          financialRequirements.map((row) =>
            [row.requirementType || 'Financial requirement', row.minimumValue ? `minimum ${row.minimumValue}` : '', row.period, row.evidenceRequired].filter(Boolean).join(' - ')
          ),
          'No financial capacity requirements added yet.'
        )}
      </article>
    </div>
  );
}

function renderServiceReviewRequirements(services: CreateTenderServiceRequirements, financialRequirements: CreateTenderFinancialRequirementRow[]) {
  return (
    <div className="tender-review-section-stack">
      <article className="tender-review-section">
        <h4>Service definition</h4>
        <div className="tender-review-field-grid">
          {renderReviewField('Service category', services.serviceCategory)}
          {renderReviewField('Scope of services', services.scopeOfServices)}
          {renderReviewField('Duration', services.duration)}
        </div>
        {renderReviewTextList(services.serviceLocations, 'No service locations added yet.')}
      </article>
      <article className="tender-review-section">
        <h4>Personnel requirements</h4>
        {renderReviewTextList(
          services.personnelRequirementRows.map((row) =>
            [row.position || 'Personnel role', row.minimumEducation, row.minimumYearsExperience ? `${row.minimumYearsExperience} years` : '', row.cvRequired ? 'CV required' : '', row.mandatory ? 'mandatory' : 'optional']
              .filter(Boolean)
              .join(' - ')
          ),
          'No personnel requirements added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Financial capacity</h4>
        {renderReviewTextList(
          financialRequirements.map((row) =>
            [row.requirementType || 'Financial requirement', row.minimumValue ? `minimum ${row.minimumValue}` : '', row.period, row.evidenceRequired].filter(Boolean).join(' - ')
          ),
          'No financial capacity requirements added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Supporting documents</h4>
        {renderReviewTextList(
          services.supportingDocumentRows.map((row) => `${row.documentName || 'Supporting document'}${row.mandatory ? ' - mandatory' : ''}`),
          'No supporting documents added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Environmental and social requirements</h4>
        {renderReviewTextList(
          services.esRequirementCards.map((row) => [row.category || 'ES requirement', row.description, row.evidenceRequired.join(', '), row.mandatory ? 'mandatory' : 'optional'].filter(Boolean).join(' - ')),
          'No environmental or social requirements added yet.'
        )}
      </article>
      <article className="tender-review-section">
        <h4>Risk, safety, and insurance</h4>
        {renderReviewTextList(
          [
            ...services.insuranceCovers.map((cover) => `Insurance cover: ${cover}`),
            services.insuranceNotes ? `Insurance notes: ${services.insuranceNotes}` : '',
            services.riskAssessmentRequirement ? `Risk assessment: ${services.riskAssessmentRequirement}` : '',
            services.safetyPlanRequirement ? `Safety plan: ${services.safetyPlanRequirement}` : '',
            services.ppeRequirements ? `PPE: ${services.ppeRequirements}` : ''
          ],
          'No risk, safety, or insurance requirements added yet.'
        )}
      </article>
    </div>
  );
}

function renderReviewField(label: string, value: string | number | string[] | undefined) {
  const display = Array.isArray(value) ? value.filter(Boolean).join(', ') : String(value ?? '').trim();
  return (
    <div className="tender-review-field" key={`${label}-${display || 'empty'}`}>
      <span>{label}</span>
      <strong>{display || 'Not specified'}</strong>
    </div>
  );
}

function renderReviewTextList(items: string[], emptyText: string) {
  const values = items.map((item) => item.trim()).filter(Boolean);
  if (!values.length) return <div className="scope-empty">{emptyText}</div>;
  return (
    <ul className="tender-review-bullet-list">
      {values.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function renderReviewObjectRows(rows: Array<Array<{ label: string; value: string | number | undefined }>>) {
  return (
    <div className="tender-review-record-list">
      {rows.map((row, index) => (
        <article className="tender-review-record" key={`${index}-${row.map((item) => item.value).join('-')}`}>
          {row.map((item) => (
            <div className="tender-review-record-heading" key={item.label}>
              <strong>{item.label}</strong>
              <span>{String(item.value ?? '').trim() || 'Not specified'}</span>
            </div>
          ))}
        </article>
      ))}
    </div>
  );
}

function renderReviewEvaluation(criteria: CreateTenderEvaluationCriterion[]) {
  if (!criteria.length) return <div className="scope-empty">No evaluation criteria configured.</div>;
  return (
    <div className="tender-review-record-list">
      {criteria.map((criterion) => (
        <article className="tender-review-record" key={criterion.id}>
          <div className="tender-review-record-heading">
            <strong>{criterion.label}</strong>
            <span>{criterion.weight}%</span>
          </div>
          {renderReviewTextList(normalizeTextList(criterion.subcriteria?.length ? criterion.subcriteria : criterion.notes), 'No subcriteria selected.')}
        </article>
      ))}
    </div>
  );
}

function getReviewVisibility(method: string) {
  return method === 'Invited Tender' || method === 'Restricted Tender' ? 'Invited suppliers only' : 'Public marketplace';
}

function getReviewCommercialTitle(typeId: CreateTenderProcurementTypeId) {
  if (typeId === 'works') return 'Bill of Quantities';
  if (typeId === 'consultancy') return 'Financial Proposal';
  if (typeId === 'services') return 'Service Commercial Schedule';
  return 'Quantity Schedule';
}

function getReviewCommercialEmptyText(typeId: CreateTenderProcurementTypeId) {
  if (typeId === 'works') return 'No BOQ items added yet.';
  if (typeId === 'consultancy') return 'No financial proposal items added yet.';
  if (typeId === 'services') return 'No service commercial items added yet.';
  return 'No quantity schedule items added yet.';
}

function formatReviewMoney(value: number, currency: string) {
  return `${currency || 'TZS'} ${Math.round(value).toLocaleString('en-US')}`;
}

function formatReviewLabel(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeDraftForType(draft: CreateTenderDraft, typeId: CreateTenderProcurementTypeId): CreateTenderDraft {
  return {
    ...draft,
    procurementTypeId: typeId,
    consultancyRequirements: normalizeConsultancyRequirements(draft),
    serviceRequirements: normalizeServiceRequirements(draft),
    worksRequirements: draft.worksRequirements ?? createEmptyWorksRequirements(),
    categories: draft.categories.filter((category) => createTenderSetup.categories[typeId].includes(category)),
    selectedLicenses: draft.selectedLicenses.filter((license) => createTenderSetup.regulatoryLicenses[typeId].includes(license)),
    regulatoryLicenseRequirements: typeId === 'goods' || typeId === 'works' || typeId === 'services' || typeId === 'consultancy' ? draft.regulatoryLicenseRequirements : [],
    evaluationCriteria: getSuggestedCriteria(typeId),
    updatedAt: new Date().toISOString()
  };
}

function normalizeConsultancyRequirements(draft: CreateTenderDraft): CreateTenderConsultancyRequirements {
  const current = draft.consultancyRequirements ?? createEmptyConsultancyRequirements();
  return {
    ...createEmptyConsultancyRequirements(),
    ...current,
    generalObjective: current.generalObjective || draft.requirements.consultancy_objective || '',
    backgroundNarrative: current.backgroundNarrative || draft.requirements.consultancy_methodology || '',
    keyExpertRows:
      current.keyExpertRows.length || !draft.requirements.consultancy_team
        ? current.keyExpertRows
        : [
            {
              id: createRowId('consultancy-key-expert-migrated'),
              positionTitle: draft.requirements.consultancy_team,
              minimumQualification: '',
              yearsOfExperience: '',
              certifications: '',
              quantityRequired: '',
              mandatory: true
            }
          ],
    reportingRequirementRows:
      current.reportingRequirementRows.length || !draft.requirements.consultancy_reports
        ? current.reportingRequirementRows
        : [
            {
              id: createRowId('consultancy-reporting-migrated'),
              reportType: draft.requirements.consultancy_reports,
              frequency: '',
              submissionFormat: '',
              submissionChannel: ''
            }
          ]
  };
}

function normalizeServiceRequirements(draft: CreateTenderDraft): CreateTenderServiceRequirements {
  const current = draft.serviceRequirements ?? createEmptyServiceRequirements();
  return {
    ...createEmptyServiceRequirements(),
    ...current,
    scopeOfServices: current.scopeOfServices || draft.requirements.services_scope || '',
    reportingRequirements: current.reportingRequirements || draft.requirements.services_reporting || '',
    slaRequirement: current.slaRequirement || draft.requirements.services_sla || '',
    personnelRequirementRows:
      current.personnelRequirementRows.length || !draft.requirements.services_staffing
        ? current.personnelRequirementRows
        : [
            {
              id: createRowId('service-personnel-migrated'),
              position: draft.requirements.services_staffing,
              minimumEducation: '',
              minimumYearsExperience: '',
              cvRequired: true,
              mandatory: true
            }
          ]
  };
}

function isBackendTenderId(id: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

function createTenderPersistencePayload(draft: CreateTenderDraft): CreateTenderPayload {
  const budget = parsePositiveNumber(draft.estimatedBudget);
  const type = toBackendTenderType(draft.procurementTypeId);
  const metadata = removeUndefinedValues({
    frontendSource: 'react-create-tender',
    frontendDraftId: isBackendTenderId(draft.id) ? undefined : draft.id,
    method: draft.method,
    procurementTypeId: draft.procurementTypeId,
    procuringEntity: draft.procuringEntity,
    fundingSource: draft.fundingSource === 'Other' ? draft.customFundingSource : draft.fundingSource,
    contact: draft.contact,
    invitedSuppliers: draft.invitedSuppliers,
    evaluationCriteria: draft.evaluationCriteria,
    milestones: draft.milestones,
    publication: {
      publicationDate: draft.publicationDate,
      openingDate: draft.openingDate,
      clarificationDeadline: draft.clarificationDeadline
    },
    confirmations: draft.confirmations,
    attachments: draft.attachments
  });

  return {
    title: draft.title.trim(),
    description: buildBackendDescription(draft),
    type,
    categories: normalizeBackendCategories(draft, type),
    currency: draft.currency || 'TZS',
    location: draft.location.trim() || draft.worksRequirements?.location?.trim() || 'Tanzania',
    requirements: buildBackendRequirements(draft),
    metadata,
    requirementRows: draftRequirementRows(draft),
    commercialItems: draftCommercialItems(draft),
    ...(budget ? { budget } : {}),
    ...(draft.submissionDate ? { closingDate: draft.submissionDate } : {})
  };
}

function draftToTenderDetail(draft: CreateTenderDraft): TenderDetail {
  const payload = createTenderPersistencePayload(draft);
  const now = new Date().toISOString();

  return {
    id: draft.id,
    reference: draft.reference || draft.id,
    title: payload.title || 'Untitled tender',
    organization: draft.procuringEntity || payload.location || 'Procuring entity',
    ownerOrganization: draft.procuringEntity || 'Procuring entity',
    type: toPdfTenderType(draft.procurementTypeId) as TenderDetail['type'],
    category: payload.categories[0],
    categories: payload.categories,
    status: toPdfTenderStatus(draft.status) as TenderDetail['status'],
    budget: payload.budget ?? 0,
    currency: payload.currency || 'TZS',
    closingDate: payload.closingDate || draft.submissionDate || '',
    location: payload.location,
    description: payload.description,
    createdByCurrentUser: true,
    ownedByCurrentOrganization: true,
    canBid: false,
    hasDraftBid: false,
    hasSubmittedBid: false,
    isSaved: false,
    method: draft.method,
    visibility: 'PUBLIC_MARKETPLACE',
    publishedAt: draft.publishedAt || draft.submittedAt || now,
    requirements: payload.requirements,
    metadata: payload.metadata,
    requirementRows: draftRequirementRows(draft),
    milestones: draftMilestones(draft),
    commercialItems: draftCommercialItems(draft),
    documents: draftPdfDocuments(draft),
    bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
    submittedBidBusinesses: [],
    currentBid: null,
    activity: { marketplaceViews: 0, documentDownloads: 0, clarifications: 0 }
  };
}

function draftRequirementRows(draft: CreateTenderDraft): TenderDetail['requirementRows'] {
  const rows: TenderDetail['requirementRows'] = [];

  rows.push(
    ...Object.entries(draft.requirements)
      .filter(([, value]) => value.trim())
      .map(([key, value]) => ({ id: `summary-${key}`, section: 'Summary', payload: { title: humanizeDraftLabel(key), value } }))
  );
  rows.push(...draft.eligibilityRequirements.map((row) => ({ id: row.id, section: 'Eligibility', payload: { ...row, title: row.requirementName } })));
  rows.push(...draft.financialRequirements.map((row) => ({ id: row.id, section: 'Financial', payload: { ...row, title: row.requirementType } })));
  rows.push(...draft.regulatoryLicenseRequirements.map((row) => ({ id: row.id, section: 'Regulatory license', payload: { ...row, title: row.license } })));
  rows.push(...draft.evaluationCriteria.map((row) => ({ id: row.id, section: 'Evaluation', payload: { ...row, title: row.label } })));

  return rows;
}

function draftMilestones(draft: CreateTenderDraft): TenderDetail['milestones'] {
  const rows: TenderDetail['milestones'] = draft.milestones.map((milestone) => ({
    id: milestone.id,
    name: milestone.label,
    dueDate: milestone.dueDate || null,
    payload: {}
  }));

  rows.push(
    ...draft.worksRequirements.worksMilestoneRows.map((milestone) => ({
      id: milestone.id,
      name: milestone.milestone,
      dueDate: milestone.targetDate || null,
      payload: { source: 'Works milestone' }
    }))
  );

  return rows.filter((row) => row.name || row.dueDate);
}

function draftCommercialItems(draft: CreateTenderDraft): TenderDetail['commercialItems'] {
  if (draft.procurementTypeId === 'services') {
    return draft.serviceRequirements.serviceBoqRows.map((row, index) => commercialItemFromValues(row.id, index, row.description, row.quantity, row.unit, row.rate));
  }
  if (draft.procurementTypeId === 'works') {
    return [
      ...draft.worksRequirements.boqRows.map((row, index) => commercialItemFromValues(row.id, index, row.description, row.quantity, row.unit, row.rate)),
      ...draft.worksRequirements.lumpSumPricingRows.map((row, index) => commercialItemFromValues(row.id, draft.worksRequirements.boqRows.length + index, row.description || row.section, 1, 'Lot', row.amount, { section: row.section }))
    ];
  }

  return draft.commercialItems.map((row, index) => commercialItemFromValues(row.id, index, row.description, row.quantity, row.unit, row.unitPrice));
}

function commercialItemFromValues(id: string, index: number, description: string, quantityValue: string | number, unit: string | null, rateValue: string | number | undefined, payload: Record<string, unknown> = {}) {
  const quantity = parsePdfNumber(quantityValue) || 1;
  const rate = parsePdfNumber(rateValue) || 0;
  const total = rate ? Math.round(quantity * rate * 100) / 100 : 0;

  return {
    id,
    itemNo: String(index + 1),
    description: description || `Commercial item ${index + 1}`,
    quantity,
    unit,
    rate,
    total,
    payload
  };
}

function draftPdfDocuments(draft: CreateTenderDraft): TenderDetail['documents'] {
  const names = [
    ...draft.attachments,
    ...draft.worksRequirements.technicalSpecificationDocuments.flatMap((row) => [row.uploadName, row.documentTitle === 'Others' ? row.customDocumentTitle : row.documentTitle]),
    ...draft.worksRequirements.drawingDesignRows.flatMap((row) => [row.uploadName, row.documentType === 'Other' ? row.otherDocumentName : row.documentType]),
    draft.worksRequirements.siteSurveyUploadName,
    ...draft.serviceRequirements.supportingDocumentRows.map((row) => row.documentName),
    ...draft.consultancyRequirements.supportingDocumentRows.flatMap((row) => [row.uploadName, row.documentTitle])
  ]
    .map((name) => String(name || '').trim())
    .filter(Boolean);

  return [...new Set(names)].map((name, index) => ({
    id: `draft-document-${index + 1}`,
    name,
    documentType: 'DRAFT_ATTACHMENT',
    label: 'Draft attachment'
  }));
}

function toBackendTenderType(typeId: CreateTenderProcurementTypeId): CreateTenderPayload['type'] {
  if (typeId === 'works') return 'Works';
  if (typeId === 'services') return 'Non Consultancy';
  if (typeId === 'consultancy') return 'Consultancy';
  return 'Goods';
}

function toPdfTenderType(typeId: CreateTenderProcurementTypeId) {
  if (typeId === 'works') return 'WORKS';
  if (typeId === 'services') return 'SERVICE';
  if (typeId === 'consultancy') return 'CONSULTANCY';
  return 'GOODS';
}

function toPdfTenderStatus(status: CreateTenderDraftStatus) {
  if (status === 'PUBLISHED') return 'PUBLISHED';
  if (status === 'SUBMITTED') return 'EVALUATION';
  return 'DRAFT';
}

function humanizeDraftLabel(value: string) {
  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (letter) => letter.toUpperCase());
}

function normalizeBackendCategories(draft: CreateTenderDraft, type: CreateTenderPayload['type']) {
  const categories = [...new Set(draft.categories.map((category) => category.trim()).filter(Boolean))];
  return categories.length ? categories : [type];
}

function buildBackendDescription(draft: CreateTenderDraft) {
  const description = draft.description.trim();
  if (description.length >= 20) return description;
  const title = draft.title.trim() || 'procurement opportunity';
  const location = draft.location.trim() || draft.worksRequirements?.location?.trim() || 'Tanzania';
  const detail = description ? `${description}. ` : '';
  return `${detail}Tender package for ${title} in ${location}.`;
}

function buildBackendRequirements(draft: CreateTenderDraft): Record<string, unknown> {
  return {
    [draft.procurementTypeId]: { fields: buildRequirementFields(draft) },
    summary: draft.requirements,
    commercialItems: draft.commercialItems,
    productSpecifications: draft.productSpecifications,
    sampleRequirements: draft.sampleRequirements,
    financialRequirements: draft.financialRequirements,
    eligibilityRequirements: draft.eligibilityRequirements,
    regulatoryLicenseRequirements: draft.regulatoryLicenseRequirements,
    serviceRequirements: draft.serviceRequirements,
    worksRequirements: draft.worksRequirements,
    consultancyRequirements: draft.consultancyRequirements,
    deliverables: draft.deliverables,
    attachments: draft.attachments
  };
}

function buildRequirementFields(draft: CreateTenderDraft): Record<string, unknown> {
  if (draft.procurementTypeId === 'works') return buildWorksRequirementFields(draft);
  if (draft.procurementTypeId === 'services') return buildServiceRequirementFields(draft);
  if (draft.procurementTypeId === 'consultancy') return buildConsultancyRequirementFields(draft);
  return buildGoodsRequirementFields(draft);
}

function buildGoodsRequirementFields(draft: CreateTenderDraft): Record<string, unknown> {
  return {
    quantityScheduleRows: draft.commercialItems.map((item, index) => ({
      itemNumber: index + 1,
      itemDescription: item.description,
      unitOfMeasure: normalizeBackendUnit(item.unit),
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      totalPrice: multiplyNumericStrings(item.quantity, item.unitPrice)
    })),
    productSpecificationTemplate: draft.productSpecifications,
    sampleRequirementRows: draft.sampleRequirements,
    financialRequirementRows: normalizeFinancialRequirementRows(draft.financialRequirements),
    eligibilityRequirementCards: draft.eligibilityRequirements,
    regulatoryLicenseRequirementRows: draft.regulatoryLicenseRequirements
  };
}

function buildWorksRequirementFields(draft: CreateTenderDraft): Record<string, unknown> {
  const works = draft.worksRequirements;
  return {
    projectName: works.projectName || draft.title,
    location: works.location || draft.location,
    contractType: works.contractType,
    customContractType: works.customContractType,
    completionPeriod: works.completionPeriod,
    scopeSummary: works.scopeSummary || draft.description,
    mainConstructionActivities: works.mainConstructionActivities,
    technicalSpecificationDocuments: works.technicalSpecificationDocuments,
    drawingDesignRows: works.drawingDesignRows,
    lumpSumPricingRows: works.lumpSumPricingRows,
    boqRows: works.boqRows.map((row) => ({ ...row, unit: normalizeBackendUnit(row.unit) })),
    commencementDate: works.commencementDate,
    worksCompletionPeriod: works.worksCompletionPeriod,
    worksMilestoneRows: works.worksMilestoneRows,
    siteVisitRequirement: works.siteVisitRequirement,
    siteSurveyUploadName: works.siteSurveyUploadName,
    similarCompletedProjectsRequired: works.similarCompletedProjectsRequired,
    keyPersonnelCvsRequired: works.keyPersonnelCvsRequired,
    bankStatementsRequired: works.bankStatementsRequired,
    bankStatementPeriod: works.bankStatementPeriod
  };
}

function buildServiceRequirementFields(draft: CreateTenderDraft): Record<string, unknown> {
  const services = draft.serviceRequirements;
  return {
    serviceCategory: services.serviceCategory || draft.categories[0],
    scopeOfServices: services.scopeOfServices || draft.description,
    serviceLocations: services.serviceLocations,
    duration: services.duration,
    serviceBoqRows: services.serviceBoqRows.map((row) => ({ ...row, unit: normalizeBackendUnit(row.unit) })),
    personnelRequirementRows: services.personnelRequirementRows,
    equipmentRequirementRows: services.equipmentRequirementRows,
    supportingDocumentRows: services.supportingDocumentRows,
    esRequirementCards: services.esRequirementCards,
    reportingRequirements: services.reportingRequirements,
    slaRequirement: services.slaRequirement,
    serviceDeliverables: services.serviceDeliverables,
    serviceMilestones: services.serviceMilestones
  };
}

function buildConsultancyRequirementFields(draft: CreateTenderDraft): Record<string, unknown> {
  const consultancy = draft.consultancyRequirements;
  return {
    entityBackgroundCards: consultancy.entityBackgroundCards,
    projectName: consultancy.projectName || draft.title,
    backgroundNarrative: consultancy.backgroundNarrative || draft.description,
    currentSituation: consultancy.currentSituation,
    relatedInitiatives: consultancy.relatedInitiatives,
    mainProblemDescription: consultancy.mainProblemDescription,
    expectedImpact: consultancy.expectedImpact,
    consultancyGeneralObjective: consultancy.generalObjective,
    specificObjectiveRows: consultancy.specificObjectiveRows,
    assignmentActivityRows: consultancy.assignmentActivityRows,
    clientResponsibilityRows: consultancy.clientResponsibilityRows,
    consultantResponsibilityRows: consultancy.consultantResponsibilityRows,
    deliverableRows: consultancy.deliverableRows,
    reportingRequirementRows: consultancy.reportingRequirementRows,
    keyExpertRows: consultancy.keyExpertRows,
    supportingDocumentRows: consultancy.supportingDocumentRows,
    externalReferenceRows: consultancy.externalReferenceRows
  };
}

function getDraftValidationNote(validation?: TenderDraftValidation) {
  if (!validation) return '';
  const notes = [...validation.warnings];
  if (validation.missingRequiredFields.length) {
    notes.push(
      `Missing for publication: ${validation.missingRequiredFields
        .slice(0, 4)
        .map((field) => field.label)
        .join(', ')}${validation.missingRequiredFields.length > 4 ? '...' : ''}`
    );
  }
  return notes.slice(0, 3).join(' ');
}

function getApiErrorMessage(_error: unknown, fallback: string) {
  return fallback;
}

function parsePositiveNumber(value: string | number | undefined) {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) && number > 0 ? number : undefined;
}

function parsePdfNumber(value: string | number | undefined) {
  const number = Number(String(value ?? '').replace(/,/g, '').trim());
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function multiplyNumericStrings(left: string | number | undefined, right: string | number | undefined) {
  const leftNumber = Number(String(left ?? '').replace(/,/g, '').trim());
  const rightNumber = Number(String(right ?? '').replace(/,/g, '').trim());
  if (!Number.isFinite(leftNumber) || !Number.isFinite(rightNumber)) return '';
  return Math.round(leftNumber * rightNumber * 100) / 100;
}

function normalizeFinancialRequirementRows(rows: CreateTenderFinancialRequirementRow[]) {
  return rows.map((row) => ({
    ...row,
    evidenceRequired: normalizeTextList(row.evidenceRequired)
  }));
}

function normalizeBackendUnit(value: string | undefined) {
  const unit = String(value ?? '').trim();
  const normalized = unit.toLowerCase();
  const aliases: Record<string, string> = {
    pc: 'Piece',
    pcs: 'Piece',
    piece: 'Piece',
    pieces: 'Piece',
    unit: 'Each',
    units: 'Each',
    each: 'Each',
    sqm: 'Square Meter',
    sq: 'Square Meter',
    'sq m': 'Square Meter',
    'square metre': 'Square Meter',
    'square meter': 'Square Meter',
    meter: 'Meter',
    metre: 'Meter'
  };
  return aliases[normalized] ?? unit;
}

function removeUndefinedValues(value: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function draftFromTenderDetail(tender: TenderDetail): CreateTenderDraft {
  const metadata = objectValue(tender.metadata);
  const requirements = objectValue(tender.requirements);
  const publication = objectValue(metadata.publication);
  const typeId = parseProcurementType(stringValue(metadata.procurementTypeId) || tender.type) ?? 'goods';
  const categoryOptions = createTenderSetup.categories[typeId];
  const categories = normalizeTextList((tender.categories?.length ? tender.categories : [tender.category]).filter(Boolean).join(','))
    .filter((category) => categoryOptions.includes(category));
  const fundingSource = stringValue(metadata.fundingSource);
  const base = createEmptyTenderDraft();
  const draft: CreateTenderDraft = {
    ...base,
    id: tender.id,
    status: 'DRAFT',
    title: tender.title ?? '',
    reference: tender.reference ?? '',
    description: tender.description ?? '',
    procuringEntity: stringValue(metadata.procuringEntity) || tender.organization || tender.ownerOrganization || '',
    fundingSource: fundingSource && createTenderSetup.fundingSources.includes(fundingSource) ? fundingSource : fundingSource ? 'Other' : base.fundingSource,
    customFundingSource: fundingSource && !createTenderSetup.fundingSources.includes(fundingSource) ? fundingSource : '',
    currency: tender.currency || 'TZS',
    estimatedBudget: tender.budget ? String(tender.budget) : '',
    contact: {
      ...base.contact,
      ...objectValue(metadata.contact)
    },
    submissionDate: dateOnlyString(tender.closingDate),
    openingDate: dateOnlyString(publication.openingDate),
    clarificationDeadline: dateOnlyString(publication.clarificationDeadline),
    publicationDate: dateOnlyString(publication.publicationDate),
    location: tender.location || '',
    procurementTypeId: typeId,
    categories: categories.length ? categories : categoryOptions.slice(0, 1),
    method: frontendTenderMethod(stringValue(metadata.method) || tender.method),
    invitedSuppliers: stringArray(metadata.invitedSuppliers),
    requirements: stringMap(objectValue(requirements.summary)),
    selectedLicenses: stringArray(metadata.selectedLicenses),
    commercialItems: arrayValue<CreateTenderLineItem>(requirements.commercialItems, base.commercialItems),
    productSpecifications: arrayValue<CreateTenderProductSpecificationRow>(requirements.productSpecifications, base.productSpecifications),
    sampleRequirements: arrayValue<CreateTenderSampleRequirementRow>(requirements.sampleRequirements, base.sampleRequirements),
    financialRequirements: arrayValue<CreateTenderFinancialRequirementRow>(requirements.financialRequirements, base.financialRequirements),
    eligibilityRequirements: arrayValue<CreateTenderEligibilityRequirementRow>(requirements.eligibilityRequirements, base.eligibilityRequirements),
    regulatoryLicenseRequirements: arrayValue<CreateTenderRegulatoryLicenseRequirementRow>(requirements.regulatoryLicenseRequirements, base.regulatoryLicenseRequirements),
    consultancyRequirements: {
      ...base.consultancyRequirements,
      ...objectValue(requirements.consultancyRequirements)
    },
    serviceRequirements: {
      ...base.serviceRequirements,
      ...objectValue(requirements.serviceRequirements)
    },
    worksRequirements: {
      ...base.worksRequirements,
      ...objectValue(requirements.worksRequirements)
    },
    deliverables: stringArray(requirements.deliverables),
    attachments: stringArray(requirements.attachments).length ? stringArray(requirements.attachments) : stringArray(metadata.attachments),
    milestones: arrayValue(metadata.milestones, base.milestones),
    evaluationCriteria: arrayValue<CreateTenderEvaluationCriterion>(metadata.evaluationCriteria, getSuggestedCriteria(typeId)),
    confirmations: {
      ...base.confirmations,
      ...objectValue(metadata.confirmations)
    },
    planFilledFields: [],
    createdAt: tender.publishedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    submittedAt: '',
    publishedAt: ''
  };

  return draft;
}

function objectValue(value: unknown): Record<string, unknown> {
  return isRecordValue(value) ? value : {};
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item ?? '').trim()).filter(Boolean) : [];
}

function stringMap(value: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, typeof entry === 'string' ? entry : String(entry ?? '')]));
}

function arrayValue<T>(value: unknown, fallback: T[]): T[] {
  return Array.isArray(value) ? value as T[] : fallback;
}

function dateOnlyString(value: unknown) {
  if (typeof value !== 'string' || !value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function frontendTenderMethod(value: string | undefined) {
  const normalized = String(value ?? '').trim().replace(/[\s-]+/g, '_').toUpperCase();
  if (normalized === 'INVITED_TENDER') return 'Invited Tender';
  if (normalized === 'RESTRICTED_TENDER') return 'Restricted Tender';
  if (normalized === 'FRAMEWORK_CALL_OFF') return 'Framework Call-Off';
  return 'Open Tender';
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
      hasMeaningfulConsultancyRequirements(draft.consultancyRequirements) ||
      hasMeaningfulServiceRequirements(draft.serviceRequirements) ||
      hasMeaningfulWorksRequirements(draft.worksRequirements) ||
      draft.productSpecifications.length ||
      draft.sampleRequirements.length ||
      draft.financialRequirements.length ||
      draft.eligibilityRequirements.length ||
      draft.regulatoryLicenseRequirements.length ||
      draft.deliverables.length
  );
}

function hasMeaningfulConsultancyRequirements(consultancy?: CreateTenderConsultancyRequirements) {
  if (!consultancy) return false;
  return Boolean(
    consultancy.entityBackgroundCards.length ||
      consultancy.projectName ||
      consultancy.backgroundNarrative ||
      consultancy.existingChallenges ||
      consultancy.currentSituation ||
      consultancy.relatedInitiatives ||
      consultancy.mainProblemDescription ||
      consultancy.expectedImpact ||
      consultancy.generalObjective ||
      consultancy.specificObjectiveRows.length ||
      consultancy.assignmentActivityRows.length ||
      consultancy.outOfScopeActivities ||
      consultancy.clientResponsibilityRows.length ||
      consultancy.consultantResponsibilityRows.length ||
      consultancy.deliverableRows.length ||
      consultancy.reportingRequirementRows.length ||
      consultancy.individualProfessionalCertifications.some(Boolean) ||
      consultancy.individualYearsExperience ||
      consultancy.individualSimilarAssignmentsCount ||
      consultancy.firmMinimumYearsExperience ||
      consultancy.firmRequiredSimilarAssignments ||
      consultancy.firmSectorExperience.some(Boolean) ||
      consultancy.keyExpertRows.length ||
      consultancy.consultantReportsTo ||
      consultancy.supervisingOfficer ||
      consultancy.approvalAuthority ||
      consultancy.meetingFrequency ||
      consultancy.coordinationMechanism ||
      consultancy.communicationMethods.some(Boolean) ||
      consultancy.officeSpaceProvided ||
      consultancy.accessToFacilities ||
      consultancy.accessToDocuments ||
      consultancy.supportingDocumentRows.length ||
      consultancy.externalReferenceRows.length
  );
}

function hasMeaningfulServiceRequirements(services?: CreateTenderServiceRequirements) {
  if (!services) return false;
  return Boolean(
    services.serviceCategory ||
      services.scopeOfServices ||
      services.serviceLocations.some(Boolean) ||
      services.duration ||
      services.serviceBoqRows.length ||
      services.personnelRequirementRows.length ||
      services.numberOfGuards ||
      services.shiftSchedule ||
      services.patrolFrequency ||
      services.weaponRequirement ||
      services.controlRoomRequirement ||
      services.cleaningAreas ||
      services.cleaningFrequency ||
      services.cleaningMaterials ||
      services.wasteDisposalRequirements ||
      services.serviceDeliverables.some(Boolean) ||
      services.serviceMilestones.some(Boolean) ||
      services.reportingRequirements ||
      services.slaRequirement ||
      services.uptimeRequirement ||
      services.responseTime ||
      services.supportHours ||
      services.maintenanceSchedule ||
      services.sparePartsRequirement ||
      services.technicianRequirements ||
      services.menuRequirements ||
      services.hygieneRequirements ||
      services.foodCertifications.some(Boolean) ||
      services.fleetRequirements ||
      services.driverLicenseRequirements ||
      services.routeCoverage ||
      services.equipmentRequirementRows.length ||
      services.esRequirementCards.length ||
      services.supportingDocumentRows.length ||
      services.insuranceCovers.some(Boolean) ||
      services.insuranceNotes ||
      services.riskAssessmentRequirement ||
      services.safetyPlanRequirement ||
      services.ppeRequirements
  );
}

function hasMeaningfulWorksRequirements(works?: CreateTenderWorksRequirements) {
  if (!works) return false;
  return Boolean(
    works.projectName ||
      works.procuringEntity ||
      works.location ||
      works.contractType ||
      works.customContractType ||
      works.completionPeriod ||
      works.scopeSummary ||
      works.mainConstructionActivities.some(Boolean) ||
      works.technicalSpecificationDocuments.length ||
      works.drawingDesignRows.length ||
      works.lumpSumPricingRows.length ||
      works.boqRows.length ||
      works.commencementDate ||
      works.worksCompletionPeriod ||
      works.worksMilestoneRows.length ||
      works.siteSurveyUploadName ||
      works.similarCompletedProjectsRequired ||
      works.keyPersonnelCvsRequired ||
      works.bankStatementsRequired ||
      works.bankStatementPeriod
  );
}

function normalizeTextList(value: string[] | string | undefined) {
  if (Array.isArray(value)) return value.map((item) => String(item || '').trim()).filter(Boolean);
  return String(value || '')
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getEvaluationSummary(criteria: CreateTenderEvaluationCriterion[]) {
  const total = Math.round(criteria.reduce((sum, item) => sum + Number(item.weight || 0), 0) * 100) / 100;
  const remaining = Math.round((100 - total) * 100) / 100;
  const state = !criteria.length ? 'empty' : remaining === 0 ? 'balanced' : remaining > 0 ? 'under' : 'over';
  const message = state === 'balanced' ? 'Balanced' : state === 'over' ? `Reduce by ${Math.abs(remaining)}%` : `Add ${remaining}% remaining`;
  return { total, remaining, state, message };
}

function autoBalanceCriteria(criteria: CreateTenderEvaluationCriterion[], changedCriterionId: string, changedWeight: number) {
  if (criteria.length < 2) return criteria.map((criterion) => (criterion.id === changedCriterionId ? { ...criterion, weight: changedWeight } : criterion));
  const others = criteria.filter((criterion) => criterion.id !== changedCriterionId);
  const remaining = Math.max(100 - changedWeight, 0);
  const otherTotal = others.reduce((sum, criterion) => sum + Number(criterion.weight || 0), 0);
  let used = 0;
  const balancedOthers = others.map((criterion, index) => {
    const weight =
      index === others.length - 1
        ? Math.round((remaining - used) * 100) / 100
        : Math.round(((otherTotal ? Number(criterion.weight || 0) / otherTotal : 1 / others.length) * remaining) * 100) / 100;
    used += weight;
    return { ...criterion, weight };
  });

  return criteria.map((criterion) => (criterion.id === changedCriterionId ? { ...criterion, weight: changedWeight } : balancedOthers.shift() ?? criterion));
}

function getCreateTenderResumeStep(draft: CreateTenderDraft) {
  if (!draft.title.trim() || !draft.fundingSource || !draft.submissionDate || !draft.openingDate || (!draft.contact.email.trim() && !draft.contact.phone.trim())) return 0;
  if (!draft.procurementTypeId || !draft.categories.length || !draft.method) return 1;
  if (!hasTenderRequirementProgress(draft)) return 2;
  if (!draft.evaluationCriteria.length || getEvaluationSummary(draft.evaluationCriteria).state !== 'balanced') return 3;
  if (!Object.values(draft.confirmations).every(Boolean)) return 4;
  return 5;
}

function hasTenderRequirementProgress(draft: CreateTenderDraft) {
  return Boolean(
    Object.values(draft.requirements).some(Boolean) ||
      draft.commercialItems.length ||
      draft.productSpecifications.length ||
      draft.sampleRequirements.length ||
      draft.financialRequirements.length ||
      draft.eligibilityRequirements.length ||
      draft.regulatoryLicenseRequirements.length ||
      draft.deliverables.length ||
      draft.attachments.length
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
