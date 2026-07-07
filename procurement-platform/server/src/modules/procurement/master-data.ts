import { masterDataGroupValues, type MasterDataGroup, type MasterDataGroupDto, type MasterDataItemDto } from './types.js';

type CatalogInputItem = Omit<MasterDataItemDto, 'value' | 'isActive' | 'sortOrder'> & Partial<Pick<MasterDataItemDto, 'value' | 'isActive' | 'sortOrder'>>;

function item(code: string, label: string, sortOrder: number, input: Partial<CatalogInputItem> = {}): MasterDataItemDto {
  return {
    code,
    label,
    value: input.value ?? label,
    isActive: input.isActive ?? true,
    sortOrder
  };
}

const catalog = {
  'tender-types': [
    item('GOODS', 'Goods', 10),
    item('WORKS', 'Works', 20),
    item('SERVICE', 'Non Consultancy', 30),
    item('CONSULTANCY', 'Consultancy', 40)
  ],
  'procurement-methods': [
    item('OPEN_TENDER', 'Open Tender', 10),
    item('INVITED_TENDER', 'Invited Tender', 20)
  ],
  categories: [
    item('ICT_EQUIPMENT', 'ICT Equipment', 10),
    item('OFFICE_RENOVATION', 'Office Renovation', 20),
    item('CLEANING_SERVICES', 'Cleaning Services', 30),
    item('SECURITY_SERVICES', 'Security Services', 40),
    item('SYSTEM_AUDIT', 'System Audit', 50),
    item('TRAINING', 'Training', 60),
    item('MEDICAL_EQUIPMENT', 'Medical Equipment', 70),
    item('CONSTRUCTION_WORKS', 'Construction Works', 80),
    item('CONSULTANCY_SERVICES', 'Consultancy Services', 90),
    item('OTHERS', 'Others', 100)
  ],
  currencies: [
    item('TZS', 'TZS', 10, { value: 'TZS' }),
    item('USD', 'USD', 20, { value: 'USD' })
  ],
  units: [
    item('EACH', 'Each', 10),
    item('LOT', 'Lot', 20),
    item('PIECE', 'Piece', 30),
    item('SET', 'Set', 40),
    item('MONTH', 'Month', 50),
    item('DAY', 'Day', 60),
    item('HOUR', 'Hour', 70),
    item('METER', 'Meter', 80),
    item('SQUARE_METER', 'Square Meter', 90)
  ],
  'funding-sources': [
    item('GOVERNMENT_BUDGET', 'Government Budget', 10),
    item('DONOR_FUNDED', 'Donor Funded', 20),
    item('OWN_SOURCE', 'Own Source', 30),
    item('DEVELOPMENT_PARTNER', 'Development Partner', 40),
    item('PROJECT_FUND', 'Project Fund', 50)
  ],
  'evaluation-methods': [
    item('LOWEST_EVALUATED_COST', 'Lowest Evaluated Cost', 10),
    item('QUALITY_AND_COST_BASED', 'Quality and Cost Based', 20),
    item('TECHNICAL_COMPLIANCE', 'Technical Compliance', 30),
    item('LEAST_COST', 'Least Cost', 40),
    item('FIXED_BUDGET', 'Fixed Budget', 50)
  ],
  'response-types': [
    item('TEXT', 'Text', 10),
    item('NUMBER', 'Number', 20),
    item('CURRENCY', 'Currency', 30),
    item('DATE', 'Date', 40),
    item('BOOLEAN', 'Boolean', 50),
    item('SINGLE_SELECT', 'Single Select', 60),
    item('MULTI_SELECT', 'Multi Select', 70),
    item('FILE_UPLOAD', 'File Upload', 80)
  ],
  standards: [
    item('ISO_9001', 'ISO 9001', 10),
    item('ISO_27001', 'ISO 27001', 20),
    item('ISO_14001', 'ISO 14001', 30),
    item('TBS_STANDARD', 'TBS Standard', 40),
    item('PPRA_GUIDELINE', 'PPRA Guideline', 50)
  ],
  certifications: [
    item('BUSINESS_LICENSE', 'Business License', 10),
    item('TAX_CLEARANCE', 'Tax Clearance', 20),
    item('VAT_REGISTRATION', 'VAT Registration', 30),
    item('MANUFACTURER_AUTHORIZATION', 'Manufacturer Authorization', 40),
    item('PROFESSIONAL_CERTIFICATE', 'Professional Certificate', 50)
  ],
  'regulatory-licenses': [
    item('BRELA_REGISTRATION', 'BRELA Registration', 10),
    item('TRA_TIN', 'TRA TIN', 20),
    item('OSHA_COMPLIANCE', 'OSHA Compliance', 30),
    item('EWURA_LICENSE', 'EWURA License', 40),
    item('TCRA_LICENSE', 'TCRA License', 50),
    item('CRB_REGISTRATION', 'CRB Registration', 60)
  ],
  'professional-bodies': [
    item('ERB', 'ERB', 10, { value: 'ERB' }),
    item('NBAA', 'NBAA', 20, { value: 'NBAA' }),
    item('AQRB', 'AQRB', 30, { value: 'AQRB' }),
    item('CRB', 'CRB', 40, { value: 'CRB' }),
    item('TLS', 'TLS', 50, { value: 'TLS' }),
    item('ICT_COMMISSION', 'ICT Commission', 60)
  ]
} satisfies Record<MasterDataGroup, MasterDataItemDto[]>;

function cloneGroup(group: MasterDataGroup): MasterDataGroupDto {
  return {
    group,
    items: [...catalog[group]].sort((a, b) => a.sortOrder - b.sortOrder).map((entry) => ({ ...entry }))
  };
}

export function getProcurementMasterDataGroups(): MasterDataGroupDto[] {
  return masterDataGroupValues.map((group) => cloneGroup(group));
}

export function getProcurementMasterDataGroup(group: string): MasterDataGroupDto | null {
  if (!isMasterDataGroup(group)) return null;
  return cloneGroup(group);
}

export function getProcurementMasterDataOptions(group: MasterDataGroup): string[] {
  return cloneGroup(group).items.filter((entry) => entry.isActive).map((entry) => entry.value);
}

function isMasterDataGroup(group: string): group is MasterDataGroup {
  return (masterDataGroupValues as readonly string[]).includes(group);
}
