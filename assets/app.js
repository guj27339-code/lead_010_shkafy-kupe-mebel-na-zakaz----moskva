/* Site behaviour layer. No frameworks, third-party trackers or hidden submissions. */
(() => {
  'use strict';
  const $ = (q, root = document) => root.querySelector(q);
  const $$ = (q, root = document) => [...root.querySelectorAll(q)];
  if ($('.social-dock')) document.body.classList.add('has-social-dock');
  const live = (form, text, state) => {
    const output = $('[data-brief-status]', form);
    if (output) { output.textContent = text; output.dataset.state = state; }
  };
  const fallbackCopy = (preview) => {
    preview.focus(); preview.select();
    try { return document.execCommand('copy'); } catch (_) { return false; }
  };
  const copy = async (preview) => {
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(preview.value); return true; } catch (_) { /* select fallback */ }
    }
    return fallbackCopy(preview);
  };
  $$('[data-menu-toggle]').forEach(button => {
    const nav = document.getElementById(button.getAttribute('aria-controls'));
    if (!nav) return;
    const mobile = window.matchMedia('(max-width: 760px)');
    const set = (open) => { button.setAttribute('aria-expanded', String(open)); nav.hidden = mobile.matches && !open; };
    set(false);
    mobile.addEventListener('change', () => set(false));
    button.addEventListener('click', () => set(button.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') { set(false); button.focus(); }
    });
  });
  $$('[data-tabs]').forEach(group => {
    const tabs = $$('[data-tab]', group);
    const select = (tab) => {
      tabs.forEach(t => {
        const active = t === tab;
        t.setAttribute('aria-selected', String(active)); t.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
      });
    };
    select(tabs.find(t => t.getAttribute('aria-selected') === 'true') || tabs[0]);
    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', e => {
        let index;
        if (e.key === 'ArrowRight') index = (i + 1) % tabs.length;
        if (e.key === 'ArrowLeft') index = (i + tabs.length - 1) % tabs.length;
        if (e.key === 'Home') index = 0;
        if (e.key === 'End') index = tabs.length - 1;
        if (index !== undefined) { e.preventDefault(); select(tabs[index]); tabs[index].focus(); }
      });
    });
  });
  $$('[data-brief]').forEach(form => {
    let config;
    try { config = JSON.parse(form.dataset.config); } catch (_) { live(form, 'Не удалось открыть форму. Свяжитесь с компанией по контактам.', 'error'); return; }
    const preview = $('[data-brief-preview]', form);
    const previewWrap = preview ? preview.closest('.brief-preview-label') : null;
    const copyButton = $('[data-copy-brief]', form);
    let submitting = false;
    const summary = () => {
      const data = new FormData(form);
      const lines = [config.company];
      let hasDetails = false;
      [['goal', 'Задача'], ['detail', 'Объект или задача'], ['name', 'Имя'], ['contact', 'Контакт'], ['message', 'Пожелания']].forEach(([key, label]) => {
        const value = String(data.get(key) || '').trim();
        if (value) { lines.push(`${label}: ${value}`); hasDetails = true; }
      });
      preview.value = lines.join('\n');
      if (previewWrap) previewWrap.hidden = !hasDetails;
      if (copyButton) copyButton.disabled = !hasDetails;
      const wa = $('[data-send-wa]', form);
      if (wa && config.whatsapp) { const u = new URL(config.whatsapp); u.searchParams.set('text', preview.value); wa.href = u.href; }
      const tg = $('[data-send-tg]', form);
      if (tg && config.telegram) {
        try { const u = new URL(config.telegram); u.searchParams.set('text', preview.value); tg.href = u.href; }
        catch (_) { tg.href = config.telegram; }
      }
      const vk = $('[data-send-vk]', form);
      if (vk && config.vk) vk.href = config.vk;
      const mail = $('[data-send-email]', form);
      if (mail && config.email) mail.href = `${config.email}?subject=${encodeURIComponent(config.company)}&body=${encodeURIComponent(preview.value)}`;
      return data;
    };
    form.addEventListener('input', summary); form.addEventListener('change', summary); summary();
    if (copyButton) copyButton.addEventListener('click', async () => {
      summary();
      if (copyButton.disabled) return;
      live(form, (await copy(preview)) ? 'Текст скопирован. Сообщение ещё не отправлено.' : 'Выделите и скопируйте текст вручную.', 'copy');
    });
    $$('[data-send-message]', form).forEach(link => link.addEventListener('click', async () => {
      summary();
      if (!preview || !preview.value.trim()) return;
      // WhatsApp and Telegram receive the draft in the URL when supported. We also copy
      // it as a safe fallback so VK/Telegram users can paste immediately if a client or
      // browser ignores the text parameter.
      const copied = await copy(preview);
      const channel = link.hasAttribute('data-send-wa') ? 'WhatsApp' : (link.hasAttribute('data-send-tg') ? 'Telegram' : 'ВКонтакте');
      live(form, copied ? `${channel} открывается. Текст обращения также скопирован.` : `${channel} открывается с подготовленным обращением.`, 'copy');
    }));
    $$('[data-preset]').forEach(button => button.addEventListener('click', () => {
      const field = $('[name="goal"]', form);
      if (!field || ![...field.options].some(x => x.value === button.dataset.preset)) return;
      field.value = button.dataset.preset; field.dispatchEvent(new Event('change', {bubbles: true}));
      form.scrollIntoView({behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
      field.focus({preventScroll: true});
    }));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (submitting || !config.endpoint || !form.reportValidity()) return;
      const data = summary(); if (String(data.get('website') || '')) return;
      const submit = $('[data-submit]', form);
      submitting = true; submit.disabled = true; live(form, 'Отправляем заявку…', 'pending');
      const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const headers = {'Content-Type': 'application/json', 'Accept': 'application/json'};
        if (config.key) headers['X-Lead-Relay-Key'] = config.key;
        const response = await fetch(config.endpoint, {
          method: 'POST', headers, signal: controller.signal, credentials: 'omit',
          body: JSON.stringify({company: config.company, name: String(data.get('name') || ''), contact: String(data.get('contact') || ''), service: String(data.get('goal') || ''), message: preview.value, website: '', page: location.href})
        });
        const text = await response.text();
        let result = null; try { result = text ? JSON.parse(text) : null; } catch (_) { /* not an acknowledged API response */ }
        const acknowledged = response.status === 204 || (result && (result.ok === true || result.success === true));
        if (!response.ok || !acknowledged) throw new Error('not_acknowledged');
        live(form, 'Сервис приёма подтвердил получение заявки.', 'success');
      } catch (_) {
        live(form, 'Доставка не подтверждена. Текст сохранён — скопируйте его или свяжитесь с компанией по контактам.', 'error');
      } finally { clearTimeout(timer); submitting = false; submit.disabled = false; }
    });
  });
  $$('[data-lightbox]').forEach(link => {
    link.addEventListener('click', e => {
      if (!window.HTMLDialogElement) return; // Normal image link is the fallback.
      e.preventDefault();
      const dialog = document.createElement('dialog'); dialog.className = 'site-lightbox'; dialog.setAttribute('aria-label', 'Фотография');
      const image = document.createElement('img'); image.src = link.href; image.alt = $('img', link)?.alt || '';
      const close = document.createElement('button'); close.type = 'button'; close.textContent = 'Закрыть'; close.dataset.lightboxClose = '';
      close.addEventListener('click', () => dialog.close());
      dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
      dialog.addEventListener('close', () => { dialog.remove(); link.focus(); });
      dialog.append(close, image); document.body.append(dialog); dialog.showModal(); close.focus();
    });
  });
  // Progressive enhancement: never hide content in CSS or require JS for visibility.
  // Only animate below-fold sections when they enter view; no repeated scroll work.
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!motion.matches && 'IntersectionObserver' in window && Element.prototype.animate) {
    const running = new Set();
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);
        if (motion.matches) return;
        const i = Number(entry.target.dataset.motionIndex || 0);
        const x = i % 2 ? 8 : -8;
        const animation = entry.target.animate(
          [{opacity: .55, transform: `translate3d(${x}px, 16px, 0) scale(.99)`}, {opacity: 1, transform: 'translate3d(0,0,0) scale(1)'}],
          {duration: 420 + i * 28, delay: Math.min(i * 34, 170), easing: 'cubic-bezier(.2,.72,.2,1)', fill: 'both'}
        );
        running.add(animation);
        animation.onfinish = animation.oncancel = () => running.delete(animation);
      });
    }, {threshold: .06});
    const motionTargets = $$([
      'main > section', 'main article', 'main h1', 'main h2', 'main h3',
      'main figure', 'main blockquote', 'main .card', 'main [class*="card"]',
      'main .contact-action', 'main .brief-action', 'main .button', 'main [data-preset]',
      '.trusted-work-item', '.verified-review-card', '.site-footer > *'
    ].join(','));
    const uniqueTargets = [...new Set(motionTargets)].filter(node => !node.closest('.site-lightbox'));
    uniqueTargets.slice(0, 80).forEach((node, index) => {
      if (node.getBoundingClientRect().top < innerHeight * .72) return;
      node.dataset.motionIndex = String(index % 6);
      observer.observe(node);
    });
    motion.addEventListener('change', () => {
      if (motion.matches) { observer.disconnect(); running.forEach(animation => animation.cancel()); }
    });
  }

  // Floating quick-contact dock: staggered entrance, then reveal after a short scroll so it
  // never covers the first screen. Pure enhancement — links work with JS off, and any failure
  // here must never stop the page or the readiness flag below.
  try {
    const dock = $('.social-dock');
    if (dock) {
      const links = $$('.social-dock-link', dock);
      links.forEach((link, i) => link.style.setProperty('--dock-i', String(i)));
      const reveal = () => {
        const show = window.scrollY > 140 || document.documentElement.scrollHeight <= innerHeight * 1.4;
        dock.classList.toggle('social-dock--in', show);
      };
      reveal();
      let ticking = false;
      addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => { reveal(); ticking = false; });
      }, {passive: true});
    }
  } catch (_) { /* dock is optional; ignore */ }

  // Gentle parallax drift on the hero image while scrolling (skipped for reduced motion / touch).
  try {
    if (!motion.matches && matchMedia('(hover:hover)').matches) {
      const heroImg = $('.hero-visual img, [data-hero-image]');
      if (heroImg) {
        let raf = 0;
        const drift = () => {
          raf = 0;
          const shift = Math.max(-14, Math.min(14, window.scrollY * 0.04));
          heroImg.style.transform = `translate3d(0, ${shift}px, 0) scale(1.02)`;
        };
        addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(drift); }, {passive: true});
        drift();
      }
    }
  } catch (_) { /* parallax is optional; ignore */ }

  window.__siteReady = true;
})();
