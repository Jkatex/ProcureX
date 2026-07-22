/* Supports the i18n client workflow with reusable logic kept close to the screens that consume it. */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureProcurexStaticNamespace } from './index';

const originalTextNodes = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<Element, Record<string, string>>();
const translatableAttributes = ['aria-label', 'title', 'placeholder', 'alt'];

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function preserveWhitespace(original: string, translated: string) {
  const leading = original.match(/^\s*/)?.[0] ?? '';
  const trailing = original.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
}

function shouldSkipElement(element: Element | null) {
  return Boolean(
    element?.closest(
      [
        'script',
        'style',
        'svg',
        'path',
        'code',
        'pre',
        'textarea',
        'input',
        '[contenteditable="true"]',
        '[data-no-localize]',
        '[data-localization-ignore]',
        '.MuiAvatar-root',
        '.recharts-wrapper',
        'tbody td'
      ].join(',')
    )
  );
}

function shouldTranslateValue(value: string) {
  const trimmed = normalizeText(value);
  if (trimmed.length < 2) return false;
  if (/^[\d\s.,:%/+()-]+$/.test(trimmed)) return false;
  if (/^[A-Z0-9_-]{16,}$/.test(trimmed)) return false;
  if (trimmed.includes('@')) return false;
  return true;
}

export function DomLocalization() {
  const { i18n } = useTranslation();
  const language = i18n.language === 'sw' ? 'sw' : 'en';

  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let timeout: number | undefined;

    function translateValue(value: string) {
      if (language !== 'sw') return value;
      const translated = i18n.getResource(language, 'procurexStatic', normalizeText(value));
      return typeof translated === 'string' && translated.trim() ? translated : value;
    }

    function apply(root: ParentNode = document) {
      const showText = document.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
      const walker = document.createTreeWalker(root, showText);
      const textNodes: Text[] = [];

      while (walker.nextNode()) {
        const node = walker.currentNode as Text;
        if (!node.nodeValue || shouldSkipElement(node.parentElement) || !shouldTranslateValue(node.nodeValue)) continue;
        textNodes.push(node);
      }

      textNodes.forEach((node) => {
        const original = originalTextNodes.get(node) ?? node.nodeValue ?? '';
        originalTextNodes.set(node, original);
        node.nodeValue = language === 'sw' ? preserveWhitespace(original, translateValue(original)) : original;
      });

      const elementRoot = root instanceof Element ? root : document.documentElement;
      elementRoot.querySelectorAll('*').forEach((element) => {
        if (shouldSkipElement(element)) return;
        let originals = originalAttributes.get(element);
        if (!originals) {
          originals = {};
          originalAttributes.set(element, originals);
        }

        translatableAttributes.forEach((attribute) => {
          const current = element.getAttribute(attribute);
          if (!current || !shouldTranslateValue(current)) return;
          const original = originals[attribute] ?? current;
          originals[attribute] = original;
          element.setAttribute(attribute, language === 'sw' ? translateValue(original) : original);
        });
      });
    }

    function schedule(root?: ParentNode) {
      window.clearTimeout(timeout);
      timeout = window.setTimeout(() => apply(root), 25);
    }

    ensureProcurexStaticNamespace(language).then(() => {
      if (cancelled) return;
      apply();
      observer = new MutationObserver((mutations) => {
        const target = mutations.find((mutation) => mutation.type === 'childList' && mutation.addedNodes.length > 0)?.target;
        schedule(target instanceof Element ? target : undefined);
      });
      observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      window.clearTimeout(timeout);
    };
  }, [i18n, language]);

  return null;
}
