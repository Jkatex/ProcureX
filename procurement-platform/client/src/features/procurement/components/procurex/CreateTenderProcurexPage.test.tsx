import { ThemeProvider } from '@mui/material';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import '@/i18n';
import { store } from '@/app/store';
import { procurexTheme } from '@/styles/mui-theme';
import { resetCreateTenderDrafts } from '../../slice';
import { MarketplaceProcurexPage } from './MarketplaceProcurexPage';
import { CreateTenderProcurexPage } from './CreateTenderProcurexPage';

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
  fireEvent.change(screen.getByLabelText('Submission deadline'), { target: { value: '2026-08-20' } });
  fireEvent.change(screen.getByLabelText('Opening date'), { target: { value: '2026-08-21' } });
  fireEvent.change(screen.getByLabelText('Contact email'), { target: { value: 'procurement@example.go.tz' } });
}

async function addDefaultCategory(user: ReturnType<typeof userEvent.setup>, category = 'Medical equipment') {
  await user.selectOptions(screen.getByLabelText('Category'), category);
  await user.click(screen.getByRole('button', { name: 'Add Category' }));
}

beforeEach(() => {
  store.dispatch(resetCreateTenderDrafts());
  window.localStorage.clear();
});

describe('CreateTenderProcurexPage', () => {
  it('renders the six-step wizard and starts at Basic Information', () => {
    const { container } = renderCreateTender();

    expect(screen.getByRole('heading', { name: 'Create Tender Wizard' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { name: 'Basic Information' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Procurement Planning').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Tender Review and Publication').length).toBeGreaterThan(0);
    expect(container.querySelector('.wizard-shell')).toBeInTheDocument();
    expect(container.querySelector('.wizard-rail')).not.toBeInTheDocument();
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

    fireEvent.change(screen.getByLabelText('Opening date'), { target: { value: '2026-08-25' } });
    fireEvent.change(screen.getByLabelText('Submission deadline'), { target: { value: '2026-08-20' } });

    expect(screen.getByLabelText('Submission deadline')).toHaveValue('2026-08-20');
    expect(screen.getByLabelText('Opening date')).toHaveValue('2026-08-25');
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

    expect(screen.getByText('Please add the title, funding source, key dates, and one contact option before continuing.')).toBeInTheDocument();
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
    expect(entityBackgroundControl?.querySelector('.scope-list-heading')).toContainElement(screen.getByRole('button', { name: 'Add Entity Background' }));
    expect(entityBackgroundControl?.querySelector('.scope-empty')).toHaveTextContent('No procuring entity background captured yet.');
    const projectBackgroundControl = within(introductionBlock as HTMLElement).getByText('1.2 Project Background').closest('.requirement-control');
    expect(projectBackgroundControl).toBeInTheDocument();
    expect(projectBackgroundControl?.querySelector('.scope-list-heading')).toHaveTextContent('1.2 Project Background');
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

    expect(screen.queryByLabelText('Bank statement period')).not.toBeInTheDocument();
    await user.click(screen.getByLabelText('Bank statements'));
    expect(screen.getByLabelText('Bank statement period')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Bank statement period'), { target: { value: 'Submit statements for the last 6 months.' } });

    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Minimum Annual Turnover');
    fireEvent.change(screen.getByLabelText('Minimum value 1'), { target: { value: '500000000' } });
    await user.selectOptions(screen.getByLabelText('Period 1'), 'Last 3 Years');
    await user.selectOptions(screen.getByLabelText('Evidence required 1'), 'Audited accounts');
  }, 10000);

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
    fireEvent.change(screen.getByLabelText('BOQ rate 1'), { target: { value: '15000' } });
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
    expect(screen.getByRole('columnheader', { name: /total/i })).toBeInTheDocument();
    expect(screen.getByText('Import Excel')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Excel Template' })).toBeInTheDocument();
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
    await user.type(screen.getByLabelText('Item 1 description'), 'Solar panel kit');

    await user.click(screen.getByRole('button', { name: 'Add Sample Requirement' }));
    expect(screen.getByLabelText('Related BOQ Item 1')).toHaveDisplayValue('Solar panel kit');
    expect(screen.getByLabelText('Sample Required 1')).toBeChecked();
    await user.type(screen.getByLabelText('Number of Samples 1'), '2');
    await user.type(screen.getByLabelText('Sample Description 1'), 'One sealed sample and one working sample');

    await user.click(screen.getByRole('button', { name: 'Add Financial Requirement' }));
    await user.selectOptions(screen.getByLabelText('Requirement type 1'), 'Minimum Annual Turnover');
    await user.type(screen.getByLabelText('Minimum value 1'), '50000000');
    await user.selectOptions(screen.getByLabelText('Period 1'), 'Last 3 Years');
    await user.selectOptions(screen.getByLabelText('Evidence required 1'), 'Audited accounts');

    await user.click(screen.getByRole('button', { name: 'Manufacturer authorization' }));
    expect(screen.getByLabelText('Requirement name 1')).toHaveValue('Manufacturer authorization');
    await user.type(screen.getByLabelText('Eligibility notes 1'), 'Must be current');
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

    await user.click(screen.getByRole('button', { name: 'Tax clearance certificate' }));
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
    expect(screen.getByRole('heading', { name: 'Evaluation criteria and timeline' })).toBeInTheDocument();
    expect(screen.getByText('Technical Compliance')).toBeInTheDocument();
    expect(screen.getByText('Conformity to technical specifications')).toBeInTheDocument();
  }, 10000);

  it('category selection supports adding and removing categories', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await addDefaultCategory(user);

    const categoryButton = screen.getByRole('button', { name: 'Medical equipment x' });
    expect(categoryButton).toBeInTheDocument();

    await user.click(categoryButton);

    expect(screen.queryByRole('button', { name: 'Medical equipment x' })).not.toBeInTheDocument();
  });

  it('invited tender reveals invited supplier controls', async () => {
    const user = userEvent.setup();
    renderCreateTender();

    await user.click(screen.getAllByRole('button', { name: /Procurement Planning/ })[0]);
    await user.selectOptions(screen.getByLabelText('Procurement method'), 'Invited Tender');

    expect(screen.getByRole('heading', { name: 'Invited suppliers' })).toBeInTheDocument();
    expect(screen.getByLabelText('Supplier name')).toBeInTheDocument();
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
    expect(screen.getByRole('button', { name: 'Healthcare infrastructure x' })).toBeInTheDocument();
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
    expect(screen.getByText('2026-08-20')).toBeInTheDocument();
    expect(screen.getByText('2026-08-21')).toBeInTheDocument();
    expect(screen.getByText(/Solar panels, inverters, mounting kits/)).toBeInTheDocument();
    expect(screen.getByText('Solar panel kit')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('Pcs')).toBeInTheDocument();
    expect(screen.queryByText('Installed pilot system')).not.toBeInTheDocument();
  }, 10000);

  it('save draft creates a My Tenders draft visible through marketplace state', async () => {
    const user = userEvent.setup();
    const { unmount } = renderWithRoutes();

    await fillBasicStep(user, 'Session Saved Generator Tender');
    await user.click(screen.getByRole('button', { name: 'Save Draft' }));

    expect(screen.getByText('Draft saved for this session.')).toBeInTheDocument();
    unmount();

    render(
      <Provider store={store}>
        <ThemeProvider theme={procurexTheme}>
          <MemoryRouter initialEntries={['/procurement/my-tenders']}>
            <MarketplaceProcurexPage />
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );

    expect(await screen.findByText('Session Saved Generator Tender')).toBeInTheDocument();
  });

  it('submit requires confirmations, then creates posted and marketplace tender records', async () => {
    const user = userEvent.setup();
    renderWithRoutes();

    await fillBasicStep(user, 'Published React Tender');
    await user.click(screen.getAllByRole('button', { name: 'Continue' })[0]);
    await addDefaultCategory(user);
    await user.click(screen.getAllByRole('button', { name: /Tender Review and Publication/ })[0]);

    expect(screen.getByText('Evaluation submission')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Submit Tender for Evaluation' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'If the tender passes evaluation:' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'If the tender does not pass:' })).toBeInTheDocument();
    expect(screen.getByText('I confirm the tender information is complete and accurate.')).toBeInTheDocument();
    expect(screen.getByText('I understand the tender will be reviewed before publication.')).toBeInTheDocument();
    expect(screen.getByText('I understand rejected tenders will return as draft with comments.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Download Tender PDF' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit Tender for Evaluation' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'Download Tender PDF' }));
    expect(screen.getByText('Tender PDF generator is not available in this frontend yet.')).toBeInTheDocument();

    for (const checkbox of screen.getAllByRole('checkbox')) {
      await user.click(checkbox);
    }

    await user.click(screen.getByRole('button', { name: 'Submit Tender for Evaluation' }));

    expect(await screen.findByText('Published React Tender')).toBeInTheDocument();
    expect(screen.getAllByText('Posted').length).toBeGreaterThan(0);

    render(
      <Provider store={store}>
        <ThemeProvider theme={procurexTheme}>
          <MemoryRouter initialEntries={['/procurement/marketplace']}>
            <MarketplaceProcurexPage />
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );

    const marketplace = await screen.findByRole('tabpanel', { name: 'Marketplace tenders' });
    expect(within(marketplace).getByText('Published React Tender')).toBeInTheDocument();
  });
});
