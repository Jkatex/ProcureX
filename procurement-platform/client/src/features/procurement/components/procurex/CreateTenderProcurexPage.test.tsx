import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as XLSX from 'xlsx';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import '@/i18n';
import { store } from '@/app/store';
import { procurexTheme } from '@/styles/mui-theme';
import { resetCreateTenderDrafts } from '../../slice';
import { MarketplaceProcurexPage } from './MarketplaceProcurexPage';
import { CreateTenderProcurexPage } from './CreateTenderProcurexPage';

const procurementApiMock = vi.hoisted(() => ({
  createTender: vi.fn(),
  updateTender: vi.fn(),
  publishTender: vi.fn(),
  getMarketplace: vi.fn(),
  getTenderDetail: vi.fn(),
  saveTender: vi.fn(),
  unsaveTender: vi.fn()
}));

const communicationApiMock = vi.hoisted(() => ({
  listRecipients: vi.fn()
}));

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

vi.mock('../../api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../api')>();
  return {
    ...actual,
    procurementApi: {
      ...actual.procurementApi,
      ...procurementApiMock
    }
  };
});

vi.mock('@/features/communication/api', () => ({
  communicationApi: communicationApiMock
}));

vi.mock('html2pdf.js', () => ({
  default: html2PdfMock.factory
}));

const defaultSubmissionDeadline = dateDaysFromNow(37);
const defaultOpeningDate = dateDaysFromNow(38);

function dateDaysFromNow(days: number) {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

function renderCreateTender(route = '/procurement/create-tender') {
  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter initialEntries={[route]}>
          <CreateTenderProcurexPage />
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

function renderWithRoutes() {
  procurementApiMock.getMarketplace.mockResolvedValue(emptyMarketplaceResponse());

  return render(
    <Provider store={store}>
      <ThemeProvider theme={procurexTheme}>
        <MemoryRouter initialEntries={['/procurement/create-tender']}>
          <Routes>
            <Route path="/procurement/create-tender" element={<CreateTenderProcurexPage />} />
            <Route path="/procurement/my-tenders" element={<MarketplaceProcurexPage />} />
            <Route path="/procurement/marketplace" element={<MarketplaceProcurexPage />} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>
    </Provider>
  );
}

async function fillBasicStep(user: ReturnType<typeof userEvent.setup>, title = 'Regional ICT Support Framework') {
  fireEvent.change(screen.getByLabelText('Tender title'), { target: { value: title } });
  await user.selectOptions(screen.getByLabelText('Funding source'), 'Government budget');
  fireEvent.change(screen.getByLabelText('Delivery Point'), { target: { value: 'Dodoma' } });
  fireEvent.change(screen.getByLabelText('Submission deadline'), { target: { value: defaultSubmissionDeadline } });
  fireEvent.change(screen.getByLabelText('Estimated budget'), { target: { value: '250000000' } });
  fireEvent.change(screen.getByLabelText('Opening date'), { target: { value: defaultOpeningDate } });
  fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'procurement@example.go.tz' } });
}

async function addDefaultCategory(user: ReturnType<typeof userEvent.setup>, category = 'Medical equipment') {
  await user.clear(screen.getByLabelText('Category'));
  await user.type(screen.getByLabelText('Category'), category);
  await user.click(await screen.findByRole('button', { name: category }));
}

async function completeMinimumGoodsRequirements(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
  await user.click(screen.getByRole('button', { name: 'Add Item' }));
  await user.type(screen.getByLabelText('Item 1 description'), 'Laptop computer');
  await user.selectOptions(screen.getByLabelText('Item 1 unit'), 'Pcs');
  await user.type(screen.getByLabelText('Item 1 quantity'), '5');
  await user.click(screen.getByRole('button', { name: 'Add Specification' }));
  await user.type(screen.getByLabelText('Specification name'), 'Processor');
  await user.type(screen.getByLabelText('Specific detail required'), 'Core i5 or above');
  await user.click(screen.getByRole('button', { name: 'Save Specification' }));
}

function emptyMarketplaceResponse() {
  return {
    tenders: [],
    myTenders: [],
    myBids: [],
    summary: {},
    pagination: { page: 1, limit: 20, matching: 0, totalPages: 0, hasNextPage: false, hasPreviousPage: false }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  store.dispatch(resetCreateTenderDrafts());
  window.localStorage.clear();
  html2PdfMock.worker.set.mockReturnValue(html2PdfMock.worker);
  html2PdfMock.worker.from.mockReturnValue(html2PdfMock.worker);
  html2PdfMock.worker.outputPdf.mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
  procurementApiMock.createTender.mockResolvedValue({
    success: true,
    message: 'Tender draft saved successfully',
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      reference: 'PX-GDS-2026-001',
      title: 'Backend Tender',
      status: 'Draft',
      type: 'Goods',
      createdAt: '2026-07-01T08:00:00.000Z'
    },
    validation: { warnings: [], missingRequiredFields: [], schemaVersion: 'procurement-design-v1' }
  });
  procurementApiMock.updateTender.mockResolvedValue({
    success: true,
    message: 'Tender updated successfully',
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      reference: 'PX-GDS-2026-001',
      title: 'Backend Tender',
      status: 'Draft',
      updatedAt: '2026-07-01T08:30:00.000Z'
    },
    validation: { warnings: [], missingRequiredFields: [], schemaVersion: 'procurement-design-v1' }
  });
  procurementApiMock.publishTender.mockResolvedValue({
    success: true,
    message: 'Tender submitted for admin review',
    data: {
      id: '11111111-1111-4111-8111-111111111111',
      reference: 'PX-GDS-2026-001',
      title: 'Backend Tender',
      status: 'Under Review',
      visibility: 'PRIVATE',
      publishedAt: '',
      closingDate: defaultSubmissionDeadline
    },
    validation: { warnings: [], scannerIssues: [], standardizedCategories: ['Medical equipment'] }
  });
  procurementApiMock.getMarketplace.mockResolvedValue(emptyMarketplaceResponse());
  communicationApiMock.listRecipients.mockResolvedValue([
    { id: '22222222-2222-4222-8222-222222222222', name: 'Kilimanjaro Supplies Limited', kind: 'COMPANY', country: 'TZ', capabilities: ['SUPPLIER'] }
  ]);
});

function pdfSourceText() {
  const source = html2PdfMock.worker.from.mock.calls.at(-1)?.[0] as HTMLElement | undefined;
  return source?.textContent ?? '';
}

function mockBrowserDownload() {
  const downloads: string[] = [];
  const blobs: Blob[] = [];
  const click = vi.fn();
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
      Object.defineProperty(element, 'click', { configurable: true, value: click });
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

  return { blobs, click, downloads };
}

function spreadsheetFile(rows: unknown[][], fileName = 'import.xlsx') {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
  const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new File([data], fileName, { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('CreateTenderProcurexPage', () => {
  it('renders the six-step wizard and starts at Basic Information', () => {
    const { container } = renderCreateTender();

    expect(screen.getByRole('heading', { name: 'Create Tender Wizard' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Basic Information' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Procurement Planning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tender Review and Publication').length).toBeGreaterThan(0);
    expect(container.querySelector('.wizard-shell')).toBeInTheDocument();
    expect(container.querySelector('.wizard-rail')).toBeInTheDocument();
    expect(container.querySelector('.hero-action-stack .save-draft-button')).toBeInTheDocument();
    expect(container.querySelector('.journey-panel')).toBeInTheDocument();
    expect(container.querySelector('.journey-panel-content .planning-section')).toBeInTheDocument();
    expect(container.querySelector('.wizard-progress-step.active')).toHaveTextContent('Basic Information');
    expect(screen.getByRole('button', { name: 'Save Draft' })).toHaveClass('save-draft-button');
    expect(screen.getByRole('button', { name: 'Save Draft' })).toBeDisabled();
  });

  it('step navigation updates the active panel', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);

    expect(screen.getByRole('heading', { name: 'Procurement Planning' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Basic Information' })).not.toBeInTheDocument();

    const procurementMethod = screen.getByLabelText('Procurement method') as HTMLSelectElement;
    expect(Array.from(procurementMethod.options).map((option) => option.textContent)).toEqual(['Open Tender', 'Invited Tender']);
  });

  it('renders prototype Basic Information contact grid and tender details', () => {
    renderCreateTender();

    expect(screen.getByLabelText('Delivery Point')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact person or department')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact phone number')).toBeInTheDocument();
    expect(screen.getByLabelText('Contact email')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tender details' })).toBeInTheDocument();
    expect(screen.getByLabelText('Tender title')).toBeInTheDocument();
    expect(screen.getByLabelText('Funding source')).toBeInTheDocument();
    expect(screen.getByLabelText('Submission deadline')).toBeInTheDocument();
    expect(screen.getByLabelText('Estimated budget')).toBeInTheDocument();
    expect(screen.getByLabelText('Opening date')).toBeInTheDocument();
    expect(screen.queryByLabelText('Procuring entity')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Basic information preview')).not.toBeInTheDocument();
  });

  it('reveals a custom funding source field when Other is selected', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.selectOptions(screen.getByLabelText('Funding source'), 'Other');

    expect(screen.getByLabelText('Custom funding source')).toBeInTheDocument();
  });

  it('keeps Submission deadline and Opening date independent', () => {
    renderCreateTender();

    const laterOpeningDate = dateDaysFromNow(42);
    fireEvent.change(screen.getByLabelText('Opening date'), { target: { value: laterOpeningDate } });
    fireEvent.change(screen.getByLabelText('Submission deadline'), { target: { value: defaultSubmissionDeadline } });

    expect(screen.getByLabelText('Submission deadline')).toHaveValue(defaultSubmissionDeadline);
    expect(screen.getByLabelText('Opening date')).toHaveValue(laterOpeningDate);
  });

  it('updates frontend-only contact verification badges', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.type(screen.getByLabelText('Contact email'), 'buyer@example.go.tz');
    await user.type(screen.getByLabelText('Contact phone number'), '+255700000001');
    await user.click(screen.getByRole('button', { name: 'Verify Email' }));
    await user.click(screen.getByRole('button', { name: 'Verify Phone' }));

    expect(screen.getByText('Email verified')).toBeInTheDocument();
    expect(screen.getByText('Phone verified')).toBeInTheDocument();
    expect(screen.getByText('Contact verified')).toBeInTheDocument();
  });

  it('blocks Continue until minimum Basic Information fields are complete', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);

    expect(screen.getByText('Add a tender title with at least 5 characters before continuing.')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Basic Information' }).length).toBeGreaterThan(0);

    await fillBasicStep(user, 'Validated Basic Information Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);

    expect(screen.getByRole('heading', { name: 'Procurement Planning' })).toBeInTheDocument();
  });

  it('procurement type changes swap visible requirement sections', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    expect(screen.getByRole('heading', { name: 'Procurement classification' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Non Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    expect(screen.getByRole('heading', { name: 'Service Tender Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Definition' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Quantity Schedule and Product Specifications' })).not.toBeInTheDocument();
  });

  it('renders and manages Non Consultancy service requirements like the ProcureX reference', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Non Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    expect(screen.getByRole('heading', { name: 'Service Tender Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Definition' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bill of Quantities (BOQ)' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Capacity Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Personnel Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Environmental and Social Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Supporting Documents' })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Scope of services'), { target: { value: 'Provide round-the-clock facility security.' } });
    await user.click(screen.getByRole('button', { name: 'Add Service Location' }));
    fireEvent.change(screen.getByLabelText('Service locations 1'), { target: { value: 'Head office' } });

    await user.click(screen.getByRole('button', { name: 'Add BOQ Line' }));
    fireEvent.change(screen.getByLabelText('Service BOQ description 1'), { target: { value: 'Security guard services' } });
    await user.selectOptions(screen.getByLabelText('Service BOQ unit 1'), 'Month');
    fireEvent.change(screen.getByLabelText('Service BOQ quantity 1'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Service BOQ rate 1'), { target: { value: '500000' } });
    expect(screen.getByText('6,000,000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Personnel Requirement' }));
    fireEvent.change(screen.getByLabelText('Personnel position 1'), { target: { value: 'Security supervisor' } });
    await user.selectOptions(screen.getByLabelText('Minimum education 1'), 'Diploma');
    fireEvent.change(screen.getByLabelText('Personnel experience 1'), { target: { value: '5' } });

    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Access to Credit');
    fireEvent.change(screen.getByLabelText('Minimum value 1'), { target: { value: '50000000' } });

    await user.selectOptions(screen.getByLabelText('Service category'), 'Security');
    expect(screen.getByRole('heading', { name: 'Security Service Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Equipment Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Insurance Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Risk and Safety Requirements' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Number of guards'), { target: { value: '8' } });

    await user.click(screen.getByRole('button', { name: 'Add Equipment' }));
    fireEvent.change(screen.getByLabelText('Equipment name 1'), { target: { value: 'Radio handset' } });
    await user.selectOptions(screen.getByLabelText('Ownership type 1'), 'Owned');

    await user.click(screen.getByRole('button', { name: 'Add ES Requirement' }));
    await user.selectOptions(screen.getByLabelText('ES category 1'), 'Worker safety');
    fireEvent.change(screen.getByLabelText('ES description 1'), { target: { value: 'Provide safety induction before deployment.' } });

    await user.click(screen.getByRole('button', { name: 'Add Required Document' }));
    fireEvent.change(screen.getByLabelText('Supporting document 1'), { target: { value: 'Valid service provider license' } });

    await user.click(screen.getAllByRole('button', { name: /Review Tender/ })[0]);

    expect(screen.getByRole('heading', { name: 'Service definition' })).toBeInTheDocument();
    expect(screen.getByText('Head office')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Service Commercial Schedule' })).toBeInTheDocument();
    expect(screen.getByText('Security guard services')).toBeInTheDocument();
    expect(screen.getByText(/Security supervisor - Diploma - 5 years/)).toBeInTheDocument();
    expect(screen.getByText(/Access to Credit - minimum 50000000/)).toBeInTheDocument();
    expect(screen.getByText(/Valid service provider license/)).toBeInTheDocument();
  }, 10000);

  it('adds regulatory license requirements at the bottom of Non Consultancy tender requirements', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Non Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    await user.selectOptions(screen.getByLabelText('Service category'), 'Security');
    expect(screen.getByRole('heading', { name: 'Risk and Safety Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regulatory license requirements' })).toBeInTheDocument();

    const licensePanel = document.querySelector('.license-requirements-panel');
    expect(licensePanel?.querySelector(':scope > .scope-list-heading > button')).toHaveTextContent('Add License Requirement');

    const bodyText = document.body.textContent ?? '';
    expect(bodyText.indexOf('Regulatory license requirements')).toBeGreaterThan(bodyText.indexOf('Risk and Safety Requirements'));

    expect(screen.getByText('No regulatory license requirements added yet.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add License Requirement' }));
    await user.type(screen.getByLabelText('Search all regulatory licenses'), 'Content Services');
    await user.click(screen.getByRole('option', { name: /Content Services License/ }));

    expect(screen.getByText('Content Services License')).toBeInTheDocument();
    expect(screen.getByText('Tanzania Communications Regulatory Authority (TCRA)')).toBeInTheDocument();
    expect(screen.getByLabelText('Content Services License Mandatory')).toBeChecked();

    await user.click(screen.getByLabelText('Content Services License Mandatory'));
    expect(screen.getByLabelText('Content Services License Mandatory')).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.type(screen.getByLabelText('Search regulatory license'), 'Electronic Communications');
    await user.click(screen.getByRole('option', { name: /Electronic Communications Service License/ }));

    expect(screen.queryByText('Content Services License')).not.toBeInTheDocument();
    expect(screen.getByText('Electronic Communications Service License')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove license requirement' }));
    expect(screen.queryByText('Electronic Communications Service License')).not.toBeInTheDocument();
    expect(screen.getByText('No regulatory license requirements added yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add License Requirement' }));
    await user.type(screen.getByLabelText('Search all regulatory licenses'), 'Environmental Compliance');
    await user.click(screen.getByRole('option', { name: /Environmental Compliance Certificate/ }));

    await user.click(screen.getAllByRole('button', { name: /Review Tender/ })[0]);

    expect(screen.getByRole('heading', { name: 'Regulatory license requirements' })).toBeInTheDocument();
    expect(screen.getByText('Environmental Compliance Certificate')).toBeInTheDocument();
    expect(screen.getByText('National Environment Management Council (NEMC)')).toBeInTheDocument();
  }, 10000);

  it('renders and manages Consultancy TOR requirements like the ProcureX reference', async () => {
    const user = userEvent.setup();
    const { container } = renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /^Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    expect(screen.getByRole('heading', { name: 'Consultancy Procurement TOR' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Introduction' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Objectives of the Consultancy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Scope of Consultancy Services' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4. Duties and Responsibilities of the Parties' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '5. Deliverables and Timeline' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '6. Required Qualifications and Experience' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '7. Institutional and Organizational Arrangements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '8. Attachments and Reference Documents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regulatory license requirements' })).toBeInTheDocument();
    expect(container.querySelector('.consultancy-requirements-step')).toBeInTheDocument();
    expect(container.querySelector('.consultancy-tor-workspace')).toBeInTheDocument();
    expect(container.querySelector('.consultancy-tor-header')).toBeInTheDocument();
    expect(container.querySelector('.requirement-section-grid')).toBeInTheDocument();
    expect(container.querySelectorAll('.consultancy-requirements-step .requirement-block').length).toBeGreaterThanOrEqual(8);
    const introductionBlock = container.querySelector('#requirement-section-consultancyIntroduction');
    expect(introductionBlock).toBeInTheDocument();
    expect(within(introductionBlock as HTMLElement).getByRole('heading', { name: '1. Introduction' })).toBeInTheDocument();
    const entityBackgroundControl = within(introductionBlock as HTMLElement).getByText('1.1 Procuring Entity Background').closest('.requirement-control');
    expect(entityBackgroundControl).toBeInTheDocument();
    expect(within(entityBackgroundControl as HTMLElement).getByRole('button', { name: 'Add Entity Background' })).toBeInTheDocument();
    expect(entityBackgroundControl?.querySelector('.scope-empty')).toHaveTextContent('No procuring entity background captured yet.');
    const projectBackgroundControl = within(introductionBlock as HTMLElement).getByText('1.2 Project Background').closest('.requirement-control');
    expect(projectBackgroundControl).toBeInTheDocument();
    expect(projectBackgroundControl?.querySelector('.form-label')).toHaveTextContent('1.2 Project Background');
    expect(projectBackgroundControl?.querySelectorAll('.requirement-accordion-item')).toHaveLength(5);
    ['Project Name', 'Background Narrative', 'Existing Challenges', 'Current Situation', 'Related Initiatives'].forEach((label) => {
      expect(within(projectBackgroundControl as HTMLElement).getByText(label)).toBeInTheDocument();
    });
    const projectNameRow = within(projectBackgroundControl as HTMLElement).getByText('Project Name').closest('details');
    expect(projectNameRow).toHaveAttribute('open');
    fireEvent.change(screen.getByLabelText('Project Name'), { target: { value: 'Procurement capacity diagnostic' } });
    expect(screen.getByLabelText('Project Name')).toHaveValue('Procurement capacity diagnostic');

    fireEvent.change(screen.getByLabelText('General Objective'), { target: { value: 'Improve regional procurement performance.' } });
    await user.click(screen.getByRole('button', { name: 'Add Objective' }));
    fireEvent.change(screen.getByLabelText('Objective Title 1'), { target: { value: 'Assess current workflows' } });
    fireEvent.change(screen.getByLabelText('Objective Description 1'), { target: { value: 'Document gaps and process bottlenecks.' } });
    await user.selectOptions(screen.getByLabelText('Priority Level 1'), 'High');

    await user.click(screen.getByRole('button', { name: 'Add Activity' }));
    fireEvent.change(screen.getByLabelText('Activity Title 1'), { target: { value: 'Stakeholder interviews' } });
    fireEvent.change(screen.getByLabelText('Expected Output 1'), { target: { value: 'Interview summary' } });
    fireEvent.change(screen.getByLabelText('Activity Location 1'), { target: { value: 'Dodoma' } });

    await user.click(screen.getByRole('button', { name: 'Add Deliverable' }));
    fireEvent.change(screen.getByLabelText('Deliverable Name 1'), { target: { value: 'Inception report' } });
    fireEvent.change(screen.getByLabelText('Submission Timeline 1'), { target: { value: '2 weeks' } });

    await user.click(screen.getByRole('button', { name: 'Add Key Personnel' }));
    fireEvent.change(screen.getByLabelText('Key Personnel Position Title 1'), { target: { value: 'Procurement specialist' } });
    await user.selectOptions(screen.getByLabelText('Key Personnel Minimum Qualification 1'), 'Masters Degree');
    fireEvent.change(screen.getByLabelText('Key Personnel Years of Experience 1'), { target: { value: '8' } });

    await user.click(screen.getByRole('button', { name: 'Add Supporting Document' }));
    fireEvent.change(screen.getByLabelText('Consultancy Document Title 1'), { target: { value: 'Existing procurement manual' } });
    await user.selectOptions(screen.getByLabelText('Consultancy Document Category 1'), 'Policy documents');

    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Consultancy requirement type 1'), 'Audited Financial Statements');
    fireEvent.change(screen.getByLabelText('Consultancy minimum value 1'), { target: { value: '3 years' } });

    await user.click(screen.getAllByRole('button', { name: /Review Tender/ })[0]);

    expect(screen.getByRole('heading', { name: 'Consultancy TOR introduction' })).toBeInTheDocument();
    expect(screen.getByText('Improve regional procurement performance.')).toBeInTheDocument();
    expect(screen.getByText(/Assess current workflows/)).toBeInTheDocument();
    expect(screen.getByText(/Stakeholder interviews/)).toBeInTheDocument();
    expect(screen.getByText(/Inception report/)).toBeInTheDocument();
    expect(screen.getByText(/Procurement specialist/)).toBeInTheDocument();
    expect(screen.getByText(/Existing procurement manual/)).toBeInTheDocument();
    expect(screen.getByText(/Audited Financial Statements - minimum 3 years/)).toBeInTheDocument();
  }, 10000);

  it('renders and manages works tender requirements like the ProcureX reference', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Works/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    expect(screen.getByRole('heading', { name: 'Works Tender Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '1. Project Overview' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '2. Scope Description' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '3. Technical Specifications' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '4. Drawings and Design Documents' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '5. Bill of Quantities (BoQ) / Pricing Schedule' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '6. Time Schedule and Milestones' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '7. Site Visit' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Technical Capacity' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Capacity Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regulatory license requirements' })).toBeInTheDocument();

    const bodyText = document.body.textContent ?? '';
    expect(bodyText.indexOf('Regulatory license requirements')).toBeGreaterThan(bodyText.indexOf('Financial Capacity Requirements'));

    fireEvent.change(screen.getByLabelText('Project title'), { target: { value: 'Ward office construction' } });
    fireEvent.change(screen.getByLabelText('Procuring entity'), { target: { value: 'District Council' } });
    fireEvent.change(screen.getByLabelText('Project location'), { target: { value: 'Kigoma' } });
    await user.selectOptions(screen.getByLabelText('Contract type'), 'Other');
    expect(screen.getByLabelText('Custom contract type')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Custom contract type'), { target: { value: 'Design and build' } });
    await user.selectOptions(screen.getByLabelText('Contract type'), 'Lump Sum Contract');
    expect(screen.getByText('A single total price is agreed for the whole work or project.')).toBeInTheDocument();

    const scope = 'Construct ward clinic block';
    fireEvent.change(screen.getByLabelText('Scope Summary'), { target: { value: scope } });
    expect(screen.getByText(`${scope.length}/1000`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '+ Add Activity' }));
    fireEvent.change(screen.getByLabelText('Main Activities item 1'), { target: { value: 'Foundation works' } });
    await user.click(screen.getByRole('button', { name: '+ Add Activity' }));
    await user.click(screen.getByRole('button', { name: 'Remove Main Activities 2' }));
    expect(screen.queryByLabelText('Main Activities item 2')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Specification Document' }));
    await user.selectOptions(screen.getByLabelText('Document title 1'), 'Others');
    fireEvent.change(screen.getByLabelText('Custom specification document title 1'), { target: { value: 'Concrete mix standards' } });
    await user.upload(screen.getByLabelText('Upload document 1'), new File(['spec'], 'technical-spec.pdf', { type: 'application/pdf' }));
    expect(screen.getByText('technical-spec.pdf')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Drawing' }));
    await user.selectOptions(screen.getByLabelText('Document type 1'), 'Other');
    fireEvent.change(screen.getByLabelText('Other document name 1'), { target: { value: 'Site layout' } });
    await user.upload(screen.getByLabelText('CAD / PDF upload 1'), new File(['drawing'], 'site-layout.dwg', { type: 'application/octet-stream' }));
    expect(screen.getByText('site-layout.dwg')).toBeInTheDocument();

    expect(screen.getByText('Summary pricing schedule')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Pricing Section' }));
    fireEvent.change(screen.getByLabelText('Section 1'), { target: { value: 'Preliminaries' } });
    fireEvent.change(screen.getByLabelText('Description 1'), { target: { value: 'Mobilization and site setup' } });
    fireEvent.change(screen.getByLabelText('Amount 1'), { target: { value: '1000000' } });

    await user.click(screen.getByRole('button', { name: 'Add BOQ Line' }));
    fireEvent.change(screen.getByLabelText('BOQ description 1'), { target: { value: 'Concrete works' } });
    await user.selectOptions(screen.getByLabelText('BOQ unit 1'), 'Sqm');
    fireEvent.change(screen.getByLabelText('BOQ quantity 1'), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText('BOQ rate 1'), { target: { value: '2500' } });
    expect(screen.getByText('25,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add BOQ Line' }));
    await user.click(screen.getByRole('button', { name: 'Remove BOQ line 2' }));
    expect(screen.queryByLabelText('BOQ description 2')).not.toBeInTheDocument();

    expect(screen.getByRole('radio', { name: 'Not mandatory' })).toBeChecked();
    expect(screen.getByLabelText('Upload Site survey')).toBeInTheDocument();
    await user.upload(screen.getByLabelText('Upload Site survey'), new File(['survey'], 'site-visit-survey.pdf', { type: 'application/pdf' }));
    expect(screen.getByText('site-visit-survey.pdf')).toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Mandatory' }));
    expect(screen.queryByLabelText('Upload Site survey')).not.toBeInTheDocument();
    expect(screen.queryByText('site-visit-survey.pdf')).not.toBeInTheDocument();

    expect(screen.queryByLabelText('Bank statement period')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Bank statements'));
    expect(screen.getByLabelText('Bank statement period')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Bank statement period'), { target: { value: 'Submit statements for the last 6 months.' } });

    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Minimum Annual Turnover');
    fireEvent.change(screen.getByLabelText('Minimum value 1'), { target: { value: '500000000' } });
    await user.selectOptions(screen.getByLabelText('Period 1'), 'Last 3 Years');
    await user.selectOptions(screen.getByLabelText('Evidence required 1'), 'Audited accounts');
  }, 20000);

  it('manages works regulatory license requirements with the prototype picker', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Works/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    expect(screen.getByText('No regulatory license requirements added yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add License Requirement' }));
    await user.type(screen.getByLabelText('Search all regulatory licenses'), 'Building Permit');
    await user.click(screen.getByRole('option', { name: /Building Permit/ }));

    expect(screen.getByText('Building Permit')).toBeInTheDocument();
    expect(screen.getByText('Contractors Registration Board (CRB) and Local Government Authorities')).toBeInTheDocument();
    expect(screen.getByLabelText('Building Permit Mandatory')).toBeChecked();

    await user.click(screen.getByLabelText('Building Permit Mandatory'));
    expect(screen.getByLabelText('Building Permit Mandatory')).not.toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.type(screen.getByLabelText('Search regulatory license'), 'Environmental Impact');
    await user.click(screen.getByRole('option', { name: /Environmental Impact Assessment Certificate/ }));

    expect(screen.queryByText('Building Permit')).not.toBeInTheDocument();
    expect(screen.getByText('Environmental Impact Assessment Certificate')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove license requirement' }));
    expect(screen.queryByText('Environmental Impact Assessment Certificate')).not.toBeInTheDocument();
    expect(screen.getByText('No regulatory license requirements added yet.')).toBeInTheDocument();
  }, 10000);

  it('summarizes works requirements during review', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Works/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    fireEvent.change(screen.getByLabelText('Project title'), { target: { value: 'District market rehabilitation' } });
    fireEvent.change(screen.getByLabelText('Procuring entity'), { target: { value: 'Municipal Council' } });
    fireEvent.change(screen.getByLabelText('Project location'), { target: { value: 'Morogoro' } });
    await user.selectOptions(screen.getByLabelText('Contract type'), 'Lump Sum Contract');
    fireEvent.change(screen.getByLabelText('Scope Summary'), { target: { value: 'Rehabilitate market stalls and drainage.' } });
    await user.click(screen.getByRole('button', { name: '+ Add Activity' }));
    fireEvent.change(screen.getByLabelText('Main Activities item 1'), { target: { value: 'Drainage works' } });
    await user.click(screen.getByRole('button', { name: 'Add Specification Document' }));
    await user.selectOptions(screen.getByLabelText('Document title 1'), 'Material specifications');
    await user.upload(screen.getByLabelText('Upload document 1'), new File(['spec'], 'materials.pdf', { type: 'application/pdf' }));
    await user.click(screen.getByRole('button', { name: 'Add BOQ Line' }));
    fireEvent.change(screen.getByLabelText('BOQ description 1'), { target: { value: 'Drain channel' } });
    await user.selectOptions(screen.getByLabelText('BOQ unit 1'), 'Meter');
    fireEvent.change(screen.getByLabelText('BOQ quantity 1'), { target: { value: '20' } });
    fireEvent.change(screen.getByLabelText('BOQ rate 1'), { target: { value: '5000' } });
    expect(screen.getByText('100,000')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Access to Credit');
    fireEvent.change(screen.getByLabelText('Minimum value 1'), { target: { value: '250000000' } });
    await user.click(screen.getByRole('button', { name: 'Add License Requirement' }));
    await user.type(screen.getByLabelText('Search all regulatory licenses'), 'Building Permit');
    await user.click(screen.getByRole('option', { name: /Building Permit/ }));

    await user.click(screen.getAllByRole('button', { name: /Review Tender/ })[0]);

    expect(screen.getByRole('heading', { name: 'Tender requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Project overview' })).toBeInTheDocument();
    expect(screen.getByText('District market rehabilitation')).toBeInTheDocument();
    expect(screen.getByText('Municipal Council')).toBeInTheDocument();
    expect(screen.getByText('Morogoro')).toBeInTheDocument();
    expect(screen.getByText('Drainage works')).toBeInTheDocument();
    expect(screen.getByText('Material specifications - materials.pdf')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Bill of Quantities' })).toBeInTheDocument();
    expect(screen.getByText('Unpriced schedule')).toBeInTheDocument();
    expect(screen.getByText('Drain channel')).toBeInTheDocument();
    expect(screen.getByText(/Access to Credit - minimum 250000000/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regulatory license requirements' })).toBeInTheDocument();
    expect(screen.getByText('Building Permit')).toBeInTheDocument();
  }, 10000);

  it('renders goods tender requirements with a BOQ table and product specification builder', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    expect(screen.getAllByText('Goods Tender Requirements').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Quantity Schedule / BOQ' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product Specification Builder' })).toBeInTheDocument();
    expect(screen.getByText('No items added yet.')).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /item/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /description/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^unit$/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /qty/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /unit price/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /^total$/i })).toBeInTheDocument();
    expect(screen.getAllByText('Import Excel / CSV')).toHaveLength(2);
    expect(screen.getAllByRole('button', { name: 'Download Excel Template' })).toHaveLength(2);
    expect(screen.getByRole('heading', { name: 'Sample Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial Capacity Requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regulatory license requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other Eligibility Requirements' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Deliverables and attachments' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add Sample Requirement' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    await user.type(screen.getByLabelText('Item 1 description'), 'Solar panel kit');
    await user.selectOptions(screen.getByLabelText('Item 1 unit'), 'Pcs');
    await user.type(screen.getByLabelText('Item 1 quantity'), '2');
    await user.type(screen.getByLabelText('Item 1 unit price'), '12500');

    expect(screen.getByText('25,000')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Solar panel kit' })).toBeInTheDocument();
    expect(screen.getByText('No specifications added for this item yet.')).toBeInTheDocument();
  });

  it('imports goods BOQ rows from CSV and allows the same file to be selected again', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    const input = screen.getByLabelText('Import goods quantity schedule') as HTMLInputElement;
    const file = new File(['Item,Description,Unit,Qty\n1,Solar inverter,Pcs,3'], 'goods-boq.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });
    expect(await screen.findByDisplayValue('Solar inverter')).toBeInTheDocument();
    expect(screen.getByLabelText('Item 1 unit')).toHaveValue('Pcs');
    expect(screen.getByLabelText('Item 1 quantity')).toHaveValue('3');
    expect(store.getState().notifications.items.some((notification) => notification.message === 'Goods quantity schedule imported 1 row.')).toBe(true);
    expect(input).toHaveValue('');

    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getAllByDisplayValue('Solar inverter')).toHaveLength(2));
    expect(input).toHaveValue('');
  });

  it('imports goods product specification rows from CSV and maps them to existing goods items', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    await user.type(screen.getByLabelText('Item 1 description'), 'Solar inverter');

    const input = screen.getByLabelText('Import product specifications') as HTMLInputElement;
    const file = new File(['Item,Specification,Specific detail required\n1,Battery backup,4 hours minimum'], 'product-specs.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByDisplayValue('Battery backup')).toBeInTheDocument();
    expect(screen.getByDisplayValue('4 hours minimum')).toBeInTheDocument();
    expect(store.getState().notifications.items.some((notification) => notification.message === 'Product specifications imported 1 row.')).toBe(true);
  });

  it('imports service BOQ rows from CSV', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Non Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    const input = screen.getByLabelText('Import service BOQ') as HTMLInputElement;
    const file = new File(['No.,Description,Unit,Quantity,Rate\n1,Security guard services,Month,12,500000'], 'service-boq.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByDisplayValue('Security guard services')).toBeInTheDocument();
    expect(screen.getByLabelText('Service BOQ unit 1')).toHaveValue('Month');
    expect(screen.getByLabelText('Service BOQ quantity 1')).toHaveValue('12');
    expect(screen.getByLabelText('Service BOQ rate 1')).toHaveValue('500000');
    expect(screen.getByText('6,000,000')).toBeInTheDocument();
  });

  it('imports works BOQ rows from CSV', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Works/ }));
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    const input = screen.getByLabelText('Import works BOQ') as HTMLInputElement;
    const file = new File(['No.,Description,Unit,Quantity\n1,Concrete works,Sqm,10'], 'works-boq.csv', { type: 'text/csv' });

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByDisplayValue('Concrete works')).toBeInTheDocument();
    expect(screen.getByLabelText('BOQ unit 1')).toHaveValue('Sqm');
    expect(screen.getByLabelText('BOQ quantity 1')).toHaveValue('10');
  });

  it('imports goods BOQ rows from XLSX files', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    const input = screen.getByLabelText('Import goods quantity schedule') as HTMLInputElement;
    const file = spreadsheetFile([
      ['Item', 'Description', 'Unit', 'Qty'],
      ['1', 'Water pump', 'Pcs', '4']
    ]);

    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByDisplayValue('Water pump')).toBeInTheDocument();
    expect(screen.getByLabelText('Item 1 quantity')).toHaveValue('4');
  });

  it('warns on empty spreadsheets and unsupported import files without mutating goods rows', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    const input = screen.getByLabelText('Import goods quantity schedule') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [spreadsheetFile([], 'empty.xlsx')] } });

    await waitFor(() =>
      expect(store.getState().notifications.items.some((notification) => notification.message === 'Goods quantity schedule did not include usable rows.')).toBe(true)
    );
    expect(screen.queryByLabelText('Item 1 description')).not.toBeInTheDocument();
    expect(input).toHaveValue('');

    fireEvent.change(input, { target: { files: [new File(['%PDF-1.4'], 'goods.pdf', { type: 'application/pdf' })] } });

    await waitFor(() => expect(store.getState().notifications.items.some((notification) => notification.message === 'Use an Excel or CSV file for this import.')).toBe(true));
    expect(screen.queryByLabelText('Item 1 description')).not.toBeInTheDocument();
    expect(input).toHaveValue('');
  });

  it('orders goods requirements with regulatory licenses after financial capacity', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);

    const bodyText = document.body.textContent ?? '';
    const financialIndex = bodyText.indexOf('Financial Capacity Requirements');
    const licenseIndex = bodyText.indexOf('Regulatory license requirements');
    const eligibilityIndex = bodyText.indexOf('Other Eligibility Requirements');

    expect(financialIndex).toBeGreaterThan(-1);
    expect(licenseIndex).toBeGreaterThan(financialIndex);
    expect(eligibilityIndex).toBeGreaterThan(licenseIndex);
    expect(bodyText).not.toContain('Deliverables and attachments');
  });

  it('adds and removes product specifications through the prototype modal', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    await user.type(screen.getByLabelText('Item 1 description'), 'Laptop computer');

    await user.click(screen.getByRole('button', { name: 'Add Specification' }));
    expect(screen.getByRole('dialog', { name: 'Add Specification' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Specification' }));
    expect(screen.getByText('Specification name is required.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Specification name'), 'Processor');
    await user.type(screen.getByLabelText('Specific detail required'), 'Core i5 or above');
    await user.click(screen.getByRole('button', { name: 'Save Specification' }));

    expect(screen.getByDisplayValue('Processor')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Core i5 or above')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Delete specification' }));

    expect(screen.queryByDisplayValue('Processor')).not.toBeInTheDocument();
    expect(screen.getByText('No specifications added for this item yet.')).toBeInTheDocument();
  }, 10000);

  it('supports sample, financial, and eligibility goods requirement rows', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
    expect(screen.queryByText('Sample requirement design')).not.toBeInTheDocument();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    expect(screen.getByRole('radio', { name: 'Yes' })).toBeChecked();
    expect(screen.getByText('Sample requirement design')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Add Sample Requirement' })).toBeDisabled();
    expect(screen.getByText('Add at least one quantity item before adding sample requirements.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    fireEvent.change(screen.getByLabelText('Item 1 description'), { target: { value: 'Solar panel kit' } });
    expect(screen.getByRole('button', { name: 'Add Sample Requirement' })).toBeEnabled();
    await user.click(screen.getByRole('button', { name: 'Add Sample Requirement' }));
    expect(screen.getByLabelText('Sample Required 1')).toBeChecked();
    expect(screen.getByLabelText('Related BOQ Item 1')).toHaveDisplayValue('Solar panel kit');
    fireEvent.change(screen.getByLabelText('Number of Samples 1'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('Sample Description 1'), { target: { value: 'One sealed sample and one working sample' } });

    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Minimum Annual Turnover');
    fireEvent.change(screen.getByLabelText('Minimum value 1'), { target: { value: '50000000' } });
    await user.selectOptions(screen.getByLabelText('Period 1'), 'Last 3 Years');
    await user.selectOptions(screen.getByLabelText('Evidence required 1'), 'Audited accounts');

    await user.click(screen.getByRole('button', { name: 'Add Requirement' }));
    fireEvent.change(screen.getByLabelText('Requirement name 1'), { target: { value: 'Manufacturer authorization' } });
    fireEvent.change(screen.getByLabelText('Eligibility notes 1'), { target: { value: 'Must be current' } });
  }, 10000);

  it('manages regulatory license requirements with the prototype picker', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
    expect(screen.getByText('No regulatory license requirements added yet.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add License Requirement' }));
    await user.type(screen.getByLabelText('Search all regulatory licenses'), 'Food Business');
    await user.click(screen.getByRole('option', { name: /Food Business Permit/ }));

    expect(screen.getAllByText('Food Business Permit / Food Handling License').length).toBeGreaterThan(0);
    expect(screen.getByText('Tanzania Medicines and Medical Devices Authority (TMDA)')).toBeInTheDocument();
    expect(screen.getByLabelText('Food Business Permit / Food Handling License Mandatory')).toBeChecked();
    expect(screen.getByLabelText('Food Business Permit / Food Handling License Expiry required')).toBeChecked();

    await user.click(screen.getByRole('button', { name: 'Add License Requirement' }));
    await user.type(screen.getByLabelText('Search all regulatory licenses'), 'Food Business Permit');
    expect(screen.queryByRole('option', { name: /Food Business Permit/ })).not.toBeInTheDocument();
    expect(screen.getByText('No matching license')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Change' }));
    await user.type(screen.getByLabelText('Search regulatory license'), 'Petroleum Retail');
    await user.click(screen.getByRole('option', { name: /Petroleum Retail Outlet License/ }));

    expect(screen.queryByText('Food Business Permit / Food Handling License')).not.toBeInTheDocument();
    expect(screen.getByText('Petroleum Retail Outlet License')).toBeInTheDocument();
    expect(screen.getByText('Energy and Water Utilities Regulatory Authority (EWURA)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove license requirement' }));
    expect(screen.queryByText('Petroleum Retail Outlet License')).not.toBeInTheDocument();
    expect(screen.getByText('No regulatory license requirements added yet.')).toBeInTheDocument();
  }, 10000);

  it('summarizes goods-specific prototype requirements during review', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    await user.type(screen.getByLabelText('Item 1 description'), 'Laptop computer');
    await user.selectOptions(screen.getByLabelText('Item 1 unit'), 'Pcs');
    await user.type(screen.getByLabelText('Item 1 quantity'), '5');

    await user.click(screen.getByRole('button', { name: 'Add Specification' }));
    await user.type(screen.getByLabelText('Specification name'), 'Processor');
    await user.type(screen.getByLabelText('Specific detail required'), 'Core i5 or above');
    await user.click(screen.getByRole('button', { name: 'Save Specification' }));

    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    await user.click(screen.getByRole('button', { name: 'Add Sample Requirement' }));
    await user.type(screen.getByLabelText('Number of Samples 1'), '1');

    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Access to Credit');
    await user.type(screen.getByLabelText('Minimum value 1'), '20000000');

    await user.click(screen.getByRole('button', { name: 'Add License Requirement' }));
    await user.type(screen.getByLabelText('Search all regulatory licenses'), 'Food Business');
    await user.click(screen.getByRole('option', { name: /Food Business Permit/ }));

    await user.click(screen.getByRole('button', { name: 'Add Requirement' }));
    fireEvent.change(screen.getByLabelText('Requirement name 1'), { target: { value: 'Tax clearance certificate' } });
    await user.click(screen.getAllByRole('button', { name: /Review Tender/ })[0]);

    expect(screen.getByRole('heading', { name: 'Tender information' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tender requirements' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Product specifications' })).toBeInTheDocument();
    expect(screen.getByText('Laptop computer - Processor: Core i5 or above')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sample requirements' })).toBeInTheDocument();
    expect(screen.getByText(/Laptop computer - 1/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Financial capacity' })).toBeInTheDocument();
    expect(screen.getByText(/Access to Credit - minimum 20000000/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Regulatory license requirements' })).toBeInTheDocument();
    expect(screen.getByText('Food Business Permit / Food Handling License')).toBeInTheDocument();
    expect(screen.getByText('Tanzania Medicines and Medical Devices Authority (TMDA)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Other eligibility' })).toBeInTheDocument();
    expect(screen.getByText(/Tax clearance certificate/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Deliverables and attachments' })).toBeInTheDocument();
    expect(screen.getByText('Unpriced schedule')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Evaluation criteria and timeline' })).toBeInTheDocument();
    expect(screen.getByText('Technical Compliance')).toBeInTheDocument();
    expect(screen.getByText('Conformity to technical specifications')).toBeInTheDocument();
  }, 10000);

  it('category selection searches, auto-adds, prevents duplicates, and supports removing categories', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    const categorySearch = screen.getByLabelText('Category') as HTMLInputElement;
    expect(categorySearch).toHaveAttribute('type', 'search');
    expect(screen.queryByRole('button', { name: 'Add Category' })).not.toBeInTheDocument();

    await user.type(categorySearch, 'Medical equipment');
    await user.click(await screen.findByRole('button', { name: 'Medical equipment' }));

    expect(screen.getByText('Medical equipment')).toBeInTheDocument();
    expect(categorySearch).toHaveValue('');

    await user.type(categorySearch, 'Medical equipment');
    expect(screen.queryByRole('button', { name: 'Medical equipment' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Medical equipment')).toHaveLength(1);
    await user.clear(categorySearch);

    await user.type(categorySearch, 'Others');
    await user.click(await screen.findByRole('button', { name: 'Others' }));
    expect(screen.getByText('Others')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remove Medical equipment' }));

    expect(screen.queryByText('Medical equipment')).not.toBeInTheDocument();
    expect(screen.getByText('Others')).toBeInTheDocument();
  });

  it('invited tender reveals invited supplier controls', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.selectOptions(screen.getByLabelText('Procurement method'), 'Invited Tender');

    expect(screen.getByRole('heading', { name: 'Invited suppliers' })).toBeInTheDocument();
    expect(screen.getByLabelText('Supplier organization')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /Kilimanjaro Supplies Limited/ })).toBeInTheDocument();
    expect(communicationApiMock.listRecipients).toHaveBeenCalledWith(expect.objectContaining({ capability: 'SUPPLIER' }));
  });

  it('planning handoff pre-fills values and starts on the requested step', () => {
    window.localStorage.setItem(
      'procurex.planning.selectedTenderPlan',
      JSON.stringify({
        title: 'Planned Health Facility Upgrade',
        procurementType: 'works',
        category: 'Healthcare infrastructure',
        method: 'Open Tender',
        fundingSource: 'Project loan',
        openingDate: '2026-09-02',
        closingDate: '2026-09-01',
        startStep: 2
      })
    );

    renderCreateTender();

    expect(screen.getByRole('heading', { name: 'Procurement Planning' })).toBeInTheDocument();
    expect(screen.getByText('Planning-autofill notice: selected plan values pre-filled this tender draft.')).toBeInTheDocument();
    expect(screen.getByText('Healthcare infrastructure')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Healthcare infrastructure' })).toBeInTheDocument();
  });

  it('planning handoff pre-fills Basic Information and warns when edited', async () => {
    const user = userEvent.setup();
    window.localStorage.setItem(
      'procurex.planning.selectedTenderPlan',
      JSON.stringify({
        title: 'Planned Clinic Equipment',
        description: 'Initial plan objective',
        procuringEntity: 'District Health Office',
        location: 'Mwanza',
        fundingSource: 'Project loan',
        currency: 'TZS',
        estimatedBudget: 350000000,
        openingDate: '2026-09-02',
        closingDate: '2026-09-01',
        clarificationDeadline: '2026-08-25',
        publicationDate: '2026-08-01'
      })
    );

    renderCreateTender();

    expect(screen.getByLabelText('Tender title')).toHaveValue('Planned Clinic Equipment');
    expect(screen.getByLabelText('Delivery Point')).toHaveValue('Mwanza');

    await user.clear(screen.getByLabelText('Tender title'));
    await user.type(screen.getByLabelText('Tender title'), 'Edited Clinic Equipment');

    expect(screen.getByText('Planning handoff fields were edited: title.')).toBeInTheDocument();
  });

  it('evaluation criteria weights show balanced and unbalanced status', async () => {
    const user = userEvent.setup();
    const { container } = renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(container.querySelector('.evaluation-criteria-panel')).toBeInTheDocument();
    expect(container.querySelector('.evaluation-criteria-panel .evaluation-builder')).toBeInTheDocument();
    expect(document.body.textContent).toContain('Total Weight: 100%');
    expect(screen.getByRole('heading', { name: 'Evaluation Criteria and Weights' })).toBeInTheDocument();
    expect(screen.getByText('Criteria suggestion library')).toBeInTheDocument();
    expect(screen.getByText('Balancing mode')).toBeInTheDocument();
    expect(screen.getByText('Selected criteria')).toBeInTheDocument();
    expect(screen.getByText('Suggested criteria')).toBeInTheDocument();
    expect(screen.getByText('5 criteria')).toBeInTheDocument();
    expect(screen.getByText('Buyer-controlled labels, weights, and selectable subcriteria.')).toBeInTheDocument();
    expect(screen.getByText('Technical Compliance')).toBeInTheDocument();
    expect(screen.getAllByText('Balanced').length).toBeGreaterThan(1);

    const firstWeight = screen.getAllByLabelText('Weight')[0];
    await user.clear(firstWeight);
    await user.type(firstWeight, '10');

    expect(screen.getAllByText('Add 30% remaining').length).toBeGreaterThan(1);
  });

  it('works evaluation criteria use the ProcureX builder and reference weights', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Works/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(screen.getByText('Criteria suggestion library')).toBeInTheDocument();
    expect(screen.getByText('Selected criteria')).toBeInTheDocument();
    expect(screen.getByText('Suggested criteria')).toBeInTheDocument();
    expect(screen.getByText('Technical Methodology')).toBeInTheDocument();
    expect(screen.getByText('Personnel')).toBeInTheDocument();
    expect(screen.getByText('Equipment and Resources')).toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Schedule and Execution')).toBeInTheDocument();
    expect(screen.getByText('Health, Safety and Environment (HSE)')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
    expect(screen.getAllByText('Balanced').length).toBeGreaterThan(1);

    expect(screen.getAllByLabelText('Weight').map((input) => (input as HTMLInputElement).value)).toEqual(['20', '15', '10', '15', '10', '10', '20']);

    const firstWeight = screen.getAllByLabelText('Weight')[0];
    await user.clear(firstWeight);
    await user.type(firstWeight, '10');

    expect(screen.getAllByText('Add 10% remaining').length).toBeGreaterThan(1);
  }, 10000);

  it('works evaluation edit menu manages subcriteria chips', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Works/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    expect(screen.getByLabelText('Criterion name')).toHaveValue('Technical Methodology');
    expect(screen.getByText('Subcriteria')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Custom subcriterion'), 'Community disruption plan');
    await user.click(screen.getByRole('button', { name: 'Add Custom' }));

    expect(screen.getAllByText('Community disruption plan').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Remove Community disruption plan' }));

    expect(screen.queryByRole('button', { name: 'Remove Community disruption plan' })).not.toBeInTheDocument();
  }, 10000);

  it('works evaluation suggestions hide selected criteria and support custom criteria', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Works/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(screen.getByText('7 criteria')).toBeInTheDocument();
    expect(screen.getByText('All suggested criteria have been added.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Delete criteria' })[0]);

    expect(screen.getByText('6 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Technical Methodology/ }));

    expect(screen.getByText('7 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Custom Criterion' }));

    expect(screen.getByText('8 criteria')).toBeInTheDocument();
    expect(screen.getByText('Custom Criterion')).toBeInTheDocument();
  }, 10000);

  it('Non Consultancy evaluation criteria use the ProcureX builder and reference service weights', async () => {
    const user = userEvent.setup();
    const { container } = renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Non Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(container.querySelector('.evaluation-criteria-panel .evaluation-builder')).toBeInTheDocument();
    expect(container.querySelector('.evaluation-balance-panel')).not.toBeInTheDocument();
    expect(screen.getByText('Criteria suggestion library')).toBeInTheDocument();
    expect(screen.getByText('Selected criteria')).toBeInTheDocument();
    expect(screen.getByText('Suggested criteria')).toBeInTheDocument();
    expect(screen.getByText('Service Delivery Approach')).toBeInTheDocument();
    expect(screen.getByText('Staffing and Personnel')).toBeInTheDocument();
    expect(screen.getByText('Service Capacity')).toBeInTheDocument();
    expect(screen.getByText('SLA and Performance')).toBeInTheDocument();
    expect(screen.getByText('Tools and Systems')).toBeInTheDocument();
    expect(screen.getByText('Experience')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
    expect(screen.getAllByText('Balanced').length).toBeGreaterThan(1);

    expect(screen.getAllByLabelText('Weight').map((input) => (input as HTMLInputElement).value)).toEqual(['20', '20', '10', '20', '10', '10', '10']);

    const firstWeight = screen.getAllByLabelText('Weight')[0];
    await user.clear(firstWeight);
    await user.type(firstWeight, '10');

    expect(screen.getAllByText('Add 10% remaining').length).toBeGreaterThan(1);
  }, 10000);

  it('Non Consultancy evaluation edit menu manages service subcriteria chips', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Non Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    expect(screen.getByLabelText('Criterion name')).toHaveValue('Service Delivery Approach');
    expect(screen.getByText('Subcriteria')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Custom subcriterion'), 'Continuity reporting');
    await user.click(screen.getByRole('button', { name: 'Add Custom' }));

    expect(screen.getAllByText('Continuity reporting').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Remove Continuity reporting' }));

    expect(screen.queryByRole('button', { name: 'Remove Continuity reporting' })).not.toBeInTheDocument();
  }, 10000);

  it('Non Consultancy evaluation suggestions hide selected criteria and support custom criteria', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /Non Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(screen.getByText('7 criteria')).toBeInTheDocument();
    expect(screen.getByText('All suggested criteria have been added.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Delete criteria' })[0]);

    expect(screen.getByText('6 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Service Delivery Approach/ }));

    expect(screen.getByText('7 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Custom Criterion' }));

    expect(screen.getByText('8 criteria')).toBeInTheDocument();
    expect(screen.getByText('Custom Criterion')).toBeInTheDocument();
  }, 10000);

  it('Consultancy evaluation criteria use the ProcureX builder and reference weights', async () => {
    const user = userEvent.setup();
    const { container } = renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /^Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(container.querySelector('.evaluation-criteria-panel .evaluation-builder')).toBeInTheDocument();
    expect(container.querySelector('.evaluation-balance-panel')).not.toBeInTheDocument();
    expect(screen.getByText('Criteria suggestion library')).toBeInTheDocument();
    expect(screen.getByText('Methodology and Approach')).toBeInTheDocument();
    expect(screen.getByText('Key Experts')).toBeInTheDocument();
    expect(screen.getByText('Firm Experience')).toBeInTheDocument();
    expect(screen.getByText('Work Plan and Organization')).toBeInTheDocument();
    expect(screen.getByText('Knowledge Transfer')).toBeInTheDocument();
    expect(screen.getByText('Financial')).toBeInTheDocument();
    expect(screen.getAllByText('Balanced').length).toBeGreaterThan(1);

    expect(screen.getAllByLabelText('Weight').map((input) => (input as HTMLInputElement).value)).toEqual(['30', '35', '15', '10', '10', '0']);

    const firstWeight = screen.getAllByLabelText('Weight')[0];
    await user.clear(firstWeight);
    await user.type(firstWeight, '20');

    expect(screen.getAllByText('Add 10% remaining').length).toBeGreaterThan(1);
  }, 10000);

  it('Consultancy evaluation edit menu manages subcriteria chips', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /^Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    expect(screen.getByLabelText('Criterion name')).toHaveValue('Methodology and Approach');
    expect(screen.getByText('Subcriteria')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Custom subcriterion'), 'Knowledge transfer sessions');
    await user.click(screen.getByRole('button', { name: 'Add Custom' }));

    expect(screen.getAllByText('Knowledge transfer sessions').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Remove Knowledge transfer sessions' }));

    expect(screen.queryByRole('button', { name: 'Remove Knowledge transfer sessions' })).not.toBeInTheDocument();
  }, 10000);

  it('Consultancy evaluation suggestions hide selected criteria and support custom criteria', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.click(screen.getByRole('button', { name: /^Consultancy/ }));
    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(screen.getByText('6 criteria')).toBeInTheDocument();
    expect(screen.getByText('All suggested criteria have been added.')).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: 'Delete criteria' })[0]);

    expect(screen.getByText('5 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Methodology and Approach/ }));

    expect(screen.getByText('6 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Custom Criterion' }));

    expect(screen.getByText('7 criteria')).toBeInTheDocument();
    expect(screen.getByText('Custom Criterion')).toBeInTheDocument();
  }, 10000);

  it('goods evaluation edit menu manages subcriteria chips', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    expect(screen.getByLabelText('Criterion name')).toHaveValue('Technical Compliance');
    expect(screen.getByText('Subcriteria')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Custom subcriterion'), 'Energy efficiency rating');
    await user.click(screen.getByRole('button', { name: 'Add Custom' }));

    expect(screen.getAllByText('Energy efficiency rating').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Remove Energy efficiency rating' }));

    expect(screen.queryByRole('button', { name: 'Remove Energy efficiency rating' })).not.toBeInTheDocument();
  }, 10000);

  it('goods evaluation suggestions hide selected criteria and support custom criteria', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Evaluation Criteria and Weights/ })[0]);

    expect(screen.getByText('5 criteria')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Delete criteria' })[0]);

    expect(screen.getByText('4 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Technical Compliance/ }));

    expect(screen.getByText('5 criteria')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Custom Criterion' }));

    expect(screen.getByText('6 criteria')).toBeInTheDocument();
    expect(screen.getByText('Custom Criterion')).toBeInTheDocument();
  });

  it('review step reflects entered details and requirements', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Supply of Solar Equipment');
    fireEvent.change(screen.getByLabelText('Contact person or department'), { target: { value: 'Procurement Officer' } });
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    fireEvent.change(screen.getByLabelText('Item 1 description'), {
      target: { value: 'Solar panel kit' }
    });
    fireEvent.change(screen.getByLabelText('Item 1 unit'), {
      target: { value: 'Pcs' }
    });
    fireEvent.change(screen.getByLabelText('Item 1 quantity'), {
      target: { value: '12' }
    });
    await user.click(screen.getByRole('button', { name: 'Add Specification' }));
    await user.type(screen.getByLabelText('Specification name'), 'Kit requirements');
    await user.type(screen.getByLabelText('Specific detail required'), 'Solar panels, inverters, mounting kits');
    await user.click(screen.getByRole('button', { name: 'Save Specification' }));
    await user.click(screen.getAllByRole('button', { name: /Review Tender/ })[0]);

    expect(screen.getByRole('heading', { name: 'Tender information' })).toBeInTheDocument();
    expect(screen.getByText('Supply of Solar Equipment')).toBeInTheDocument();
    expect(screen.getByText(/Procurement Officer/)).toBeInTheDocument();
    expect(screen.getByText('Dodoma')).toBeInTheDocument();
    expect(screen.getByText(defaultSubmissionDeadline)).toBeInTheDocument();
    expect(screen.getByText(defaultOpeningDate)).toBeInTheDocument();
    expect(screen.getByText(/Solar panels, inverters, mounting kits/)).toBeInTheDocument();
    expect(screen.getByText('Solar panel kit')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Pcs')).toBeInTheDocument();
    expect(screen.queryByText('Installed pilot system')).not.toBeInTheDocument();
  }, 10000);

  it('save draft creates a backend draft and stores the returned id/reference', async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    await fillBasicStep(user, 'Backend Saved Generator Tender');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(procurementApiMock.createTender).toHaveBeenCalledTimes(1));
    expect(procurementApiMock.createTender).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Backend Saved Generator Tender',
        type: 'Goods',
        closingDate: defaultSubmissionDeadline,
        location: 'Dodoma'
      })
    );
    expect(store.getState().procurement.createTenderDrafts[0]).toMatchObject({
      id: '11111111-1111-4111-8111-111111111111',
      reference: 'PX-GDS-2026-001',
      status: 'DRAFT'
    });
    expect(store.getState().notifications.items.some((notification) => notification.message === 'Your tender draft was saved.')).toBe(true);
  });

  it('second save patches the existing backend draft', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Backend Patch Generator Tender');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));
    await waitFor(() => expect(procurementApiMock.createTender).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(procurementApiMock.updateTender).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      expect.objectContaining({
        title: 'Backend Patch Generator Tender',
        type: 'Goods'
      })
    ));
  });

  it('normalizes shorthand BOQ units before saving to the backend', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Backend Unit Normalization Tender');
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Add Item' }));
    fireEvent.change(screen.getByLabelText('Item 1 description'), {
      target: { value: 'Laptop computer' }
    });
    await user.selectOptions(screen.getByLabelText('Item 1 unit'), 'Pcs');
    fireEvent.change(screen.getByLabelText('Item 1 quantity'), {
      target: { value: '12' }
    });
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(procurementApiMock.createTender).toHaveBeenCalledTimes(1));
    expect(procurementApiMock.createTender).toHaveBeenCalledWith(
      expect.objectContaining({
        requirements: expect.objectContaining({
          goods: {
            fields: expect.objectContaining({
              quantityScheduleRows: [expect.objectContaining({ unitOfMeasure: 'Piece' })]
            })
          }
        })
      })
    );
  });

  it('normalizes financial evidence into tag arrays before saving to the backend', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Backend Evidence Normalization Tender');
    await user.click(screen.getAllByRole('button', { name: /Tender Requirements/ })[0]);
    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Minimum Annual Turnover');
    await user.type(screen.getByLabelText('Minimum value 1'), '20000000');
    await user.selectOptions(screen.getByLabelText('Period 1'), 'Annual');
    await user.selectOptions(screen.getByLabelText('Evidence required 1'), 'Bank statement');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    await waitFor(() => expect(procurementApiMock.createTender).toHaveBeenCalledTimes(1));
    expect(procurementApiMock.createTender).toHaveBeenCalledWith(
      expect.objectContaining({
        requirements: expect.objectContaining({
          goods: {
            fields: expect.objectContaining({
              financialRequirementRows: [expect.objectContaining({ evidenceRequired: ['Bank statement'] })]
            })
          }
        })
      })
    );
  });

  it('blocks review submission before backend calls when estimated budget is missing', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    fireEvent.change(screen.getByLabelText('Tender title'), { target: { value: 'No Budget Publish Tender' } });
    await user.selectOptions(screen.getByLabelText('Funding source'), 'Government budget');
    fireEvent.change(screen.getByLabelText('Delivery Point'), { target: { value: 'Dodoma' } });
    fireEvent.change(screen.getByLabelText('Submission deadline'), { target: { value: defaultSubmissionDeadline } });
    fireEvent.change(screen.getByLabelText('Opening date'), { target: { value: defaultOpeningDate } });
    fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'procurement@example.go.tz' } });
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }

    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));

    expect(await screen.findByText('Add a positive estimated budget before submitting this tender for review.')).toBeInTheDocument();
    expect(procurementApiMock.createTender).not.toHaveBeenCalled();
    expect(procurementApiMock.publishTender).not.toHaveBeenCalled();
  });

  it('blocks review submission before backend calls when the title is too short', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Bad');
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }

    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));

    expect(await screen.findByText('Add a tender title with at least 5 characters before submitting this tender for review.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic Information' })).toBeInTheDocument();
    expect(procurementApiMock.createTender).not.toHaveBeenCalled();
    expect(procurementApiMock.updateTender).not.toHaveBeenCalled();
    expect(procurementApiMock.publishTender).not.toHaveBeenCalled();
  });

  it('blocks review submission before backend calls when the submission deadline is not future dated', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Expired Closing Date Tender');
    fireEvent.change(screen.getByLabelText('Submission deadline'), { target: { value: new Date().toISOString().slice(0, 10) } });
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }

    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));

    expect(await screen.findByText('Select a submission deadline in the future before submitting this tender for review.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Basic Information' })).toBeInTheDocument();
    expect(procurementApiMock.createTender).not.toHaveBeenCalled();
    expect(procurementApiMock.updateTender).not.toHaveBeenCalled();
    expect(procurementApiMock.publishTender).not.toHaveBeenCalled();
  });

  it('blocks review submission before backend calls when goods requirements are incomplete', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Missing Goods Requirements Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }

    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));

    expect(await screen.findByText('Add at least one goods quantity line before submitting this tender for review.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Quantity Schedule / BOQ' })).toBeInTheDocument();
    expect(procurementApiMock.createTender).not.toHaveBeenCalled();
    expect(procurementApiMock.updateTender).not.toHaveBeenCalled();
    expect(procurementApiMock.publishTender).not.toHaveBeenCalled();
  });

  it('submit requires confirmations, then saves and sends the tender to admin review', async () => {
    const user = userEvent.setup();
    const download = mockBrowserDownload();
    renderWithRoutes();

    await fillBasicStep(user, 'Published React Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await completeMinimumGoodsRequirements(user);
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);

    expect(screen.getByText('Review submission')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Submit Tender for Review' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'If the tender passes review:' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'If the tender does not pass:' })).toBeInTheDocument();
    expect(screen.getByText('I confirm the tender information is complete and accurate.')).toBeInTheDocument();
    expect(screen.getByText('I understand the tender will be reviewed before publication.')).toBeInTheDocument();
    expect(screen.getByText('I understand rejected tenders will return as draft with comments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Tender PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Tender for Review' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Download Tender PDF' }));
    await waitFor(() => expect(html2PdfMock.worker.outputPdf).toHaveBeenCalledWith('blob'));
    expect(html2PdfMock.worker.set).toHaveBeenCalledWith(expect.objectContaining({ filename: expect.stringMatching(/^PX-DRAFT-\d{4}-\d+-tender-pack\.pdf$/) }));
    expect(pdfSourceText()).toContain('Published React Tender');
    expect(pdfSourceText()).toContain('Dodoma');
    expect(pdfSourceText()).toContain('Government budget');
    expect(pdfSourceText()).toContain('250,000,000');
    expect(download.downloads.at(-1)).toMatch(/^PX-DRAFT-\d{4}-\d+-tender-pack\.pdf$/);
    expect(download.blobs.at(-1)?.type).toBe('application/pdf');
    expect(store.getState().notifications.items.some((notification) => notification.message === 'Tender PDF generator is not available in this frontend yet.')).toBe(false);

    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }

    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Tender for Review' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));
    expect(await screen.findByRole('dialog', { name: 'Submit tender for review' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Signature keyphrase'), 'Signing123');
    await user.click(screen.getByRole('button', { name: 'Submit tender' }));

    await waitFor(() => expect(procurementApiMock.createTender).toHaveBeenCalledTimes(1));
    expect(procurementApiMock.publishTender).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', { signatureKeyphrase: 'Signing123' });
    expect(store.getState().notifications.items.some((notification) => notification.message === 'Your tender was saved and sent to admin review.')).toBe(true);
  }, 15000);

  it('surfaces backend review validation errors in user feedback', async () => {
    procurementApiMock.publishTender.mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          message: 'Tender cannot be published',
          errors: [{ message: 'Tender requirements are required before publishing.' }]
        }
      }
    });
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Invalid Publish Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await completeMinimumGoodsRequirements(user);
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Tender for Review' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));
    await user.type(screen.getByLabelText('Signature keyphrase'), 'Signing123');
    await user.click(screen.getByRole('button', { name: 'Submit tender' }));

    expect(await screen.findByText('Tender requirements are required before publishing.')).toBeInTheDocument();
    expect(screen.queryByText('Tender could not be submitted for review.')).not.toBeInTheDocument();
    expect(store.getState().notifications.items.some((notification) => notification.message === 'Tender requirements are required before publishing.')).toBe(true);
  }, 15000);

  it('formats backend draft validation errors before showing submission feedback', async () => {
    procurementApiMock.createTender.mockRejectedValueOnce({
      response: {
        data: {
          success: false,
          message: 'Validation failed',
          errors: [
            { path: 'title', message: 'String must contain at least 5 character(s)', code: 'too_small' },
            { path: 'closingDate', message: 'Closing date must be in the future.', code: 'custom' }
          ]
        }
      }
    });
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Backend Validation Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await completeMinimumGoodsRequirements(user);
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Tender for Review' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));
    await user.type(screen.getByLabelText('Signature keyphrase'), 'Signing123');
    await user.click(screen.getByRole('button', { name: 'Submit tender' }));

    expect(await screen.findByText('Tender title must contain at least 5 characters. Submission deadline must be in the future.')).toBeInTheDocument();
    expect(screen.queryByText(/String must contain at least 5 character/)).not.toBeInTheDocument();
    expect(screen.queryByText('Closing date must be in the future.')).not.toBeInTheDocument();
    expect(procurementApiMock.publishTender).not.toHaveBeenCalled();
  });

  it('blocks invited tender review submission until a registered supplier is selected', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Invited Backend Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await user.selectOptions(screen.getByLabelText('Procurement method'), 'Invited Tender');
    await completeMinimumGoodsRequirements(user);
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }
    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));

    expect(await screen.findByText('Please select at least one registered supplier organization for this invited tender.')).toBeInTheDocument();
    expect(procurementApiMock.createTender).not.toHaveBeenCalled();
    expect(procurementApiMock.publishTender).not.toHaveBeenCalled();
  });

  it('submits invited tenders with selected supplier organization metadata', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await fillBasicStep(user, 'Invited Registered Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await user.selectOptions(screen.getByLabelText('Procurement method'), 'Invited Tender');
    await user.click(await screen.findByRole('button', { name: /Kilimanjaro Supplies Limited/ }));
    expect(screen.getByText('Kilimanjaro Supplies Limited')).toBeInTheDocument();
    await completeMinimumGoodsRequirements(user);
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);
    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }
    await waitFor(() => expect(screen.getByRole('button', { name: 'Submit Tender for Review' })).toBeEnabled());
    await user.click(screen.getByRole('button', { name: 'Submit Tender for Review' }));
    await user.type(screen.getByLabelText('Signature keyphrase'), 'Signing123');
    await user.click(screen.getByRole('button', { name: 'Submit tender' }));

    await waitFor(() => expect(procurementApiMock.createTender).toHaveBeenCalledTimes(1));
    expect(procurementApiMock.createTender).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          method: 'Invited Tender',
          invitedSuppliers: ['Kilimanjaro Supplies Limited'],
          invitedSupplierNames: ['Kilimanjaro Supplies Limited'],
          invitedOrganizationIds: ['22222222-2222-4222-8222-222222222222'],
          invitedSupplierOrganizations: [
            expect.objectContaining({
              id: '22222222-2222-4222-8222-222222222222',
              name: 'Kilimanjaro Supplies Limited',
              capabilities: ['SUPPLIER']
            })
          ]
        })
      })
    );
    expect(procurementApiMock.publishTender).toHaveBeenCalledWith('11111111-1111-4111-8111-111111111111', { signatureKeyphrase: 'Signing123' });
  }, 15000);
});
