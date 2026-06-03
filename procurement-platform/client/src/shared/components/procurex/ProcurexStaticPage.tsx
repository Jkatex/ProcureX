import { ChangeEvent, FormEvent, MouseEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import i18nInstance from '@/i18n';
import { LanguageSwitcher } from '../LanguageSwitcher';

type ProcurexStaticPageProps = {
  pageKey: string;
  html: string;
};

const pageToRoute: Record<string, string> = {
  welcome: '/',
  'about-procurex': '/about',
  'privacy-policy': '/privacy',
  'terms-and-conditions': '/terms',
  contact: '/contact',
  'guest-marketplace': '/guest-marketplace',
  register: '/register',
  'sign-in': '/sign-in',
  'role-selection': '/role-selection',
  'identity-verification': '/identity/verification',
  'iam-verification': '/identity/verification',
  'account-profile': '/identity/profile',
  'verification-status': '/identity/profile',
  'app-launcher': '/apps',
  'workspace-dashboard': '/dashboard',
  'buyer-dashboard': '/dashboard',
  'supplier-dashboard': '/dashboard',
  'procurement-dashboard': '/dashboard',
  'tender-planning': '/tender-planning',
  marketplace: '/procurement/marketplace',
  'supplier-marketplace': '/procurement/marketplace',
  'create-tender': '/procurement/create-tender',
  'tender-publication': '/procurement/tender-publication',
  'tender-details': '/procurement/tender-details',
  'tender-document': '/procurement/tender-document',
  'tender-detail': '/procurement/supplier-tender-detail',
  'supplier-tender-detail': '/procurement/supplier-tender-detail',
  'procurement-guide': '/procurement/guide',
  'supplier-journey': '/procurement/guide',
  'buyer-journey': '/procurement/guide',
  'bidding-workspace': '/bidding',
  'bid-evaluation': '/evaluation',
  'awarding-contracts': '/awards-contracts',
  'award-recommendation': '/awards-contracts/recommendation',
  'contract-negotiation': '/awards-contracts/negotiation',
  'post-award-tracking': '/awards-contracts/post-award',
  'communication-center': '/communication',
  'records-history': '/records',
  'admin-dashboard': '/admin',
  'admin-search': '/admin/search',
  'admin-users': '/admin/users',
  'admin-compliance': '/admin/compliance',
  'admin-analytics': '/admin/analytics',
  'admin-audit': '/admin/audit'
};

const evaluationSelectionStorageKeys = ['procurex.selectedEvaluationTender', 'procurex.selectedEvaluationReport'];

type EvaluationSelectionWindow = Window & {
  procurexSelectedEvaluationTender?: string;
  procurexSelectedEvaluationReport?: string;
};

function clearEvaluationEntrySelection() {
  if (typeof window === 'undefined') return;

  const evaluationWindow = window as EvaluationSelectionWindow;
  evaluationWindow.procurexSelectedEvaluationTender = '';
  evaluationWindow.procurexSelectedEvaluationReport = '';

  try {
    evaluationSelectionStorageKeys.forEach((key) => window.localStorage.removeItem(key));
  } catch {
    // localStorage may be unavailable in some embedded/test environments; window fallbacks above cover the prototype state.
  }
}

const originalTextNodes = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const translatableAttributes = ['aria-label', 'title', 'placeholder', 'alt'];

const appDrawerHtml = `
  <div class="app-menu-header">
    <div class="app-menu-brand">
      <span class="platform-logo platform-logo-sm">
        <img class="platform-logo-image" src="/assets/logo.svg" alt="ProcureX">
      </span>
      <strong>ProcureX Apps</strong>
    </div>
    <span>Company account tools</span>
  </div>
  <button class="app-menu-card app-menu-iam" type="button" data-navigate="account-profile">
    <span class="app-menu-icon">
      <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/><path d="M16 11l2 2 4-4"/>
      </svg>
    </span>
    <span><strong>Registration and Verification</strong><em>Account and identity verification</em></span>
  </button>
  <button class="app-menu-card app-menu-procurement" type="button" data-navigate="tender-planning">
    <span class="app-menu-icon">
      <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M4 4h16v16H4z"/><path d="M8 8h8"/><path d="M8 12h8"/><path d="M8 16h5"/>
      </svg>
    </span>
    <span><strong>Procurement Planning</strong><em>APP, SPP, budgets, approvals</em></span>
  </button>
  <button class="app-menu-card app-menu-procurement" type="button" data-navigate="marketplace">
    <span class="app-menu-icon">
      <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M3 9h18l-2-5H5z"/><path d="M5 9v11h14V9"/><path d="M9 13h6"/><path d="M9 17h4"/>
      </svg>
    </span>
    <span><strong>Procurement</strong><em>Marketplace, create tender, bid</em></span>
  </button>
  <button class="app-menu-card app-menu-communication" type="button" data-navigate="communication-center">
    <span class="app-menu-icon">
      <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8"/><path d="M8 13h5"/>
      </svg>
    </span>
    <span><strong>Communication Center</strong><em>Messages, clarifications, alerts</em></span>
  </button>
  <button class="app-menu-card app-menu-evaluation" type="button" data-navigate="bid-evaluation">
    <span class="app-menu-icon">
      <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M9 11l2 2 4-4"/><path d="M8 4h8"/><path d="M8 20h8"/><path d="M5 7h14v10H5z"/>
      </svg>
    </span>
    <span><strong>Evaluation</strong><em>Evaluate bids on your tenders</em></span>
  </button>
  <button class="app-menu-card app-menu-awarding" type="button" data-navigate="awarding-contracts">
    <span class="app-menu-icon">
      <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <circle cx="12" cy="8" r="4"/><path d="M8.5 11.5L7 21l5-3 5 3-1.5-9.5"/><path d="M10.5 8l1 1 2-2"/>
      </svg>
    </span>
    <span><strong>Awarding and Contract</strong><em>Awards, negotiations, signatures</em></span>
  </button>
  <button class="app-menu-card app-menu-contracts" type="button" data-navigate="records-history">
    <span class="app-menu-icon">
      <svg class="app-menu-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M8 3h8l3 3v15H5V3z"/><path d="M15 3v4h4"/><path d="M8 12h8"/><path d="M8 16h6"/>
      </svg>
    </span>
    <span><strong>Records and History</strong><em>Past tenders, bids, awards</em></span>
  </button>
`;

function translateStaticText(text: string, language: string) {
  if (language !== 'sw') return text;
  const translated = i18nInstance.getResource(language, 'procurexStatic', text);
  return typeof translated === 'string' ? translated : text;
}

function preserveWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function shouldTranslateNode(node: Text) {
  const parent = node.parentElement;
  if (!parent) return false;
  if (parent.closest('svg, path, style, script, noscript, textarea')) return false;
  return Boolean(node.nodeValue?.trim());
}

function applyStaticTranslations(root: HTMLElement, language: string) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    const node = walker.currentNode as Text;
    if (shouldTranslateNode(node)) textNodes.push(node);
  }

  textNodes.forEach((node) => {
    const original = originalTextNodes.get(node) ?? node.nodeValue ?? '';
    originalTextNodes.set(node, original);
    const trimmed = original.trim().replace(/\s+/g, ' ');
    const translated = translateStaticText(trimmed, language);
    node.nodeValue = preserveWhitespace(original, translated);
  });

  root.querySelectorAll('*').forEach((element) => {
    let originals = originalAttributes.get(element);
    if (!originals) {
      originals = {};
      originalAttributes.set(element, originals);
    }

    translatableAttributes.forEach((attribute) => {
      const current = element.getAttribute(attribute);
      if (!current) return;
      const original = originals[attribute] ?? current;
      originals[attribute] = original;
      element.setAttribute(attribute, translateStaticText(original.trim().replace(/\s+/g, ' '), language));
    });
  });
}

function normalizeAppDrawer(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-app-menu]').forEach((menu) => {
    menu.innerHTML = appDrawerHtml;
  });
}

function setActiveTab(tab: HTMLElement) {
  const tabName = tab.getAttribute('data-tab');
  const tabGroup = tab.closest('.tabs');
  const tabContent = tabGroup?.nextElementSibling;

  if (!tabName || !tabGroup) return;

  tabGroup.querySelectorAll('.tab').forEach((item) => item.classList.remove('active'));
  tab.classList.add('active');

  tabContent?.querySelectorAll<HTMLElement>('.tab-content').forEach((panel) => {
    const isActive = panel.getAttribute('data-tab') === tabName;
    panel.classList.toggle('tab-content--visible', isActive);
    panel.classList.toggle('tab-content--hidden', !isActive);
  });
}

function syncInitialTabs(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('.tab.active').forEach(setActiveTab);
  root.querySelectorAll<HTMLElement>('[data-supplier-tab-list] [data-supplier-tab-target].active').forEach((tab) => {
    setSupplierTab(tab);
  });
}

function toggleWorkspaceMenu(button: HTMLElement, root: HTMLElement) {
  const menuSelector = button.hasAttribute('data-app-menu-toggle') ? '[data-app-menu]' : '[data-profile-menu]';
  const menu = root.querySelector<HTMLElement>(menuSelector);
  const willOpen = !menu?.classList.contains('open');

  root.querySelectorAll<HTMLElement>('[data-app-menu], [data-profile-menu]').forEach((item) => item.classList.remove('open'));
  root
    .querySelectorAll<HTMLElement>('[data-app-menu-toggle], [data-profile-menu-toggle]')
    .forEach((item) => item.setAttribute('aria-expanded', 'false'));

  menu?.classList.toggle('open', willOpen);
  button.setAttribute('aria-expanded', String(willOpen));
}

function setSupplierTab(tab: HTMLElement) {
  const target = tab.getAttribute('data-supplier-tab-target');
  const list = tab.closest<HTMLElement>('[data-supplier-tab-list]');
  const scope = tab.closest<HTMLElement>('.supplier-detail-subtabs, .supplier-detail-tabbed-view') ?? tab.closest<HTMLElement>('.procurex-react-page');

  if (!target || !list || !scope) return;

  list.querySelectorAll<HTMLElement>('[data-supplier-tab-target]').forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  });

  scope.querySelectorAll<HTMLElement>(':scope > .supplier-detail-tab-panels > [data-supplier-tab-panel]').forEach((panel) => {
    const isActive = panel.getAttribute('data-supplier-tab-panel') === target;
    panel.style.display = isActive ? 'block' : 'none';
  });
}

function setNamedPanelTab(button: HTMLElement, buttonAttribute: string, panelAttribute: string) {
  const target = button.getAttribute(buttonAttribute);
  const scope = button.closest<HTMLElement>('.procurex-react-page');
  if (!target || !scope) return;

  scope.querySelectorAll<HTMLElement>(`[${buttonAttribute}]`).forEach((item) => {
    const isActive = item === button;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  });

  scope.querySelectorAll<HTMLElement>(`[${panelAttribute}]`).forEach((panel) => {
    const isActive = panel.getAttribute(panelAttribute) === target;
    panel.style.display = isActive ? '' : 'none';
    panel.classList.toggle('active', isActive);
  });
}

function activateTabByName(root: HTMLElement, target: string) {
  const tab = root.querySelector<HTMLElement>(`.tab[data-tab="${CSS.escape(target)}"]`);
  if (tab) setActiveTab(tab);
}

function activatePlanningAnchor(root: HTMLElement, link: HTMLAnchorElement) {
  const href = link.getAttribute('href');
  if (!href?.startsWith('#') || href.length < 2) return false;

  const panel = root.querySelector<HTMLElement>(`#${CSS.escape(href.slice(1))}`);
  if (!panel) return false;

  const tabName = panel.getAttribute('data-tab');
  if (tabName) activateTabByName(root, tabName);

  root.querySelectorAll<HTMLElement>('.planning-nav-card').forEach((card) => {
    card.classList.toggle('active', card === link);
  });

  window.requestAnimationFrame(() => {
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  return true;
}

function setProcurementPlanningView(button: HTMLElement, root: HTMLElement) {
  const view = button.getAttribute('data-planning-view');
  if (!view) return;

  root.querySelectorAll<HTMLElement>('[data-planning-view]').forEach((item) => {
    item.classList.toggle('active', item === button);
    item.setAttribute('aria-selected', String(item === button));
  });

  root.querySelectorAll<HTMLElement>('[data-planning-panel]').forEach((panel) => {
    const isActive = panel.getAttribute('data-planning-panel') === view;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? '' : 'none';
  });
}

function openProcurementPlanDrawer(button: HTMLElement, root: HTMLElement) {
  const recordId = button.getAttribute('data-plan-open');
  const drawer = root.querySelector<HTMLElement>('[data-plan-drawer]');
  const content = root.querySelector<HTMLElement>('[data-plan-drawer-content]');
  const template = recordId
    ? root.querySelector<HTMLTemplateElement>(`template[data-plan-template="${CSS.escape(recordId)}"]`)
    : null;

  if (!drawer || !content || !template) return;

  content.innerHTML = template.innerHTML;
  drawer.classList.add('open');
  drawer.setAttribute('aria-hidden', 'false');
}

function closeProcurementPlanDrawer(root: HTMLElement) {
  const drawer = root.querySelector<HTMLElement>('[data-plan-drawer]');
  drawer?.classList.remove('open');
  drawer?.setAttribute('aria-hidden', 'true');
}

function scrollProcurementPlanningTarget(button: HTMLElement, root: HTMLElement) {
  const target = button.getAttribute('data-planning-scroll');
  if (!target) return;

  const element = root.querySelector<HTMLElement>(`#${CSS.escape(target)}`) || root.querySelector<HTMLElement>(`[data-planning-panel="${CSS.escape(target)}"]`);
  element?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function setProcurementPlanningMode(button: HTMLElement, root: HTMLElement) {
  const mode = button.getAttribute('data-planning-mode');
  const front = root.querySelector<HTMLElement>('[data-planning-front]');
  const editor = root.querySelector<HTMLElement>('[data-planning-editor]');
  const uploadPanel = root.querySelector<HTMLElement>('#planning-upload');

  if (!mode) return;

  if (editor && front && mode === 'create') {
    front.hidden = true;
    editor.hidden = false;
    editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const createPanel = root.querySelector<HTMLElement>('#planning-create');
  if (createPanel && uploadPanel) {
    createPanel.hidden = mode !== 'create';
    uploadPanel.hidden = mode !== 'upload';
  }

  const target = mode === 'upload' ? uploadPanel : createPanel;
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (mode === 'upload') {
    uploadPanel?.removeAttribute('hidden');
    uploadPanel?.querySelector<HTMLInputElement>('[data-plan-upload-input]')?.click();
  }
}

function closeProcurementPlanningEditor(root: HTMLElement) {
  const front = root.querySelector<HTMLElement>('[data-planning-front]');
  const editor = root.querySelector<HTMLElement>('[data-planning-editor]');
  if (!front || !editor) return;
  if (root.dataset.planningDirty === 'true' && !window.confirm('Leave this plan without saving changes?')) return;
  root.dataset.planningDirty = 'false';
  editor.hidden = true;
  front.hidden = false;
  front.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function downloadProcurementPlanningText(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function collectProcurementPlanningTableCsv(root: HTMLElement) {
  const rows = Array.from(root.querySelectorAll<HTMLTableRowElement>('[data-planning-year-table] tr:not([hidden])'));
  return rows.map((row) =>
    Array.from(row.querySelectorAll('th, td'))
      .map((cell) => `"${(cell.textContent || '').trim().replace(/"/g, '""')}"`)
      .join(',')
  ).join('\n');
}

function addProcurementPlanningRow(root: HTMLElement) {
  const body = root.querySelector<HTMLElement>('[data-plan-create-body]');
  const lastRow = body?.querySelector<HTMLTableRowElement>('[data-plan-create-row]:last-child');
  if (!body || !lastRow) return;

  const nextRow = lastRow.cloneNode(true) as HTMLTableRowElement;
  nextRow.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field) => {
    field.value = '';
  });
  nextRow.querySelector<HTMLInputElement>('input[name="appCode"]')?.focus();
  body.appendChild(nextRow);
  root.dataset.planningDirty = 'true';
}

function filterProcurementPlanningYear(select: HTMLSelectElement, root: HTMLElement) {
  const selectedYear = select.value;
  const rows = root.querySelectorAll<HTMLTableRowElement>('[data-financial-year]');
  let visibleCount = 0;

  rows.forEach((row) => {
    const isVisible = row.getAttribute('data-financial-year') === selectedYear;
    row.hidden = !isVisible;
    if (isVisible) visibleCount += 1;
  });

  const currentYear = root.querySelector<HTMLElement>('[data-planning-current-year]');
  if (currentYear) currentYear.textContent = selectedYear;

  root.querySelectorAll<HTMLElement>('.planning-kpi-card').forEach((card) => {
    if (card.textContent?.includes('Financial Year')) {
      const value = card.querySelector('strong');
      if (value) value.textContent = selectedYear;
    }
    if (card.textContent?.includes('Plan Lines')) {
      const value = card.querySelector('strong');
      if (value) value.textContent = String(visibleCount);
    }
  });
}

function updateProcurementPlanningUploadStatus(input: HTMLInputElement, root: HTMLElement) {
  const status = root.querySelector<HTMLElement>('[data-plan-upload-status]');
  const file = input.files?.[0];
  if (status) {
    status.textContent = file ? `${file.name} selected. Import parsing can be connected to the backend or Excel parser.` : 'No file selected.';
  }
}

function scrollPageToTop() {
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;

  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return;

  try {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  } catch {
    // jsdom does not implement scrollTo; direct scrollTop assignment above is enough for tests.
  }
}

function initializeStaticPage(root: HTMLElement, language: string) {
  normalizeAppDrawer(root);
  syncInitialTabs(root);
  applyPlanningDraftToCreateTender(root);
  applyStaticTranslations(root, language);
}

function applyPlanningDraftToCreateTender(root: HTMLElement) {
  const wizard = root.querySelector<HTMLElement>('[data-create-tender-wizard]');
  if (!wizard) return;

  try {
    const plannedTender = JSON.parse(window.localStorage.getItem('procurex.planning.selectedTenderPlan') || 'null') as
      | { title?: string; openingDate?: string; closingDate?: string; fundingSource?: string }
      | null;
    if (!plannedTender) return;

    const titleInput = wizard.querySelector<HTMLInputElement>('[data-tender-title]');
    if (titleInput && plannedTender.title) titleInput.value = plannedTender.title;
    wizard.querySelectorAll<HTMLInputElement>('[data-milestone-row-proxy="milestone-opening"], [data-milestone-row="milestone-opening"] [data-milestone-field="date"]').forEach((input) => {
      if (plannedTender.openingDate) input.value = plannedTender.openingDate;
    });
    wizard.querySelectorAll<HTMLInputElement>('[data-milestone-row-proxy="milestone-closing"], [data-milestone-row="milestone-closing"] [data-milestone-field="date"]').forEach((input) => {
      if (plannedTender.closingDate) input.value = plannedTender.closingDate;
    });
  } catch {
    // Bad localStorage content should never block rendering the static prototype page.
  }
}

function resetStaticPage(root: HTMLElement, html: string, language: string) {
  root.innerHTML = html;
  initializeStaticPage(root, language);
  scrollPageToTop();
}

export function ProcurexStaticPage({ pageKey, html }: ProcurexStaticPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const staticPageInstanceKey = pageKey === 'bid-evaluation' ? `${pageKey}:${location.key}` : pageKey;

  useEffect(() => {
    document.body.dataset.page = pageKey;
    document.body.dataset.procurexReactPage = 'true';
    const root = rootRef.current;
    if (root) {
      if (pageKey === 'bid-evaluation') clearEvaluationEntrySelection();
      initializeStaticPage(root, i18n.language);
      if (pageKey === 'bid-evaluation') scrollPageToTop();
    }

    return () => {
      delete document.body.dataset.procurexReactPage;
    };
  }, [pageKey, html, i18n.language, location.key]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const navTarget = target.closest<HTMLElement>('[data-navigate]');
    const evaluationReset = target.closest<HTMLElement>('[data-evaluation-clear-selection]');
    const tab = target.closest<HTMLElement>('.tab[data-tab]');
    const supplierTab = target.closest<HTMLElement>('[data-supplier-tab-target]');
    const supplierJump = target.closest<HTMLElement>('[data-supplier-jump-target]');
    const iamTab = target.closest<HTMLElement>('[data-iam-tab]');
    const communicationTab = target.closest<HTMLElement>('[data-communication-tab]');
    const awardingJump = target.closest<HTMLElement>('[data-awarding-tab-jump]');
    const menuButton = target.closest<HTMLElement>('[data-app-menu-toggle], [data-profile-menu-toggle]');
    const planningAnchor = target.closest<HTMLAnchorElement>('.planning-nav-card[href^="#"]');
    const procurementPlanningView = target.closest<HTMLElement>('[data-planning-view]');
    const procurementPlanOpen = target.closest<HTMLElement>('[data-plan-open]');
    const procurementPlanClose = target.closest<HTMLElement>('[data-plan-close]');
    const procurementPlanningScroll = target.closest<HTMLElement>('[data-planning-scroll]');
    const procurementPlanningMode = target.closest<HTMLElement>('[data-planning-mode]');
    const procurementPlanningAddRow = target.closest<HTMLElement>('[data-plan-add-row]');
    const procurementPlanningEditorBack = target.closest<HTMLElement>('[data-plan-editor-back]');
    const procurementPlanningTemplateDownload = target.closest<HTMLElement>('[data-plan-template-download]');
    const procurementPlanningDownload = target.closest<HTMLElement>('[data-plan-download]');
    const procurementPlanningViewFull = target.closest<HTMLElement>('[data-plan-view-full]');
    const procurementPlanningFullClose = target.closest<HTMLElement>('[data-plan-full-close]');
    const procurementPlanningRemoveRow = target.closest<HTMLElement>('[data-plan-remove-row]');
    const procurementPlanningAddColumn = target.closest<HTMLElement>('[data-plan-add-column]');
    const procurementPlanningRemoveColumn = target.closest<HTMLElement>('[data-plan-remove-column]');
    const procurementPlanningTender = target.closest<HTMLElement>('[data-plan-tender]');
    const procurementPlanningStatusNavigate = target.closest<HTMLElement>('[data-status-navigate]');

    if (planningAnchor && rootRef.current && activatePlanningAnchor(rootRef.current, planningAnchor)) {
      event.preventDefault();
      return;
    }

    if (procurementPlanOpen && rootRef.current) {
      event.preventDefault();
      openProcurementPlanDrawer(procurementPlanOpen, rootRef.current);
      return;
    }

    if (procurementPlanClose && rootRef.current) {
      event.preventDefault();
      closeProcurementPlanDrawer(rootRef.current);
      return;
    }

    if (procurementPlanningView && rootRef.current) {
      event.preventDefault();
      setProcurementPlanningView(procurementPlanningView, rootRef.current);
      return;
    }

    if (procurementPlanningScroll && rootRef.current) {
      event.preventDefault();
      scrollProcurementPlanningTarget(procurementPlanningScroll, rootRef.current);
      return;
    }

    if (procurementPlanningMode && rootRef.current) {
      event.preventDefault();
      setProcurementPlanningMode(procurementPlanningMode, rootRef.current);
      return;
    }

    if (procurementPlanningAddRow && rootRef.current) {
      event.preventDefault();
      addProcurementPlanningRow(rootRef.current);
      return;
    }

    if (procurementPlanningEditorBack && rootRef.current) {
      event.preventDefault();
      closeProcurementPlanningEditor(rootRef.current);
      return;
    }

    if (procurementPlanningTemplateDownload) {
      event.preventDefault();
      downloadProcurementPlanningText(
        'procurex-plan-template.csv',
        'Tender Title,Opening Date,Closing Date,Category,Budget,Procurement Method,Source of Funds,Expected Completion Date,Status,Q1,Q2,Q3,Q4,Notes\nConstruction of community water wells,2026-08-01,2026-08-30,Works,480000000,Open Tender,Development budget,2026-12-15,Draft planning,Design,Tender,Award,Contract,'
      );
      return;
    }

    if (procurementPlanningDownload && rootRef.current) {
      event.preventDefault();
      downloadProcurementPlanningText('procurex-plan.csv', collectProcurementPlanningTableCsv(rootRef.current));
      return;
    }

    if (procurementPlanningViewFull && rootRef.current) {
      event.preventDefault();
      const fullView = rootRef.current.querySelector<HTMLElement>('[data-plan-full-view]');
      fullView?.removeAttribute('hidden');
      fullView?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (procurementPlanningFullClose && rootRef.current) {
      event.preventDefault();
      rootRef.current.querySelector<HTMLElement>('[data-plan-full-view]')?.setAttribute('hidden', '');
      return;
    }

    if (procurementPlanningRemoveRow) {
      event.preventDefault();
      procurementPlanningRemoveRow.closest('[data-plan-create-row]')?.remove();
      if (rootRef.current) rootRef.current.dataset.planningDirty = 'true';
      return;
    }

    if (procurementPlanningAddColumn && rootRef.current) {
      event.preventDefault();
      const label = window.prompt('Column name');
      if (!label) return;
      const id = `custom-${Date.now()}`;
      const head = rootRef.current.querySelector<HTMLElement>('[data-plan-create-head]');
      head?.querySelector('th:nth-last-child(2)')?.insertAdjacentHTML(
        'beforebegin',
        `<th data-column-id="${id}" data-custom-column="true">${label}</th>`
      );
      rootRef.current.querySelectorAll<HTMLElement>('[data-plan-create-row]').forEach((row) => {
        row.querySelector('td:nth-last-child(2)')?.insertAdjacentHTML(
          'beforebegin',
          `<td data-column-id="${id}" data-custom-column="true"><input class="form-input" name="${id}"></td>`
        );
      });
      rootRef.current.dataset.planningDirty = 'true';
      return;
    }

    if (procurementPlanningRemoveColumn && rootRef.current) {
      event.preventDefault();
      const customHeads = rootRef.current.querySelectorAll<HTMLElement>('[data-plan-create-head] [data-custom-column="true"]');
      const last = customHeads[customHeads.length - 1];
      if (!last) {
        window.alert('Only custom columns can be removed.');
        return;
      }
      const id = last.getAttribute('data-column-id') || '';
      rootRef.current.querySelectorAll<HTMLElement>(`[data-column-id="${CSS.escape(id)}"]`).forEach((cell) => cell.remove());
      rootRef.current.dataset.planningDirty = 'true';
      return;
    }

    if (procurementPlanningTender) {
      event.preventDefault();
      const row = procurementPlanningTender.closest('tr');
      const title = row?.querySelector('td strong')?.textContent?.trim() || '';
      window.localStorage.setItem('procurex.planning.selectedTenderPlan', JSON.stringify({ title }));
      navigate(pageToRoute['create-tender']);
      return;
    }

    if (procurementPlanningStatusNavigate) {
      event.preventDefault();
      const page = procurementPlanningStatusNavigate.getAttribute('data-status-navigate') || 'workspace-dashboard';
      navigate(pageToRoute[page] || '/dashboard');
      return;
    }

    if (navTarget) {
      event.preventDefault();
      const page = navTarget.getAttribute('data-navigate') || 'welcome';
      if (page === 'bid-evaluation') clearEvaluationEntrySelection();
      if (pageKey === 'bid-evaluation' && page === 'bid-evaluation' && rootRef.current) {
        resetStaticPage(rootRef.current, html, i18n.language);
      }
      navigate(pageToRoute[page] || '/');
      return;
    }

    if (evaluationReset && rootRef.current) {
      event.preventDefault();
      clearEvaluationEntrySelection();
      resetStaticPage(rootRef.current, html, i18n.language);
      return;
    }

    if (tab) {
      event.preventDefault();
      setActiveTab(tab);
      return;
    }

    if (supplierTab) {
      event.preventDefault();
      setSupplierTab(supplierTab);
      return;
    }

    if (supplierJump && rootRef.current) {
      event.preventDefault();
      const section = rootRef.current.querySelector<HTMLElement>(
        `[data-supplier-document-section="${CSS.escape(supplierJump.getAttribute('data-supplier-jump-target') ?? '')}"]`
      );
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (iamTab) {
      event.preventDefault();
      setNamedPanelTab(iamTab, 'data-iam-tab', 'data-iam-panel');
      return;
    }

    if (communicationTab) {
      event.preventDefault();
      communicationTab.parentElement?.querySelectorAll('button').forEach((button) => {
        button.classList.toggle('active', button === communicationTab);
      });
      return;
    }

    if (awardingJump && rootRef.current) {
      event.preventDefault();
      activateTabByName(rootRef.current, awardingJump.getAttribute('data-awarding-tab-jump') ?? '');
      return;
    }

    if (menuButton && rootRef.current) {
      event.preventDefault();
      toggleWorkspaceMenu(menuButton, rootRef.current);
    }
  }

  function handleSubmit(event: FormEvent<HTMLDivElement>) {
    const form = event.target as HTMLFormElement;
    if (!form?.matches?.('form')) return;

    event.preventDefault();

    if (form.matches('[data-procurement-plan-form]') && rootRef.current) {
      rootRef.current.dataset.planningDirty = 'false';
      const status = form.querySelector<HTMLElement>('[data-plan-form-status], .form-status');
      status?.classList.add('success');
      if (status) status.textContent = 'Plan saved in this frontend demo.';
      closeProcurementPlanningEditor(rootRef.current);
      return;
    }

    const action = form.getAttribute('data-action');
    const status =
      form.querySelector<HTMLElement>('[data-form-status]') ||
      form.querySelector<HTMLElement>('.form-status') ||
      form.querySelector<HTMLElement>('.form-error-new') ||
      form.querySelector<HTMLElement>('.form-error');

    if (action === 'login') {
      navigate('/dashboard');
      return;
    }

    if (action === 'register') {
      navigate('/identity/verification');
      return;
    }

    status?.classList.add('success');
    if (status) status.textContent = 'Saved in this frontend demo.';
  }

  function handleChange(event: ChangeEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const yearFilter = target.closest<HTMLSelectElement>('[data-planning-year-filter]');
    const uploadInput = target.closest<HTMLInputElement>('[data-plan-upload-input]');
    const planningInput = target.closest<HTMLElement>('[data-procurement-plan-form] input, [data-procurement-plan-form] select, [data-procurement-plan-form] textarea');

    if (yearFilter && rootRef.current) {
      filterProcurementPlanningYear(yearFilter, rootRef.current);
      return;
    }

    if (uploadInput && rootRef.current) {
      updateProcurementPlanningUploadStatus(uploadInput, rootRef.current);
      return;
    }

    if (planningInput && rootRef.current) {
      rootRef.current.dataset.planningDirty = 'true';
    }
  }

  return (
    <>
      <div className="procurex-floating-language">
        <LanguageSwitcher />
      </div>
      <div
        key={staticPageInstanceKey}
        ref={rootRef}
        id="page-content"
        role="main"
        tabIndex={-1}
        className="procurex-react-page"
        onClick={handleClick}
        onChange={handleChange}
        onSubmit={handleSubmit}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
