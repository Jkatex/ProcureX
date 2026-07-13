import { TenderType } from '@prisma/client';
import type {
  CategoryStandardizationDto,
  CategoryStandardizationResultDto,
  ProcurementTaxonomyCategoryDto,
  ProcurementTaxonomyResponseDto
} from './types.js';

export const procurementTaxonomyVersion = 'procurement-taxonomy-v1';

type TaxonomyEntry = {
  code: string;
  label: string;
  type: TenderType;
  synonyms: string[];
  sortOrder: number;
};

const taxonomy: TaxonomyEntry[] = [
  entry('ICT_EQUIPMENT', 'ICT Equipment', TenderType.GOODS, 10, ['computer supplies', 'it equipment', 'ict supplies', 'laptops', 'laptop computers', 'desktop computers', 'printers', 'network equipment']),
  entry('MEDICAL_EQUIPMENT', 'Medical Equipment', TenderType.GOODS, 20, ['health', 'health goods', 'medical supplies', 'diagnostic equipment', 'hospital equipment', 'laboratory equipment', 'clinical equipment']),
  entry('OFFICE_SUPPLIES', 'Office Supplies', TenderType.GOODS, 30, ['stationery', 'office stationery', 'paper supplies', 'printing supplies']),
  entry('OFFICE_RENOVATION', 'Office Renovation', TenderType.WORKS, 40, ['building repairs', 'renovation works', 'office repairs', 'refurbishment', 'minor works']),
  entry('CONSTRUCTION_WORKS', 'Construction Works', TenderType.WORKS, 50, ['civil works', 'building construction', 'road works', 'construction', 'infrastructure works']),
  entry('CLEANING_SERVICES', 'Cleaning Services', TenderType.SERVICE, 60, ['janitorial', 'cleaners', 'cleaning', 'sanitation services', 'hygiene services']),
  entry('SECURITY_SERVICES', 'Security Services', TenderType.SERVICE, 70, ['guards', 'security guard services', 'guarding', 'site security', 'surveillance services']),
  entry('SYSTEM_AUDIT', 'System Audit', TenderType.CONSULTANCY, 80, ['audit', 'system review', 'ict audit', 'information systems audit', 'technology audit']),
  entry('TRAINING', 'Training', TenderType.CONSULTANCY, 90, ['capacity building', 'workshop', 'training services', 'skills development', 'professional training']),
  entry('CONSULTANCY_SERVICES', 'Consultancy Services', TenderType.CONSULTANCY, 100, ['consulting', 'advisory services', 'technical assistance', 'professional services']),
  ...catalogEntries(TenderType.GOODS, 1000, [
    'Telecommunication Equipment',
    'Motor Vehicles',
    'Water Meters and Spare Parts',
    'Water Pumps and Spare Parts',
    'Water and Sewer Treatment Equipment and consumables',
    'Veterinary Equipment and Supplies',
    'Mining and Quarrying Equipment',
    'Packaging Materials',
    'Fire Fighting Equipment',
    'Accommodation and Office furniture and accessories',
    'Agricultural and forestry and landscape machinery and equipment',
    'Batteries and generators and kinetic power transmission',
    'Classroom and instructional furniture and accessories',
    'Cleaning Equipment and Supplies',
    'Communications Devices and Accessories',
    'Computer Equipment and Accessories',
    'Computer Software',
    'Concrete and cement and plaster',
    'Construction and maintenance support equipment',
    'Data Voice or Multimedia Network Equipment or Platforms and Accessories',
    'Developmental and professional teaching aids and materials and accessories and supplies',
    'Domestic kitchenware and kitchen supplies',
    'Doors and windows and glass',
    'Electrical equipment and components and supplies',
    'Emergency and field medical services products',
    'Exterior finishing materials',
    'Fertilizers, Plants Nutrients and herbicides',
    'Heavy construction machinery and equipment',
    'Hospital beds and Furnitures',
    'Laboratory and scientific equipment',
    'Laboratory supplies and fixtures',
    'Lighting Fixtures and Accessories',
    'Medical Equipment and Accessories',
    'Medical facility products',
    'Medical Supplies and Equipment',
    'Motor Vehicle Components and Accessories',
    'Office Supplies and accessories',
    'Patient care and treatment products and supplies',
    'Pharmaceuticals',
    'Plumbing fixtures',
    'Printed Books, Textbooks and Reading Materials',
    'Roads and landscape architecture and construction materials',
    'Safety and security equipment',
    'Security and surveillance Equipment',
    'Seeds and Seedlings',
    'Stationery',
    'Structural building products (Blocks, Bricks, Tiles and Flagstones)',
    'Tools and Equipment',
    'Water Pipes and Fittings',
    'Water Supply Equipment',
    'Water Treatment Chemicals',
    'Water Treatment Equipment',
    'Construction materials',
    'Classroom furniture',
    'Other Goods'
  ]),
  ...catalogEntries(TenderType.WORKS, 2000, [
    'Building Contractors',
    'Civil Contractors',
    'Mechanical Contractors',
    'Electrical Contractors',
    'Specialist Building - Carpentry and Joinery',
    'Specialist Building - Concreting Works',
    'Specialist Building - Interior Decoration',
    'Specialist Building - Water Proofing Installations',
    'Specialist Civil - Drilling Works',
    'Specialist Civil - Labour Based Road Works',
    'Specialist Civil - Treatments Plants and Water Works',
    'Specialist Electrical - Telecommunications ICT and Security Systems Installations',
    'Specialist Electrical - Power Generation Equipment Installations and Maintenance',
    'Specialist Electrical - Renewable Energy Installation - Solar',
    'Specialist Mechanical - Heating Ventilation and Air Conditioning',
    'Specialist Mechanical - Elevators and Escalators Installation and Maintenance',
    'Specialist Mechanical - Plumbing and Sanitations',
    'Specialist Mechanical - Fire Prevention and Protections',
    'Specialist-Maintenance and Repair of Hospital Equipment',
    'Healthcare infrastructure',
    'Roads and bridges',
    'Water supply works',
    'Building construction',
    'Electrical works',
    'Civil works',
    'Mechanical installations',
    'Renovation and finishing',
    'Other Works'
  ]),
  ...catalogEntries(TenderType.SERVICE, 3000, [
    'Auction Services',
    'Printing Services (Business Stationery, Books, Booklets, Brochures, Leaflets, Cards, Forms, Labels, Manuals and Maps)',
    'Desktop publishing services',
    'Digital Printing Services',
    'Warehousing and Storage Services',
    'Catering Services',
    'Building and Compound Cleaning Services',
    'Fumigation Services',
    'Security Services',
    'Service and Maintenance of ICT Equipment',
    'Internet Services',
    'Insurance and Brokerage Services',
    'Conference and Related Services',
    'Repair and Maintenance of Air conditioners',
    'Advertising Services',
    'Real Estate Management Services',
    'Car hiring services',
    'Documentary and documentation Services',
    'Events management',
    'Graphics design services',
    'Hospitality services',
    'Laundry services',
    'Repair and Maintenance of Motor Vehicles (vehicles and motor cycle)',
    'Transportation and Handling Services',
    'Travel facilitation (Ticketing, Visa, Tours, Hotel bookings)',
    'Clearing and Forwarding Services',
    'Finance and Banking Services',
    'Network Services',
    'Voice and Data Services',
    'ICT System Maintenance and Support',
    'Water and Sewer treatment Services',
    'Non Hazardous Waste Management Services',
    'Hazardous Waste Management Services',
    'Repair and maintenance of Medical Equipment',
    'Vehicle Tracking and Fleet Management Services',
    'Passenger transportation services',
    'Medical Laboratory Services',
    'Facilities maintenance',
    'Cleaning services',
    'Transport and logistics',
    'ICT support',
    'Waste management',
    'Training services',
    'Other Non Consultancy'
  ]),
  ...catalogEntries(TenderType.CONSULTANCY, 4000, [
    'Information Technology Consultancy',
    'Business Process Consultancy',
    'Software Development',
    'Systems Operations',
    'Management Consultancy',
    'Human Resources Consultancy',
    'Educational Consultancy',
    'Legal Services Consultancy',
    'Environmental Consultancy',
    'Energy Consultancy',
    'Health Care Consultancy',
    'Procurement Consultancy',
    'Tax Consultancy',
    'Accountancy and auditing',
    'Financial and audit Services Consultancy',
    'Oil and Gas Consultancy',
    'Research, survey and Development Consultancy',
    'Structural Design',
    'Strategic Planning Consultancy',
    'Quality Management Consultancy',
    'Personnel Skills Training Services',
    'Vocational Training Services',
    'Construction Management Services',
    'Programme and Project Management Services',
    'Architectural services',
    'Forensic and investigation consultancy services',
    'Health and safety audit services',
    'Land surveying services',
    'Urban/Town Planning Services',
    'Civil Engineering Services',
    'Building Engineering Services',
    'Mechanical Engineering Services',
    'Electrical Engineering Services',
    'Quantity and Building Surveying Services',
    'Actuarial Services',
    'Valuation Consultancy Services',
    'Geoscience Consultancy Services',
    'Irrigation Engineering Services',
    'Feasibility study',
    'Engineering design',
    'Audit services',
    'Legal advisory',
    'Environmental assessment',
    'Project management',
    'Research services',
    'Training consultancy',
    'Other Consultancy'
  ])
];

const fallbackByType: Record<TenderType, string> = {
  [TenderType.GOODS]: 'Other Goods',
  [TenderType.WORKS]: 'Other Works',
  [TenderType.SERVICE]: 'Other Non Consultancy',
  [TenderType.CONSULTANCY]: 'Other Consultancy'
};

export function getProcurementTaxonomy(): ProcurementTaxonomyResponseDto {
  return {
    success: true,
    data: {
      taxonomyVersion: procurementTaxonomyVersion,
      categories: taxonomy.map(taxonomyCategoryDto).sort((left, right) => left.sortOrder - right.sortOrder)
    }
  };
}

export function standardizeCategory(rawCategory: string, type?: TenderType | string | null): CategoryStandardizationDto {
  const raw = rawCategory.trim();
  const tenderType = normalizeTenderType(type);
  const normalizedRaw = normalizeText(raw);
  const explicitOtherType = explicitOtherCategoryType(normalizedRaw, tenderType);
  if (explicitOtherType) {
    return {
      rawCategory: raw,
      standardCategory: fallbackByType[explicitOtherType],
      type: frontendTenderType(explicitOtherType),
      confidence: 1,
      synonymsMatched: normalizedRaw === normalizeText(fallbackByType[explicitOtherType]) ? [] : [raw]
    };
  }
  const candidates = tenderType ? prioritizeByType(tenderType) : taxonomy;

  let best: { entry: TaxonomyEntry; confidence: number; synonymsMatched: string[] } | null = null;
  for (const candidate of candidates) {
    const scored = scoreCategory(candidate, normalizedRaw);
    if (!best || scored.confidence > best.confidence) {
      best = { entry: candidate, ...scored };
    }
  }

  if (best && best.confidence > 0) {
    return {
      rawCategory: raw,
      standardCategory: best.entry.label,
      type: frontendTenderType(best.entry.type),
      confidence: best.confidence,
      synonymsMatched: best.synonymsMatched
    };
  }

  const fallbackType = tenderType ?? TenderType.GOODS;
  return {
    rawCategory: raw,
    standardCategory: fallbackByType[fallbackType],
    type: frontendTenderType(fallbackType),
    confidence: 0.35,
    synonymsMatched: []
  };
}

export function standardizeCategoryList(categories: string[], type?: TenderType | string | null): CategoryStandardizationResultDto {
  const mappings = categories.map((category) => standardizeCategory(category, type));
  const seen = new Set<string>();
  return {
    taxonomyVersion: procurementTaxonomyVersion,
    mappings,
    standardCategories: mappings
      .map((mapping) => mapping.standardCategory)
      .filter((category) => {
        const key = normalizeText(category);
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
  };
}

export function standardizeCategoryName(category: string, type?: TenderType | string | null) {
  return standardizeCategory(category, type).standardCategory;
}

export function categorySearchTerms(search: string) {
  const normalized = normalizeText(search);
  if (!normalized) return [];
  const terms = new Set<string>();
  for (const entry of taxonomy) {
    const labels = [entry.label, entry.code, ...entry.synonyms];
    if (labels.some((label) => normalizeText(label).includes(normalized) || normalized.includes(normalizeText(label)))) {
      terms.add(entry.label);
      for (const synonym of entry.synonyms) terms.add(synonym);
    }
  }
  return Array.from(terms);
}

export function normalizeTenderType(value: TenderType | string | null | undefined): TenderType | null {
  const normalized = normalizeLabel(value);
  if (normalized === 'GOODS') return TenderType.GOODS;
  if (normalized === 'WORKS') return TenderType.WORKS;
  if (normalized === 'SERVICE' || normalized === 'SERVICES' || normalized === 'NON_CONSULTANCY' || normalized === 'NON_CONSULTANCY_SERVICES') return TenderType.SERVICE;
  if (normalized === 'CONSULTANCY') return TenderType.CONSULTANCY;
  return null;
}

function entry(code: string, label: string, type: TenderType, sortOrder: number, synonyms: string[]): TaxonomyEntry {
  return { code, label, type, sortOrder, synonyms };
}

function catalogEntries(type: TenderType, baseSortOrder: number, labels: string[]) {
  const seen = new Set<string>();
  return labels
    .filter((label) => {
      const key = normalizeText(label);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((label, index) => entry(categoryCode(label), label, type, baseSortOrder + index, []));
}

function categoryCode(label: string) {
  return normalizeLabel(label).replace(/[^A-Z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

function explicitOtherCategoryType(normalizedRaw: string, tenderType: TenderType | null) {
  if (!normalizedRaw) return null;
  if (normalizedRaw === 'other' || normalizedRaw === 'others') return tenderType ?? TenderType.GOODS;
  for (const [type, label] of Object.entries(fallbackByType) as Array<[TenderType, string]>) {
    if (normalizedRaw === normalizeText(label)) return tenderType ?? type;
  }
  return null;
}

function taxonomyCategoryDto(item: TaxonomyEntry): ProcurementTaxonomyCategoryDto {
  return {
    code: item.code,
    label: item.label,
    value: item.label,
    type: frontendTenderType(item.type),
    synonyms: [...item.synonyms],
    isActive: true,
    sortOrder: item.sortOrder
  };
}

function prioritizeByType(type: TenderType) {
  return [...taxonomy.filter((item) => item.type === type), ...taxonomy.filter((item) => item.type !== type)];
}

function scoreCategory(entry: TaxonomyEntry, normalizedRaw: string) {
  const labels = [entry.label, entry.code, ...entry.synonyms];
  for (const label of labels) {
    if (normalizeText(label) === normalizedRaw) {
      return {
        confidence: label === entry.label || label === entry.code ? 1 : 0.98,
        synonymsMatched: label === entry.label || label === entry.code ? [] : [label]
      };
    }
  }

  const rawTokens = tokenSet(normalizedRaw);
  let bestOverlap = 0;
  let matched = '';
  for (const label of labels) {
    const labelTokens = tokenSet(normalizeText(label));
    const overlap = [...rawTokens].filter((token) => labelTokens.has(token)).length;
    const ratio = labelTokens.size > 0 ? overlap / labelTokens.size : 0;
    if (ratio > bestOverlap) {
      bestOverlap = ratio;
      matched = label;
    }
  }

  if (bestOverlap >= 0.75) {
    return {
      confidence: 0.72,
      synonymsMatched: matched && matched !== entry.label && matched !== entry.code ? [matched] : []
    };
  }

  return { confidence: 0, synonymsMatched: [] };
}

function tokenSet(value: string) {
  return new Set(value.split(' ').filter((token) => token.length > 2));
}

function normalizeText(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function normalizeLabel(value: unknown) {
  return String(value ?? '')
    .trim()
    .replace(/([a-z])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .replace(/_+/g, '_')
    .toUpperCase();
}

function frontendTenderType(type: TenderType) {
  if (type === TenderType.GOODS) return 'Goods';
  if (type === TenderType.WORKS) return 'Works';
  if (type === TenderType.SERVICE) return 'Non Consultancy';
  return 'Consultancy';
}
