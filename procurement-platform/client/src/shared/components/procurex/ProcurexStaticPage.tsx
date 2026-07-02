import { ChangeEvent, FormEvent, MouseEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/app/store';
import { accountApi, type AccountActivityEvent } from '@/features/account/api';
import { assumeUser, signOut, signOutSession } from '@/features/auth/slice';
import i18nInstance, { ensureProcurexStaticNamespace, hasProcurexStaticNamespace } from '@/i18n';
import { AccountMenu } from '@/shared/components/AccountMenu';
import { demoUsers } from '@/shared/data/fixtures';
import type { SessionUser } from '@/shared/types/domain';
import { LanguageSwitcher } from '../LanguageSwitcher';

type ProcurexStaticPageProps = {
  pageKey: string;
  html: string;
  onInitialize?: (root: HTMLElement) => void;
};

const pageToRoute: Record<string, string> = {
  welcome: '/',
  'about-procurex': '/about',
  'privacy-policy': '/privacy',
  'terms-and-conditions': '/terms',
  contact: '/contact',
  help: '/help',
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
  'my-tenders': '/procurement/my-tenders',
  'my-tender': '/procurement/my-tenders',
  'my-bids': '/procurement/my-bids',
  'my-bid': '/procurement/my-bids',
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
  'award-response': '/awards-contracts/award-response',
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

function notifyStaticPage(title: string, message: string, reason?: string, tone: 'success' | 'info' | 'warning' | 'error' = 'info') {
  window.dispatchEvent(
    new CustomEvent('procurex:notify', {
      detail: {
        tone,
        title,
        message,
        reason,
        dismissible: true
      }
    })
  );
}

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
    <span>ProcureX account tools</span>
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

function sessionInitials(user?: SessionUser | null) {
  const parts = String(user?.displayName || 'ProcureX user')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  return (parts[0]?.[0] || 'P').toUpperCase() + (parts.length > 1 ? (parts[1]?.[0] || '').toUpperCase() : '');
}

function personalizeStaticChrome(root: HTMLElement, user?: SessionUser | null) {
  root.querySelectorAll<HTMLElement>('.profile-button span').forEach((node) => {
    node.textContent = sessionInitials(user);
  });

  root.querySelectorAll<HTMLElement>('.app-menu-header > span').forEach((node) => {
    node.textContent = user?.organization || 'ProcureX account tools';
  });

  root.querySelectorAll<HTMLButtonElement>('[data-profile-menu] button').forEach((button) => {
    const label = normalizeButtonText(button);
    if (label === 'profile') button.dataset.navigate = 'account-profile';
    if (label === 'messages') button.dataset.navigate = 'communication-center';
    if (label === 'help') button.dataset.navigate = 'help';
    if (label === 'language') button.dataset.profileLanguage = 'true';
    if (label === 'logout') button.dataset.navigate = 'sign-in';
  });
}

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

function cssEscape(value: string) {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(value);
  return value.replace(/["\\]/g, (char) => `\\${char}`);
}

function shouldTranslateNode(node: Text) {
  const parent = node.parentElement;
  if (!parent) return false;
  if (parent.closest('svg, path, style, script, noscript, textarea')) return false;
  return Boolean(node.nodeValue?.trim());
}

function applyStaticTranslations(root: HTMLElement, language: string) {
  const showText = root.ownerDocument.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
  const walker = root.ownerDocument.createTreeWalker(root, showText);
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

function setMarketplaceTab(tab: HTMLElement) {
  const target = tab.getAttribute('data-marketplace-tab');
  const marketplaceRoot = tab.closest<HTMLElement>('[data-marketplace-root]');
  if (!target || !marketplaceRoot) return;

  marketplaceRoot.querySelectorAll<HTMLElement>('[data-marketplace-tab]').forEach((button) => {
    const isActive = button.getAttribute('data-marketplace-tab') === target;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  marketplaceRoot.querySelectorAll<HTMLElement>('[data-marketplace-tab-panel]').forEach((panel) => {
    panel.style.display = panel.getAttribute('data-marketplace-tab-panel') === target ? 'grid' : 'none';
  });
}

function getMarketplaceRouteTabFromLocation(pathname: string, search: string) {
  if (pathname.endsWith('/procurement/my-tenders')) return 'my-tenders';
  if (pathname.endsWith('/procurement/my-bids')) return 'my-bids';

  const tab = new URLSearchParams(search).get('tab') || '';
  return ['marketplace', 'my-tenders', 'my-bids'].includes(tab) ? tab : '';
}

function getMarketplaceRouteTab(marketplaceRoot: HTMLElement) {
  const routeRoot = marketplaceRoot.closest<HTMLElement>('.procurex-react-page');
  const pathname = routeRoot?.dataset.procurexRoutePath || (typeof window === 'undefined' ? '' : window.location.pathname);
  const search = routeRoot?.dataset.procurexRouteSearch || (typeof window === 'undefined' ? '' : window.location.search);
  return getMarketplaceRouteTabFromLocation(pathname, search);
}

function createMarketplaceRouteHtml(html: string, pathname: string, search: string) {
  const routeTab = getMarketplaceRouteTabFromLocation(pathname, search);
  if (!routeTab || typeof DOMParser === 'undefined') return html;

  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = document.body.firstElementChild;
  const marketplaceRoot = wrapper?.querySelector<HTMLElement>('[data-marketplace-root]');
  if (!wrapper || !marketplaceRoot) return html;

  marketplaceRoot.querySelectorAll<HTMLElement>('[data-marketplace-tab]').forEach((button) => {
    const isActive = button.getAttribute('data-marketplace-tab') === routeTab;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });

  marketplaceRoot.querySelectorAll<HTMLElement>('[data-marketplace-tab-panel]').forEach((panel) => {
    panel.style.display = panel.getAttribute('data-marketplace-tab-panel') === routeTab ? 'grid' : 'none';
  });

  return wrapper.innerHTML;
}

function createTranslatedStaticHtml(html: string, language: string) {
  if (language !== 'sw' || typeof DOMParser === 'undefined') return html;

  const document = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
  const wrapper = document.body.firstElementChild as HTMLElement | null;
  if (!wrapper) return html;

  applyStaticTranslations(wrapper, language);
  return wrapper.innerHTML;
}

function applyMarketplaceFilters(marketplaceRoot: HTMLElement) {
  const rows = Array.from(marketplaceRoot.querySelectorAll<HTMLElement>('[data-marketplace-row]'));
  const count = marketplaceRoot.querySelector<HTMLElement>('[data-marketplace-count]');
  const search = marketplaceRoot.querySelector<HTMLInputElement>('[data-marketplace-search]');
  const type = marketplaceRoot.querySelector<HTMLSelectElement>('[data-marketplace-type]');
  const budget = marketplaceRoot.querySelector<HTMLSelectElement>('[data-marketplace-budget]');
  const status = marketplaceRoot.querySelector<HTMLSelectElement>('[data-marketplace-status]');
  const sort = marketplaceRoot.querySelector<HTMLSelectElement>('[data-marketplace-sort]');
  const list = marketplaceRoot.querySelector<HTMLElement>('[data-marketplace-list]');

  const query = (search?.value || '').trim().toLowerCase();
  const activeType = type?.value || '';
  const activeBudget = budget?.value || '';
  const activeStatus = status?.value || '';

  const visibleRows = rows.filter((row) => {
    const matchesQuery = !query || (row.dataset.search || '').includes(query);
    const matchesType = !activeType || row.dataset.type === activeType;
    const matchesBudget = !activeBudget || row.dataset.budgetBand === activeBudget;
    const matchesStatus = !activeStatus || row.dataset.status === activeStatus;
    return matchesQuery && matchesType && matchesBudget && matchesStatus;
  });

  visibleRows.sort((a, b) => {
    if (sort?.value === 'budget-desc') return Number(b.dataset.budget || 0) - Number(a.dataset.budget || 0);
    if (sort?.value === 'budget-asc') return Number(a.dataset.budget || 0) - Number(b.dataset.budget || 0);
    if (sort?.value === 'newest') return Date.parse(b.dataset.created || '0') - Date.parse(a.dataset.created || '0');
    return Date.parse(a.dataset.closing || '0') - Date.parse(b.dataset.closing || '0');
  });

  rows.forEach((row) => {
    row.hidden = !visibleRows.includes(row);
  });
  visibleRows.forEach((row) => list?.appendChild(row));
  if (count) count.textContent = `${visibleRows.length} matching`;
}

function initializeMarketplace(root: HTMLElement) {
  const marketplaceRoot = root.querySelector<HTMLElement>('[data-marketplace-root]');
  if (!marketplaceRoot) return;

  const routeTab = getMarketplaceRouteTab(marketplaceRoot);
  const routeTabButton = routeTab
    ? Array.from(marketplaceRoot.querySelectorAll<HTMLElement>('[data-marketplace-tab]')).find(
        (tab) => tab.getAttribute('data-marketplace-tab') === routeTab
      )
    : null;
  const activeTab =
    routeTabButton ||
    marketplaceRoot.querySelector<HTMLElement>('[data-marketplace-tab].active') ||
    marketplaceRoot.querySelector<HTMLElement>('[data-marketplace-tab]');
  if (activeTab) setMarketplaceTab(activeTab);
  applyMarketplaceFilters(marketplaceRoot);
}

function syncMarketplaceRouteTab(root: HTMLElement) {
  const marketplaceRoot = root.querySelector<HTMLElement>('[data-marketplace-root]');
  if (!marketplaceRoot) return;

  const routeTab = getMarketplaceRouteTab(marketplaceRoot);
  if (!routeTab) return;

  const tab = Array.from(marketplaceRoot.querySelectorAll<HTMLElement>('[data-marketplace-tab]')).find(
    (item) => item.getAttribute('data-marketplace-tab') === routeTab
  );
  if (tab) setMarketplaceTab(tab);
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
  const tab = root.querySelector<HTMLElement>(`.tab[data-tab="${cssEscape(target)}"]`);
  if (tab) setActiveTab(tab);
}

function setAwardingQueueTab(tab: HTMLElement) {
  const target = tab.getAttribute('data-tab');
  const tabGroup = tab.closest<HTMLElement>('.awarding-contract-tabs');
  const tabContent =
    tabGroup?.closest<HTMLElement>('.awarding-tabs-panel, .award-response-page, .post-award-page')?.querySelector<HTMLElement>('.awarding-tab-content') ??
    tabGroup?.nextElementSibling;
  const scope = tab.closest<HTMLElement>('.procurex-react-page');

  if (!target || !tabGroup) return;

  tabGroup.querySelectorAll<HTMLElement>('.supplier-detail-tab[data-tab]').forEach((item) => {
    const isActive = item === tab;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  });

  tabContent?.querySelectorAll<HTMLElement>('.tab-content').forEach((panel) => {
    const isActive = panel.getAttribute('data-tab') === target;
    panel.classList.toggle('tab-content--visible', isActive);
      panel.classList.toggle('tab-content--hidden', !isActive);
  });

  scope?.querySelectorAll<HTMLElement>('[data-awarding-tab-jump]').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-awarding-tab-jump') === target);
  });
}

function activateAwardingQueueTabByName(root: HTMLElement, target: string) {
  const tab = root.querySelector<HTMLElement>(
    `.awarding-contract-tabs .supplier-detail-tab[data-tab="${cssEscape(target)}"]`
  );
  if (tab) setAwardingQueueTab(tab);
}

function setPostAwardMode(root: HTMLElement, mode: string) {
  root.querySelectorAll<HTMLElement>('[data-post-award-mode-panel]').forEach((panel) => {
    panel.style.display = panel.getAttribute('data-post-award-mode-panel') === mode ? '' : 'none';
  });
}

function activateClosedContractPanel(root: HTMLElement, contract: string) {
  root.querySelectorAll<HTMLElement>('[data-closed-contract-panel]').forEach((panel) => {
    const isActive = panel.getAttribute('data-closed-contract-panel') === contract;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? '' : 'none';
  });
}

function activateAwardResponsePanel(root: HTMLElement, awardId: string) {
  root.querySelectorAll<HTMLElement>('[data-award-response-panel]').forEach((panel) => {
    const isActive = panel.getAttribute('data-award-response-panel') === awardId;
    panel.classList.toggle('active', isActive);
    panel.style.display = isActive ? '' : 'none';
  });

  root.querySelectorAll<HTMLElement>('[data-award-response-jump]').forEach((button) => {
    const isActive = button.getAttribute('data-award-response-jump') === awardId;
    button.classList.toggle('active', isActive);
    button.setAttribute('aria-selected', String(isActive));
  });
}

function applyRouteSearchState(root: HTMLElement, pageKey: string, search: string) {
  const params = new URLSearchParams(search);

  if (pageKey === 'tender-planning') {
    const view = params.get('view') || 'front';
    const planId = params.get('plan') || '';
    if (view === 'detail' && planId) {
      const button = root.querySelector<HTMLElement>(`[data-plan-details="${cssEscape(planId)}"]`);
      if (button) setProcurementPlanningDetailFromButton(button, root);
    }
    setProcurementPlanningRoute(root, view);
  }

  if (pageKey === 'awarding-contracts') {
    activateAwardingQueueTabByName(root, params.get('queue') || 'my-urgent-actions');
  }

  if (pageKey === 'contract-negotiation') {
    activateTabByName(root, params.get('tab') || 'overview');
  }

  if (pageKey === 'post-award-tracking') {
    const mode = params.get('mode') || 'active';
    setPostAwardMode(root, mode);
    activateTabByName(root, params.get('tab') || (mode === 'closed' ? 'closure' : 'milestones'));
    activateClosedContractPanel(root, params.get('contract') || 'closed-contract-1');
  }

  if (pageKey === 'award-response') {
    const firstAward = root.querySelector<HTMLElement>('[data-award-response-panel]')?.getAttribute('data-award-response-panel') || '';
    activateAwardResponsePanel(root, params.get('award') || firstAward);
  }
}

function setAwardWizardStep(wizard: HTMLElement, requestedIndex: number) {
  const panels = Array.from(wizard.querySelectorAll<HTMLElement>('[data-award-step-panel]'));
  const stepControls = Array.from(wizard.querySelectorAll<HTMLElement>('[data-award-step-index]'));
  if (!panels.length) return;

  const activeIndex = Math.min(Math.max(requestedIndex, 0), panels.length - 1);
  const activePanel = panels[activeIndex];

  panels.forEach((panel, index) => {
    panel.classList.toggle('active', index === activeIndex);
  });

  stepControls.forEach((control) => {
    const stepIndex = Number(control.dataset.awardStepIndex);
    const active = stepIndex === activeIndex;
    control.classList.toggle('active', active);
    control.classList.toggle('completed', stepIndex < activeIndex);
    control.setAttribute('aria-current', active ? 'step' : 'false');
  });

  const previousButton = wizard.querySelector<HTMLButtonElement>('[data-award-prev]');
  const nextButton = wizard.querySelector<HTMLButtonElement>('[data-award-next]');
  const progressOutput = wizard.querySelector<HTMLElement>('[data-award-progress]');
  const stepTitleOutput = wizard.querySelector<HTMLElement>('[data-award-step-title]');
  const activeTitle =
    stepControls
      .find((control) => Number(control.dataset.awardStepIndex) === activeIndex)
      ?.querySelector('span')
      ?.textContent?.trim() || '';

  if (previousButton) previousButton.disabled = activeIndex === 0;
  if (nextButton) nextButton.disabled = activeIndex === panels.length - 1;
  if (progressOutput) progressOutput.textContent = `Step ${activeIndex + 1} of ${panels.length}`;
  if (stepTitleOutput) stepTitleOutput.textContent = activeTitle;

  wizard.dataset.awardActiveStep = String(activeIndex);
  wizard
    .closest<HTMLElement>('[data-award-contract-workspace]')
    ?.setAttribute('data-award-current-step', activePanel?.getAttribute('data-award-step-id') || 'evaluation-result');
}

function syncAwardWizards(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-award-wizard]').forEach((wizard) => {
    const explicitIndex = Number(wizard.dataset.awardActiveStep);
    const activePanelIndex = Array.from(wizard.querySelectorAll<HTMLElement>('[data-award-step-panel]')).findIndex((panel) =>
      panel.classList.contains('active')
    );
    setAwardWizardStep(wizard, Number.isFinite(explicitIndex) ? explicitIndex : Math.max(activePanelIndex, 0));
  });
}

function handleAwardWizardControl(control: HTMLElement) {
  const wizard = control.closest<HTMLElement>('[data-award-wizard]');
  if (!wizard) return false;

  const currentIndex = Number(wizard.dataset.awardActiveStep || '0');
  if (control.hasAttribute('data-award-prev')) setAwardWizardStep(wizard, currentIndex - 1);
  else if (control.hasAttribute('data-award-next')) setAwardWizardStep(wizard, currentIndex + 1);
  else setAwardWizardStep(wizard, Number(control.dataset.awardStepIndex || '0'));
  return true;
}

function activatePlanningAnchor(root: HTMLElement, link: HTMLAnchorElement) {
  const href = link.getAttribute('href');
  if (!href?.startsWith('#') || href.length < 2) return false;

  const panel = root.querySelector<HTMLElement>(`#${cssEscape(href.slice(1))}`);
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
    ? root.querySelector<HTMLTemplateElement>(`template[data-plan-template="${cssEscape(recordId)}"]`)
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

  const element = root.querySelector<HTMLElement>(`#${cssEscape(target)}`) || root.querySelector<HTMLElement>(`[data-planning-panel="${cssEscape(target)}"]`);
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

function setProcurementPlanningRoute(root: HTMLElement, route = 'front') {
  const front = root.querySelector<HTMLElement>('[data-planning-front]');
  const editor = root.querySelector<HTMLElement>('[data-planning-editor]');
  const fullView = root.querySelector<HTMLElement>('[data-plan-full-view]');
  const detailView = root.querySelector<HTMLElement>('[data-plan-detail-view]');

  if (front) front.hidden = route !== 'front';
  if (editor) editor.hidden = route !== 'create';
  if (fullView) fullView.hidden = route !== 'full';
  if (detailView) detailView.hidden = route !== 'detail';
  const target = route === 'full' ? fullView : route === 'detail' ? detailView : route === 'create' ? editor : front;
  target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function escapeStaticHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function normalizeStaticInputDate(value = '') {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toISOString().slice(0, 10);
}

function readProcurementPlanningRow(button: HTMLElement) {
  const row = button.closest<HTMLTableRowElement>('tr');
  const cells = row ? Array.from(row.querySelectorAll<HTMLTableCellElement>('td')) : [];
  const tenderCell = cells[0];
  return {
    title: tenderCell?.querySelector('strong')?.textContent?.trim() || '',
    sourceOfFunds: tenderCell?.querySelector('span')?.textContent?.trim() || '',
    openingDate: normalizeStaticInputDate(cells[1]?.textContent?.trim() || ''),
    closingDate: normalizeStaticInputDate(cells[2]?.textContent?.trim() || ''),
    category: cells[3]?.textContent?.trim() || '',
    budget: cells[4]?.textContent?.trim() || '',
    procurementMethod: cells[5]?.textContent?.trim() || '',
    status: cells[6]?.textContent?.trim() || ''
  };
}

function setProcurementPlanningDetailFromButton(button: HTMLElement, root: HTMLElement) {
  const record = readProcurementPlanningRow(button);
  const content = root.querySelector<HTMLElement>('[data-plan-detail-content]');
  if (!content) return;
  content.innerHTML = `
    <div class="procurement-plan-drawer-content">
      <span class="section-kicker">Plan details</span>
      <h2 id="plan-drawer-title">${escapeStaticHtml(record.title)}</h2>
      <div class="procurement-plan-drawer-status">
        <span class="badge badge-info">${escapeStaticHtml(record.status || 'Not Open')}</span>
        <span class="planning-readiness-pill">Annual plan</span>
      </div>
      <section>
        <h3>Plan Details</h3>
        <div class="planning-detail-grid procurement-plan-detail-grid">
          <div><span>Opening Date</span><strong>${escapeStaticHtml(record.openingDate)}</strong></div>
          <div><span>Closing Date</span><strong>${escapeStaticHtml(record.closingDate)}</strong></div>
          <div><span>Category</span><strong>${escapeStaticHtml(record.category)}</strong></div>
          <div><span>Budget</span><strong>${escapeStaticHtml(record.budget)}</strong></div>
          <div><span>Method</span><strong>${escapeStaticHtml(record.procurementMethod)}</strong></div>
          <div><span>Source of Funds</span><strong>${escapeStaticHtml(record.sourceOfFunds)}</strong></div>
        </div>
      </section>
    </div>
  `;
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

  rows.forEach((row) => {
    const isVisible = row.getAttribute('data-financial-year') === selectedYear;
    row.hidden = !isVisible;
  });

  const currentYear = root.querySelector<HTMLElement>('[data-planning-current-year]');
  if (currentYear) currentYear.textContent = selectedYear;

  root.querySelectorAll<HTMLElement>('.planning-kpi-card').forEach((card) => {
    if (card.textContent?.includes('Financial Year')) {
      const value = card.querySelector('strong');
      if (value) value.textContent = selectedYear;
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

function initializeStaticPage(root: HTMLElement, language: string, pageKey: string, search: string) {
  const activeLanguage =
    language === 'sw' || i18nInstance.language === 'sw' || i18nInstance.resolvedLanguage === 'sw' ? 'sw' : 'en';

  normalizeAppDrawer(root);
  syncInitialTabs(root);
  syncAwardWizards(root);
  applyRouteSearchState(root, pageKey, search);
  initializeMarketplace(root);
  applyPlanningDraftToCreateTender(root);
  applyStaticTranslations(root, activeLanguage);
}

function setCreateTenderWizardStep(wizard: HTMLElement, requestedIndex: number) {
  const panels = Array.from(wizard.querySelectorAll<HTMLElement>('.wizard-workspace > .journey-panel'));
  const controls = Array.from(wizard.querySelectorAll<HTMLElement>('[data-wizard-step-index]'));
  if (!panels.length) return;
  const activeIndex = Math.min(Math.max(requestedIndex, 0), panels.length - 1);

  panels.forEach((panel, index) => {
    const active = index === activeIndex;
    panel.classList.toggle('active', active);
    panel.setAttribute('aria-hidden', active ? 'false' : 'true');
  });

  controls.forEach((control) => {
    const index = Number(control.dataset.wizardStepIndex);
    const active = index === activeIndex;
    control.classList.toggle('active', active);
    control.classList.toggle('completed', index < activeIndex);
    control.setAttribute('aria-current', active ? 'step' : 'false');
  });

  const previousButton = wizard.querySelector<HTMLButtonElement>('[data-wizard-prev]');
  const nextButton = wizard.querySelector<HTMLButtonElement>('[data-wizard-next]');
  const progressOutput = wizard.querySelector<HTMLElement>('[data-wizard-progress]');
  const stepTitleOutput = wizard.querySelector<HTMLElement>('[data-wizard-step-title]');
  if (previousButton) previousButton.disabled = activeIndex === 0;
  if (nextButton) nextButton.hidden = activeIndex === panels.length - 1;
  if (progressOutput) progressOutput.textContent = `Step ${activeIndex + 1} of ${panels.length}`;
  if (stepTitleOutput) stepTitleOutput.textContent = controls.find((item) => Number(item.dataset.wizardStepIndex) === activeIndex)?.querySelector('span')?.textContent || '';
}

function applyPlanningDraftToCreateTender(root: HTMLElement) {
  const wizard = root.querySelector<HTMLElement>('[data-create-tender-wizard]');
  if (!wizard) return;

  try {
    const plannedTender = JSON.parse(window.localStorage.getItem('procurex.planning.selectedTenderPlan') || 'null') as
      | { title?: string; openingDate?: string; closingDate?: string; fundingSource?: string; category?: string; procurementMethod?: string; startStep?: number }
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
    const methodSelect = wizard.querySelector<HTMLSelectElement>('[data-procurement-method]');
    if (methodSelect && plannedTender.procurementMethod) {
      methodSelect.value = /invited/i.test(plannedTender.procurementMethod) ? 'Invited Tender' : 'Open Tender';
    }
    const fundingSelect = wizard.querySelector<HTMLSelectElement>('[data-tender-funding-source-select]');
    const fundingCustom = wizard.querySelector<HTMLInputElement>('[data-tender-funding-source-custom]');
    if (fundingSelect && plannedTender.fundingSource) {
      const hasOption = Array.from(fundingSelect.options).some((option) => option.value === plannedTender.fundingSource || option.textContent === plannedTender.fundingSource);
      fundingSelect.value = hasOption ? plannedTender.fundingSource : 'Other';
      if (fundingCustom) {
        fundingCustom.hidden = hasOption;
        if (!hasOption) fundingCustom.value = plannedTender.fundingSource;
      }
    }
    if (plannedTender.category) {
      const category = plannedTender.category;
      const selectedCategoryList = wizard.querySelector<HTMLElement>('[data-selected-category-list]');
      if (selectedCategoryList) {
        selectedCategoryList.innerHTML = `<div class="selected-category-row" data-selected-category="${escapeStaticHtml(category)}"><span>${escapeStaticHtml(category)}</span></div>`;
      }
      const typeId = /work/i.test(category) ? 'works' : /consult/i.test(category) && !/non/i.test(category) ? 'consultancy' : /goods/i.test(category) ? 'goods' : 'services';
      wizard.querySelectorAll<HTMLInputElement>('input[name="procurementType"]').forEach((input) => {
        input.checked = input.value === typeId;
        input.closest<HTMLElement>('[data-procurement-type-card]')?.classList.toggle('selected', input.checked);
      });
    }
    setCreateTenderWizardStep(wizard, Number(plannedTender.startStep ?? 2));
  } catch {
    // Bad localStorage content should never block rendering the static prototype page.
  }
}

function resetStaticPage(root: HTMLElement, html: string, language: string, pageKey: string, search: string) {
  root.innerHTML = html;
  initializeStaticPage(root, language, pageKey, search);
  scrollPageToTop();
}

function normalizeRouteSearch(routeSearch: string) {
  return routeSearch.trim().replace(/^\?/, '').replace(/^&/, '');
}

function routeWithSearch(route: string, routeSearch: string) {
  const normalized = normalizeRouteSearch(routeSearch);
  return normalized ? `${route}?${normalized}` : route;
}

const dashboardNavigationTargets = new Set([
  'workspace-dashboard',
  'buyer-dashboard',
  'supplier-dashboard',
  'procurement-dashboard'
]);

const dashboardPageKeys = new Set([
  'workspace-dashboard',
  'buyer-dashboard',
  'supplier-dashboard',
  'procurement-dashboard'
]);

function hasBrowserHistoryEntry() {
  if (typeof window === 'undefined') return true;
  const state = window.history.state as { idx?: number } | null;
  return typeof state?.idx !== 'number' || state.idx > 0;
}

function normalizeButtonText(target: HTMLElement) {
  return target.textContent?.replace(/\s+/g, ' ').trim().toLowerCase() || '';
}

function shouldNavigateBack(target: HTMLElement, pageKey: string) {
  if (target.hasAttribute('data-history-back')) return true;

  const label = normalizeButtonText(target);
  if (label === 'back' || label.startsWith('back to ')) return true;

  const page = target.getAttribute('data-navigate') || '';
  return target.classList.contains('app-brand-button') && dashboardNavigationTargets.has(page) && !dashboardPageKeys.has(pageKey);
}

function accountActivityForPage(page: string): AccountActivityEvent | null {
  if (page === 'account-profile' || page === 'verification-status') return 'identity.profile.opened';
  if (page === 'communication-center') return 'communication.messages.opened';
  if (page === 'help') return 'support.help.opened';
  return null;
}

function captureAwardContractSelection(target: HTMLElement) {
  const tenderId = target.getAttribute('data-select-tender');
  if (!tenderId || typeof window === 'undefined') return;

  try {
    window.localStorage.setItem('procurex.marketplace.selectedTenderId', tenderId);
  } catch {
    // Storage can be unavailable in jsdom/private contexts; navigation still works without persisted selection.
  }
}

const languageHeaderTargets = [
  '.app-topbar-actions',
  '.welcome-nav-actions-v2',
  '.about-nav-actions',
  '.privacy-nav-actions',
  '.terms-nav-actions',
  '.contact-nav-actions',
  '.nav-actions',
  '.px-nav-links',
  '.px-topbar-inner',
  '.px-public-nav-inner',
  '.section-header',
  '.ekyc-header',
  '.table-header',
  '.dashboard-compact-header',
  '.planning-editor-header',
  '.evaluation-builder-header',
  '.records-detail-header',
  '.tracking-header'
];

const languageMountSelector = '[data-procurex-language-mount="true"]';

function createLanguageHost(ownerDocument: Document, className: string) {
  const host = ownerDocument.createElement('div');
  host.className = className;
  host.dataset.procurexLanguageMount = 'true';
  return host;
}

function insertLanguageHost(root: HTMLElement, ownerDocument: Document) {
  const authHeader = root.querySelector<HTMLElement>('.register-header-inner-new');
  if (authHeader) {
    const host = createLanguageHost(ownerDocument, 'procurex-language-inline procurex-language-inline--auth');
    const authLink = authHeader.querySelector<HTMLElement>('.login-link-new');
    authHeader.insertBefore(host, authLink || null);
    return host;
  }

  const headerTarget = languageHeaderTargets
    .map((selector) => root.querySelector<HTMLElement>(selector))
    .find((target): target is HTMLElement => Boolean(target));

  if (headerTarget) {
    const host = createLanguageHost(ownerDocument, 'procurex-language-inline');
    headerTarget.appendChild(host);
    return host;
  }

  const fallbackHost = createLanguageHost(ownerDocument, 'procurex-language-fallback');
  root.insertBefore(fallbackHost, root.firstChild);
  return fallbackHost;
}

function createStaticHtmlWithLanguageMount(html: string) {
  if (typeof DOMParser === 'undefined') {
    return `<div class="procurex-language-fallback" data-procurex-language-mount="true"></div>${html}`;
  }

  const parser = new DOMParser();
  const documentFragment = parser.parseFromString(`<div id="procurex-static-html-root">${html}</div>`, 'text/html');
  const root = documentFragment.getElementById('procurex-static-html-root');
  if (!root) return html;

  root.querySelectorAll(languageMountSelector).forEach((host) => host.remove());
  insertLanguageHost(root, documentFragment);
  return root.innerHTML;
}

function prepareLanguageSwitcherMount(root: HTMLElement) {
  return root.querySelector<HTMLElement>(languageMountSelector) || insertLanguageHost(root, document);
}

function prepareStaticAccountMenuMount(root: HTMLElement) {
  root.querySelectorAll<HTMLElement>('[data-profile-menu]').forEach((menu) => menu.remove());
  const host = root.querySelector<HTMLElement>('.profile-menu-wrap');
  if (!host) return null;
  host.replaceChildren();
  host.dataset.procurexAccountMenuMount = 'true';
  return host;
}

type AuthDemoAccount = {
  email: string;
  password: string;
  displayName: string;
  accountType: 'USER' | 'ADMIN';
  isNewUser?: boolean;
};

type RegistrationDraft = {
  email: string;
  phone: string;
};

type StoredRegisteredAccount = RegistrationDraft & {
  password: string;
  displayName: string;
  createdAt: string;
};

const authStorageKeys = {
  registrationDraft: 'procurex.registrationDraft',
  pendingAccount: 'procurex.pendingAccount',
  registeredAccounts: 'procurex.registeredAccounts'
};

const authDemoAccounts: AuthDemoAccount[] = [
  {
    email: 'demo@procurex.tz',
    password: 'Demo123!',
    displayName: 'Demo Verified User',
    accountType: 'USER'
  },
  {
    email: 'admin@procurex.tz',
    password: 'Admin123!',
    displayName: 'Admin User',
    accountType: 'ADMIN'
  }
];

function safeReadJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;

  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

function safeWriteJson(key: string, value: unknown) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Auth remains usable for the current render even when localStorage is disabled.
  }
}

function getStoredRegisteredAccounts() {
  return safeReadJson<StoredRegisteredAccount[]>(authStorageKeys.registeredAccounts, []);
}

function saveRegisteredAccount(account: StoredRegisteredAccount) {
  const normalizedEmail = account.email.toLowerCase();
  const accounts = getStoredRegisteredAccounts().filter((item) => item.email.toLowerCase() !== normalizedEmail);
  safeWriteJson(authStorageKeys.registeredAccounts, [...accounts, account]);
  safeWriteJson(authStorageKeys.pendingAccount, account);
}

function findAuthAccount(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  return authDemoAccounts.find(
    (account) => account.email.toLowerCase() === normalizedEmail && account.password === password
  );
}

function getSavedAuthEmail() {
  const pendingAccount = safeReadJson<Partial<StoredRegisteredAccount>>(authStorageKeys.pendingAccount, {});
  const registrationDraft = safeReadJson<Partial<RegistrationDraft>>(authStorageKeys.registrationDraft, {});
  return pendingAccount.email || registrationDraft.email || '';
}

function accountToSessionUser(account: AuthDemoAccount): SessionUser {
  if (account.accountType === 'ADMIN') return { ...demoUsers.admin, email: account.email, displayName: account.displayName };

  return {
    ...demoUsers.user,
    id: demoUsers.user.id,
    email: account.email,
    displayName: account.displayName,
    organization: account.displayName,
    verificationStatus: 'APPROVED'
  };
}

function setAuthFormStatus(form: HTMLFormElement, message: string, isSuccess = false) {
  const status =
    form.querySelector<HTMLElement>('[data-form-status]') ||
    form.querySelector<HTMLElement>('.form-status') ||
    form.querySelector<HTMLElement>('.form-error-new') ||
    form.querySelector<HTMLElement>('.form-error');

  if (!status) return;
  status.textContent = message;
  status.classList.toggle('success', isSuccess);
}

function setRegisterStep(root: HTMLElement, step: number) {
  root.querySelectorAll<HTMLElement>('.register-screen-new[data-screen]').forEach((screen) => {
    const screenStep = Number(screen.dataset.screen || '1');
    screen.classList.toggle('active', screenStep === step);
  });

  root.querySelectorAll<HTMLElement>('.progress-step-new[data-step]').forEach((progressStep) => {
    const progressIndex = Number(progressStep.dataset.step || '1');
    progressStep.classList.toggle('active', progressIndex === Math.min(step, 4));
    progressStep.classList.toggle('completed', progressIndex < Math.min(step, 4));
  });

  const draft = safeReadJson<Partial<RegistrationDraft>>(authStorageKeys.registrationDraft, {});
  const phoneDisplay = root.querySelector<HTMLElement>('#phone-display');
  const emailDisplay = root.querySelector<HTMLElement>('#email-display');
  if (phoneDisplay) phoneDisplay.textContent = draft.phone || '';
  if (emailDisplay) emailDisplay.textContent = draft.email || '';
  scrollPageToTop();
}

function getPasswordChecks(password: string) {
  return {
    length: password.length >= 8 && password.length <= 12,
    uppercase: /[A-Z]/.test(password),
    number: /\d/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };
}

function updatePasswordState(root: HTMLElement) {
  const passwordInput = root.querySelector<HTMLInputElement>('.password-input-new');
  const confirmInput = root.querySelector<HTMLInputElement>('.confirm-password-new');
  const createButton = root.querySelector<HTMLButtonElement>('.btn-create-new');
  const termsInput = root.querySelector<HTMLInputElement>('#terms-accept-new');
  const password = passwordInput?.value || '';
  const checks = getPasswordChecks(password);
  const passed = Object.values(checks).filter(Boolean).length;
  const strengthFill = root.querySelector<HTMLElement>('.strength-fill-new');
  const strengthText = root.querySelector<HTMLElement>('.strength-text-new strong');
  const labels = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'];

  root.querySelectorAll<HTMLElement>('[data-requirement]').forEach((item) => {
    const requirement = item.dataset.requirement as keyof ReturnType<typeof getPasswordChecks>;
    const isMet = Boolean(checks[requirement]);
    item.classList.toggle('met', isMet);
    const icon = item.querySelector<HTMLElement>('.requirement-icon-new');
    if (icon) icon.textContent = isMet ? 'OK' : 'o';
  });

  if (strengthFill) strengthFill.style.width = `${(passed / 4) * 100}%`;
  if (strengthText) strengthText.textContent = labels[passed];
  if (createButton) {
    createButton.disabled = passed < 4 || password !== (confirmInput?.value || '') || !termsInput?.checked;
  }
}

function updateOtpState(root: HTMLElement) {
  const otpInputs = Array.from(root.querySelectorAll<HTMLInputElement>('.otp-input-new'));
  const verifyButton = root.querySelector<HTMLButtonElement>('[data-action="register-step2"] .btn-continue-new');
  if (verifyButton) verifyButton.disabled = otpInputs.map((input) => input.value).join('').length !== otpInputs.length;
}

function togglePasswordVisibility(button: HTMLElement) {
  const wrapper = button.closest('.password-input-wrapper-new');
  const input = wrapper?.querySelector<HTMLInputElement>('input');
  if (!input) return;

  const showPassword = input.type === 'password';
  input.type = showPassword ? 'text' : 'password';
  button.setAttribute('aria-label', showPassword ? 'Hide password' : 'Show password');
}

function toggleConfirmControl(button: HTMLElement, root: HTMLElement) {
  const control = button.closest<HTMLElement>('[data-confirm-control]');
  const input = control?.querySelector<HTMLInputElement>('.confirm-action-input');
  if (!input) return;

  input.checked = !input.checked;
  button.setAttribute('aria-pressed', String(input.checked));
  control?.classList.toggle('confirmed', input.checked);
  updatePasswordState(root);
}

function initializeAuthPage(root: HTMLElement, pageKey: string) {
  if (pageKey === 'sign-in') {
    const emailInput = root.querySelector<HTMLInputElement>('[data-action="sign-in"] input[name="email"]');
    if (emailInput && !emailInput.value) emailInput.value = getSavedAuthEmail();
  }

  if (pageKey === 'register') {
    const draft = safeReadJson<Partial<RegistrationDraft>>(authStorageKeys.registrationDraft, {});
    const emailInput = root.querySelector<HTMLInputElement>('[data-action="register-step1"] input[name="email"]');
    const phoneInput = root.querySelector<HTMLInputElement>('[data-action="register-step1"] input[name="phone"]');
    if (emailInput && draft.email) emailInput.value = draft.email;
    if (phoneInput && draft.phone) phoneInput.value = draft.phone;
    setRegisterStep(root, 1);
    updateOtpState(root);
    updatePasswordState(root);
  }
}

function handleAuthClick(target: HTMLElement, root: HTMLElement) {
  const demoAccountButton = target.closest<HTMLButtonElement>('[data-demo-email]');
  const fillSignupButton = target.closest<HTMLButtonElement>('[data-fill-signup]');
  const passwordToggle = target.closest<HTMLButtonElement>('.password-toggle-new');
  const confirmToggle = target.closest<HTMLButtonElement>('[data-confirm-toggle]');
  const continueToPassword = target.closest<HTMLButtonElement>('.btn-continue-to-password-new');
  const resendLink = target.closest<HTMLButtonElement>('.btn-resend-link-new');
  const openEmail = target.closest<HTMLButtonElement>('.btn-open-email-new');

  if (demoAccountButton) {
    const form = demoAccountButton.closest('.procurex-react-page')?.querySelector<HTMLFormElement>('[data-action="sign-in"]');
    const emailInput = form?.querySelector<HTMLInputElement>('input[name="email"]');
    const passwordInput = form?.querySelector<HTMLInputElement>('input[name="password"]');
    if (emailInput) emailInput.value = demoAccountButton.dataset.demoEmail || '';
    if (passwordInput) passwordInput.value = demoAccountButton.dataset.demoPassword || '';
    return true;
  }

  if (fillSignupButton) {
    const form = root.querySelector<HTMLFormElement>('[data-action="register-step1"]');
    const emailInput = form?.querySelector<HTMLInputElement>('input[name="email"]');
    const phoneInput = form?.querySelector<HTMLInputElement>('input[name="phone"]');
    if (emailInput) emailInput.value = '';
    if (phoneInput) phoneInput.value = '';
    return true;
  }

  if (passwordToggle) {
    togglePasswordVisibility(passwordToggle);
    return true;
  }

  if (confirmToggle) {
    toggleConfirmControl(confirmToggle, root);
    return true;
  }

  if (continueToPassword) {
    setRegisterStep(root, 4);
    return true;
  }

  if (resendLink) {
    notifyStaticPage('Activation link resent', 'Activation link resent in this frontend demo.', 'Check your email, then continue to password setup.', 'success');
    return true;
  }

  if (openEmail) {
    notifyStaticPage('Open email app', 'Open your email app, then continue to password setup in this frontend demo.', 'The next registration step needs the activation message.', 'info');
    return true;
  }

  return false;
}

function handleAuthInput(target: HTMLElement, root: HTMLElement) {
  const otpInput = target.closest<HTMLInputElement>('.otp-input-new');
  const passwordField = target.closest<HTMLInputElement>('.password-input-new, .confirm-password-new');

  if (otpInput) {
    otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 1);
    if (otpInput.value) {
      const otpInputs = Array.from(root.querySelectorAll<HTMLInputElement>('.otp-input-new'));
      otpInputs[otpInputs.indexOf(otpInput) + 1]?.focus();
    }
    updateOtpState(root);
    return true;
  }

  if (passwordField) {
    updatePasswordState(root);
    return true;
  }

  return false;
}

function handleRegisterSubmit(form: HTMLFormElement, root: HTMLElement) {
  const action = form.getAttribute('data-action');

  if (action === 'register-step1') {
    const formData = new FormData(form);
    const draft = {
      email: String(formData.get('email') || '').trim(),
      phone: String(formData.get('phone') || '').trim()
    };

    if (!draft.email || !draft.phone) {
      setAuthFormStatus(form, 'Enter an email address and mobile number.');
      return true;
    }

    safeWriteJson(authStorageKeys.registrationDraft, draft);
    setRegisterStep(root, 2);
    return true;
  }

  if (action === 'register-step2') {
    const code = Array.from(root.querySelectorAll<HTMLInputElement>('.otp-input-new'))
      .map((input) => input.value)
      .join('');

    if (code.length !== 6) {
      setAuthFormStatus(form, 'Enter the 6-digit verification code.');
      return true;
    }

    setRegisterStep(root, 3);
    return true;
  }

  if (action === 'register-step4') {
    const draft = safeReadJson<RegistrationDraft | null>(authStorageKeys.registrationDraft, null);
    const formData = new FormData(form);
    const password = String(formData.get('password') || '');
    const confirmPassword = String(formData.get('confirmPassword') || '');
    const termsAccepted = Boolean(formData.get('termsAccepted'));
    const checks = getPasswordChecks(password);

    if (!draft?.email || !draft.phone) {
      setAuthFormStatus(form, 'Start with account info before creating a password.');
      setRegisterStep(root, 1);
      return true;
    }

    if (!Object.values(checks).every(Boolean)) {
      setAuthFormStatus(form, 'Password must satisfy all requirements.');
      return true;
    }

    if (password !== confirmPassword) {
      setAuthFormStatus(form, 'Passwords must match.');
      return true;
    }

    if (!termsAccepted) {
      setAuthFormStatus(form, 'Confirm agreement before creating the account.');
      return true;
    }

    saveRegisteredAccount({
      ...draft,
      password,
      displayName: draft.email.split('@')[0].replace(/[.-]/g, ' '),
      createdAt: new Date().toISOString()
    });
    setRegisterStep(root, 5);
    return true;
  }

  return false;
}

export function ProcurexStaticPage({ pageKey, html, onInitialize }: ProcurexStaticPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [languageMount, setLanguageMount] = useState<HTMLElement | null>(null);
  const [accountMenuMount, setAccountMenuMount] = useState<HTMLElement | null>(null);
  const [staticTranslationVersion, setStaticTranslationVersion] = useState(0);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const { i18n } = useTranslation();
  const renderLanguage =
    i18n.language === 'sw' || i18nInstance.language === 'sw' || i18nInstance.resolvedLanguage === 'sw' ? 'sw' : 'en';
  const staticTranslationLanguage = renderLanguage === 'sw' && !hasProcurexStaticNamespace('sw') ? 'en' : renderLanguage;
  const baseStaticHtml = useMemo(() => createStaticHtmlWithLanguageMount(html), [html]);
  const staticHtml = useMemo(() => {
    const routeStaticHtml =
      pageKey === 'marketplace'
        ? createMarketplaceRouteHtml(baseStaticHtml, location.pathname, location.search)
        : baseStaticHtml;
    return createTranslatedStaticHtml(routeStaticHtml, staticTranslationLanguage);
  }, [baseStaticHtml, location.pathname, location.search, pageKey, staticTranslationLanguage, staticTranslationVersion]);
  const staticPageInstanceKey =
    pageKey === 'bid-evaluation'
      ? `${pageKey}:${location.key}`
      : pageKey === 'marketplace'
        ? `${pageKey}:${location.pathname}:${location.search}`
        : pageKey;

  useLayoutEffect(() => {
    document.body.dataset.page = pageKey;
    document.body.dataset.procurexReactPage = 'true';
    const root = rootRef.current;
    if (root) {
      root.dataset.procurexRoutePath = location.pathname;
      root.dataset.procurexRouteSearch = location.search;
      if (pageKey === 'bid-evaluation') clearEvaluationEntrySelection();
      initializeStaticPage(root, i18n.language, pageKey, location.search);
      personalizeStaticChrome(root, user);
      syncMarketplaceRouteTab(root);
      initializeAuthPage(root, pageKey);
      setLanguageMount(prepareLanguageSwitcherMount(root));
      setAccountMenuMount(prepareStaticAccountMenuMount(root));
      if (pageKey === 'bid-evaluation') scrollPageToTop();
    }

    return () => {
      delete document.body.dataset.procurexReactPage;
      setAccountMenuMount(null);
    };
  }, [pageKey, staticHtml, i18n.language, location.key, location.pathname, location.search, user]);

  useEffect(() => {
    if (renderLanguage !== 'sw' || hasProcurexStaticNamespace('sw')) return;

    let isMounted = true;
    void ensureProcurexStaticNamespace('sw').then(() => {
      if (isMounted) setStaticTranslationVersion((version) => version + 1);
    });

    return () => {
      isMounted = false;
    };
  }, [renderLanguage]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !languageMount) return;

    initializeStaticPage(root, i18n.language, pageKey, location.search);
    personalizeStaticChrome(root, user);
    setAccountMenuMount(prepareStaticAccountMenuMount(root));
    initializeAuthPage(root, pageKey);
    if (pageKey === 'bid-evaluation') scrollPageToTop();
  }, [pageKey, staticHtml, i18n.language, location.key, location.search, languageMount, user]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || !onInitialize) return;
    onInitialize(root);
  }, [pageKey, staticHtml, i18n.language, location.key, location.search, languageMount, onInitialize]);

  useEffect(() => {
    if (pageKey !== 'communication-center' || !onInitialize) return;

    const initialize = onInitialize;
    let cancelled = false;
    let attempts = 0;
    let frame = 0;

    function initializeWhenReady() {
      if (cancelled) return;
      const root = rootRef.current;
      if (root?.querySelector('[data-communication-center]')) {
        initialize(root);
        return;
      }
      attempts += 1;
      if (attempts < 10) frame = window.requestAnimationFrame(initializeWhenReady);
    }

    frame = window.requestAnimationFrame(initializeWhenReady);

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [pageKey, staticHtml, location.key, location.search, onInitialize]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const navTarget = target.closest<HTMLElement>('[data-navigate]');
    const evaluationReset = target.closest<HTMLElement>('[data-evaluation-clear-selection]');
    const tab = target.closest<HTMLElement>('.tab[data-tab]');
    const awardingTab = target.closest<HTMLElement>(
      '.awarding-contract-tabs .supplier-detail-tab[data-tab]'
    );
    const supplierTab = target.closest<HTMLElement>('[data-supplier-tab-target]');
    const supplierJump = target.closest<HTMLElement>('[data-supplier-jump-target]');
    const awardResponseJump = target.closest<HTMLElement>('[data-award-response-jump]');
    const awardResponseAction = target.closest<HTMLElement>('[data-award-response-action]');
    const closedContractJump = target.closest<HTMLElement>('[data-closed-contract-jump]');
    const iamTab = target.closest<HTMLElement>('[data-iam-tab]');
    const communicationTab = target.closest<HTMLElement>('[data-communication-tab]');
    const awardingJump = target.closest<HTMLElement>('[data-awarding-tab-jump]');
    const awardWizardControl = target.closest<HTMLElement>(
      '[data-award-step-index], [data-award-prev], [data-award-next]'
    );
    const menuButton = target.closest<HTMLElement>('[data-app-menu-toggle], [data-profile-menu-toggle]');
    const profileLanguage = target.closest<HTMLElement>('[data-profile-language]');
    const planningAnchor = target.closest<HTMLAnchorElement>('.planning-nav-card[href^="#"]');
    const procurementPlanningView = target.closest<HTMLElement>('[data-planning-view]');
    const procurementPlanOpen = target.closest<HTMLElement>('[data-plan-open]');
    const procurementPlanDetails = target.closest<HTMLElement>('[data-plan-details]');
    const procurementPlanClose = target.closest<HTMLElement>('[data-plan-close]');
    const procurementPlanningScroll = target.closest<HTMLElement>('[data-planning-scroll]');
    const procurementPlanningMode = target.closest<HTMLElement>('[data-planning-mode]');
    const procurementPlanningAddRow = target.closest<HTMLElement>('[data-plan-add-row]');
    const procurementPlanningTemplateDownload = target.closest<HTMLElement>('[data-plan-template-download]');
    const procurementPlanningDownload = target.closest<HTMLElement>('[data-plan-download]');
    const procurementPlanningViewFull = target.closest<HTMLElement>('[data-plan-view-full]');
    const procurementPlanningFullClose = target.closest<HTMLElement>('[data-plan-full-close]');
    const procurementPlanningRemoveRow = target.closest<HTMLElement>('[data-plan-remove-row]');
    const procurementPlanningAddColumn = target.closest<HTMLElement>('[data-plan-add-column]');
    const procurementPlanningRemoveColumn = target.closest<HTMLElement>('[data-plan-remove-column]');
    const procurementPlanningColumnLabel = target.closest<HTMLElement>('[data-plan-column-label]');
    const procurementPlanningTender = target.closest<HTMLElement>('[data-plan-tender]');
    const procurementPlanningStatusNavigate = target.closest<HTMLElement>('[data-status-navigate]');
    const createTenderWizardStep = target.closest<HTMLElement>('[data-wizard-step-index], [data-wizard-prev], [data-wizard-next]');
    const marketplaceTab = target.closest<HTMLElement>('[data-marketplace-tab]');
    const marketplaceCategory = target.closest<HTMLElement>('[data-marketplace-category]');
    const marketplaceSave = target.closest<HTMLButtonElement>('[data-marketplace-save]');

    if ((pageKey === 'register' || pageKey === 'sign-in') && rootRef.current && handleAuthClick(target, rootRef.current)) {
      event.preventDefault();
      return;
    }

    if (marketplaceTab) {
      event.preventDefault();
      setMarketplaceTab(marketplaceTab);
      const marketplaceTabRoute = pageToRoute[marketplaceTab.getAttribute('data-marketplace-tab') || 'marketplace'];
      if (marketplaceTabRoute && marketplaceTabRoute !== location.pathname) {
        navigate(marketplaceTabRoute);
      }
      return;
    }

    if (marketplaceCategory && rootRef.current) {
      event.preventDefault();
      const marketplaceRoot = marketplaceCategory.closest<HTMLElement>('[data-marketplace-root]');
      const type = marketplaceRoot?.querySelector<HTMLSelectElement>('[data-marketplace-type]');
      if (marketplaceRoot && type) {
        type.value = marketplaceCategory.getAttribute('data-marketplace-category') || '';
        applyMarketplaceFilters(marketplaceRoot);
      }
      return;
    }

    if (marketplaceSave) {
      event.preventDefault();
      marketplaceSave.textContent = marketplaceSave.textContent === 'Saved' ? 'Save' : 'Saved';
      return;
    }

    if (planningAnchor && rootRef.current && activatePlanningAnchor(rootRef.current, planningAnchor)) {
      event.preventDefault();
      return;
    }

    if (awardWizardControl && handleAwardWizardControl(awardWizardControl)) {
      event.preventDefault();
      return;
    }

    if (procurementPlanOpen && rootRef.current) {
      event.preventDefault();
      openProcurementPlanDrawer(procurementPlanOpen, rootRef.current);
      return;
    }

    if (procurementPlanDetails && rootRef.current) {
      event.preventDefault();
      setProcurementPlanningDetailFromButton(procurementPlanDetails, rootRef.current);
      setProcurementPlanningRoute(rootRef.current, 'detail');
      navigate(`/tender-planning?view=detail&plan=${encodeURIComponent(procurementPlanDetails.getAttribute('data-plan-details') || '')}`);
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
      if (procurementPlanningMode.getAttribute('data-planning-mode') === 'create') {
        navigate('/tender-planning?view=create');
      }
      return;
    }

    if (procurementPlanningAddRow && rootRef.current) {
      event.preventDefault();
      addProcurementPlanningRow(rootRef.current);
      return;
    }

    if (procurementPlanningTemplateDownload) {
      event.preventDefault();
      downloadProcurementPlanningText(
        'procurex-plan-template.csv',
        'Tender Title,Category,Procurement Method,Opening Date,Closing Date,Source of Funds,Budget,Expected Completion Date,Notes\nConstruction of community water wells,Works,Open Tender,2026-08-01,2026-08-30,Development budget,480000000,2026-12-15,'
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
      setProcurementPlanningRoute(rootRef.current, 'full');
      navigate('/tender-planning?view=full');
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
      const id = `custom-${Date.now()}`;
      const label = 'New Column';
      const head = rootRef.current.querySelector<HTMLElement>('[data-plan-create-head]');
      head?.querySelector('th:last-child')?.insertAdjacentHTML(
        'beforebegin',
        `<th data-column-id="${id}" data-custom-column="true"><span data-plan-column-label>${label}</span><button class="planning-column-remove" type="button" data-plan-remove-column="${id}" aria-label="Remove ${label} column">Remove Column</button></th>`
      );
      rootRef.current.querySelectorAll<HTMLElement>('[data-plan-create-row]').forEach((row) => {
        row.querySelector('td:last-child')?.insertAdjacentHTML(
          'beforebegin',
          `<td data-column-id="${id}" data-custom-column="true"><input class="form-input" type="text" name="${id}"></td>`
        );
      });
      head?.querySelector<HTMLElement>(`[data-column-id="${cssEscape(id)}"] [data-plan-column-label]`)?.scrollIntoView({
        block: 'nearest',
        inline: 'center'
      });
      rootRef.current.dataset.planningDirty = 'true';
      return;
    }

    if (procurementPlanningRemoveColumn && rootRef.current) {
      event.preventDefault();
      const id = procurementPlanningRemoveColumn.getAttribute('data-plan-remove-column') || '';
      rootRef.current.querySelectorAll<HTMLElement>('[data-column-id]').forEach((cell) => {
        if (cell.getAttribute('data-column-id') === id) cell.remove();
      });
      rootRef.current.dataset.planningDirty = 'true';
      return;
    }

    if (procurementPlanningColumnLabel && rootRef.current) {
      if (procurementPlanningColumnLabel.matches('input, textarea')) {
        rootRef.current.dataset.planningDirty = 'true';
        return;
      }
      event.preventDefault();
      const label = window.prompt('Column name', procurementPlanningColumnLabel.textContent?.trim() || '');
      if (!label) return;
      procurementPlanningColumnLabel.textContent = label;
      rootRef.current.dataset.planningDirty = 'true';
      return;
    }

    if (procurementPlanningTender) {
      event.preventDefault();
      const plan = readProcurementPlanningRow(procurementPlanningTender);
      window.localStorage.setItem('procurex.planning.selectedTenderPlan', JSON.stringify({
        title: plan.title,
        openingDate: plan.openingDate,
        closingDate: plan.closingDate,
        category: plan.category,
        procurementMethod: plan.procurementMethod,
        fundingSource: plan.sourceOfFunds,
        budget: plan.budget,
        status: plan.status,
        startStep: 2
      }));
      navigate(pageToRoute['create-tender']);
      return;
    }

    if (createTenderWizardStep) {
      const wizard = createTenderWizardStep.closest<HTMLElement>('[data-create-tender-wizard]');
      if (wizard) {
        event.preventDefault();
        const panels = Array.from(wizard.querySelectorAll<HTMLElement>('.wizard-workspace > .journey-panel'));
        const activeIndex = panels.findIndex((panel) => panel.classList.contains('active'));
        const requested = createTenderWizardStep.hasAttribute('data-wizard-prev')
          ? activeIndex - 1
          : createTenderWizardStep.hasAttribute('data-wizard-next')
            ? activeIndex + 1
            : Number(createTenderWizardStep.dataset.wizardStepIndex);
        setCreateTenderWizardStep(wizard, requested);
        return;
      }
    }

    if (procurementPlanningStatusNavigate) {
      event.preventDefault();
      const page = procurementPlanningStatusNavigate.getAttribute('data-status-navigate') || 'workspace-dashboard';
      navigate(pageToRoute[page] || '/dashboard');
      return;
    }

    if (profileLanguage && rootRef.current) {
      event.preventDefault();
      rootRef.current.querySelector<HTMLElement>('[data-profile-menu]')?.classList.remove('open');
      rootRef.current.querySelector<HTMLElement>('[data-profile-menu-toggle]')?.setAttribute('aria-expanded', 'false');
      rootRef.current.querySelector<HTMLElement>('[aria-label="Language"], [aria-label="Lugha"]')?.focus();
      return;
    }

    if (navTarget) {
      event.preventDefault();
      const page = navTarget.getAttribute('data-navigate') || 'welcome';
      const routeSearch = navTarget.getAttribute('data-route-search') || '';
      const route = routeWithSearch(pageToRoute[page] || '/', routeSearch);

      if (shouldNavigateBack(navTarget, pageKey)) {
        if (hasBrowserHistoryEntry()) {
          navigate(-1);
        } else {
          navigate(route);
        }
        return;
      }

      captureAwardContractSelection(navTarget);
      const accountEvent = accountActivityForPage(page);
      if (accountEvent) void accountApi.recordActivity(accountEvent).catch(() => undefined);
      if (page === 'bid-evaluation') clearEvaluationEntrySelection();
      if (page === 'sign-in') {
        dispatch(signOutSession())
          .unwrap()
          .catch(() => dispatch(signOut()));
      }
      if (pageKey === 'bid-evaluation' && page === 'bid-evaluation' && rootRef.current) {
        resetStaticPage(rootRef.current, staticHtml, i18n.language, pageKey, location.search);
        setLanguageMount(prepareLanguageSwitcherMount(rootRef.current));
      }
      navigate(route);
      return;
    }

    if (evaluationReset && rootRef.current) {
      event.preventDefault();
      clearEvaluationEntrySelection();
      resetStaticPage(rootRef.current, staticHtml, i18n.language, pageKey, location.search);
      setLanguageMount(prepareLanguageSwitcherMount(rootRef.current));
      return;
    }

    if (tab) {
      event.preventDefault();
      setActiveTab(tab);
      return;
    }

    if (awardingTab) {
      event.preventDefault();
      setAwardingQueueTab(awardingTab);
      const queue = awardingTab.getAttribute('data-tab');
      if (queue) navigate(`/awards-contracts?queue=${encodeURIComponent(queue)}`);
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
        `[data-supplier-document-section="${cssEscape(supplierJump.getAttribute('data-supplier-jump-target') ?? '')}"]`
      );
      section?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    if (awardResponseJump && rootRef.current) {
      event.preventDefault();
      const awardId = awardResponseJump.getAttribute('data-award-response-jump') || '';
      activateAwardResponsePanel(rootRef.current, awardId);
      if (awardId) navigate(`/awards-contracts/award-response?award=${encodeURIComponent(awardId)}`);
      return;
    }

    if (awardResponseAction) {
      event.preventDefault();
      const panel = awardResponseAction.closest<HTMLElement>('[data-award-response-panel]');
      const action = awardResponseAction.getAttribute('data-award-response-action') || '';
      const statusLabels: Record<string, string> = {
        accept: 'Award Accepted',
        clarify: 'Clarification Requested',
        decline: 'Award Declined'
      };
      const statusOutput = panel?.querySelector<HTMLElement>('[data-award-response-status]');
      if (statusOutput) statusOutput.textContent = `Current supplier response: ${statusLabels[action] || 'Response Recorded'}`;
      return;
    }

    if (closedContractJump && rootRef.current) {
      event.preventDefault();
      const contract = closedContractJump.getAttribute('data-closed-contract-jump') || 'closed-contract-1';
      activateClosedContractPanel(rootRef.current, contract);
      navigate(`/awards-contracts/post-award?mode=closed&contract=${encodeURIComponent(contract)}&tab=closure`);
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
      const queue = awardingJump.getAttribute('data-awarding-tab-jump') ?? '';
      activateAwardingQueueTabByName(rootRef.current, queue);
      if (queue) navigate(`/awards-contracts?queue=${encodeURIComponent(queue)}`);
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

    if (action === 'sign-in') {
      const formData = new FormData(form);
      const email = String(formData.get('email') || '').trim();
      const password = String(formData.get('password') || '');
      const account = findAuthAccount(email, password);

      if (!account) {
        setAuthFormStatus(form, 'Use a mock account or a frontend account you created.');
        return;
      }

      const sessionUser = accountToSessionUser(account);
      dispatch(assumeUser(sessionUser));

      if (account.accountType === 'ADMIN') {
        navigate('/admin');
      } else if (account.isNewUser) {
        navigate('/identity/verification');
      } else {
        navigate('/dashboard');
      }
      return;
    }

    if (action?.startsWith('register-step') && rootRef.current && handleRegisterSubmit(form, rootRef.current)) {
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
    const marketplaceFilter = target.closest<HTMLElement>(
      '[data-marketplace-search], [data-marketplace-type], [data-marketplace-budget], [data-marketplace-status], [data-marketplace-sort]'
    );

    if ((pageKey === 'register' || pageKey === 'sign-in') && rootRef.current && handleAuthInput(target, rootRef.current)) {
      return;
    }

    if (marketplaceFilter) {
      const marketplaceRoot = marketplaceFilter.closest<HTMLElement>('[data-marketplace-root]');
      if (marketplaceRoot) applyMarketplaceFilters(marketplaceRoot);
      return;
    }

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

  function handleInput(event: FormEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;

    if ((pageKey === 'register' || pageKey === 'sign-in') && rootRef.current && handleAuthInput(target, rootRef.current)) {
      return;
    }

    const marketplaceSearch = target.closest<HTMLElement>('[data-marketplace-search]');
    const marketplaceRoot = marketplaceSearch?.closest<HTMLElement>('[data-marketplace-root]');
    if (marketplaceRoot) {
      applyMarketplaceFilters(marketplaceRoot);
      return;
    }

    const wizard = target.closest<HTMLElement>('[data-create-tender-wizard]');
    if (!wizard || wizard.dataset.planningAmendmentWarningShown === 'true') return;
    const panel = target.closest<HTMLElement>('.journey-panel');
    if (!panel || !['wizard-step-1', 'wizard-step-2'].includes(panel.id)) return;
    if (!window.localStorage.getItem('procurex.planning.selectedTenderPlan')) return;
    wizard.dataset.planningAmendmentWarningShown = 'true';
    notifyStaticPage('Planning handoff changed', 'These details came from the approved procurement plan.', 'If you amend them here, make sure the difference is approved or update the plan too.', 'warning');
  }

  return (
    <>
      {languageMount ? createPortal(<LanguageSwitcher />, languageMount) : null}
      {accountMenuMount ? createPortal(<AccountMenu buttonClassName="profile-button" />, accountMenuMount) : null}
      <div
        key={staticPageInstanceKey}
        ref={rootRef}
        id="page-content"
        role="main"
        tabIndex={-1}
        className="procurex-react-page"
        onClick={handleClick}
        onChange={handleChange}
        onInput={handleInput}
        onSubmit={handleSubmit}
        dangerouslySetInnerHTML={{ __html: staticHtml }}
      />
    </>
  );
}
