// Texts of the static markup in index.html. The HTML carries English, seen
// before the script runs; here they are rewritten into the current language
// by attribute: `data-i18n` — text, `data-i18n-title` — tooltip,
// `data-i18n-aria` — aria-label. An unknown key leaves the text as is.

import { hasKey, lang, t } from '../i18n';

const ATTRIBUTES: readonly [string, (node: HTMLElement, text: string) => void][] = [
  ['data-i18n', (node, text) => {
    node.textContent = text;
  }],
  ['data-i18n-title', (node, text) => {
    node.title = text;
  }],
  ['data-i18n-aria', (node, text) => node.setAttribute('aria-label', text)],
];

export function applyStaticText(root: Document): void {
  // Text-only RTL: `lang` follows the language, `dir` of the page stays ltr;
  // the stylesheet lets every text pick its own direction (style.css).
  root.documentElement.lang = lang();
  root.title = t('app.title');
  for (const [attribute, apply] of ATTRIBUTES) {
    for (const node of root.querySelectorAll(`[${attribute}]`)) {
      const key = node.getAttribute(attribute) ?? '';
      if (node instanceof HTMLElement && hasKey(key)) apply(node, t(key));
    }
  }
}
