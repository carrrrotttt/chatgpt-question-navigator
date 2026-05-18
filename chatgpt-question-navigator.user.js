// ==UserScript==
// @name         ChatGPT 问题导航
// @namespace    https://chatgpt.com/
// @version      1.3.1
// @description  在 ChatGPT 对话页显示所有用户问题，点击后滚动到对应位置。
// @author       Codex
// @match        https://chatgpt.com/*
// @match        https://chat.openai.com/*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const PANEL_ID = 'chatgpt-question-navigator-host';
  const HIGHLIGHT_CLASS = 'chatgpt-question-navigator-highlight';
  const USER_MESSAGE_SELECTORS = [
    '[data-message-author-role="user"]',
    '[data-testid="user-message"]',
    '[data-author="user"]',
    '[data-role="user"]'
  ];
  const EMPTY_MESSAGE = '探赜索隐，钩深致远';

  let questions = [];
  let questionMap = new Map();
  let listEl;
  let emptyEl;
  let searchInput;
  let collapseButton;
  let refreshButton;
  let hostEl;
  let collapsed = false;
  let refreshTimer = 0;
  let highlightedTarget = null;
  let highlightTimer = 0;
  let scrollAttemptToken = 0;
  let scrollAnimation = 0;
  let lastUrl = location.href;
  let dragState = null;

  function init() {
    createPanel();
    injectHighlightStyle();
    refreshQuestions();
    observePageChanges();
    observeUrlChanges();
  }

  function createPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const host = document.createElement('div');
    host.id = PANEL_ID;
    hostEl = host;
    document.documentElement.appendChild(host);

    const root = host.attachShadow({ mode: 'open' });
    root.innerHTML = `
      <style>
        :host {
          position: fixed;
          top: 50%;
          right: 16px;
          z-index: 2147483647;
          transform: translateY(-50%);
          color-scheme: dark;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        }

        .panel {
          width: 304px;
          max-height: min(68vh, 640px);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          border: 1px solid rgba(255, 255, 255, 0.07);
          border-radius: 11px;
          background: rgba(28, 29, 31, 0.9);
          color: rgba(238, 239, 241, 0.95);
          box-shadow: 0 14px 34px rgba(0, 0, 0, 0.22);
          backdrop-filter: blur(10px);
        }

        .header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 16px 16px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
          cursor: grab;
          user-select: none;
        }

        .title {
          min-width: 0;
          font-size: 15px;
          font-weight: 700;
          line-height: 1.2;
          color: rgba(247, 247, 248, 0.96);
        }

        .actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex: 0 0 auto;
        }

        .icon-button {
          width: 24px;
          height: 24px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          flex: 0 0 auto;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: rgba(220, 223, 227, 0.82);
          cursor: pointer;
          font-size: 15px;
          line-height: 1;
        }

        .icon-button:hover {
          background: rgba(255, 255, 255, 0.06);
          color: rgba(241, 243, 245, 0.96);
        }

        .search-wrap {
          padding: 12px 14px 14px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.07);
        }

        .search {
          width: 100%;
          box-sizing: border-box;
          height: 46px;
          border: 1px solid rgba(255, 255, 255, 0.13);
          border-radius: 6px;
          padding: 0 14px;
          background: rgba(255, 255, 255, 0.022);
          color: rgba(239, 240, 242, 0.95);
          font: inherit;
          font-size: 14px;
          outline: none;
        }

        .search::placeholder {
          color: rgba(196, 199, 204, 0.62);
        }

        .search:focus {
          border-color: rgba(255, 255, 255, 0.24);
          box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.05);
        }

        .body {
          overflow: auto;
          padding: 12px 14px 14px;
        }

        .question {
          width: 100%;
          display: grid;
          grid-template-columns: 24px minmax(0, 1fr);
          gap: 10px;
          align-items: center;
          padding: 7px 0;
          border: 0;
          border-radius: 6px;
          background: transparent;
          color: inherit;
          cursor: pointer;
          text-align: left;
        }

        .question:hover {
          background: rgba(255, 255, 255, 0.04);
        }

        .number {
          color: rgba(175, 180, 188, 0.72);
          font-size: 11px;
          line-height: 1.35;
          text-align: center;
        }

        .text {
          display: block;
          overflow: hidden;
          white-space: nowrap;
          text-overflow: ellipsis;
          font-size: 14px;
          line-height: 1.45;
          color: rgba(228, 230, 233, 0.92);
        }

        .empty {
          padding: 12px 0 4px;
          color: rgba(196, 199, 204, 0.62);
          font-size: 13px;
          line-height: 1.45;
        }

        :host(.is-collapsed) .panel {
          width: auto;
          min-width: 72px;
        }

        :host(.is-collapsed) .title,
        :host(.is-collapsed) .search-wrap,
        :host(.is-collapsed) .body {
          display: none;
        }

        :host(.is-collapsed) .header {
          padding: 8px;
          border-bottom: 0;
          justify-content: center;
        }

        :host(.is-collapsed) .actions,
        :host(.is-collapsed) .refresh,
        :host(.is-collapsed) .toggle {
          display: inline-flex;
        }

        @media (max-width: 760px) {
          :host {
            right: 8px;
          }

          .panel {
            width: 272px;
            max-height: 52vh;
          }
        }
      </style>
      <section class="panel" aria-label="ChatGPT 问题导航">
        <div class="header">
          <div class="title">探赜索隐</div>
          <div class="actions">
            <button class="icon-button refresh" type="button" title="刷新问题列表" aria-label="刷新问题列表">↻</button>
            <button class="icon-button toggle" type="button" title="折叠问题导航" aria-label="折叠问题导航">‹</button>
          </div>
        </div>
        <div class="search-wrap">
          <input class="search" type="search" placeholder="搜索提问内容" aria-label="搜索提问内容" autocomplete="off">
        </div>
        <div class="body">
          <div class="empty">探赜索隐，钩深致远</div>
          <div class="list"></div>
        </div>
      </section>
    `;

    listEl = root.querySelector('.list');
    emptyEl = root.querySelector('.empty');
    searchInput = root.querySelector('.search');
    collapseButton = root.querySelector('.toggle');
    refreshButton = root.querySelector('.refresh');

    collapseButton.addEventListener('click', () => {
      collapsed = !collapsed;
      host.classList.toggle('is-collapsed', collapsed);
      collapseButton.textContent = collapsed ? '›' : '‹';
      collapseButton.title = collapsed ? '展开问题导航' : '折叠问题导航';
      collapseButton.setAttribute('aria-label', collapseButton.title);
    });

    refreshButton.addEventListener('click', () => {
      refreshQuestions();
    });

    searchInput.addEventListener('input', renderList);

    root.querySelector('.header').addEventListener('pointerdown', startDrag);

    listEl.addEventListener('click', (event) => {
      const button = event.target.closest('.question');
      if (!button) return;

      const item = questionMap.get(button.dataset.key);
      if (!item) {
        scheduleRefresh();
        return;
      }

      scrollToQuestion(item);
    });
  }

  function injectHighlightStyle() {
    const style = document.createElement('style');
    style.textContent = `
      .${HIGHLIGHT_CLASS} {
        outline: 2px solid #10a37f !important;
        outline-offset: 8px !important;
        box-shadow: 0 0 0 8px rgba(16, 163, 127, 0.12) !important;
        transition: outline-color 160ms ease, box-shadow 160ms ease !important;
      }
    `;
    document.head.appendChild(style);
  }

  function observePageChanges() {
    const observer = new MutationObserver(scheduleRefresh);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true
    });
  }

  function observeUrlChanges() {
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = originalPushState.apply(this, args);
      checkUrlChange();
      return result;
    };

    history.replaceState = function (...args) {
      const result = originalReplaceState.apply(this, args);
      checkUrlChange();
      return result;
    };

    window.addEventListener('popstate', checkUrlChange);
  }

  function checkUrlChange() {
    if (location.href === lastUrl) return;
    lastUrl = location.href;
    rebuildQuestions();
  }

  function scheduleRefresh() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(refreshQuestions, 160);
  }

  function refreshQuestions() {
    if (!isConversationRoute()) {
      clearQuestions();
      renderList();
      return;
    }

    mergeVisibleQuestions();
    renderList();
  }

  function rebuildQuestions() {
    clearQuestions();
    refreshQuestions();
  }

  function clearQuestions() {
    questionMap = new Map();
    questions = [];
  }

  function mergeVisibleQuestions() {
    const nodes = USER_MESSAGE_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const seenTargets = new Set();
    const textCounts = new Map();

    nodes.forEach((node) => {
      const target = getScrollTarget(node);
      if (!target || seenTargets.has(target)) return;

      const text = normalizeText(node.innerText || node.textContent || '');
      if (!text) return;

      const count = textCounts.get(text) || 0;
      textCounts.set(text, count + 1);
      seenTargets.add(target);
      upsertQuestion(text, target, count);
    });

    questions.sort((a, b) => a.order - b.order || a.firstSeen - b.firstSeen);
  }

  function getScrollTarget(node) {
    return (
      node.closest('[data-testid^="conversation-turn-"]') ||
      node.closest('article') ||
      node
    );
  }

  function isConversationRoute() {
    return /(^|\/)c\/[^/]+/.test(location.pathname);
  }

  function normalizeText(text) {
    return text.replace(/\s+/g, ' ').trim();
  }

  function upsertQuestion(text, target, duplicateIndex) {
    const key = makeQuestionKey(text, target, duplicateIndex);
    const existing = questionMap.get(key);

    if (existing) {
      existing.text = text;
      existing.target = target;
      existing.turnId = getTargetId(target);
      existing.order = getQuestionOrder(target, existing.firstSeen);
      rememberScrollPosition(existing, target);
      return;
    }

    const item = {
      key,
      text,
      target,
      turnId: getTargetId(target),
      order: getQuestionOrder(target, questions.length),
      firstSeen: questions.length
    };

    rememberScrollPosition(item, target);
    questions.push(item);
    questionMap.set(key, item);
  }

  function makeQuestionKey(text, target, duplicateIndex) {
    const turnId = getTargetId(target);
    if (turnId) return `turn:${turnId}`;
    return `text:${simpleHash(text)}:${duplicateIndex}:${text.slice(0, 80)}`;
  }

  function getQuestionOrder(target, fallback) {
    const turnId = getTargetId(target);
    const match = turnId.match(/conversation-turn-(\d+)/);
    return match ? Number(match[1]) : fallback + 1000000;
  }

  function getTargetId(target) {
    return target.getAttribute('data-testid') || target.id || '';
  }

  function simpleHash(text) {
    let hash = 0;
    for (let index = 0; index < text.length; index += 1) {
      hash = ((hash << 5) - hash + text.charCodeAt(index)) | 0;
    }
    return String(hash);
  }

  function renderList() {
    if (!listEl || !emptyEl) return;

    listEl.textContent = '';
    const keyword = normalizeText(searchInput ? searchInput.value : '').toLowerCase();
    const visibleQuestions = keyword
      ? questions.filter((item) => item.text.toLowerCase().includes(keyword))
      : questions;

    emptyEl.hidden = visibleQuestions.length > 0;
    emptyEl.textContent = questions.length > 0 ? '没有匹配的问题' : EMPTY_MESSAGE;

    const fragment = document.createDocumentFragment();

    visibleQuestions.forEach((item) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'question';
      button.dataset.key = item.key;
      button.title = item.text;

      const number = document.createElement('span');
      number.className = 'number';
      number.textContent = String(questions.indexOf(item) + 1);

      const text = document.createElement('span');
      text.className = 'text';
      text.textContent = item.text;

      button.append(number, text);
      fragment.appendChild(button);
    });

    listEl.appendChild(fragment);
  }

  function scrollToQuestion(item) {
    const token = ++scrollAttemptToken;
    const delays = [0, 180, 420, 760];

    delays.forEach((delay, index) => {
      window.setTimeout(() => {
        if (token !== scrollAttemptToken) return;

        const target = resolveCurrentTarget(item);
        if (!target) {
          scrollToRememberedPosition(item, index === 0, token);
          return;
        }

        const scroller = getScrollContainer(target);
        const top = getCenteredScrollTop(scroller, target);
        const duration = index === 0 ? 420 : 180;
        animateScrollTo(scroller, top, duration, token);
        rememberScrollPosition(item, target);

        if (index === delays.length - 1 || isTargetNearScrollCenter(scroller, target)) {
          window.setTimeout(() => {
            if (token === scrollAttemptToken && target.isConnected) {
              highlightTarget(target);
            }
          }, duration + 40);
        }
      }, delay);
    });
  }

  function resolveCurrentTarget(item) {
    if (item.target && item.target.isConnected && targetContainsQuestion(item.target, item.text)) {
      return item.target;
    }

    const byTurnId = findTargetByTurnId(item.turnId);
    if (byTurnId && targetContainsQuestion(byTurnId, item.text)) {
      item.target = byTurnId;
      return item.target;
    }

    const nodes = USER_MESSAGE_SELECTORS.flatMap((selector) => Array.from(document.querySelectorAll(selector)));
    const matched = nodes.find((node) => isSameQuestionText(node, item.text));
    if (!matched) return null;

    item.target = getScrollTarget(matched);
    item.turnId = getTargetId(item.target);
    rememberScrollPosition(item, item.target);
    return item.target;
  }

  function scrollToRememberedPosition(item, smooth, token) {
    if (!Number.isFinite(item.scrollTop)) return;

    const scroller = item.scroller && item.scroller.isConnected
      ? item.scroller
      : findMainScrollContainer();

    animateScrollTo(scroller, item.scrollTop, smooth ? 420 : 180, token);
  }

  function findTargetByTurnId(turnId) {
    if (!turnId) return null;

    const candidates = Array.from(document.querySelectorAll('[data-testid^="conversation-turn-"], article'));
    return candidates.find((target) => getTargetId(target) === turnId) || null;
  }

  function targetContainsQuestion(target, text) {
    return normalizeText(target.innerText || target.textContent || '').includes(text);
  }

  function isSameQuestionText(node, text) {
    return normalizeText(node.innerText || node.textContent || '') === text;
  }

  function isTargetNearScrollCenter(scroller, target) {
    const rect = target.getBoundingClientRect();
    const targetCenter = rect.top + rect.height / 2;
    const containerRect = isDocumentScroller(scroller)
      ? { top: 0, height: window.innerHeight }
      : scroller.getBoundingClientRect();
    const viewportCenter = containerRect.top + containerRect.height / 2;
    return Math.abs(targetCenter - viewportCenter) < Math.max(64, containerRect.height * 0.1);
  }

  function rememberScrollPosition(item, target) {
    const scroller = getScrollContainer(target);
    item.scroller = scroller;
    item.scrollTop = getCenteredScrollTop(scroller, target);
  }

  function getScrollContainer(target) {
    let node = target.parentElement;

    while (node && node !== document.body && node !== document.documentElement) {
      const style = window.getComputedStyle(node);
      const canScroll = /(auto|scroll|overlay)/.test(style.overflowY);
      if (canScroll && node.scrollHeight > node.clientHeight + 24) {
        return node;
      }
      node = node.parentElement;
    }

    return document.scrollingElement || document.documentElement;
  }

  function findMainScrollContainer() {
    const visibleQuestion = USER_MESSAGE_SELECTORS
      .flatMap((selector) => Array.from(document.querySelectorAll(selector)))
      .find((node) => node.offsetParent !== null);

    if (visibleQuestion) {
      return getScrollContainer(visibleQuestion);
    }

    const candidates = Array.from(document.querySelectorAll('main, [role="main"], div'))
      .filter((node) => node !== hostEl && !hostEl.contains(node))
      .filter((node) => node.scrollHeight > node.clientHeight + 120);

    return candidates.sort((a, b) => {
      const aRange = a.scrollHeight - a.clientHeight;
      const bRange = b.scrollHeight - b.clientHeight;
      return bRange - aRange;
    })[0] || document.scrollingElement || document.documentElement;
  }

  function getCenteredScrollTop(scroller, target) {
    const rect = target.getBoundingClientRect();

    if (isDocumentScroller(scroller)) {
      return Math.max(0, window.scrollY + rect.top - (window.innerHeight - rect.height) / 2);
    }

    const scrollerRect = scroller.getBoundingClientRect();
    return Math.max(0, scroller.scrollTop + rect.top - scrollerRect.top - (scroller.clientHeight - rect.height) / 2);
  }

  function animateScrollTo(scroller, top, duration, token) {
    window.cancelAnimationFrame(scrollAnimation);

    const start = getScrollerTop(scroller);
    const distance = top - start;
    const startTime = performance.now();

    if (Math.abs(distance) < 2) {
      setScrollerTop(scroller, top);
      return;
    }

    const step = (now) => {
      if (token !== scrollAttemptToken) return;

      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setScrollerTop(scroller, start + distance * eased);

      if (progress < 1) {
        scrollAnimation = window.requestAnimationFrame(step);
      }
    };

    scrollAnimation = window.requestAnimationFrame(step);
  }

  function getScrollerTop(scroller) {
    return isDocumentScroller(scroller) ? window.scrollY : scroller.scrollTop;
  }

  function setScrollerTop(scroller, top) {
    if (isDocumentScroller(scroller)) {
      window.scrollTo(0, top);
    } else {
      scroller.scrollTop = top;
    }
  }

  function isDocumentScroller(scroller) {
    return scroller === document.scrollingElement || scroller === document.documentElement || scroller === document.body;
  }

  function highlightTarget(target) {
    window.clearTimeout(highlightTimer);

    if (highlightedTarget && highlightedTarget.isConnected) {
      highlightedTarget.classList.remove(HIGHLIGHT_CLASS);
    }

    highlightedTarget = target;
    highlightedTarget.classList.add(HIGHLIGHT_CLASS);

    highlightTimer = window.setTimeout(() => {
      if (highlightedTarget && highlightedTarget.isConnected) {
        highlightedTarget.classList.remove(HIGHLIGHT_CLASS);
      }
      highlightedTarget = null;
    }, 1400);
  }

  function startDrag(event) {
    if (!hostEl || event.button !== 0 || event.target.closest('button')) return;

    const rect = hostEl.getBoundingClientRect();
    dragState = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startTop: rect.top,
      height: rect.height
    };

    hostEl.style.top = `${rect.top}px`;
    hostEl.style.transform = 'none';

    event.currentTarget.setPointerCapture(event.pointerId);
    event.currentTarget.addEventListener('pointermove', dragPanel);
    event.currentTarget.addEventListener('pointerup', stopDrag, { once: true });
    event.currentTarget.addEventListener('pointercancel', stopDrag, { once: true });
  }

  function dragPanel(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    const maxTop = Math.max(8, window.innerHeight - dragState.height - 8);
    const nextTop = Math.min(maxTop, Math.max(8, dragState.startTop + event.clientY - dragState.startY));
    hostEl.style.top = `${nextTop}px`;
  }

  function stopDrag(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;

    event.currentTarget.releasePointerCapture(event.pointerId);
    event.currentTarget.removeEventListener('pointermove', dragPanel);
    dragState = null;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
