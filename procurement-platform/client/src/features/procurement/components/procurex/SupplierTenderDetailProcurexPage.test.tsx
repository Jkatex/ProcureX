import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '@/shared/api/http';
import { procurementApi } from '../../api';
import { buildTenderPackPdfHtml, generatedTenderPackFilename } from '../../tenderPdfPack';
import type { TenderDetail } from '../../types';
import { SupplierTenderDetailProcurexPage } from './SupplierTenderDetailProcurexPage';

const html2PdfMock = vi.hoisted(() => {
  const worker = {
    set: vi.fn(),
    from: vi.fn(),
    outputPdf: vi.fn()
  };
  return {
    factory: vi.fn(() => worker),
    worker
  };
});

vi.mock('html2pdf.js', () => ({
  default: html2PdfMock.factory
}));

const supplierTender: TenderDetail = {
  id: 'tender-2',
  reference: 'PX-2026-002',
  title: 'Office renovation works',
  organization: 'Tanzania Revenue Authority',
  ownerOrganization: 'Tanzania Revenue Authority',
  type: 'WORKS',
  category: 'Office Renovation',
  categories: ['Office Renovation'],
  status: 'OPEN',
  budget: 950000000,
  currency: 'TZS',
  closingDate: '2099-09-15',
  location: 'Dodoma',
  description: 'Renovation of regional office spaces',
  createdByCurrentUser: false,
  ownedByCurrentOrganization: false,
  canBid: true,
  hasDraftBid: false,
  hasSubmittedBid: false,
  isSaved: false,
  visibility: 'PUBLIC_MARKETPLACE',
  publishedAt: '2026-07-01T08:00:00.000Z',
  requirements: {
    deliveryRequirements: ['Complete works in phases'],
    complianceDocuments: ['Contractor registration certificate'],
    evaluationCriteria: [{ criterion: 'Methodology', weight: 60 }],
    worksRequirements: {
      projectName: 'Office renovation works',
      procuringEntity: 'Tanzania Revenue Authority',
      location: 'Dodoma',
      contractType: 'Lump Sum Contract',
      customContractType: '',
      completionPeriod: '90 days',
      scopeSummary: 'Renovate regional office workspaces',
      mainConstructionActivities: ['Partition works', 'Electrical refit'],
      technicalSpecificationDocuments: [{ id: 'spec-doc-1', documentTitle: 'Material specifications', customDocumentTitle: '', uploadName: 'Renovation tender document' }],
      drawingDesignRows: [{ id: 'drawing-1', documentType: 'Architectural drawings', otherDocumentName: '', uploadName: 'Architectural layout.pdf' }],
      lumpSumPricingRows: [],
      boqRows: [{ id: 'line-1', description: 'Partition works', unit: 'Lot', quantity: '1', rate: '950000000' }],
      commencementDate: '2099-08-15',
      worksCompletionPeriod: '90 days',
      worksMilestoneRows: [{ id: 'ms-1', milestone: 'Site visit', targetDate: '2099-08-01' }],
      siteVisitRequirement: 'Not mandatory',
      siteSurveyUploadName: 'Site survey.pdf',
      similarCompletedProjectsRequired: true,
      keyPersonnelCvsRequired: true,
      bankStatementsRequired: false,
      bankStatementPeriod: ''
    },
    financialRequirements: [{ id: 'fin-works-1', requirementType: 'Minimum Annual Turnover', minimumValue: '500000000', period: 'Last 3 Years', evidenceRequired: 'Audited accounts', mandatory: true }],
    regulatoryLicenseRequirements: [{ id: 'lic-works-1', license: 'Contractor registration certificate', body: 'Contractors Registration Board', mandatory: true, expiryRequired: true }]
  },
  metadata: {
    buyerNotice: 'Please use Gate B for the mandatory site visit.',
    contact: { name: 'Works Officer', phone: '+255 700 000 002' },
    fundingSource: 'Government budget',
    publication: { openingDate: '2099-07-20' }
  },
  requirementRows: [{ id: 'req-1', section: 'Technical', payload: { title: 'Submit methodology' } }],
  milestones: [{ id: 'ms-1', name: 'Site visit', dueDate: '2099-08-01', payload: {} }],
  commercialItems: [{ id: 'line-1', itemNo: '1.1', description: 'Partition works', quantity: 1, unit: 'Lot', rate: 950000000, total: 950000000, payload: {} }],
  documents: [
    {
      id: 'doc-1',
      name: 'Renovation tender document',
      documentType: 'TENDER_DOCUMENT',
      label: 'Tender document',
      openUrl: '/api/procurement/tenders/tender-2/documents/doc-1/open',
      downloadUrl: '/api/procurement/tenders/tender-2/documents/doc-1/download'
    }
  ],
  bidSummary: { total: 0, draft: 0, submitted: 0, withdrawn: 0 },
  currentBid: null
};

const goodsTender: TenderDetail = {
  ...supplierTender,
  id: 'goods-tender-1',
  reference: 'PX-GDS-2026-009',
  title: 'Supply diagnostic kits',
  organization: 'Medical Stores Department',
  ownerOrganization: 'Medical Stores Department',
  buyerLogoUrl: '/api/procurement/tenders/goods-tender-1/buyer-logo',
  type: 'GOODS',
  category: 'Medical equipment',
  categories: ['Medical equipment'],
  budget: 250000000,
  closingDate: '2099-09-30',
  description: 'Supply of diagnostic kits for regional health facilities.',
  requirements: {
    summary: { requireSamples: 'Yes' },
    commercialItems: [{ id: 'kit-1', description: 'Diagnostic kit', quantity: '2', unit: 'Set' }],
    productSpecifications: [{ id: 'spec-1', sourceItemId: 'kit-1', specificationName: 'Shelf life', acceptableRequirement: 'At least 18 months' }],
    sampleRequirements: [{
      id: 'sample-1',
      relatedBoqItemId: 'kit-1',
      sampleRequired: true,
      numberOfSamples: '1',
      sampleDescription: 'Sealed sample kit',
      deliveryLocation: 'MSD Dodoma',
      deliveryDeadline: '2099-08-20',
      mandatory: true,
      returnableSample: false
    }],
    financialRequirements: [{ id: 'fin-1', requirementType: 'Access to Credit', minimumValue: '10000000', period: 'Last 12 months', evidenceRequired: 'Bank letter', mandatory: true }],
    eligibilityRequirements: [{ id: 'elig-1', requirementName: 'Tax clearance certificate', mandatory: true, requiresUpload: true, notes: 'Supplier must be tax compliant.' }],
    regulatoryLicenseRequirements: [{ id: 'lic-1', license: 'Medical Devices Registration Permit', body: 'Tanzania Medicines and Medical Devices Authority (TMDA)', mandatory: true, expiryRequired: true }]
  },
  metadata: {
    fundingSource: 'Government budget',
    contact: { name: 'Procurement Officer', phone: '+255 700 000 009' },
    publication: { openingDate: '2099-08-01' },
    evaluationCriteria: [{ id: 'criteria-1', label: 'Technical Compliance', weight: 70, notes: '', suggestedFor: ['goods'], subcriteria: ['Conformity to technical specifications'] }]
  },
  requirementRows: [],
  commercialItems: [{ id: 'kit-1', itemNo: '1', description: 'Diagnostic kit', quantity: 2, unit: 'Set', rate: 0, total: 0, payload: {} }]
};

const consultancyTender: TenderDetail = {
  ...supplierTender,
  id: 'consultancy-tender-1',
  reference: 'PX-CNS-2026-014',
  title: 'Procurement advisory services',
  organization: 'ProcureX Marketplace Test Buyer Authority',
  ownerOrganization: 'ProcureX Marketplace Test Buyer Authority',
  buyerLogoUrl: '/api/procurement/tenders/consultancy-tender-1/buyer-logo',
  type: 'CONSULTANCY',
  category: 'Consultancy Services',
  categories: ['Consultancy Services'],
  budget: 120000000,
  closingDate: '2099-10-15',
  location: 'Dar es Salaam',
  description: 'Terms of reference for procurement advisory services.',
  requirements: {
    consultancyRequirements: {
      entityBackgroundCards: [{ id: 'bg-1', organizationBackground: 'Public buyer responsible for marketplace oversight.', departmentUnit: 'Procurement Management Unit' }],
      projectName: 'Procurement capacity diagnostic',
      backgroundNarrative: 'Review current procurement operations and controls.',
      existingChallenges: 'Manual reviews delay tender publication.',
      currentSituation: 'Several workflows are being digitized.',
      relatedInitiatives: 'National e-procurement strengthening program.',
      mainProblemDescription: 'The buyer needs an independent diagnostic of process gaps.',
      expectedImpact: 'Improve procurement oversight and response time.',
      generalObjective: 'Improve regional procurement performance.',
      specificObjectiveRows: [{ id: 'obj-1', objectiveTitle: 'Assess current workflows', objectiveDescription: 'Document gaps and bottlenecks.', priorityLevel: 'High' }],
      assignmentActivityRows: [{ id: 'act-1', activityTitle: 'Stakeholder interviews', detailedDescription: 'Interview procurement and user departments.', expectedOutput: 'Interview summary', location: 'Dodoma', duration: '10' }],
      outOfScopeActivities: 'Software implementation is not part of this assignment.',
      clientResponsibilityRows: [{ id: 'client-1', title: 'Provide records', description: 'Give the consultant access to tender files.', supportType: 'Document access' }],
      consultantResponsibilityRows: [{ id: 'consultant-1', title: 'Submit analysis', description: 'Prepare evidence-based findings.', supportType: 'Weekly', reportingFrequency: 'Weekly' }],
      deliverableRows: [{ id: 'del-1', deliverableName: 'Inception report', description: 'Initial approach and work plan.', submissionTimeline: '2 weeks', formatRequired: 'PDF', reviewer: 'Procurement portal', submissionChannel: 'Procurement portal', mandatory: true }],
      reportingRequirementRows: [{ id: 'rep-1', reportType: 'Monthly report', frequency: 'Monthly', submissionFormat: 'PDF', submissionChannel: 'Email' }],
      individualProfessionalCertifications: ['PMP'],
      individualCvRequired: 'Required',
      individualYearsExperience: '7',
      individualSimilarAssignmentsCount: '3',
      individualSimilarAssignmentsEvidenceRequired: 'Required',
      firmMinimumYearsExperience: '5',
      firmRequiredSimilarAssignments: '4',
      firmSectorExperience: ['Public sector'],
      firmRequiredEvidence: 'Required',
      keyExpertRows: [{ id: 'expert-1', positionTitle: 'Procurement specialist', minimumQualification: 'Masters Degree', yearsOfExperience: '8', certifications: 'PMP', quantityRequired: '1', mandatory: true }],
      consultantReportsTo: 'Project Manager',
      supervisingOfficer: 'Supervising Officer',
      approvalAuthority: 'Accounting Officer',
      meetingFrequency: 'Monthly',
      coordinationMechanism: 'Steering committee reviews each milestone.',
      communicationMethods: ['Email', 'Procurement portal'],
      officeSpaceProvided: true,
      accessToFacilities: true,
      accessToDocuments: true,
      supportingDocumentRows: [{ id: 'doc-row-1', documentTitle: 'Baseline study', category: 'Baseline studies', uploadName: 'Baseline study.pdf', confidential: false }],
      externalReferenceRows: [{ id: 'ref-1', referenceName: 'PPRA guidelines', description: 'Public procurement guidance', url: 'https://www.ppra.go.tz' }]
    },
    financialRequirements: [{ id: 'fin-1', requirementType: 'Audited Financial Statements', minimumValue: '3 years', period: 'Last 3 Years', evidenceRequired: 'Audited accounts', mandatory: true }],
    regulatoryLicenseRequirements: [{ id: 'lic-1', license: 'Professional registration', body: 'Professional body', mandatory: true, expiryRequired: true }]
  },
  metadata: {
    contact: { name: 'Consultancy Officer', phone: '+255 700 000 001' },
    fundingSource: 'Development partner grant',
    publication: { openingDate: '2099-08-01' },
    method: 'Open Tender',
    evaluationCriteria: [{ id: 'criteria-1', label: 'Methodology and Work Plan', weight: 60, notes: '', suggestedFor: ['consultancy'], subcriteria: ['Understanding of TOR', 'Work plan realism'] }]
  },
  requirementRows: [],
  commercialItems: [],
  documents: [
    {
      id: 'doc-consultancy-1',
      name: 'Baseline study.pdf',
      documentType: 'TENDER_DOCUMENT',
      label: 'Baseline study',
      openUrl: '/api/procurement/tenders/consultancy-tender-1/documents/doc-consultancy-1/open',
      downloadUrl: '/api/procurement/tenders/consultancy-tender-1/documents/doc-consultancy-1/download'
    }
  ]
};

describe('SupplierTenderDetailProcurexPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    html2PdfMock.worker.set.mockReturnValue(html2PdfMock.worker);
    html2PdfMock.worker.from.mockReturnValue(html2PdfMock.worker);
    html2PdfMock.worker.outputPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the procurex-ui style supplier tender detail for backend tenders', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(supplierTender);

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=tender-2']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByRole('heading', { name: 'Office renovation works' })).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Start Bid' }).some((link) => link.getAttribute('href') === '/bidding?tenderId=tender-2')).toBe(true);
    expect(screen.getByRole('button', { name: 'Open Document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Document' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Tender' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Ask for Clarification' }).some((link) => link.getAttribute('href')?.includes('/communication?'))).toBe(true);
    expect(screen.queryByText('Mandatory before bid')).not.toBeInTheDocument();
    expect(screen.queryByText('Additional responses')).not.toBeInTheDocument();
    expect(screen.queryByText('Time remaining')).not.toBeInTheDocument();
    expect(screen.queryByText('Jump to')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for Clarification' })).toHaveAttribute('href', expect.stringContaining('/communication?view=compose&mode=clarification'));
    expect(screen.getByRole('tab', { name: 'Procurement details', selected: true })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Clarification and buyer notice' })).toBeInTheDocument();
    expect(screen.getByLabelText('Works tender summary')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scope of Work' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Main Activities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Technical Specifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Drawings and Design Documents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bill of Quantities' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Time Schedule and Milestones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Site Visit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Technical Capacity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Capacity Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regulatory License Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evaluation Criteria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Customer Information' })).not.toBeInTheDocument();
    expect(screen.getByText('Renovate regional office workspaces')).toBeInTheDocument();
    expect(screen.getAllByText('Partition works').length).toBeGreaterThan(0);
    expect(screen.getByText('Renovation tender document')).toBeInTheDocument();
    expect(screen.getByText('Contractor registration certificate')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Buyer notice' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Clarification and buyer notice' }));

    expect(screen.getByRole('tab', { name: 'Clarification and buyer notice', selected: true })).toBeInTheDocument();
    expect(screen.queryByText('Clarification deadline')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Buyer notice' })).toBeInTheDocument();
    expect(screen.getByText('Please use Gate B for the mandatory site visit.')).toBeInTheDocument();
  });

  it('uses the goods procurement document format for marketplace tender details', async () => {
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(goodsTender);

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=goods-tender-1']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByRole('heading', { name: 'Supply diagnostic kits' })).toHaveLength(2);
    expect(screen.getByLabelText('Goods tender summary')).toBeInTheDocument();
    expect(screen.getByAltText('Medical Stores Department logo')).toHaveAttribute('src', '/api/procurement/tenders/goods-tender-1/buyer-logo');
    expect(screen.getByRole('heading', { name: 'Goods Details' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product Specifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sample Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Capacity Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Eligibility Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evaluation Criteria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Customer Information' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Diagnostic kit').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2 Set').length).toBeGreaterThan(0);
    expect(screen.getByText('Shelf life')).toBeInTheDocument();
    expect(screen.getByText('At least 18 months')).toBeInTheDocument();
    expect(screen.getByText('Sealed sample kit')).toBeInTheDocument();
    expect(screen.getByText('MSD Dodoma')).toBeInTheDocument();
    expect(screen.getByText('Access to Credit')).toBeInTheDocument();
    expect(screen.getByText('10000000')).toBeInTheDocument();
    expect(screen.getByText('Tax clearance certificate')).toBeInTheDocument();
    expect(screen.getByText('Medical Devices Registration Permit')).toBeInTheDocument();
    expect(screen.getByText('Technical Compliance')).toBeInTheDocument();
    expect(screen.getByText(/Conformity to technical specifications/)).toBeInTheDocument();
    expect(screen.getByText('Procurement Method')).toBeInTheDocument();
    expect(screen.getByText(/\+255 700 000 009/)).toBeInTheDocument();
  });

  it('uses the consultancy procurement TOR document format for marketplace tender details', async () => {
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(consultancyTender);

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=consultancy-tender-1']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    expect(await screen.findAllByRole('heading', { name: 'Procurement advisory services' })).toHaveLength(2);
    expect(screen.getByLabelText('Consultancy tender summary')).toBeInTheDocument();
    expect(screen.getByAltText('ProcureX Marketplace Test Buyer Authority logo')).toHaveAttribute('src', '/api/procurement/tenders/consultancy-tender-1/buyer-logo');
    expect(screen.getByText('TERMS OF REFERENCE')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Objectives of the Consultancy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Scope of Consultancy Services' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Duties and Responsibilities of the Parties' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deliverables and Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Required Qualifications and Experience' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Institutional and Organizational Arrangements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Attachments and Reference Documents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /External References/ })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evaluation Criteria' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Amendments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Customer Information' })).not.toBeInTheDocument();
    expect(screen.queryByText('Document Metadata')).not.toBeInTheDocument();
    expect(screen.getByText('Improve regional procurement performance.')).toBeInTheDocument();
    expect(screen.getByText('Stakeholder interviews')).toBeInTheDocument();
    expect(screen.getByText('Interview summary')).toBeInTheDocument();
    expect(screen.getByText('Procurement specialist')).toBeInTheDocument();
    expect(screen.getByText('Inception report')).toBeInTheDocument();
    expect(screen.getAllByText('Procurement portal').length).toBeGreaterThan(0);
    expect(screen.getByText('Audited Financial Statements')).toBeInTheDocument();
    expect(screen.getByText('Professional registration')).toBeInTheDocument();
    expect(screen.getByText('Baseline study.pdf')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'https://www.ppra.go.tz' })).toHaveAttribute('href', 'https://www.ppra.go.tz/');
    expect(screen.getByText('Methodology and Work Plan')).toBeInTheDocument();
    expect(screen.getByText(/Understanding of TOR/)).toBeInTheDocument();
    expect(screen.getByText('Funding Source')).toBeInTheDocument();
    expect(screen.getByText('Development partner grant')).toBeInTheDocument();
    expect(screen.queryByText('Submission Deadline')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'View' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Download' }).length).toBeGreaterThan(0);
  });

  it('builds the consultancy fallback PDF from the official TOR model', () => {
    const html = buildTenderPackPdfHtml(consultancyTender);

    expect(generatedTenderPackFilename(consultancyTender)).toBe('Tender_PX-CNS-2026-014_Consultancy.pdf');
    expect(html).toContain('TERMS OF REFERENCE');
    expect(html).toContain('Tender Summary');
    expect(html).toContain('Scope of Consultancy Services');
    expect(html).toContain('Attachments and Reference Documents');
    expect(html).toContain('Evaluation Criteria');
    expect(html).toContain('Baseline study.pdf');
    expect(html).toContain('https://www.ppra.go.tz/');
    expect(html).not.toContain('ProcureX Tender Pack');
    expect(html).not.toContain('Document Metadata');
    expect(html).not.toContain('<button');
  });

  it('downloads a consolidated tender pack PDF from the main supplier action', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(supplierTender);
    const download = mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get');

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=tender-2']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    await screen.findAllByRole('heading', { name: 'Office renovation works' });
    await user.click(screen.getByRole('button', { name: 'Download Document' }));

    expect(getDocument).not.toHaveBeenCalled();
    await waitFor(() => expect(html2PdfMock.worker.set).toHaveBeenCalledWith(expect.objectContaining({ filename: 'PX-2026-002-tender-pack.pdf' })));
    expect(pdfSourceText()).toContain('Complete works in phases');
    expect(pdfSourceText()).toContain('Contractor registration certificate');
    expect(pdfSourceText()).toContain('Methodology');
    expect(pdfSourceText()).toContain('Site visit');
    expect(pdfSourceText()).toContain('Partition works');
    expect(pdfSourceText()).toContain('Renovation tender document');
    expect(download.downloads.at(-1)).toBe('PX-2026-002-tender-pack.pdf');
    expect(download.blobs.at(-1)?.type).toBe('application/pdf');
  });

  it('downloads backend documents from supplier document cards', async () => {
    const user = userEvent.setup();
    vi.spyOn(procurementApi, 'getTenderDetail').mockResolvedValue(supplierTender);
    const download = mockBrowserDownload();
    const getDocument = vi.spyOn(apiClient, 'get').mockResolvedValue({
      data: new Blob(['pdf'], { type: 'application/pdf' }),
      headers: { 'content-disposition': 'attachment; filename="Renovation tender document.pdf"' }
    });

    render(
      <MemoryRouter initialEntries={['/procurement/supplier-tender-detail?tenderId=tender-2']}>
        <SupplierTenderDetailProcurexPage />
      </MemoryRouter>
    );

    await screen.findByText('Renovation tender document');
    await user.click(screen.getByRole('button', { name: 'Download' }));

    expect(getDocument).toHaveBeenCalledWith('/api/procurement/tenders/tender-2/documents/doc-1/download', { responseType: 'blob' });
    expect(download.downloads.at(-1)).toBe('Renovation tender document.pdf');
  });
});

function pdfSourceText() {
  const source = html2PdfMock.worker.from.mock.calls.at(-1)?.[0] as HTMLElement | undefined;
  return source?.textContent ?? '';
}

function mockBrowserDownload() {
  const downloads: string[] = [];
  const blobs: Blob[] = [];
  const originalCreateElement = document.createElement.bind(document);

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn((blob: Blob) => {
      blobs.push(blob);
      return `blob:procurex-${blobs.length}`;
    })
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn()
  });

  vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
    const element = originalCreateElement(tagName, options);
    if (tagName.toLowerCase() === 'a') {
      Object.defineProperty(element, 'click', { configurable: true, value: vi.fn() });
      Object.defineProperty(element, 'download', {
        configurable: true,
        get: () => downloads.at(-1) ?? '',
        set: (value: string) => {
          downloads.push(value);
        }
      });
    }
    return element;
  });

  return { blobs, downloads };
}
