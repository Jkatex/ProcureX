import type {
  CreateTenderConsultancyRequirements,
  CreateTenderDraft,
  CreateTenderEvaluationCriterion,
  CreateTenderProcurementTypeId,
  CreateTenderServiceRequirements,
  CreateTenderSetup,
  CreateTenderWorksRequirements
} from './types';

export const createTenderSetup: CreateTenderSetup = {
  procurementTypes: [
    { id: 'goods', label: 'Goods', description: 'Physical items, equipment, stock, and supplies.' },
    { id: 'works', label: 'Works', description: 'Construction, rehabilitation, infrastructure, and civil works.' },
    { id: 'services', label: 'Non Consultancy', description: 'Operational services where advisory expertise is not the main component.' },
    { id: 'consultancy', label: 'Consultancy', description: 'Professional advisory, research, design, audit, and expert assignments.' }
  ],
  categories: {
    goods: [
      'Medical equipment',
      'Computer equipment and accessories',
      'Motor vehicles',
      'Water meters and spare parts',
      'Construction materials',
      'Classroom furniture',
      'Telecommunication equipment',
      'Cleaning equipment and supplies',
      'Others'
    ],
    works: [
      'Healthcare infrastructure',
      'Roads and bridges',
      'Water supply works',
      'Building construction',
      'Electrical works',
      'Civil works',
      'Mechanical installations',
      'Renovation and finishing',
      'Others'
    ],
    services: [
      'Facilities maintenance',
      'Security services',
      'Cleaning services',
      'Transport and logistics',
      'Catering services',
      'ICT support',
      'Waste management',
      'Training services',
      'Others'
    ],
    consultancy: [
      'Feasibility study',
      'Engineering design',
      'Audit services',
      'Legal advisory',
      'Environmental assessment',
      'Project management',
      'Research services',
      'Training consultancy',
      'Others'
    ]
  },
  fundingSources: ['Government budget', 'Development partner grant', 'Internally generated funds', 'Project loan', 'Corporate operating budget', 'Other'],
  currencies: ['TZS', 'USD', 'EUR', 'GBP'],
  procurementMethods: ['Open Tender', 'Invited Tender', 'Restricted Tender', 'Framework Call-Off'],
  regulatoryLicenses: {
    goods: ['Manufacturer authorization', 'Product certification', 'Tax clearance', 'Business license'],
    works: ['Contractor registration', 'Site safety plan', 'Environmental compliance', 'Tax clearance'],
    services: ['Service provider license', 'Labour compliance', 'Insurance certificate', 'Tax clearance'],
    consultancy: ['Professional registration', 'Firm registration', 'Conflict of interest declaration', 'Tax clearance']
  },
  milestoneDefaults: ['Tender publication', 'Clarification deadline', 'Bid submission deadline', 'Opening session', 'Evaluation completion'],
  requirementTemplates: [
    {
      id: 'goods-specification',
      typeId: 'goods',
      title: 'Quantity Schedule and Product Specifications',
      description: 'Capture the bill of quantities, delivery expectations, warranty, and technical standards.',
      controls: [
        { id: 'goods_specifications', label: 'Technical specifications', kind: 'textarea' },
        { id: 'goods_delivery', label: 'Delivery location and schedule', kind: 'textarea' },
        { id: 'goods_warranty', label: 'Warranty and after-sales support', kind: 'textarea' },
        { id: 'goods_standard', label: 'Applicable product standard', kind: 'text' }
      ]
    },
    {
      id: 'works-scope',
      typeId: 'works',
      title: 'Works Scope, Site, and BOQ',
      description: 'Define the work package, site obligations, drawings, method statements, and construction schedule.',
      controls: [
        { id: 'works_scope', label: 'Scope of works', kind: 'textarea' },
        { id: 'works_site', label: 'Site location and access notes', kind: 'textarea' },
        { id: 'works_boq', label: 'BOQ and pricing instructions', kind: 'textarea' },
        { id: 'works_completion', label: 'Expected completion period', kind: 'text' }
      ]
    },
    {
      id: 'services-levels',
      typeId: 'services',
      title: 'Service Scope and Service Levels',
      description: 'Describe recurring services, resources, response standards, reporting, and governance.',
      controls: [
        { id: 'services_scope', label: 'Service scope', kind: 'textarea' },
        { id: 'services_sla', label: 'Service levels and response time', kind: 'textarea' },
        { id: 'services_staffing', label: 'Staffing and supervision requirements', kind: 'textarea' },
        { id: 'services_reporting', label: 'Reporting frequency', kind: 'select', options: ['Weekly', 'Monthly', 'Quarterly', 'On completion'] }
      ]
    },
    {
      id: 'consultancy-tor',
      typeId: 'consultancy',
      title: 'Terms of Reference and Deliverables',
      description: 'Set the assignment objective, methodology, team qualifications, deliverables, and reporting structure.',
      controls: [
        { id: 'consultancy_objective', label: 'Assignment objective', kind: 'textarea' },
        { id: 'consultancy_methodology', label: 'Methodology expectations', kind: 'textarea' },
        { id: 'consultancy_team', label: 'Key expert qualifications', kind: 'textarea' },
        { id: 'consultancy_reports', label: 'Reports and deliverables', kind: 'textarea' }
      ]
    }
  ],
  evaluationCatalog: [
    {
      id: 'goods-technical-compliance',
      label: 'Technical Compliance',
      category: 'Technical Compliance',
      weight: 40,
      notes: 'Specification compliance, standards, product performance, and compatibility.',
      suggestedFor: ['goods'],
      evaluationType: 'specification_compliance',
      evidenceRequired: ['Specification response', 'Product catalogue', 'Datasheet'],
      subcriteria: [
        'Conformity to technical specifications',
        'Compliance with standards (ISO, TBS, etc.)',
        'Brand/model compliance',
        'Product performance characteristics',
        'Sample evaluation / testing results',
        'Compatibility with existing systems/equipment'
      ]
    },
    {
      id: 'goods-financial',
      label: 'Financial',
      category: 'Financial',
      weight: 30,
      notes: 'Evaluated price and commercial completeness.',
      suggestedFor: ['goods'],
      evaluationType: 'price_based',
      evidenceRequired: ['Completed quantity schedule', 'Financial offer'],
      subcriteria: ['Total price', 'Price competitiveness', 'Cost of maintenance']
    },
    {
      id: 'goods-delivery-logistics',
      label: 'Delivery and Logistics',
      category: 'Delivery and Logistics',
      weight: 15,
      notes: 'Delivery timing, stock availability, logistics, and installation readiness.',
      suggestedFor: ['goods'],
      evaluationType: 'delivery_based',
      evidenceRequired: ['Delivery schedule', 'Logistics plan'],
      subcriteria: [
        'Delivery time compliance',
        'Availability of stock',
        'Supply chain reliability',
        'Packaging and transportation method',
        'Installation requirement compliance'
      ]
    },
    {
      id: 'goods-quality-assurance',
      label: 'Quality Assurance',
      category: 'Quality Assurance',
      weight: 10,
      notes: 'Warranty, after-sales support, return policy, and certification.',
      suggestedFor: ['goods'],
      evaluationType: 'warranty_support',
      evidenceRequired: ['Warranty letter', 'Quality certificate'],
      subcriteria: ['Warranty period offered', 'After-sales support availability', 'Replacement/return policy', 'Quality certification of manufacturer']
    },
    {
      id: 'goods-supplier-capability',
      label: 'Supplier Capability',
      category: 'Supplier Capability',
      weight: 5,
      notes: 'Past supply performance, financial capacity, local support, and authorization.',
      suggestedFor: ['goods'],
      evaluationType: 'document_check',
      evidenceRequired: ['Past supply contracts', 'Manufacturer authorization', 'Financial capacity evidence'],
      subcriteria: [
        'Past performance / similar supply experience',
        'Financial capacity of supplier',
        'Local presence / support office',
        'Authorized distributor/manufacturer status'
      ]
    },
    {
      id: 'works-technical-methodology',
      label: 'Technical Methodology',
      category: 'Technical Methodology',
      weight: 20,
      notes: 'Construction methodology, execution planning, risk, quality, and environmental controls.',
      suggestedFor: ['works'],
      evaluationType: 'scored',
      evidenceRequired: ['Construction methodology', 'Work execution plan', 'Risk mitigation plan', 'Quality assurance approach'],
      subcriteria: [
        'Construction methodology',
        'Work execution plan',
        'Site mobilization strategy',
        'Risk management approach',
        'Quality control plan',
        'Environmental management plan'
      ]
    },
    {
      id: 'works-personnel',
      label: 'Personnel',
      category: 'Personnel',
      weight: 15,
      notes: 'Qualifications, role experience, and availability of key personnel.',
      suggestedFor: ['works'],
      evaluationType: 'scored',
      evidenceRequired: ['Key personnel CVs', 'Professional certificates', 'Availability declaration'],
      subcriteria: [
        'Project manager qualification',
        'Site engineer qualifications',
        'Safety officer competence',
        'Key technical staff experience',
        'Availability of required personnel'
      ]
    },
    {
      id: 'works-equipment-resources',
      label: 'Equipment and Resources',
      category: 'Equipment and Resources',
      weight: 10,
      notes: 'Equipment availability, suitability, ownership, leasing, and mobilization.',
      suggestedFor: ['works'],
      evaluationType: 'scored',
      evidenceRequired: ['Equipment list', 'Ownership proof', 'Lease agreements', 'Availability declaration'],
      subcriteria: [
        'Availability of construction equipment',
        'Ownership vs leased equipment',
        'Equipment capacity and suitability',
        'Mobilization timeline for equipment'
      ]
    },
    {
      id: 'works-experience',
      label: 'Experience',
      category: 'Experience',
      weight: 15,
      notes: 'Similar completed works, value history, references, and timely completion.',
      suggestedFor: ['works'],
      evaluationType: 'scored',
      evidenceRequired: ['Similar completed project evidence', 'Completion certificates', 'Client references'],
      subcriteria: [
        'Similar completed projects',
        'Project value history',
        'Experience in similar terrain/environment',
        'Track record of timely completion'
      ]
    },
    {
      id: 'works-schedule-execution',
      label: 'Schedule and Execution',
      category: 'Schedule and Execution',
      weight: 10,
      notes: 'Work program, construction schedule, milestones, and critical path feasibility.',
      suggestedFor: ['works'],
      evaluationType: 'delivery_based',
      evidenceRequired: ['Work program', 'Construction schedule', 'Milestone plan'],
      subcriteria: [
        'Work program / timeline',
        'Milestone alignment',
        'Project completion duration',
        'Critical path feasibility'
      ]
    },
    {
      id: 'works-hse',
      label: 'Health, Safety and Environment (HSE)',
      category: 'Health, Safety and Environment (HSE)',
      weight: 10,
      notes: 'Safety planning, environmental mitigation, site records, and regulatory compliance.',
      suggestedFor: ['works'],
      evaluationType: 'document_check',
      mandatory: true,
      passFailGate: true,
      evidenceRequired: ['HSE policy', 'PPE plan', 'Safety officer assignment', 'Incident management plan', 'Waste management plan'],
      subcriteria: [
        'Safety plan compliance',
        'Environmental mitigation measures',
        'Site safety record',
        'Compliance with regulations'
      ]
    },
    {
      id: 'works-financial',
      label: 'Financial',
      category: 'Financial',
      weight: 20,
      notes: 'Priced BOQ, rate breakdown, price realism, and corrected tender sum.',
      suggestedFor: ['works'],
      evaluationType: 'price_based',
      evidenceRequired: ['Priced BOQ', 'Rate breakdown', 'Commercial terms'],
      subcriteria: ['Total BOQ price', 'Unit rate accuracy', 'Price realism', 'Corrected tender sum']
    },
    {
      id: 'services-delivery-approach',
      label: 'Service Delivery Approach',
      category: 'Service Delivery Approach',
      weight: 20,
      notes: 'Service methodology, operational planning, workflow design, and quality controls.',
      suggestedFor: ['services'],
      evaluationType: 'scored',
      evidenceRequired: ['Technical response', 'Service delivery approach', 'Work schedule', 'Quality control plan', 'Risk management approach'],
      subcriteria: ['Service methodology', 'Operational plan', 'Service execution strategy', 'Workflow design']
    },
    {
      id: 'services-staffing-personnel',
      label: 'Staffing and Personnel',
      category: 'Staffing and Personnel',
      weight: 20,
      notes: 'Staff qualifications, availability, training, and supervision structure.',
      suggestedFor: ['services'],
      evaluationType: 'scored',
      evidenceRequired: ['Staff CVs', 'Education certificates', 'Experience records', 'Professional certificates'],
      subcriteria: ['Staff qualifications', 'Staff availability', 'Training plan', 'Supervisory structure']
    },
    {
      id: 'services-service-capacity',
      label: 'Service Capacity',
      category: 'Service Capacity',
      weight: 10,
      notes: 'Coverage, resource availability, scalability, and continuity capability.',
      suggestedFor: ['services'],
      evaluationType: 'scored',
      evidenceRequired: ['Service coverage plan', 'Staff deployment plan', 'Continuity plan', 'Local support evidence'],
      subcriteria: ['Ability to scale service', 'Resource availability', 'Coverage area capability', 'Backup/contingency resources']
    },
    {
      id: 'services-sla-performance',
      label: 'SLA and Performance',
      category: 'SLA and Performance',
      weight: 20,
      notes: 'Response times, uptime, service levels, reporting, and escalation.',
      suggestedFor: ['services'],
      evaluationType: 'delivery_based',
      evidenceRequired: ['SLA response', 'Response-time commitment', 'Support-hours commitment', 'Reporting arrangement'],
      subcriteria: ['Response time', 'Resolution time', 'Service uptime guarantee', 'Reporting frequency', 'Escalation procedures']
    },
    {
      id: 'services-tools-systems',
      label: 'Tools and Systems',
      category: 'Tools and Systems',
      weight: 10,
      notes: 'Tools, systems, monitoring, reporting technology, and availability proof.',
      suggestedFor: ['services'],
      evaluationType: 'scored',
      evidenceRequired: ['Equipment list', 'Tools list', 'Systems description', 'Availability proof'],
      subcriteria: ['Use of technology/tools', 'Service management systems', 'Monitoring and reporting systems']
    },
    {
      id: 'services-experience',
      label: 'Experience',
      category: 'Experience',
      weight: 10,
      notes: 'Similar service contracts, industry experience, references, and performance history.',
      suggestedFor: ['services'],
      evaluationType: 'scored',
      evidenceRequired: ['Past service contracts', 'Client references', 'Performance records'],
      subcriteria: ['Similar service contracts', 'Industry experience', 'Client references', 'Performance history']
    },
    {
      id: 'services-financial',
      label: 'Financial',
      category: 'Financial',
      weight: 10,
      notes: 'Service BOQ, rate schedules, taxes, discounts, and value for money.',
      suggestedFor: ['services'],
      evaluationType: 'price_based',
      evidenceRequired: ['Service BOQ', 'Monthly rate schedule', 'Unit rate schedule', 'Tax and discount details'],
      subcriteria: ['Service pricing model', 'Monthly/annual cost', 'Cost per unit/service', 'Value for money']
    },
    {
      id: 'consultancy-methodology-approach',
      label: 'Methodology and Approach',
      category: 'Methodology and Approach',
      weight: 30,
      notes: 'TOR understanding, methodology quality, innovation, risk, and work plan feasibility.',
      suggestedFor: ['consultancy'],
      evaluationType: 'scored',
      maxScore: 30,
      evidenceRequired: ['Technical proposal', 'TOR understanding', 'Methodology response', 'Work plan', 'Risk and quality approach'],
      subcriteria: ['Understanding of Terms of Reference (ToR)', 'Methodology clarity', 'Technical approach quality', 'Innovation in approach', 'Risk identification and mitigation', 'Work plan and timeline']
    },
    {
      id: 'consultancy-key-experts',
      label: 'Key Experts',
      category: 'Key Experts',
      weight: 35,
      notes: 'Key expert qualifications, certifications, role relevance, and similar assignment experience.',
      suggestedFor: ['consultancy'],
      evaluationType: 'scored',
      maxScore: 35,
      evidenceRequired: ['Key expert CVs', 'Academic certificates', 'Professional certificates', 'Role assignment matrix'],
      subcriteria: ['Team leader qualification', 'Relevant academic qualifications', 'Professional certifications', 'Years of experience', 'Similar assignments handled', 'Role relevance to assignment']
    },
    {
      id: 'consultancy-firm-experience',
      label: 'Firm Experience',
      category: 'Firm Experience',
      weight: 15,
      notes: 'Similar consultancy assignments, sector experience, regional experience, and institutional capacity.',
      suggestedFor: ['consultancy'],
      evaluationType: 'scored',
      maxScore: 15,
      evidenceRequired: ['Similar assignment evidence', 'Client references', 'Completion certificates', 'Firm profile'],
      subcriteria: ['Similar consultancy assignments', 'Sector experience', 'Regional experience', 'Institutional capacity', 'Past performance record']
    },
    {
      id: 'consultancy-work-plan-organization',
      label: 'Work Plan and Organization',
      category: 'Work Plan and Organization',
      weight: 10,
      notes: 'Task allocation, schedule realism, resource allocation, and deliverable structure.',
      suggestedFor: ['consultancy'],
      evaluationType: 'scored',
      maxScore: 10,
      evidenceRequired: ['Work plan', 'Activity schedule', 'Deliverables schedule', 'Team organization chart'],
      subcriteria: ['Task allocation clarity', 'Time schedule realism', 'Resource allocation efficiency', 'Deliverable structure']
    },
    {
      id: 'consultancy-knowledge-transfer',
      label: 'Knowledge Transfer',
      category: 'Knowledge Transfer',
      weight: 10,
      notes: 'Training, capacity building, documentation, and sustainability of results.',
      suggestedFor: ['consultancy'],
      evaluationType: 'scored',
      maxScore: 10,
      evidenceRequired: ['Training plan', 'Knowledge transfer plan', 'Documentation approach'],
      subcriteria: ['Training plan for client staff', 'Capacity building approach', 'Documentation quality', 'Sustainability of results']
    },
    {
      id: 'consultancy-financial',
      label: 'Financial',
      category: 'Financial',
      weight: 0,
      notes: 'Separate financial proposal, fee breakdown, reimbursables, taxes, and validity confirmation.',
      suggestedFor: ['consultancy'],
      evaluationType: 'price_based',
      maxScore: 0,
      evidenceRequired: ['Separate financial proposal', 'Fee breakdown', 'Reimbursables schedule', 'Tax and validity confirmation'],
      subcriteria: ['Total consultancy fee', 'Breakdown of costs', 'Cost realism', 'Budget alignment', 'Price competitiveness']
    }
  ]
};

export function createEmptyConsultancyRequirements(): CreateTenderConsultancyRequirements {
  return {
    entityBackgroundCards: [],
    projectName: '',
    backgroundNarrative: '',
    existingChallenges: '',
    currentSituation: '',
    relatedInitiatives: '',
    mainProblemDescription: '',
    expectedImpact: '',
    generalObjective: '',
    specificObjectiveRows: [],
    assignmentActivityRows: [],
    outOfScopeActivities: '',
    clientResponsibilityRows: [],
    consultantResponsibilityRows: [],
    deliverableRows: [],
    reportingRequirementRows: [],
    individualProfessionalCertifications: [],
    individualCvRequired: 'Required',
    individualYearsExperience: '',
    individualSimilarAssignmentsCount: '',
    individualSimilarAssignmentsEvidenceRequired: 'Required',
    firmMinimumYearsExperience: '',
    firmRequiredSimilarAssignments: '',
    firmSectorExperience: [],
    firmRequiredEvidence: 'Required',
    keyExpertRows: [],
    consultantReportsTo: '',
    supervisingOfficer: '',
    approvalAuthority: '',
    meetingFrequency: '',
    coordinationMechanism: '',
    communicationMethods: [],
    officeSpaceProvided: false,
    accessToFacilities: false,
    accessToDocuments: false,
    supportingDocumentRows: [],
    externalReferenceRows: []
  };
}

export function createEmptyWorksRequirements(): CreateTenderWorksRequirements {
  return {
    projectName: '',
    procuringEntity: '',
    location: '',
    contractType: '',
    customContractType: '',
    completionPeriod: '',
    scopeSummary: '',
    mainConstructionActivities: [],
    technicalSpecificationDocuments: [],
    drawingDesignRows: [],
    lumpSumPricingRows: [],
    boqRows: [],
    commencementDate: '',
    worksCompletionPeriod: '',
    worksMilestoneRows: [],
    siteVisitRequirement: 'Not mandatory',
    siteSurveyUploadName: '',
    similarCompletedProjectsRequired: false,
    keyPersonnelCvsRequired: false,
    bankStatementsRequired: false,
    bankStatementPeriod: ''
  };
}

export function createEmptyServiceRequirements(): CreateTenderServiceRequirements {
  return {
    serviceCategory: '',
    scopeOfServices: '',
    serviceLocations: [],
    duration: '',
    serviceBoqRows: [],
    personnelRequirementRows: [],
    numberOfGuards: '',
    shiftSchedule: '',
    patrolFrequency: '',
    weaponRequirement: '',
    controlRoomRequirement: '',
    cleaningAreas: '',
    cleaningFrequency: '',
    cleaningMaterials: '',
    wasteDisposalRequirements: '',
    serviceDeliverables: [],
    serviceMilestones: [],
    reportingRequirements: '',
    slaRequirement: '',
    uptimeRequirement: '',
    responseTime: '',
    supportHours: '',
    maintenanceSchedule: '',
    sparePartsRequirement: '',
    technicianRequirements: '',
    menuRequirements: '',
    hygieneRequirements: '',
    foodCertifications: [],
    fleetRequirements: '',
    driverLicenseRequirements: '',
    routeCoverage: '',
    equipmentRequirementRows: [],
    esRequirementCards: [],
    supportingDocumentRows: [],
    insuranceCovers: [],
    insuranceNotes: '',
    riskAssessmentRequirement: '',
    safetyPlanRequirement: '',
    ppeRequirements: ''
  };
}

export function createEmptyTenderDraft(now = new Date()): CreateTenderDraft {
  const timestamp = now.toISOString();
  return {
    id: `draft-${now.getTime()}`,
    status: 'DRAFT',
    title: '',
    reference: `PX-DRAFT-${now.getFullYear()}-${String(now.getTime()).slice(-5)}`,
    description: '',
    procuringEntity: '',
    fundingSource: '',
    customFundingSource: '',
    currency: 'TZS',
    estimatedBudget: '',
    contact: { name: '', role: '', department: '', email: '', phone: '', verifiedEmail: false, verifiedPhone: false },
    submissionDate: '',
    openingDate: '',
    clarificationDeadline: '',
    publicationDate: '',
    location: '',
    procurementTypeId: 'goods',
    categories: [],
    method: 'Open Tender',
    invitedSuppliers: [],
    requirements: {},
    selectedLicenses: [],
    commercialItems: [],
    productSpecifications: [],
    sampleRequirements: [],
    financialRequirements: [],
    eligibilityRequirements: [],
    regulatoryLicenseRequirements: [],
    consultancyRequirements: createEmptyConsultancyRequirements(),
    serviceRequirements: createEmptyServiceRequirements(),
    worksRequirements: createEmptyWorksRequirements(),
    deliverables: [],
    attachments: [],
    milestones: createTenderSetup.milestoneDefaults.map((label, index) => ({ id: `milestone-${index + 1}`, label, dueDate: '' })),
    evaluationCriteria: getSuggestedCriteria('goods'),
    confirmations: { accuracy: false, compliance: false, evaluation: false, publication: false },
    planFilledFields: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function getSuggestedCriteria(typeId: CreateTenderProcurementTypeId): CreateTenderEvaluationCriterion[] {
  const suggested = createTenderSetup.evaluationCatalog.filter((criterion) => criterion.suggestedFor.includes(typeId)).slice(0, 4);
  if (typeId === 'goods' || typeId === 'works' || typeId === 'services' || typeId === 'consultancy') {
    return createTenderSetup.evaluationCatalog
      .filter((criterion) => criterion.suggestedFor.includes(typeId))
      .map((criterion) => ({ ...criterion, subcriteria: [...(criterion.subcriteria ?? [])], evidenceRequired: [...(criterion.evidenceRequired ?? [])], maxScore: criterion.maxScore ?? criterion.weight }));
  }
  const total = suggested.reduce((sum, criterion) => sum + criterion.weight, 0);
  return suggested.map((criterion) => ({ ...criterion, weight: Math.round((criterion.weight / total) * 100) }));
}

export function toTenderType(typeId: CreateTenderProcurementTypeId) {
  if (typeId === 'services') return 'SERVICE' as const;
  return typeId.toUpperCase() as 'GOODS' | 'WORKS' | 'CONSULTANCY';
}
