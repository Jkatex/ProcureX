import { FormEvent, MouseEvent, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
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
    <span><strong>Tender Planning</strong><em>APP, SPP, budgets, approvals</em></span>
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

export function ProcurexStaticPage({ pageKey, html }: ProcurexStaticPageProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { i18n } = useTranslation();

  useEffect(() => {
    document.body.dataset.page = pageKey;
    document.body.dataset.procurexReactPage = 'true';
    const root = rootRef.current;
    if (root) {
      normalizeAppDrawer(root);
      syncInitialTabs(root);
      applyStaticTranslations(root, i18n.language);
    }

    return () => {
      delete document.body.dataset.procurexReactPage;
    };
  }, [pageKey, html, i18n.language]);

  function handleClick(event: MouseEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement;
    const navTarget = target.closest<HTMLElement>('[data-navigate]');
    const tab = target.closest<HTMLElement>('.tab[data-tab]');
    const supplierTab = target.closest<HTMLElement>('[data-supplier-tab-target]');
    const supplierJump = target.closest<HTMLElement>('[data-supplier-jump-target]');
    const iamTab = target.closest<HTMLElement>('[data-iam-tab]');
    const communicationTab = target.closest<HTMLElement>('[data-communication-tab]');
    const awardingJump = target.closest<HTMLElement>('[data-awarding-tab-jump]');
    const menuButton = target.closest<HTMLElement>('[data-app-menu-toggle], [data-profile-menu-toggle]');

    if (navTarget) {
      event.preventDefault();
      const page = navTarget.getAttribute('data-navigate') || 'welcome';
      navigate(pageToRoute[page] || '/');
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

  return (
    <>
      <div className="procurex-floating-language">
        <LanguageSwitcher />
      </div>
      <div
        ref={rootRef}
        id="page-content"
        role="main"
        tabIndex={-1}
        className="procurex-react-page"
        onClick={handleClick}
        onSubmit={handleSubmit}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </>
  );
}
