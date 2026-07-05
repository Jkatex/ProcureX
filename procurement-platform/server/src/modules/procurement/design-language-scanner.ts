import type { TenderLanguageScanDto, TenderLanguageScanInput, TenderLanguageScanIssueDto, TenderLanguageScanRiskLevel, TenderLanguageScanSeverity } from './types.js';

export const tenderLanguageScannerVersion = 'tender-language-rules-v1';

type TextFragment = {
  field: string;
  text: string;
};

type LanguageRule = {
  type: string;
  severity: TenderLanguageScanSeverity;
  patterns: RegExp[];
  suggestion: string;
};

const severityScores: Record<TenderLanguageScanSeverity, number> = {
  Low: 10,
  Medium: 20,
  High: 35
};

const languageRules: LanguageRule[] = [
  {
    type: 'brand-only-restriction',
    severity: 'High',
    patterns: [
      /\bonly\s+(?:hp|dell|lenovo|apple|samsung|cisco|microsoft|oracle|toyota|nissan|isuzu|huawei|canon|epson)\b/i,
      /\b(?:hp|dell|lenovo|apple|samsung|cisco|microsoft|oracle|toyota|nissan|isuzu|huawei|canon|epson)\s+(?:brand|make|model)\s+only\b/i,
      /\bno\s+equivalent(?:s)?\b/i,
      /\boriginal\s+(?:brand|manufacturer)\s+only\b/i
    ],
    suggestion: 'Use performance, compatibility, and quality specifications, and allow equivalent products where appropriate.'
  },
  {
    type: 'local-only-restriction',
    severity: 'Medium',
    patterns: [
      /\blocal\s+(?:supplier|company|firm|vendor)s?\s+only\b/i,
      /\bonly\s+(?:tanzanian|local)\s+(?:supplier|company|firm|vendor)s?\b/i,
      /\bmust\s+be\s+(?:based|located)\s+in\s+(?:dar es salaam|dodoma|arusha|tanzania)\s+only\b/i,
      /\bregistered\s+in\s+(?:dar es salaam|dodoma|arusha)\s+only\b/i
    ],
    suggestion: 'Limit eligibility requirements to lawful registration, licensing, or delivery-capacity needs that are necessary for the tender.'
  },
  {
    type: 'discriminatory-or-exclusionary-wording',
    severity: 'High',
    patterns: [
      /\b(?:male|female)\s+(?:only|required)\b/i,
      /\b(?:christian|muslim|tribe|ethnic|race|racial|religion|religious)\s+(?:only|required|preferred)\b/i,
      /\bnot\s+open\s+to\s+(?:women|men|youth|foreigners|persons with disabilities)\b/i,
      /\bage\s+(?:below|above|under|over)\s+\d{2}\s+(?:only|required)\b/i
    ],
    suggestion: 'Remove protected-class restrictions unless a specific lawful procurement exception applies.'
  },
  {
    type: 'vague-requirement',
    severity: 'Low',
    patterns: [
      /\bhigh\s+quality\b/i,
      /\bworld[-\s]?class\b/i,
      /\bstate[-\s]?of[-\s]?the[-\s]?art\b/i,
      /\bbest\s+(?:quality|supplier|solution|service)\b/i,
      /\bas\s+(?:needed|required|appropriate)\b/i,
      /\betc\.?\b/i,
      /\band\s+so\s+on\b/i
    ],
    suggestion: 'Replace vague wording with measurable acceptance criteria, standards, quantities, or service levels.'
  },
  {
    type: 'single-supplier-wording',
    severity: 'High',
    patterns: [
      /\bsole\s+(?:supplier|source|provider|vendor)\b/i,
      /\bsingle\s+(?:supplier|source|provider|vendor)\b/i,
      /\bexclusive\s+(?:dealer|distributor|supplier|agent)\b/i,
      /\bonly\s+authorized\s+(?:dealer|distributor|supplier|agent)\b/i,
      /\bpre[-\s]?selected\s+(?:supplier|vendor|provider)\b/i
    ],
    suggestion: 'Use competitive eligibility language and justify any sole-source procurement through the appropriate non-marketplace workflow.'
  },
  {
    type: 'over-specific-experience-requirement',
    severity: 'Medium',
    patterns: [
      /\b(?:minimum|at least)\s+(?:1[1-9]|[2-9]\d)\s+years?\s+(?:of\s+)?experience\b/i,
      /\bexactly\s+\d+\s+(?:similar\s+)?(?:projects|contracts)\b/i,
      /\b(?:minimum|at least)\s+\d+\s+(?:similar\s+)?(?:projects|contracts)\s+in\s+the\s+last\s+(?:one|1|two|2)\s+years?\b/i
    ],
    suggestion: 'Use proportionate experience requirements tied to contract complexity and allow equivalent relevant experience.'
  },
  {
    type: 'unclear-evaluation-wording',
    severity: 'Medium',
    patterns: [
      /\bat\s+the\s+(?:sole\s+)?discretion\s+of\s+the\s+(?:buyer|committee|procuring entity)\b/i,
      /\bbest\s+proposal\s+wins\b/i,
      /\bas\s+determined\s+by\s+the\s+(?:buyer|committee|evaluation team)\b/i,
      /\bevaluation\s+criteria\s+will\s+be\s+communicated\s+later\b/i,
      /\bcriteria\s+to\s+be\s+decided\s+later\b/i
    ],
    suggestion: 'Publish clear evaluation criteria, weights, pass/fail gates, and scoring method before bids are submitted.'
  },
  {
    type: 'conflict-of-interest-phrase',
    severity: 'High',
    patterns: [
      /\bpreferred\s+(?:supplier|vendor|provider)\b/i,
      /\bknown\s+(?:supplier|vendor|provider)\b/i,
      /\brecommended\s+by\s+(?:management|director|board|committee)\b/i,
      /\bexisting\s+(?:supplier|vendor|provider)\s+must\b/i,
      /\bfavored\s+(?:supplier|vendor|provider)\b/i
    ],
    suggestion: 'Remove language that implies a preferred bidder and declare/manage conflicts through the approved procurement controls.'
  }
];

export function scanTenderLanguage(input: TenderLanguageScanInput): TenderLanguageScanDto {
  const fragments = collectFragments(input);
  const issues: TenderLanguageScanIssueDto[] = [];
  const seen = new Set<string>();

  for (const fragment of fragments) {
    for (const rule of languageRules) {
      const match = firstMatch(fragment.text, rule.patterns);
      if (!match) continue;
      const key = `${rule.type}:${fragment.field}:${match.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      issues.push({
        type: rule.type,
        severity: rule.severity,
        field: fragment.field,
        text: snippet(fragment.text, match),
        suggestion: rule.suggestion
      });
    }

    const deadlineIssue = deadlineIssueFor(fragment);
    if (deadlineIssue) {
      const key = `${deadlineIssue.type}:${deadlineIssue.field}:${deadlineIssue.text.toLowerCase()}`;
      if (!seen.has(key)) {
        seen.add(key);
        issues.push(deadlineIssue);
      }
    }
  }

  const score = Math.min(
    100,
    issues.reduce((total, issue) => total + severityScores[issue.severity], 0)
  );

  return {
    riskLevel: riskLevelFor(score, issues),
    score,
    issues
  };
}

function collectFragments(input: TenderLanguageScanInput) {
  const fragments: TextFragment[] = [];
  collectText(input.title, 'title', fragments);
  collectText(input.description, 'description', fragments);
  collectText(input.requirements, 'requirements', fragments);
  collectText(input.evaluationCriteria, 'evaluationCriteria', fragments);
  collectText(input.metadata, 'metadata', fragments);
  return fragments.filter((fragment) => fragment.text.trim().length > 0);
}

function collectText(value: unknown, field: string, fragments: TextFragment[]) {
  if (typeof value === 'string') {
    fragments.push({ field, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectText(item, `${field}[${index}]`, fragments));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      collectText(item, `${field}.${key}`, fragments);
    }
  }
}

function firstMatch(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[0]) return match[0];
  }
  return null;
}

function deadlineIssueFor(fragment: TextFragment): TenderLanguageScanIssueDto | null {
  if (/\b(?:within\s+(?:24|48)\s+hours?|same\s+day|immediate(?:ly)?|next\s+day)\b/i.test(fragment.text)) {
    return {
      type: 'unrealistic-deadline',
      severity: 'Medium',
      field: fragment.field,
      text: snippet(fragment.text, fragment.text.match(/\b(?:within\s+(?:24|48)\s+hours?|same\s+day|immediate(?:ly)?|next\s+day)\b/i)?.[0] ?? fragment.text),
      suggestion: 'Set a realistic response period based on tender complexity and document any urgent justification.'
    };
  }

  if (!/(deadline|closing|submission|due|date)/i.test(fragment.field)) return null;
  const dateMatch = fragment.text.match(/\b\d{4}-\d{2}-\d{2}(?:T[^\s]+)?\b/);
  if (!dateMatch) return null;
  const deadline = new Date(dateMatch[0]);
  if (Number.isNaN(deadline.getTime())) return null;
  const daysUntilDeadline = (deadline.getTime() - Date.now()) / 86400000;
  if (daysUntilDeadline >= 0 && daysUntilDeadline < 7) {
    return {
      type: 'unrealistic-deadline',
      severity: 'Medium',
      field: fragment.field,
      text: dateMatch[0],
      suggestion: 'Consider extending the submission period or recording a defensible urgency rationale.'
    };
  }
  return null;
}

function snippet(text: string, match: string) {
  const normalized = text.replace(/\s+/g, ' ').trim();
  const index = normalized.toLowerCase().indexOf(match.toLowerCase());
  if (index < 0) return match.slice(0, 180);
  const start = Math.max(0, index - 50);
  const end = Math.min(normalized.length, index + match.length + 50);
  return normalized.slice(start, end);
}

function riskLevelFor(score: number, issues: TenderLanguageScanIssueDto[]): TenderLanguageScanRiskLevel {
  const highCount = issues.filter((issue) => issue.severity === 'High').length;
  if (score >= 60 || highCount >= 2) return 'High';
  if (score >= 20 || highCount >= 1 || issues.some((issue) => issue.severity === 'Medium')) return 'Medium';
  return 'Low';
}
