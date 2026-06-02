import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workspaceRoot = path.resolve(root, '..');
const prototypeRoot = path.join(workspaceRoot, 'procurex-ui');
const clientSrc = path.join(root, 'client', 'src');

const sourceFiles = [
  'js/data.js',
  'js/charts.js',
  'js/app.js',
  'pages/shared/utils.js',
  'pages/welcome.js',
  'pages/about-procurex.js',
  'pages/privacy-policy.js',
  'pages/terms-and-conditions.js',
  'pages/contact.js',
  'pages/register.js',
  'pages/sign-in.js',
  'pages/role-selection.js',
  'pages/iam-verification.js',
  'pages/verification-status.js',
  'pages/app-launcher.js',
  'pages/workspace-dashboard.js',
  'pages/tender-planning.js',
  'pages/procurement-dashboard.js',
  'pages/admin-shared.js',
  'pages/admin-dashboard.js',
  'pages/admin-search.js',
  'pages/admin-users.js',
  'pages/admin-compliance.js',
  'pages/admin-analytics.js',
  'pages/admin-audit.js',
  'pages/buyer-dashboard.js',
  'pages/buyer-journey.js',
  'pages/guest-marketplace.js',
  'pages/supplier-dashboard.js',
  'pages/supplier-journey.js',
  'pages/supplier-marketplace.js',
  'pages/supplier-tender-detail.js',
  'pages/communication-center.js',
  'pages/create-tender.js',
  'pages/tender-publication.js',
  'pages/tender-details.js',
  'pages/tender-document.js',
  'pages/records-history.js',
  'pages/bidding-workspace.js',
  'pages/bid-evaluation.js',
  'pages/awarding-contracts.js',
  'pages/award-recommendation.js',
  'pages/contract-negotiation.js',
  'pages/post-award-tracking.js'
];

const pages = [
  ['public', 'welcome', 'WelcomeProcurexPage'],
  ['public', 'about-procurex', 'AboutProcurexPage'],
  ['public', 'privacy-policy', 'PrivacyPolicyProcurexPage'],
  ['public', 'terms-and-conditions', 'TermsAndConditionsProcurexPage'],
  ['public', 'contact', 'ContactProcurexPage'],
  ['public', 'guest-marketplace', 'GuestMarketplaceProcurexPage'],
  ['auth', 'register', 'RegisterProcurexPage'],
  ['auth', 'sign-in', 'SignInProcurexPage'],
  ['auth', 'role-selection', 'RoleSelectionProcurexPage'],
  ['identity', 'identity-verification', 'IdentityVerificationProcurexPage'],
  ['identity', 'account-profile', 'AccountProfileProcurexPage'],
  ['workspace', 'app-launcher', 'AppLauncherProcurexPage'],
  ['workspace', 'workspace-dashboard', 'WorkspaceDashboardProcurexPage'],
  ['tenderPlanning', 'tender-planning', 'TenderPlanningProcurexPage'],
  ['procurement', 'marketplace', 'MarketplaceProcurexPage'],
  ['procurement', 'create-tender', 'CreateTenderProcurexPage'],
  ['procurement', 'tender-publication', 'TenderPublicationProcurexPage'],
  ['procurement', 'tender-details', 'TenderDetailsProcurexPage'],
  ['procurement', 'tender-document', 'TenderDocumentProcurexPage'],
  ['procurement', 'tender-detail', 'SupplierTenderDetailProcurexPage'],
  ['procurement', 'procurement-guide', 'ProcurementGuideProcurexPage'],
  ['bidding', 'bidding-workspace', 'BiddingWorkspaceProcurexPage'],
  ['evaluation', 'bid-evaluation', 'BidEvaluationProcurexPage'],
  ['awardsContracts', 'awarding-contracts', 'AwardingContractsProcurexPage'],
  ['awardsContracts', 'award-recommendation', 'AwardRecommendationProcurexPage'],
  ['awardsContracts', 'contract-negotiation', 'ContractNegotiationProcurexPage'],
  ['awardsContracts', 'post-award-tracking', 'PostAwardTrackingProcurexPage'],
  ['communication', 'communication-center', 'CommunicationCenterProcurexPage'],
  ['records', 'records-history', 'RecordsHistoryProcurexPage'],
  ['admin', 'admin-dashboard', 'AdminDashboardProcurexPage'],
  ['admin', 'admin-search', 'AdminSearchProcurexPage'],
  ['admin', 'admin-users', 'AdminUsersProcurexPage'],
  ['admin', 'admin-compliance', 'AdminComplianceProcurexPage'],
  ['admin', 'admin-analytics', 'AdminAnalyticsProcurexPage'],
  ['admin', 'admin-audit', 'AdminAuditProcurexPage']
];

function createDomStub() {
  const classList = {
    add() {},
    remove() {},
    toggle() {},
    contains() {
      return false;
    }
  };

  const element = {
    dataset: {},
    classList,
    style: {},
    children: [],
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    setAttribute() {},
    getAttribute() {
      return null;
    },
    removeAttribute() {},
    addEventListener() {},
    removeEventListener() {},
    appendChild() {},
    remove() {},
    focus() {},
    click() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    closest() {
      return null;
    },
    nextElementSibling: null
  };

  return {
    body: { dataset: {}, classList },
    documentElement: { classList },
    createElement() {
      return { ...element, classList: { ...classList } };
    },
    getElementById() {
      return { ...element, classList: { ...classList } };
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    addEventListener() {},
    removeEventListener() {}
  };
}

const context = {
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  URL,
  URLSearchParams,
  Blob,
  FormData,
  Event: class Event {
    constructor(type, options = {}) {
      this.type = type;
      Object.assign(this, options);
    }
  },
  document: createDomStub(),
  localStorage: {
    data: new Map(),
    getItem(key) {
      return this.data.get(key) ?? null;
    },
    setItem(key, value) {
      this.data.set(key, String(value));
    },
    removeItem(key) {
      this.data.delete(key);
    }
  },
  history: {
    pushState() {},
    replaceState() {}
  },
  location: {
    href: 'http://localhost:5173/',
    search: ''
  },
  navigator: { userAgent: 'procurex-page-generator' },
  Chart: class Chart {},
  html2pdf() {
    return { set: () => ({ from: () => ({ save: async () => {} }) }) };
  },
  alert() {},
  confirm() {
    return true;
  }
};

context.window = context;
context.globalThis = context;

const vmContext = vm.createContext(context);

for (const relativePath of sourceFiles) {
  const absolutePath = path.join(prototypeRoot, relativePath);
  let source = await readFile(absolutePath, 'utf8');

  if (relativePath === 'js/app.js') {
    source = source.replace(
      '// Initialize the app when DOM is loaded',
      'globalThis.ProcureXApp = ProcureXApp;\n// Initialize the app when DOM is loaded'
    );
  }

  vm.runInContext(source, vmContext, { filename: relativePath });
}

function createAppFor(page) {
  const app = Object.create(vmContext.ProcureXApp.prototype);
  app.currentPage = page;
  app.pages = {};
  app.registrationTimer = null;
  app.procurementFeedTimer = null;
  vmContext.app = app;
  vmContext.window.app = app;
  return app;
}

function normalizeHtml(html) {
  return html
    .replaceAll('src="assets/', 'src="/assets/')
    .replaceAll("src='assets/", "src='/assets/")
    .replaceAll('href="assets/', 'href="/assets/')
    .replaceAll("href='assets/", "href='/assets/");
}

function renderPage(page) {
  const app = createAppFor(page);
  const pageHtml = app.getPageRenderFunction(page);
  const navHeader = app.getNavigationHeader();
  return normalizeHtml(`${navHeader}${pageHtml}`);
}

function generatedHeader() {
  return `/* This file is generated from the ProcureX design prototype. Do not edit by hand. */\n\n`;
}

function componentSource(page, componentName, html) {
  return `${generatedHeader()}import { ProcurexStaticPage } from '@/shared/components/procurex/ProcurexStaticPage';\n\nconst html = ${JSON.stringify(html)};\n\nexport function ${componentName}() {\n  return <ProcurexStaticPage pageKey="${page}" html={html} />;\n}\n`;
}

function translationObjects(strings) {
  const sorted = [...strings].sort((a, b) => a.localeCompare(b));
  const en = Object.fromEntries(sorted.map((text) => [text, text]));
  const sw = Object.fromEntries(sorted.map((text) => [text, translateDraftToSwahili(text)]));
  return { en, sw };
}

const registryImports = [];
const registryEntries = [];
const routeEntries = [];
const staticStrings = new Set();

function decodeHtml(value) {
  return value
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&#39;', "'");
}

function shouldCatalogText(value) {
  const text = value.trim();
  if (!text) return false;
  if (/^[\d\s.,:/%#()+-]+$/.test(text)) return false;
  if (/^[A-Z]{1,3}$/.test(text)) return false;
  if (/^[\w.-]+@[\w.-]+$/.test(text)) return false;
  if (/^https?:\/\//i.test(text)) return false;
  if (/^(TZS|USD)\s?[\d,]+/.test(text)) return false;
  if (/^PX[-\w\d]+/.test(text)) return false;
  return true;
}

function collectStaticStrings(html) {
  const withoutSvg = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  const textMatches = withoutSvg.matchAll(/>([^<>]+)</g);
  for (const match of textMatches) {
    const text = decodeHtml(match[1]).replace(/\s+/g, ' ').trim();
    if (shouldCatalogText(text)) staticStrings.add(text);
  }

  const attributeMatches = withoutSvg.matchAll(/\s(?:aria-label|title|placeholder|alt)="([^"]+)"/g);
  for (const match of attributeMatches) {
    const text = decodeHtml(match[1]).replace(/\s+/g, ' ').trim();
    if (shouldCatalogText(text) && text !== 'ProcureX') staticStrings.add(text);
  }
}

const exactSwahili = new Map([
  ['Welcome to ProcureX', 'Karibu ProcureX'],
  ['Browse Open Tenders', 'Tazama Zabuni Zilizo Wazi'],
  ['How It Works', 'Inavyofanya Kazi'],
  ['About', 'Kuhusu'],
  ['Help Center', 'Kituo cha Msaada'],
  ['Sign In', 'Ingia'],
  ['Get Started', 'Anza Sasa'],
  ['Create Tender', 'Tengeneza Zabuni'],
  ['Discover Tenders', 'Gundua Zabuni'],
  ['Submit Bid', 'Wasilisha Zabuni'],
  ['Track Records', 'Fuatilia Kumbukumbu'],
  ['Tenders', 'Zabuni'],
  ['Relationships', 'Mahusiano'],
  ['Records', 'Kumbukumbu'],
  ['Dashboard', 'Dashibodi'],
  ['ProcureX Apps', 'Programu za ProcureX'],
  ['Company account tools', 'Zana za akaunti ya kampuni'],
  ['Registration and Verification', 'Usajili na Uthibitishaji'],
  ['Account and identity verification', 'Akaunti na uthibitishaji wa utambulisho'],
  ['Tender Planning', 'Mpango wa Zabuni'],
  ['APP, SPP, budgets, approvals', 'APP, SPP, bajeti, idhini'],
  ['Procurement', 'Ununuzi'],
  ['Marketplace, create tender, bid', 'Soko, tengeneza zabuni, wasilisha zabuni'],
  ['Communication Center', 'Kituo cha Mawasiliano'],
  ['Messages, clarifications, alerts', 'Ujumbe, ufafanuzi, arifa'],
  ['Evaluation', 'Tathmini'],
  ['Evaluate bids on your tenders', 'Tathmini zabuni kwenye manunuzi yako'],
  ['Awarding and Contract', 'Utoaji Tuzo na Mikataba'],
  ['Awards, negotiations, signatures', 'Tuzo, majadiliano, saini'],
  ['Records and History', 'Kumbukumbu na Historia'],
  ['Past tenders, bids, awards', 'Zabuni, maombi, na tuzo zilizopita'],
  ['Profile', 'Wasifu'],
  ['Messages', 'Ujumbe'],
  ['Help', 'Msaada'],
  ['Language', 'Lugha'],
  ['Logout', 'Toka'],
  ['Marketplace', 'Soko'],
  ['My Tenders', 'Zabuni Zangu'],
  ['My Bids', 'Maombi Yangu'],
  ['Awards and Contracts', 'Tuzo na Mikataba'],
  ['Account and Verification', 'Akaunti na Uthibitishaji'],
  ['Open apps', 'Fungua programu'],
  ['Open profile menu', 'Fungua menyu ya wasifu'],
  ['Save Draft', 'Hifadhi Rasimu'],
  ['Save Draft & Exit', 'Hifadhi Rasimu na Toka'],
  ['Open Another Tender', 'Fungua Zabuni Nyingine'],
  ['Review', 'Hakiki'],
  ['Approve', 'Idhinisha'],
  ['Return', 'Rudisha'],
  ['Hold', 'Shikilia'],
  ['Flag Issue', 'Weka Alama ya Tatizo'],
  ['Submit', 'Wasilisha'],
  ['Continue', 'Endelea'],
  ['Open', 'Fungua'],
  ['View', 'Tazama'],
  ['Edit', 'Hariri'],
  ['Cancel', 'Ghairi'],
  ['Search', 'Tafuta'],
  ['Filter', 'Chuja'],
  ['Status', 'Hali'],
  ['Action', 'Kitendo'],
  ['Actions', 'Vitendo'],
  ['Buyer', 'Mnunuzi'],
  ['Supplier', 'Mzabuni'],
  ['Value', 'Thamani'],
  ['Budget', 'Bajeti'],
  ['Deadline', 'Mwisho wa Muda'],
  ['Closing date', 'Tarehe ya Kufungwa'],
  ['Reference', 'Rejea'],
  ['Organization', 'Shirika'],
  ['Location', 'Mahali'],
  ['Published', 'Imechapishwa'],
  ['Draft', 'Rasimu'],
  ['Pending', 'Inasubiri'],
  ['Approved', 'Imeidhinishwa'],
  ['Rejected', 'Imekataliwa'],
  ['Under Review', 'Inakaguliwa'],
  ['Action Required', 'Hatua Inahitajika'],
  ['Completed', 'Imekamilika'],
  ['In Progress', 'Inaendelea'],
  ['Blocked', 'Imezuiwa'],
  ['Paid', 'Imelipwa'],
  ['Pending Approval', 'Inasubiri Idhini'],
  ['High', 'Juu'],
  ['Medium', 'Wastani'],
  ['Low', 'Chini'],
  ['Critical', 'Muhimu Sana'],
  ['Attention', 'Tahadhari'],
  ['Technical', 'Kiufundi'],
  ['Commercial', 'Kibiashara'],
  ['Compliance', 'Uzingatiaji'],
  ['Documents', 'Nyaraka'],
  ['Questions', 'Maswali'],
  ['Clarifications', 'Ufafanuzi'],
  ['Timeline', 'Ratiba'],
  ['Milestones', 'Hatua Muhimu'],
  ['Payments', 'Malipo'],
  ['Issues', 'Masuala'],
  ['Variations', 'Mabadiliko'],
  ['Closure', 'Kufunga'],
  ['Performance', 'Utendaji']
]);

const phraseReplacements = [
  ['ProcureX', 'ProcureX'],
  ['procurement', 'ununuzi'],
  ['Procurement', 'Ununuzi'],
  ['tender', 'zabuni'],
  ['Tender', 'Zabuni'],
  ['tenders', 'zabuni'],
  ['Tenders', 'Zabuni'],
  ['bid', 'ombi la zabuni'],
  ['Bid', 'Ombi la Zabuni'],
  ['bids', 'maombi ya zabuni'],
  ['Bids', 'Maombi ya Zabuni'],
  ['supplier', 'mzabuni'],
  ['Supplier', 'Mzabuni'],
  ['buyer', 'mnunuzi'],
  ['Buyer', 'Mnunuzi'],
  ['contract', 'mkataba'],
  ['Contract', 'Mkataba'],
  ['contracts', 'mikataba'],
  ['Contracts', 'Mikataba'],
  ['award', 'tuzo'],
  ['Award', 'Tuzo'],
  ['awards', 'tuzo'],
  ['Awards', 'Tuzo'],
  ['evaluation', 'tathmini'],
  ['Evaluation', 'Tathmini'],
  ['compliance', 'uzingatiaji'],
  ['Compliance', 'Uzingatiaji'],
  ['communication', 'mawasiliano'],
  ['Communication', 'Mawasiliano'],
  ['records', 'kumbukumbu'],
  ['Records', 'Kumbukumbu'],
  ['history', 'historia'],
  ['History', 'Historia'],
  ['dashboard', 'dashibodi'],
  ['Dashboard', 'Dashibodi'],
  ['workspace', 'eneo la kazi'],
  ['Workspace', 'Eneo la Kazi'],
  ['account', 'akaunti'],
  ['Account', 'Akaunti'],
  ['verification', 'uthibitishaji'],
  ['Verification', 'Uthibitishaji'],
  ['identity', 'utambulisho'],
  ['Identity', 'Utambulisho'],
  ['document', 'waraka'],
  ['Document', 'Waraka'],
  ['documents', 'nyaraka'],
  ['Documents', 'Nyaraka'],
  ['message', 'ujumbe'],
  ['Message', 'Ujumbe'],
  ['messages', 'ujumbe'],
  ['Messages', 'Ujumbe'],
  ['clarification', 'ufafanuzi'],
  ['Clarification', 'Ufafanuzi'],
  ['clarifications', 'ufafanuzi'],
  ['Clarifications', 'Ufafanuzi'],
  ['review', 'hakiki'],
  ['Review', 'Hakiki'],
  ['approval', 'idhini'],
  ['Approval', 'Idhini'],
  ['approve', 'idhinisha'],
  ['Approve', 'Idhinisha'],
  ['status', 'hali'],
  ['Status', 'Hali'],
  ['deadline', 'mwisho wa muda'],
  ['Deadline', 'Mwisho wa Muda'],
  ['date', 'tarehe'],
  ['Date', 'Tarehe'],
  ['open', 'fungua'],
  ['Open', 'Fungua'],
  ['save', 'hifadhi'],
  ['Save', 'Hifadhi'],
  ['draft', 'rasimu'],
  ['Draft', 'Rasimu'],
  ['submit', 'wasilisha'],
  ['Submit', 'Wasilisha'],
  ['create', 'tengeneza'],
  ['Create', 'Tengeneza'],
  ['search', 'tafuta'],
  ['Search', 'Tafuta'],
  ['filter', 'chuja'],
  ['Filter', 'Chuja'],
  ['pending', 'inasubiri'],
  ['Pending', 'Inasubiri'],
  ['published', 'imechapishwa'],
  ['Published', 'Imechapishwa'],
  ['completed', 'imekamilika'],
  ['Completed', 'Imekamilika'],
  ['active', 'hai'],
  ['Active', 'Hai'],
  ['required', 'inahitajika'],
  ['Required', 'Inahitajika'],
  ['current', 'sasa'],
  ['Current', 'Sasa'],
  ['total', 'jumla'],
  ['Total', 'Jumla'],
  ['amount', 'kiasi'],
  ['Amount', 'Kiasi'],
  ['payment', 'malipo'],
  ['Payment', 'Malipo'],
  ['invoice', 'ankara'],
  ['Invoice', 'Ankara'],
  ['risk', 'hatari'],
  ['Risk', 'Hatari'],
  ['evidence', 'ushahidi'],
  ['Evidence', 'Ushahidi'],
  ['profile', 'wasifu'],
  ['Profile', 'Wasifu'],
  ['admin', 'msimamizi'],
  ['Admin', 'Msimamizi'],
  ['user', 'mtumiaji'],
  ['User', 'Mtumiaji'],
  ['company', 'kampuni'],
  ['Company', 'Kampuni'],
  ['organization', 'shirika'],
  ['Organization', 'Shirika']
];

function translateDraftToSwahili(text) {
  const exact = exactSwahili.get(text);
  if (exact) return exact;

  let translated = text;
  for (const [english, swahili] of phraseReplacements) {
    translated = translated.replaceAll(english, swahili);
  }

  return translated;
}

for (const [feature, page, componentName] of pages) {
  const dir = path.join(clientSrc, 'features', feature, 'components', 'procurex');
  await mkdir(dir, { recursive: true });
  const html = renderPage(page);
  collectStaticStrings(html);
  await writeFile(path.join(dir, `${componentName}.tsx`), componentSource(page, componentName, html));
  registryImports.push(`import { ${componentName} } from '@/features/${feature}/components/procurex/${componentName}';`);
  registryEntries.push(`  '${page}': ${componentName}`);
  routeEntries.push(`  '${page}': '${componentName}'`);
}

await writeFile(
  path.join(clientSrc, 'features', 'procurexPageRegistry.tsx'),
  `${generatedHeader()}import type { ComponentType } from 'react';\n${registryImports.join('\n')}\n\nexport const procurexPageRegistry = {\n${registryEntries.join(',\n')}\n} satisfies Record<string, ComponentType>;\n\nexport type ProcurexPageKey = keyof typeof procurexPageRegistry;\n`
);

const translations = translationObjects(staticStrings);
await writeFile(path.join(clientSrc, 'i18n', 'locales', 'en', 'procurex-static.json'), `${JSON.stringify(translations.en, null, 2)}\n`);
await writeFile(path.join(clientSrc, 'i18n', 'locales', 'sw', 'procurex-static.json'), `${JSON.stringify(translations.sw, null, 2)}\n`);

console.log(`Generated ${pages.length} ProcureX React parity components and ${staticStrings.size} static translation strings.`);
