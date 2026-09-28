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

  const host = typeof window !== 'undefined' ? window.location.hostname : '';
  const domains = [''];
  if (host && host !== 'localhost' && host !== '127.0.0.1') {
    domains.push(host);
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
      document.cookie = `googtrans=/auto/mr;path=/;expires=${expires}${domainPart}`;
    } else {
      document.cookie = `googtrans=;path=/;expires=${past}${domainPart}`;
      document.cookie = `googtrans=/en/en;path=/;expires=${past}${domainPart}`;
      document.cookie = `googtrans=/auto/en;path=/;expires=${past}${domainPart}`;
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
    }
    select.dispatchEvent(new Event('change', { bubbles: true }));
    if (typeof select.onchange === 'function') {
      try { select.onchange(); } catch (e) {}
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

  let host = document.getElementById('google_translate_element');
  if (!host) {
    host = document.createElement('div');
    host.id = 'google_translate_element';
    host.setAttribute('aria-hidden', 'true');
    document.body.appendChild(host);
  } else {
    host.removeAttribute('translate');
    host.classList.remove('notranslate');
  }

  if (!window.googleTranslateElementInit) {
    window.googleTranslateElementInit = function () {
      if (window.google && window.google.translate) {
        try {
          new window.google.translate.TranslateElement(
            {
              pageLanguage: 'en',
              includedLanguages: 'en,mr',
              autoDisplay: false
            },
            'google_translate_element'
          );
        } catch (e) {}
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

/**
 * Cleaner that ONLY hides annoying visual overlays (banner, tooltip balloon, floating badge)
 * WITHOUT removing elements or destroying Google Translate's iframe/select!
 */
export function installTranslateCleaner() {
  if (typeof document === 'undefined') return;

  const clean = () => {
    const unwanted = document.querySelectorAll(
      '.goog-te-banner-frame, iframe.goog-te-banner-frame, .goog-te-balloon-frame, #goog-gt-tt, .goog-tooltip, .goog-te-gadget-simple, .VIpgJd-ZVi9od-aZ2wEe-wOHMyf, .VIpgJd-ZVi9od-aZ2wEe-OiiCO, .VIpgJd-ZVi9od-ORHb-OiiCO, .VIpgJd-ZVi9od-xl07Ob-OiiCO'
    );
    unwanted.forEach(el => {
      try {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      } catch (e) {}
    });

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
    setInterval(clean, 400);

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
    if (lang === 'mr') {
      setGoogleTransCookie('mr');
      ensureGoogleWidget();

      let count = 0;
      const interval = setInterval(() => {
        count++;
        if (triggerGoogleCombo('mr') || count > 30) {
          clearInterval(interval);
        }
      }, 150);
    } else {
      setGoogleTransCookie('en');
      triggerGoogleCombo('en');
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
    if (target === 'mr') {
      ensureGoogleWidget();
      let count = 0;
      const interval = setInterval(() => {
        count++;
        if (triggerGoogleCombo('mr') || count > 20) {
          clearInterval(interval);
        }
      }, 150);
    } else {
      triggerGoogleCombo('en');
    }
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
  if (target === 'mr') {
    ensureGoogleWidget();
    triggerGoogleCombo('mr');
  } else {
    triggerGoogleCombo('en');
  }
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
    ensureGoogleWidget();
    const delays = [100, 300, 600, 1200, 2000];
    delays.forEach(d => {
      setTimeout(() => {
        triggerGoogleCombo('mr');
      }, d);
    });
  }
}

/**
 * Automatically triggers Google Translate when dynamic data (complaints, schedules, cards, tables)
 * is injected into the DOM by React.
 */
export function installDynamicContentTranslator() {
  if (typeof window === 'undefined' || typeof MutationObserver === 'undefined') return;
  if (window.__ward_dynamic_translator_installed) return;
  window.__ward_dynamic_translator_installed = true;

  let debounceTimer = null;
  const observer = new MutationObserver(mutations => {
    if (getLanguage() !== 'mr') return;

    let hasNewUserContent = false;
    for (const m of mutations) {
      if (m.type === 'childList' && m.addedNodes.length > 0) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            const tag = (node.tagName || '').toLowerCase();
            const cls = typeof node.className === 'string' ? node.className : '';
            if (
              tag === 'font' ||
              tag === 'script' ||
              tag === 'style' ||
              tag === 'iframe' ||
              cls.includes('goog-') ||
              cls.includes('skiptranslate') ||
              cls.includes('VIpgJd-')
            ) {
              continue;
            }
            hasNewUserContent = true;
            break;
          }
        }
      }
      if (hasNewUserContent) break;
    }

    if (hasNewUserContent) {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        triggerGoogleCombo('mr');
      }, 350);
    }
  });

  const attach = () => {
    const root = document.getElementById('root') || document.body;
    if (root) {
      observer.observe(root, { childList: true, subtree: true });
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', attach);
  } else {
    attach();
  }
}

/**
 * Universal term dictionary for daily database enums and categories
 */
export const MR_TERMS = {
  // Complaint statuses
  SUBMITTED: 'नोंदवले',
  PENDING: 'प्रलंबित',
  ASSIGNED: 'नियुक्त',
  IN_PROGRESS: 'प्रगतीपथावर',
  RESOLVED: 'निराकरण झाले',
  CLOSED: 'बंद केले',
  REJECTED: 'नाकारले',

  // Categories
  WATER: 'पाणीपुरवठा',
  ROADS: 'रस्ते व वाहतूक',
  GARBAGE: 'कचरा व स्वच्छता',
  DRAINAGE: 'सांडपाणी व ड्रेनेज',
  ELECTRICITY: 'विद्युत व दिवे',
  HEALTH: 'आरोग्य व स्वच्छता',
  STREETLIGHT: 'पथदिवे',
  PARK: 'उद्यान व मैदाने',
  ENCROACHMENT: 'अतिक्रमण',

  // Schedule categories & priorities
  VISIT: 'क्षेत्रीय भेट',
  MEETING: 'अधिकृत बैठक',
  INSPECTION: 'वॉर्ड पाहणी',
  EVENT: 'कार्यक्रम / उत्सव',
  CITIZEN_HEARING: 'नागरिक गाऱ्हाणे',
  URGENT: 'अतितात्काळ',
  HIGH: 'उच्च',
  MEDIUM: 'मध्यम',
  LOW: 'कमी',

  // Common statuses
  ACTIVE: 'सक्रिय',
  INACTIVE: 'निष्क्रिय',
  SUSPENDED: 'निलंबित',
  EXPIRED: 'कालबाह्य',
  DRAFT: 'मसुदा',
  PUBLISHED: 'प्रकाशित',
  ARCHIVED: 'संग्रहित',
  COMPLETED: 'पूर्ण',
  CANCELLED: 'रद्द',

  // People & Voters
  VOTER: 'मतदार',
  NON_VOTER: 'अमतदार',
  MALE: 'पुरुष',
  FEMALE: 'स्त्री',
  OTHER: 'इतर',

  // Occupations
  BUSINESS: 'व्यवसाय',
  SERVICE: 'नोकरी',
  STUDENT: 'विद्यार्थी',
  HOMEMAKER: 'गृहिणी',
  FARMER: 'शेतकरी',
  RETIRED: 'सेवानिवृत्त',
  DAILY_WAGER: 'रोजंदारी',
  UNEMPLOYED: 'बेरोजगार',

  // Roles
  SUPER_ADMIN: 'मास्टर अ‍ॅडमिन',
  SUB_MASTER_ADMIN: 'सब मास्टर अ‍ॅडमिन',
  NAGARSEVAK: 'नगरसेवक',
  EMPLOYEE: 'कर्मचारी',
  CITIZEN: 'नागरिक',
  SOCIAL_WORKER: 'सामाजिक कार्यकर्ते',
  CANDIDATE: 'निवडणूक उमेदवार',

  // Entities & Database Tables
  WARD: 'वॉर्ड',
  AREA: 'परिसर / कॉलनी',
  HOUSE: 'घर',
  APARTMENT: 'इमारत / अपार्टमेंट',
  SHOP: 'दुकान / कार्यालय',
  FAMILY: 'कुटुंब',
  PERSON: 'नागरिक',
  COMPLAINT: 'तक्रार',
  NAGARSEVAKSCHEDULE: 'दैनिक वेळापत्रक',
  DEATHRECORD: 'मृत्यू नोंद',
  WARDUPDATE: 'वॉर्ड घडामोडी',
  SCHEME: 'शासकीय योजना',
  VOTERPROFILE: 'मतदार माहिती',
  GOVERNMENTVOTERLIST: 'शासकीय मतदार यादी',
  USER: 'वापरकर्ता खाते',

  // Ownership & House Types
  OWNED: 'स्वतःचे',
  RENTED: 'भाड्याने',
  LEASED: 'लीजवर',
  BUNGALOW: 'बंगला',
  ROW_HOUSE: 'रो हाऊस',
  CHAWL: 'चाळ',
  SLUM: 'झोपडपट्टी',
  FLAT: 'फ्लॅट',

  // General Statuses
  VERIFIED: 'सत्यापित',
  UNVERIFIED: 'अपुष्ट',
  DELETED: 'हटवले',
  YES: 'होय',
  NO: 'नाही'
};

export function translateTerm(term, lang) {
  const target = lang || getLanguage();
  if (target !== 'mr') return term;
  if (!term) return '';
  const key = String(term).trim().toUpperCase();
  return MR_TERMS[key] || term;
}

if (typeof window !== 'undefined') {
  installTranslateCleaner();
  installDynamicContentTranslator();
}
