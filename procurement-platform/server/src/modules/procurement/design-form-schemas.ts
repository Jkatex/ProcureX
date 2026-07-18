import { getProcurementMasterDataOptions } from './master-data.js';
import {
  designFormSchemaTypeValues,
  type DesignFormControlDto,
  type DesignFormSchemaDto,
  type FormSchemaType,
  type MasterDataGroup
} from './types.js';

export const procurementDesignSchemaVersion = 'procurement-design-v1';

const tenderTypeLabels: Record<FormSchemaType, string> = {
  goods: 'Goods',
  works: 'Works',
  services: 'Non Consultancy',
  consultancy: 'Consultancy'
};

const inlineOptions = {
  frequency: ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'On demand'],
  educationLevels: ['Certificate', 'Diploma', 'Bachelor Degree', 'Postgraduate Diploma', 'Masters Degree', 'Professional Qualification'],
  ownershipTypes: ['Owned', 'Leased', 'Either'],
  equipmentEvidence: ['Logbook', 'Lease agreement', 'Purchase receipt', 'Photos', 'Inspection certificate', 'Availability declaration'],
  esCategories: ['Worker Safety', 'Gender and SEA/SH', 'Environmental Protection', 'Labor Compliance', 'Other'],
  esEvidence: ['Policy document', 'Certificate', 'Training records', 'Environmental plan', 'Compliance report', 'Procedure manual'],
  serviceCategories: ['Security', 'Cleaning', 'Maintenance', 'Transport', 'Catering', 'IT Support', 'Consultancy', 'Training', 'Waste Management', 'Other'],
  worksContractTypes: ['Lump Sum Contract', 'Unit Price Contract', 'Fixed Price Contract', 'Framework Contract', 'Consultancy / Time-Based Contract', 'Other'],
  worksDocumentTypes: ['Architectural drawings', 'Structural drawings', 'Electrical drawings', 'Mechanical drawings', 'Geotechnical report', 'Environmental report', 'Other'],
  worksTechnicalSpecificationTitles: ['Applicable standards / codes', 'Material specifications', 'Workmanship standards', 'Engineering requirements', 'Equipment requirements', 'Others'],
  financialRequirementTypes: ['Minimum Annual Turnover', 'Average Annual Turnover', 'Positive Net Worth', 'Working Capital', 'Access to Credit', 'Bank Statement Requirement', 'Audited Financial Statements'],
  financialPeriods: ['Annual', 'Current', 'Last 12 Months', 'Last 3 Years', 'Last 5 Years'],
  financialEvidence: ['Audited accounts', 'Bank statement', 'Bank letter', 'Credit facility letter', 'Tax clearance', 'Management accounts']
};

function masterOptions(group: MasterDataGroup) {
  return {
    optionSource: { group },
    options: getProcurementMasterDataOptions(group)
  };
}

function financialCapacitySection() {
  return {
    id: 'financialCapacity',
    title: 'Financial Capacity Requirements',
    hint: 'Structured financial rules used to verify whether bidders can sustain the contract.',
    controls: [
      {
        id: 'financialRequirementRows',
        label: 'Financial requirements',
        type: 'table',
        addLabel: 'Add Financial Requirement',
        emptyText: 'No financial requirements added yet.',
        columns: [
          { id: 'requirementType', label: 'Requirement type', type: 'select', options: inlineOptions.financialRequirementTypes },
          { id: 'minimumValue', label: 'Minimum value', type: 'number' },
          { id: 'period', label: 'Period', type: 'select', options: inlineOptions.financialPeriods },
          { id: 'evidenceRequired', label: 'Evidence required', type: 'tag-select', options: inlineOptions.financialEvidence },
          { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
        ]
      }
    ]
  };
}

const sharedSupportingDocuments = {
  id: 'supportingDocuments',
  title: 'Supporting Documents',
  hint: 'Define submission documents suppliers must upload or respond to.',
  controls: [
    {
      id: 'supportingDocumentRows',
      label: 'Required documents',
      type: 'table',
      addLabel: 'Add Required Document',
      emptyText: 'No supporting documents added yet.',
      columns: [
        { id: 'documentName', label: 'Document name', type: 'text', required: true },
        { id: 'responseType', label: 'Response type', type: 'select', ...masterOptions('response-types') },
        { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
      ]
    }
  ]
};

const schemaSections: Record<FormSchemaType, Omit<DesignFormSchemaDto, 'schemaVersion' | 'type' | 'tenderType'>> = {
  goods: {
    title: 'Goods Tender Requirements',
    sections: [
      {
        id: 'quantitySchedule',
        title: 'Quantity Schedule / BOQ',
        hint: 'Unpriced quantity schedule bidders will price during submission.',
        controls: [
          {
            id: 'quantityScheduleRows',
            label: 'Quantity lines',
            type: 'table',
            required: true,
            addLabel: 'Add Item',
            importLabel: 'Import Excel',
            emptyText: 'No items added yet.',
            columns: [
              { id: 'itemNumber', label: 'Item', type: 'index' },
              { id: 'itemDescription', label: 'Description', type: 'text', required: true },
              { id: 'unitOfMeasure', label: 'Unit', type: 'select', required: true, ...masterOptions('units') },
              { id: 'quantity', label: 'Qty', type: 'number', required: true }
            ]
          }
        ]
      },
      {
        id: 'technicalSpecifications',
        title: 'Product Specification Builder',
        hint: 'Specification that suppliers must respond to.',
        controls: [
          { id: 'productSpecificationTemplate', label: 'Product specification table', type: 'product-spec-builder', required: true }
        ]
      },
      {
        id: 'sampleRequirements',
        title: 'Sample Requirements',
        hint: 'Enable samples only when buyers need physical samples before evaluation or award.',
        controls: [
          { id: 'requireSamples', label: 'Require Samples?', type: 'yesno' },
          {
            id: 'sampleRequirementRows',
            label: 'Sample requirement design',
            type: 'table',
            addLabel: 'Add Sample Requirement',
            emptyText: 'No sample requirements added yet.',
            requiresSourceOptions: true,
            sourceEmptyText: 'Add at least one quantity item before adding sample requirements.',
            showWhen: { field: 'requireSamples', value: 'Yes' },
            columns: [
              { id: 'relatedBoqItem', label: 'Related BOQ Item', type: 'source-select', sourceControlId: 'quantityScheduleRows', sourceLabelField: 'itemDescription' },
              { id: 'sampleRequired', label: 'Sample Required', type: 'toggle' },
              { id: 'numberOfSamples', label: 'Number of Samples', type: 'number' },
              { id: 'sampleDescription', label: 'Sample Description', type: 'textarea' },
              { id: 'deliveryLocation', label: 'Delivery Location', type: 'text' },
              { id: 'deliveryDeadline', label: 'Delivery Deadline', type: 'date' },
              { id: 'mandatory', label: 'Mandatory', type: 'toggle' },
              { id: 'returnableSample', label: 'Returnable Sample?', type: 'toggle' }
            ]
          }
        ]
      },
      financialCapacitySection(),
      {
        id: 'eligibilityRequirements',
        title: 'Other Eligibility Requirements',
        hint: 'Use add/remove requirement cards for supplier eligibility documents and notes.',
        controls: [
          {
            id: 'otherEligibilityRequirements',
            label: 'Other requirements',
            type: 'cards',
            addLabel: 'Add Requirement',
            emptyText: 'No other eligibility requirements added yet.',
            fields: [
              { id: 'requirementName', label: 'Requirement name', type: 'text' },
              { id: 'mandatory', label: 'Mandatory', type: 'toggle' },
              { id: 'requiresUpload', label: 'Requires upload', type: 'toggle' },
              { id: 'notes', label: 'Notes', type: 'textarea' }
            ],
            presets: ['Certificate of incorporation', 'Tax clearance certificate', 'Manufacturer authorization', 'Past supply contracts', 'Audited financial statements']
          }
        ]
      }
    ]
  },
  works: {
    title: 'Works Tender Requirements',
    sections: [
      {
        id: 'generalInformation',
        title: '1. Project Overview',
        hint: 'Capture the purpose, buyer context, objective, and location of the works.',
        controls: [
          { id: 'projectName', label: 'Project title', type: 'text', required: true },
          { id: 'procuringEntity', label: 'Procuring entity', type: 'text' },
          { id: 'location', label: 'Project location', type: 'text', required: true },
          { id: 'contractType', label: 'Contract type', type: 'select-custom-prompt', required: true, options: inlineOptions.worksContractTypes },
          { id: 'completionPeriod', label: 'Completion period', type: 'text' }
        ]
      },
      {
        id: 'scopeDescription',
        title: '2. Scope Description',
        hint: 'Summarize the works, major construction activities, and any project notes.',
        controls: [
          { id: 'scopeSummary', label: 'Scope Summary', type: 'textarea', required: true, maxLength: 1000, rows: 6 },
          { id: 'mainConstructionActivities', label: 'Main Activities', type: 'list', addLabel: '+ Add Activity', emptyText: 'Add the key works activities expected.' }
        ]
      },
      {
        id: 'technicalSpecifications',
        title: '3. Technical Specifications',
        hint: 'Detailed technical requirements and mandatory specification documents.',
        controls: [
          {
            id: 'technicalSpecificationDocuments',
            label: 'Technical specification documents',
            type: 'table',
            addLabel: 'Add Specification Document',
            emptyText: 'No specification documents added yet.',
            columns: [
              { id: 'documentTitle', label: 'Document title', type: 'select-custom-prompt', options: inlineOptions.worksTechnicalSpecificationTitles },
              { id: 'documentUpload', label: 'Upload document', type: 'file', accept: '.pdf,.doc,.docx,.xlsx' }
            ]
          }
        ]
      },
      {
        id: 'drawingsDesignDocuments',
        title: '4. Drawings and Design Documents',
        hint: 'Reference drawings, revisions, design consultants, and CAD/PDF uploads.',
        controls: [
          {
            id: 'drawingDesignRows',
            label: 'Drawings and design documents',
            type: 'table',
            addLabel: 'Add Drawing',
            emptyText: 'No drawings or design documents added yet.',
            columns: [
              { id: 'documentType', label: 'Document type', type: 'select', options: inlineOptions.worksDocumentTypes },
              { id: 'otherDocumentName', label: 'Other document name', type: 'text', showWhen: { field: 'documentType', value: 'Other' } },
              { id: 'buyerDocumentUpload', label: 'CAD / PDF upload', type: 'file', accept: '.pdf,.dwg,.dxf,.jpg,.jpeg,.png' }
            ]
          }
        ]
      },
      {
        id: 'boqRequirements',
        title: '5. Bill of Quantities (BoQ) / Pricing Schedule',
        hint: 'Commercial breakdown of works. Lump Sum uses summary pricing; Unit Price uses detailed measured items.',
        controls: [
          {
            id: 'lumpSumPricingRows',
            label: 'Summary pricing schedule',
            type: 'table',
            addLabel: 'Add Pricing Section',
            emptyText: 'No summary pricing sections added yet.',
            showWhen: { field: 'contractType', value: 'Lump Sum Contract' },
            columns: [
              { id: 'section', label: 'Section', type: 'text' },
              { id: 'description', label: 'Description', type: 'textarea' },
              { id: 'amount', label: 'Amount', type: 'currency' }
            ]
          },
          {
            id: 'boqRows',
            label: 'Bill of Quantities table',
            type: 'table',
            addLabel: 'Add BOQ Line',
            importLabel: 'Import Excel',
            emptyText: 'No BOQ lines added yet.',
            columns: [
              { id: 'itemNumber', label: 'No.', type: 'index' },
              { id: 'description', label: 'Description', type: 'text' },
              { id: 'unit', label: 'Unit', type: 'select', ...masterOptions('units') },
              { id: 'quantity', label: 'Quantity', type: 'number' },
              { id: 'rate', label: 'Rate', type: 'currency' },
              { id: 'totalAmount', label: 'Total amount', type: 'calculated', formula: 'quantity*rate' }
            ]
          }
        ]
      },
      {
        id: 'technicalCapacity',
        title: 'Technical Capacity',
        hint: 'Turn each technical capacity evidence requirement on or off.',
        controls: [
          { id: 'similarCompletedProjectsRequired', label: 'Similar completed projects', type: 'toggle' },
          { id: 'keyPersonnelCvsRequired', label: 'Key personnel CVs', type: 'toggle' },
          { id: 'bankStatementsRequired', label: 'Bank statements', type: 'toggle' },
          { id: 'bankStatementPeriod', label: 'Bank statement period', type: 'textarea', showWhen: { field: 'bankStatementsRequired', value: true } }
        ]
      },
      financialCapacitySection()
    ]
  },
  services: {
    title: 'Service Tender Requirements',
    sections: [
      {
        id: 'serviceDefinition',
        title: 'Service Definition',
        hint: 'Core mandatory details for the service being procured.',
        controls: [
          { id: 'serviceCategory', label: 'Service category', type: 'select', required: true, options: inlineOptions.serviceCategories },
          { id: 'scopeOfServices', label: 'Scope of services', type: 'textarea', required: true },
          { id: 'serviceLocations', label: 'Service locations', type: 'list', addLabel: 'Add Service Location', emptyText: 'No service locations added yet.' },
          { id: 'duration', label: 'Duration', type: 'text' }
        ]
      },
      {
        id: 'serviceBoq',
        title: 'Bill of Quantities (BOQ)',
        hint: 'Line-item BOQ schedule for the service items suppliers should price.',
        controls: [
          {
            id: 'serviceBoqRows',
            label: 'BOQ table',
            type: 'table',
            addLabel: 'Add BOQ Line',
            importLabel: 'Import Excel',
            emptyText: 'No BOQ lines added yet.',
            columns: [
              { id: 'itemNumber', label: 'No.', type: 'index' },
              { id: 'description', label: 'Description', type: 'text' },
              { id: 'unit', label: 'Unit', type: 'select', ...masterOptions('units') },
              { id: 'quantity', label: 'Quantity', type: 'number' },
              { id: 'rate', label: 'Rate', type: 'currency' },
              { id: 'totalAmount', label: 'Total amount', type: 'calculated', formula: 'quantity*rate' }
            ]
          }
        ]
      },
      financialCapacitySection(),
      {
        id: 'staffingRequirements',
        title: 'Personnel Requirements',
        hint: 'Position-based personnel requirements for labor-based and professional services.',
        controls: [
          {
            id: 'personnelRequirementRows',
            label: 'Personnel table',
            type: 'table',
            addLabel: 'Add Personnel Requirement',
            emptyText: 'No personnel requirements added yet.',
            columns: [
              { id: 'position', label: 'Role / position', type: 'text' },
              { id: 'minimumEducation', label: 'Minimum education', type: 'select', options: inlineOptions.educationLevels },
              { id: 'minimumYearsExperience', label: 'Experience(Years)', type: 'number' },
              { id: 'cvRequired', label: 'CV required', type: 'toggle' },
              { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
            ]
          }
        ]
      },
      {
        id: 'securityRequirements',
        title: 'Security Service Requirements',
        hint: 'Shown for security tenders: guards, shifts, patrols, weapons, and control room requirements.',
        showWhen: { field: 'serviceCategory', value: 'Security' },
        controls: [
          { id: 'numberOfGuards', label: 'Number of guards', type: 'number' },
          { id: 'shiftSchedule', label: 'Shift schedule', type: 'text' },
          { id: 'patrolFrequency', label: 'Patrol frequency', type: 'select', options: inlineOptions.frequency },
          { id: 'weaponRequirement', label: 'Weapons requirement', type: 'textarea' },
          { id: 'controlRoomRequirement', label: 'Control room requirement', type: 'textarea' }
        ]
      },
      {
        id: 'cleaningRequirements',
        title: 'Cleaning Service Requirements',
        hint: 'Shown for cleaning tenders: schedules, materials, areas, and waste disposal.',
        showWhen: { field: 'serviceCategory', value: 'Cleaning' },
        controls: [
          { id: 'cleaningAreas', label: 'Cleaning areas', type: 'textarea' },
          { id: 'cleaningFrequency', label: 'Cleaning frequency', type: 'select', options: inlineOptions.frequency },
          { id: 'cleaningMaterials', label: 'Cleaning materials', type: 'textarea' },
          { id: 'wasteDisposalRequirements', label: 'Waste disposal requirements', type: 'textarea' }
        ]
      },
      {
        id: 'deliverablesSection',
        title: 'Deliverables and Reports',
        hint: 'Shown for consultancy, IT implementation, research, audits, and training services.',
        showWhen: { field: 'serviceCategory', values: ['Consultancy', 'IT Support', 'Training', 'Other'] },
        controls: [
          { id: 'serviceDeliverables', label: 'Deliverables', type: 'list', addLabel: 'Add Deliverable', emptyText: 'No deliverables added yet.' },
          { id: 'serviceMilestones', label: 'Milestones', type: 'list', addLabel: 'Add Milestone', emptyText: 'No milestones added yet.' },
          { id: 'reportingRequirements', label: 'Reporting requirements', type: 'textarea' }
        ]
      },
      {
        id: 'equipmentRequirements',
        title: 'Equipment Requirements',
        hint: 'Shown only for service categories where equipment is normally needed.',
        showWhen: { field: 'serviceCategory', values: ['Security', 'Cleaning', 'Vehicle maintenance', 'Generator maintenance', 'Maintenance', 'Catering', 'Transport / logistics'] },
        controls: [
          {
            id: 'equipmentRequirementRows',
            label: 'Equipment schedule',
            type: 'table',
            addLabel: 'Add Equipment',
            emptyText: 'No equipment requirements added yet.',
            columns: [
              { id: 'equipmentName', label: 'Equipment name', type: 'text' },
              { id: 'quantity', label: 'Minimum qty', type: 'number' },
              { id: 'ownershipRequirement', label: 'Ownership type', type: 'select', options: inlineOptions.ownershipTypes },
              { id: 'technicalSpecification', label: 'Technical specification', type: 'textarea' },
              { id: 'evidenceRequired', label: 'Evidence required', type: 'multiselect', options: inlineOptions.equipmentEvidence },
              { id: 'mandatory', label: 'Mandatory', type: 'toggle' },
              { id: 'evaluationMethod', label: 'Evaluation method', type: 'select', ...masterOptions('evaluation-methods') },
              { id: 'supplierResponseType', label: 'Response type', type: 'select', ...masterOptions('response-types') }
            ]
          }
        ]
      },
      {
        id: 'environmentalSocialRequirements',
        title: 'Environmental and Social Requirements',
        hint: 'Categorized compliance requirements for worker safety, SEA/SH, environment, and labor compliance.',
        controls: [
          {
            id: 'esRequirementCards',
            label: 'ES requirements',
            type: 'cards',
            addLabel: 'Add ES Requirement',
            emptyText: 'No environmental or social requirements added yet.',
            cardTitleField: 'category',
            cardTitlePrefix: 'ES requirement for',
            fields: [
              { id: 'category', label: 'Category', type: 'select', options: inlineOptions.esCategories },
              { id: 'description', label: 'Description', type: 'textarea' },
              { id: 'evidenceRequired', label: 'Evidence required', type: 'tag-select', options: inlineOptions.esEvidence },
              { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
            ]
          }
        ]
      },
      sharedSupportingDocuments
    ]
  },
  consultancy: {
    title: 'Consultancy Tender Requirements',
    sections: [
      {
        id: 'consultancyIntroduction',
        title: '1. Introduction',
        hint: 'Provides assignment background, procuring entity context, project background, and the problem statement.',
        controls: [
          {
            id: 'consultancyEntityBackground',
            label: '1.1 Procuring Entity Background',
            type: 'cards',
            addLabel: 'Add Entity Background',
            emptyText: 'No procuring entity background captured yet.',
            cardTitle: 'Procuring entity background',
            fields: [
              { id: 'organizationBackground', label: 'Organization Background', type: 'richtext', required: true },
              { id: 'departmentUnit', label: 'Department / Unit', type: 'select-custom-prompt', options: ['Procurement Management Unit', 'Finance', 'Planning', 'ICT', 'Engineering', 'Legal', 'User Department', 'Other'] }
            ],
            defaultValue: []
          },
          {
            id: 'consultancyProjectBackground',
            label: '1.2 Project Background',
            type: 'accordion',
            panels: [
              { id: 'projectName', label: 'Project Name', type: 'text' },
              { id: 'backgroundNarrative', label: 'Background Narrative', type: 'richtext' },
              { id: 'existingChallenges', label: 'Existing Challenges', type: 'richtext' },
              { id: 'currentSituation', label: 'Current Situation', type: 'richtext' },
              { id: 'relatedInitiatives', label: 'Related Initiatives', type: 'richtext' }
            ]
          },
          {
            id: 'consultancyProblemStatement',
            label: '1.3 Problem Statement',
            type: 'accordion',
            panels: [
              { id: 'mainProblemDescription', label: 'Main Problem Description', type: 'richtext' },
              { id: 'expectedImpact', label: 'Expected Impact', type: 'richtext' }
            ]
          }
        ]
      },
      {
        id: 'consultancyObjectives',
        title: '2. Objectives of the Consultancy',
        hint: 'Defines the general objective and specific outcomes expected from the assignment.',
        controls: [
          { id: 'consultancyGeneralObjective', label: '2.1 General Objective', type: 'richtext', required: true },
          {
            id: 'consultancySpecificObjectives',
            label: '2.2 Specific Objectives',
            type: 'cards',
            addLabel: 'Add Objective',
            emptyText: 'No specific objectives added yet.',
            cardTitleField: 'objectiveTitle',
            fields: [
              { id: 'objectiveTitle', label: 'Objective Title', type: 'text' },
              { id: 'objectiveDescription', label: 'Objective Description', type: 'textarea' },
              { id: 'priorityLevel', label: 'Priority Level', type: 'select', options: ['High', 'Medium', 'Low'] }
            ],
            defaultValue: []
          }
        ]
      },
      {
        id: 'consultancyScopeServices',
        title: '3. Scope of Consultancy Services',
        hint: 'Defines assignment activities and assignment boundaries.',
        controls: [
          {
            id: 'consultancyAssignmentActivities',
            label: '3.1 Assignment Activities',
            type: 'table',
            addLabel: 'Add Activity',
            emptyText: 'No assignment activities added yet.',
            columns: [
              { id: 'activityTitle', label: 'Activity Title', type: 'text' },
              { id: 'detailedDescription', label: 'Detailed Description', type: 'richtext' },
              { id: 'expectedOutput', label: 'Expected Output', type: 'text' },
              { id: 'location', label: 'Location', type: 'text' },
              { id: 'duration', label: 'Duration', type: 'number', suffix: 'days' }
            ]
          },
          {
            id: 'consultancyAssignmentBoundaries',
            label: '3.2 Assignment Boundaries',
            type: 'accordion',
            panels: [
              { id: 'outOfScopeActivities', label: 'Out-of-Scope Activities', type: 'richtext' }
            ]
          }
        ]
      },
      {
        id: 'consultancyDeliverablesTimeline',
        title: '5. Deliverables and Timeline',
        hint: 'Defines expected outputs and reporting requirements.',
        controls: [
          {
            id: 'consultancyDeliverables',
            label: '5.1 Deliverables',
            type: 'table',
            addLabel: 'Add Deliverable',
            emptyText: 'No deliverables added yet.',
            columns: [
              { id: 'deliverableName', label: 'Deliverable Name', type: 'text' },
              { id: 'description', label: 'Description', type: 'richtext' },
              { id: 'submissionTimeline', label: 'Submission Timeline', type: 'text', placeholder: 'e.g. 2 weeks or 2026-06-30' },
              { id: 'formatRequired', label: 'Format Required', type: 'select', options: ['PDF', 'Word', 'Excel', 'PowerPoint', 'Hard copy', 'Soft copy', 'Other'] },
              { id: 'submissionChannel', label: 'Submission Channel', type: 'select-custom-prompt', options: ['Procurement portal', 'Email', 'Physical submission', 'Project meeting', 'Other'] },
              { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
            ]
          },
          {
            id: 'consultancyReportingRequirements',
            label: '5.2 Reporting Requirements',
            type: 'table',
            addLabel: 'Add Reporting Requirement',
            emptyText: 'No reporting requirements added yet.',
            columns: [
              { id: 'reportType', label: 'Report Type', type: 'select', options: ['Weekly progress report', 'Monthly report', 'Inception report', 'Draft report', 'Final report', 'Ad hoc report'] },
              { id: 'frequency', label: 'Frequency', type: 'select', options: inlineOptions.frequency },
              { id: 'submissionFormat', label: 'Submission Format', type: 'select', options: ['PDF', 'Word', 'Excel', 'PowerPoint', 'Hard copy', 'Soft copy'] },
              { id: 'submissionChannel', label: 'Submission Channel', type: 'select', options: ['Procurement portal', 'Email', 'Physical submission', 'Project meeting', 'Other'] }
            ]
          }
        ]
      },
      {
        id: 'consultancyQualificationsExperience',
        title: '6. Required Qualifications and Experience',
        hint: 'Separates requirements for individual consultants or sole proprietors from consulting firms.',
        controls: [
          {
            id: 'consultancyIndividualQualifications',
            label: '6.1 Individual / Sole Proprietor',
            type: 'cards',
            hideAdd: true,
            fields: [
              { id: 'minimumQualification', label: 'Minimum Qualification', type: 'select-custom-prompt', options: inlineOptions.educationLevels },
              { id: 'professionalRegistration', label: 'Professional Registration', type: 'repeatable-certification', ...masterOptions('professional-bodies') },
              { id: 'yearsExperience', label: 'Years Experience', type: 'number' },
              { id: 'cvRequired', label: 'CV required', type: 'toggle' }
            ]
          },
          {
            id: 'consultancyFirmExperience',
            label: '6.2 Firm Experience',
            type: 'cards',
            hideAdd: true,
            fields: [
              { id: 'similarAssignments', label: 'Similar Assignments', type: 'textarea' },
              { id: 'certifications', label: 'Certifications', type: 'multiselect', ...masterOptions('certifications') },
              { id: 'mandatory', label: 'Mandatory', type: 'toggle' }
            ]
          }
        ]
      },
      sharedSupportingDocuments
    ]
  }
};

export function getProcurementDesignFormSchemas(): DesignFormSchemaDto[] {
  return designFormSchemaTypeValues.map((type) => cloneSchema(type));
}

export function getProcurementDesignFormSchema(type: string): DesignFormSchemaDto | null {
  const normalized = type.trim().toLowerCase();
  if (!isFormSchemaType(normalized)) return null;
  return cloneSchema(normalized);
}

function cloneSchema(type: FormSchemaType): DesignFormSchemaDto {
  return clone({
    schemaVersion: procurementDesignSchemaVersion,
    type,
    tenderType: tenderTypeLabels[type],
    ...schemaSections[type]
  });
}

function isFormSchemaType(type: string): type is FormSchemaType {
  return (designFormSchemaTypeValues as readonly string[]).includes(type);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
