// React + Google Translate compatibility guard
// When Google Translate wraps text nodes in <font> tags, React's DOM reconciler
// throws NotFoundError on removeChild or insertBefore. This standard guard catches and prevents that.
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      if (console && console.warn) {
        console.warn('[WardDesk] Safe removeChild handled node detached by Google Translate');
      }
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      if (console && console.warn) {
        console.warn('[WardDesk] Safe insertBefore handled node detached by Google Translate');
      }
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

let currentLanguage = 'en';

export function getLanguage() {
  try {
    return localStorage.getItem('ward_language') || 'en';
  } catch (e) {
    return 'en';
  }
}

/**
 * Robustly set or clear googtrans cookie across all relevant paths and hostnames/domains
 */
export function setGoogleTransCookie(targetLang) {
  const isMr = targetLang === 'mr';
  const val = isMr ? '/en/mr' : '/en/en';
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toUTCString();
  const past = 'Thu, 01 Jan 1970 00:00:00 GMT';

  const host = window.location.hostname;
  const domains = ['', host];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    domains.push(`.${host}`);
    const parts = host.split('.');
    if (parts.length > 2) {
      domains.push(`.${parts.slice(-2).join('.')}`);
    }
  }

  domains.forEach(d => {
    const domainPart = d ? `;domain=${d}` : '';
    if (isMr) {
      document.cookie = `googtrans=${val};path=/;expires=${expires}${domainPart}`;
    } else {
      document.cookie = `googtrans=;path=/;expires=${past}${domainPart}`;
      document.cookie = `googtrans=/en/en;path=/;expires=${expires}${domainPart}`;
    }
  });
}

/**
 * Triggers the Google Translate select dropdown (.goog-te-combo) if present in DOM
 */
export function triggerGoogleCombo(lang) {
  const select = document.querySelector('.goog-te-combo');
  if (select) {
    const target = lang === 'mr' ? 'mr' : 'en';
    if (select.value !== target) {
      select.value = target;
      select.dispatchEvent(new Event('change'));
    }
    return true;
  }
  return false;
}

/**
 * Ensures Google Translate container and script exist in the page
 */
export function ensureGoogleWidget() {
  if (typeof document === 'undefined') return;

  if (!document.getElementById('google_translate_element')) {
    const host = document.createElement('div');
    host.id = 'google_translate_element';
    host.className = 'notranslate';
    host.setAttribute('translate', 'no');
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
  }

  if (!window.googleTranslateElementInit) {
    window.googleTranslateElementInit = function () {
      if (window.google && window.google.translate) {
        new window.google.translate.TranslateElement(
          {
            pageLanguage: 'en',
            includedLanguages: 'en,mr',
            autoDisplay: false
          },
          'google_translate_element'
        );
        const lang = getLanguage();
        if (lang === 'mr') {
          triggerGoogleCombo('mr');
        }
      }
    };
  }

  if (!document.getElementById('google-translate-script')) {
    const s = document.createElement('script');
    s.id = 'google-translate-script';
    s.async = true;
    s.src = 'https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
    document.head.appendChild(s);
  }
}

export function installTranslateCleaner() {
  if (typeof document === 'undefined') return;

  const clean = () => {
    // 1. Remove all banner frames and skiptranslate banner containers
    const frames = document.querySelectorAll(
      '.goog-te-banner-frame, iframe.goog-te-banner-frame, .goog-te-balloon-frame, #goog-gt-tt'
    );
    frames.forEach(el => {
      try {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.remove();
      } catch (e) {}
    });

    // 2. Clear any top offset Google Translate injects into body
    if (document.body) {
      if (document.body.style.top && document.body.style.top !== '0px') {
        document.body.style.top = '0px';
      }
      if (document.body.style.position === 'relative') {
        document.body.style.position = 'static';
      }
    }
    if (document.documentElement) {
      if (document.documentElement.style.top && document.documentElement.style.top !== '0px') {
        document.documentElement.style.top = '0px';
      }
    }
  };

  clean();
  if (typeof window !== 'undefined' && !window.__ward_translate_cleaner_installed) {
    window.__ward_translate_cleaner_installed = true;
    setInterval(clean, 300);

    if (typeof MutationObserver !== 'undefined') {
      const observer = new MutationObserver(() => {
        clean();
      });
      if (document.body) {
        observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ['style', 'class'] });
      } else {
        document.addEventListener('DOMContentLoaded', () => {
          if (document.body) {
            observer.observe(document.body, { childList: true, attributes: true, attributeFilter: ['style', 'class'] });
          }
        });
      }
    }
  }
}

/**
 * Called on page initialization
 */
export function initLanguage() {
  installTranslateCleaner();
  const lang = getLanguage();
  currentLanguage = lang;
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    setGoogleTransCookie(lang);
    ensureGoogleWidget();

    if (lang === 'mr') {
      let count = 0;
      const interval = setInterval(() => {
        count++;
        if (triggerGoogleCombo('mr') || count > 30) {
          clearInterval(interval);
        }
      }, 200);
    }
  }

  return lang;
}

/**
 * Called when language is programmatically set or updated in state
 */
export function setLanguage(lang) {
  const target = lang === 'mr' ? 'mr' : 'en';
  currentLanguage = target;
  try {
    localStorage.setItem('ward_language', target);
  } catch (e) {}
  if (typeof document !== 'undefined') {
    document.documentElement.lang = target;
    document.documentElement.dataset.lang = target;
    setGoogleTransCookie(target);
    triggerGoogleCombo(target);
  }
}

/**
 * Unified language switch called by all language toggle buttons
 */
export function switchLanguage(next) {
  const target = next === 'mr' ? 'mr' : 'en';
  try {
    localStorage.setItem('ward_language', target);
  } catch (e) {}
  setGoogleTransCookie(target);
  triggerGoogleCombo(target);
  if (typeof window !== 'undefined') {
    window.location.reload();
  }
}

/**
 * Helper to ensure translation is active after SPA page transitions
 */
export function ensureCurrentLanguage() {
  const lang = getLanguage();
  if (lang === 'mr') {
    setGoogleTransCookie('mr');
    triggerGoogleCombo('mr');
  }
}

if (typeof window !== 'undefined') {
  installTranslateCleaner();
}

