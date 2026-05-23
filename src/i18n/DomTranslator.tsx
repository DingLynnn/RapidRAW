import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useSettingsStore } from '../store/useSettingsStore';
import { DEFAULT_LANGUAGE, translateText } from './translations';
import type { Language } from './translations';

const textOriginals = new WeakMap<Text, string>();
const translatedAttributes = ['placeholder', 'title', 'aria-label', 'data-tooltip', 'alt'];

const shouldSkipElement = (element: Element | null) => {
  if (!element) return false;
  return Boolean(element.closest('script, style, textarea, [data-i18n-skip="true"]'));
};

const preserveOuterWhitespace = (source: string, translated: string) => {
  const leading = source.match(/^\s*/)?.[0] ?? '';
  const trailing = source.match(/\s*$/)?.[0] ?? '';
  return `${leading}${translated}${trailing}`;
};

const renderTranslation = (source: string, language: Language) => {
  const translated = translateText(source, language);
  return translated === source ? source : preserveOuterWhitespace(source, translated);
};

const translateTextNode = (node: Text, language: Language, restoreEnglish = false) => {
  if (shouldSkipElement(node.parentElement)) return;

  const current = node.nodeValue ?? '';
  const storedOriginal = textOriginals.get(node);
  let original = storedOriginal ?? current;

  if (!textOriginals.has(node)) {
    textOriginals.set(node, original);
  } else if (
    !restoreEnglish &&
    storedOriginal &&
    current !== storedOriginal &&
    current !== renderTranslation(storedOriginal, language)
  ) {
    original = current;
    textOriginals.set(node, original);
  }

  if (language === 'en') {
    if (restoreEnglish && node.nodeValue !== original) node.nodeValue = original;
    return;
  }

  const nextValue = renderTranslation(original, language);
  if (node.nodeValue !== nextValue) node.nodeValue = nextValue;
};

const originalAttributeName = (attribute: string) => `data-i18n-original-${attribute}`;

const translateElementAttributes = (element: Element, language: Language, restoreEnglish = false) => {
  if (shouldSkipElement(element)) return;

  for (const attribute of translatedAttributes) {
    const currentValue = element.getAttribute(attribute);
    if (!currentValue) continue;

    const originalName = originalAttributeName(attribute);
    const storedOriginal = element.getAttribute(originalName);
    let original = storedOriginal ?? currentValue;

    if (!storedOriginal) {
      element.setAttribute(originalName, original);
    } else if (
      !restoreEnglish &&
      currentValue !== storedOriginal &&
      currentValue !== translateText(storedOriginal, language)
    ) {
      original = currentValue;
      element.setAttribute(originalName, original);
    }

    if (language === 'en') {
      if (restoreEnglish && currentValue !== original) element.setAttribute(attribute, original);
      continue;
    }

    const translated = translateText(original, language);
    if (currentValue !== translated) element.setAttribute(attribute, translated);
  }
};

const translateTree = (root: ParentNode, language: Language, restoreEnglish = false) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);

  let node = walker.currentNode;
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) {
      translateTextNode(node as Text, language, restoreEnglish);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      translateElementAttributes(node as Element, language, restoreEnglish);
    }
    node = walker.nextNode();
  }
};

export default function DomTranslator() {
  const language = useSettingsStore(
    useShallow((state) => (state.appSettings?.language as Language | undefined) ?? DEFAULT_LANGUAGE),
  );

  useEffect(() => {
    const translateDocument = () => translateTree(document.body, language, language === 'en');
    translateDocument();

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') {
          translateTextNode(mutation.target as Text, language);
          continue;
        }

        if (mutation.type === 'attributes') {
          translateElementAttributes(mutation.target as Element, language);
          continue;
        }

        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            translateTextNode(node as Text, language);
          } else if (node.nodeType === Node.ELEMENT_NODE) {
            translateTree(node as Element, language);
          }
        });
      }
    });

    observer.observe(document.body, {
      attributes: true,
      attributeFilter: translatedAttributes,
      characterData: true,
      childList: true,
      subtree: true,
    });

    return () => observer.disconnect();
  }, [language]);

  return null;
}
