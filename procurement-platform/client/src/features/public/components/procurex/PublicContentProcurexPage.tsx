/* Renders the public Public Content ProcureX page UI while keeping page-specific presentation near its workflow data. */
import { ProcurexStaticPage } from '@/shared/components/procurex/ProcurexStaticPage';
import { usePublicPageContent } from '../../hooks';
import type { PublicContentPageKey, PublicPageVersion } from '../../types';

type PublicContentProcurexPageProps = {
  pageKey: PublicContentPageKey;
  fallbackHtml: string;
};

const containerClass: Record<PublicContentPageKey, string> = {
  'about-procurex': 'about-container',
  'privacy-policy': 'privacy-container',
  'terms-and-conditions': 'terms-container'
};

const bandClass: Record<PublicContentPageKey, string> = {
  'about-procurex': 'about-version-band',
  'privacy-policy': 'privacy-version-band',
  'terms-and-conditions': 'terms-version-band'
};

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value: string | null) {
  if (!value) return 'Not published';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function createVersionBand(page: PublicPageVersion) {
  if (page.pageKey === 'about-procurex') return '';

  return `
    <section class="public-version-band ${bandClass[page.pageKey]}" aria-label="${escapeHtml(page.title)} version information">
      <div class="${containerClass[page.pageKey]} public-version-row">
        <span><strong>Version</strong> ${escapeHtml(page.version)}</span>
        <span><strong>Effective</strong> ${escapeHtml(formatDate(page.effectiveAt))}</span>
        <span><strong>Last updated</strong> ${escapeHtml(formatDate(page.lastUpdated))}</span>
      </div>
    </section>
  `;
}

function insertVersionBand(html: string, page: PublicPageVersion) {
  const versionBand = createVersionBand(page);
  if (!versionBand) return html;
  return html.replace(/(<main>)/, `${versionBand}$1`);
}

export function PublicContentProcurexPage({ pageKey, fallbackHtml }: PublicContentProcurexPageProps) {
  const { data } = usePublicPageContent(pageKey, fallbackHtml);
  const html = insertVersionBand(data.content.html || fallbackHtml, data);

  return <ProcurexStaticPage pageKey={pageKey} html={html} />;
}
