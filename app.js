// app.js (clean)
// 動的にレポートを描画し、入力を保存。正解表示トグルに対応。
(function () {
  const page = document.getElementById('page');
  const select = document.getElementById('reportSelect');
  const resetBtn = document.getElementById('resetBtn');
  const printBtn = document.getElementById('printBtn');
  const solutionBtn = document.getElementById('solutionBtn');
  let showSolutions = false;

  // --- storage helpers ---
  const lsKey = (id) => `report:${id}:answers`;
  const saveAnswers = (id) => {
    if (!id) return;
    const data = {};
    page.querySelectorAll('[data-field-id]').forEach((el) => {
      data[el.dataset.fieldId] = el.value || '';
    });
    try { localStorage.setItem(lsKey(id), JSON.stringify(data)); } catch {}
  };
  const loadAnswers = (id) => {
    try { return JSON.parse(localStorage.getItem(lsKey(id)) || '{}'); } catch { return {}; }
  };
  const clearAnswers = (id) => { try { localStorage.removeItem(lsKey(id)); } catch {} };

  // sizing helpers
  function setChWidth(el, ch) { const n = Math.max(3, Number(ch) || 0); el.style.setProperty('--ch', n); }
  const __measure = (() => { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); return (text, el) => { const cs = getComputedStyle(el); ctx.font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`; return ctx.measureText(String(text || '')).width; }; })();
  function displayWidth(str) { let w = 0; for (const ch of String(str || '')) { const cp = ch.codePointAt(0); w += (cp && (cp >= 0x2E80 && (cp <= 0xA4CF || (cp >= 0xF900 && cp <= 0xFAFF) || (cp >= 0xFE10 && cp <= 0xFE6F) || (cp >= 0xFF00 && cp <= 0xFF60) || (cp >= 0xFFE0 && cp <= 0xFFE6)))) ? 2 : 1; } return w; }
  function applyExactPixelWidth(el, text, extra = 0) { const cs = getComputedStyle(el); const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); const b = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth); const w = __measure(text, el) + pad + b + extra; el.style.width = `${Math.ceil(w)}px`; }

  function appendString(container, str) { const parts = String(str).split('\n'); parts.forEach((p, i) => { if (i > 0) container.appendChild(document.createElement('br')); container.appendChild(document.createTextNode(p)); }); }

  function adjustSelects(root) {
    const selects = root.querySelectorAll('select.blank-select');
    selects.forEach((sel) => {
      const optionTexts = Array.from(sel.options).map((o) => o.text || '');
      const placeholder = sel.dataset.placeholder || optionTexts[0] || '';
      let maxPx = 0;
      for (const label of optionTexts) { const px = __measure(label, sel); if (px > maxPx) maxPx = px; }
      const cs = getComputedStyle(sel);
      const padBorder = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      const minPx = Math.ceil(maxPx + padBorder + 18);
      sel.style.minWidth = `${minPx}px`;
      const currentText = sel.options[sel.selectedIndex]?.text || placeholder;
      applyExactPixelWidth(sel, currentText, 18);
    });
  }

  // Link helpers: keep fields with same linkKey in sync
  function propagateLinkedValue(linkKey, value, sourceEl) {
    if (!linkKey) return;
    const others = page.querySelectorAll('[data-link-key="' + linkKey + '"]');
    others.forEach((el) => {
      if (el === sourceEl) return;
      const tag = (el.tagName || '').toUpperCase();
      if (tag === 'INPUT') {
        const baseText = el.placeholder || '';
        el.value = value || '';
        try { applyExactPixelWidth(el, el.value || baseText); } catch {}
      } else if (tag === 'SELECT') {
        const v = String(value || '');
        const found = Array.from(el.options).some((o) => String(o.value || o.text || '') === v);
        if (found) { el.value = v; }
        const placeholder = el.dataset.placeholder || (el.options[0]?.text || '');
        const currentText = el.options[el.selectedIndex]?.text || placeholder;
        try { applyExactPixelWidth(el, currentText, 18); } catch {}
      }
    });
  }

  function unifyLinkedAfterRender() {
    const all = Array.from(page.querySelectorAll('[data-link-key]'));
    const firstNonEmpty = new Map();
    all.forEach((el) => {
      const key = el.dataset.linkKey;
      if (!key) return;
      const val = (el.value || '').toString();
      if (val && !firstNonEmpty.has(key)) firstNonEmpty.set(key, val);
    });
    firstNonEmpty.forEach((val, key) => propagateLinkedValue(key, val, null));
  }

  function renderTokens(container, tokens, answers, reportId, options = {}) {
    const useSolutions = !!options.showSolutions;
    const DEFAULT_SCALE = 2;
    tokens.forEach((t) => {
      if (typeof t === 'string') { appendString(container, t); return; }
      if (t.kind === 'text') {
        const wrap = document.createElement('span'); wrap.className = 'blank';
        const input = document.createElement('input'); input.type = 'text'; input.className = 'blank-input';
        input.placeholder = t.placeholder || '';
        // Prevent OS software keyboard; rely on our custom IME
        try {
          input.setAttribute('inputmode', 'none');
          input.setAttribute('autocomplete', 'off');
          input.setAttribute('autocorrect', 'off');
          input.setAttribute('autocapitalize', 'off');
          input.spellcheck = false;
        } catch {}
        if (t.placeholder) input.setAttribute('title', `例: ${t.placeholder}`);
        input.dataset.fieldId = t.id;
        input.dataset.linkKey = (t.link || t.id);
        input.value = useSolutions ? (t.solution ?? '') : (answers[t.id] || '');
        const baseRaw = t.size != null ? t.size : (t.placeholder ? displayWidth(t.placeholder) : 6) * DEFAULT_SCALE;
        setChWidth(input, baseRaw);
        wrap.appendChild(input); container.appendChild(wrap);
        const baseText = t.placeholder || '';
        applyExactPixelWidth(input, useSolutions ? (t.solution ?? baseText) : baseText);
        if (useSolutions) { input.readOnly = true; }
        else { input.addEventListener('input', () => { applyExactPixelWidth(input, input.value || baseText); saveAnswers(reportId); }); }
        return;
      }
      if (t.kind === 'choice') {
        const wrap = document.createElement('span'); wrap.className = 'blank';
        const sel = document.createElement('select'); sel.className = 'blank-select'; sel.dataset.fieldId = t.id; sel.dataset.linkKey = (t.link || t.id);
        const optsArr = (t.options || []).map(String);
        const isAnswerSet = optsArr.length === 6 && ['A','N','S','W','E','R'].every((x) => optsArr.includes(x));
        let placeholder;
        if (t.placeholder !== undefined) {
          if (t.placeholder === '' && !isAnswerSet) {
            // For non-ANSWER selects, show options when placeholder is intentionally blank
            placeholder = `（${optsArr.join('・')}）`;
          } else {
            placeholder = String(t.placeholder);
          }
        } else {
          placeholder = `（${optsArr.join('・')}）`;
        }
        sel.dataset.placeholder = placeholder;
        // Override placeholder behavior if placeholderMode is specified
        {
          const modeRaw = (t.placeholderMode || 'auto');
          const mode = String(modeRaw).toLowerCase();
          const listText = optsArr.join('・');
          if (mode === 'list') {
            placeholder = listText;
          } else if (mode === 'none') {
            placeholder = '';
          } else if (mode === 'text') {
            placeholder = String(t.placeholder || '');
          }
          sel.dataset.placeholder = placeholder;
        }
        const empty = document.createElement('option'); empty.value = ''; empty.textContent = placeholder; sel.appendChild(empty);
        optsArr.forEach((opt) => { const o = document.createElement('option'); o.value = opt; o.textContent = opt; sel.appendChild(o); });
        const fallbackSolution = (optsArr && optsArr.length) ? optsArr[0] : '';
        sel.value = useSolutions ? String((t.solution ?? fallbackSolution)) : (answers[t.id] || '');
        const baseRaw = t.size != null ? t.size : Math.max(displayWidth(placeholder), optsArr.reduce((m, s) => Math.max(m, displayWidth(s)), 0)) * DEFAULT_SCALE;
        setChWidth(sel, baseRaw);
        wrap.appendChild(sel); container.appendChild(wrap);
        // measure after attach
        const candidates = [placeholder, ...optsArr]; let maxPx = 0; for (const c of candidates) { const px = __measure(c, sel); if (px > maxPx) maxPx = px; }
        const cs2 = getComputedStyle(sel); const padBorder2 = parseFloat(cs2.paddingLeft) + parseFloat(cs2.paddingRight) + parseFloat(cs2.borderLeftWidth) + parseFloat(cs2.borderRightWidth);
        const minPx = Math.ceil(maxPx + padBorder2 + 18); sel.style.minWidth = `${minPx}px`;
        const currentText = sel.options[sel.selectedIndex]?.text || placeholder; applyExactPixelWidth(sel, currentText, 18);
        if (useSolutions) { sel.disabled = true; } else { sel.addEventListener('change', () => { const text = sel.options[sel.selectedIndex]?.text || placeholder; applyExactPixelWidth(sel, text, 18); saveAnswers(reportId); }); }
        return;
      }
    });
  }

  function renderReport(report, options = {}) {
    page.innerHTML = '';
    const answers = loadAnswers(report.id);
    const header = document.createElement('div'); header.className = 'page-header';
    const t = document.createElement('div'); t.className = 'title'; t.textContent = report.title || report.name || '違和感レポート';
    const st = document.createElement('div'); st.className = 'subtitle'; st.textContent = report.subtitle || '';
    header.appendChild(t); if (report.subtitle) header.appendChild(st); page.appendChild(header);
    (report.sections || []).forEach((sec) => {
      const section = document.createElement('section'); section.className = 'section';
      const h = document.createElement('div'); h.className = 'section-title'; h.textContent = sec.title || ''; section.appendChild(h);
      (sec.blocks || []).forEach((blk) => {
        if (blk.title) { const bt = document.createElement('div'); bt.className = 'block-title'; bt.textContent = blk.title; section.appendChild(bt); }
        const p = document.createElement('p'); p.className = 'paragraph';
        renderTokens(p, blk.tokens || [], answers, report.id, { showSolutions: !!options.showSolutions });
        section.appendChild(p);
      });
      page.appendChild(section); adjustSelects(section);
    });
    const notes = document.createElement('div'); notes.className = 'notes'; notes.textContent = '空欄はタップして入力/選択できます。入力内容は端末内に自動保存されます。'; page.appendChild(notes);
  }

  function populateSelect() { select.innerHTML = ''; (window.reports || []).forEach((r) => { const o = document.createElement('option'); o.value = r.id; o.textContent = r.name || r.title || r.id; select.appendChild(o); }); }
  function currentReport() { const id = select.value; return (window.reports || []).find((r) => r.id === id) || window.reports[0]; }

  function init() {
    // Ensure CSS is loaded (GH Pages cache/path issues safeguard)
    (function ensureCSS(){ const probe = document.createElement('input'); probe.className = 'blank-input'; probe.style.position = 'absolute'; probe.style.opacity = '0'; probe.style.pointerEvents = 'none'; document.body.appendChild(probe); const cs = getComputedStyle(probe); const applied = cs.borderLeftColor !== '' && cs.borderLeftWidth !== '0px'; if (!applied) { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = './styles.css?v=' + Date.now(); document.head.appendChild(link); } document.body.removeChild(probe); })();

    populateSelect(); const first = window.reports && window.reports[0]; if (first) select.value = first.id; renderReport(currentReport(), { showSolutions });
    try { unifyLinkedAfterRender(); adjustSelects(page); } catch {}

    select.addEventListener('change', () => { showSolutions = false; if (solutionBtn) { solutionBtn.classList.remove('active'); solutionBtn.textContent = '正解確認'; } renderReport(currentReport(), { showSolutions }); });
    if (resetBtn) resetBtn.addEventListener('click', () => { const r = currentReport(); if (!r) return; if (confirm('このレポートの入力内容をリセットしますか？')) { clearAnswers(r.id); renderReport(r, { showSolutions }); } });
    if (solutionBtn) solutionBtn.addEventListener('click', () => { showSolutions = !showSolutions; solutionBtn.classList.toggle('active', showSolutions); solutionBtn.textContent = showSolutions ? '解答を隠す' : '正解確認'; renderReport(currentReport(), { showSolutions }); });
    if (printBtn) printBtn.addEventListener('click', () => window.print());

    // Link syncing: mirror changes across same linkKey
    page.addEventListener('input', (e) => {
      const el = e.target;
      try {
        if (!el || !(el instanceof HTMLInputElement)) return;
      } catch { /* instanceof may fail in some envs */
        if (!el || String(el.tagName).toUpperCase() !== 'INPUT') return;
      }
      const key = el.dataset && el.dataset.linkKey;
      if (!key) return;
      propagateLinkedValue(key, el.value, el);
      const cur = currentReport(); if (cur) saveAnswers(cur.id);
    });
    page.addEventListener('change', (e) => {
      const el = e.target;
      try {
        if (!el || !(el instanceof HTMLSelectElement)) return;
      } catch { /* instanceof may fail in some envs */
        if (!el || String(el.tagName).toUpperCase() !== 'SELECT') return;
      }
      if (!el.classList.contains('blank-select')) return;
      const key = el.dataset && el.dataset.linkKey;
      if (!key) return;
      propagateLinkedValue(key, el.value, el);
      const cur = currentReport(); if (cur) saveAnswers(cur.id);
    });

    // Hidden hotspot: 5 taps on top-left to switch report
    const hotspot = document.getElementById('devHotspot');
    if (hotspot) {
      let tapCount = 0;
      let tapTimer = null;
      const cycleReport = () => {
        const reps = window.reports || [];
        if (!reps.length) return;
        const cur = currentReport();
        const idx = reps.findIndex((r) => r && cur && r.id === cur.id);
        const next = reps[(idx + 1) % reps.length];
        if (!next) return;
        select.value = next.id;
        try { select.dispatchEvent(new Event('change', { bubbles: true })); } catch { select.dispatchEvent(new Event('change')); }
      };
      const onTap = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!tapTimer) {
          tapCount = 0;
          tapTimer = setTimeout(() => { tapTimer = null; tapCount = 0; }, 1200);
        }
        tapCount += 1;
        if (tapCount >= 5) {
          clearTimeout(tapTimer); tapTimer = null; tapCount = 0;
          cycleReport();
          try { if (navigator.vibrate) navigator.vibrate(30); } catch {}
        }
      };
      hotspot.addEventListener('pointerdown', onTap);
      hotspot.addEventListener('click', onTap);
    }

    // --- On-screen Kana Keyboard (bottom sheet) ---
    (function setupIME(){
      const baseBodyPadBottom = (() => { try { return parseFloat(getComputedStyle(document.body).paddingBottom) || 0; } catch { return 0; } })();
      const kanaColumns = ['ん','わ','ら','や','ま','は','な','た','さ','か','あ'];
      const rows = [
        // rows correspond to vowels あ/い/う/え/お, with blanks where not applicable
        ['ん','わ','ら','や','ま','は','な','た','さ','か','あ'],
        ['',  '', 'り','',  'み','ひ','に','ち','し','き','い'],
        ['',  '', 'る','ゆ','む','ふ','ぬ','つ','す','く','う'],
        ['',  '', 'れ','',  'め','へ','ね','て','せ','け','え'],
        ['',  'を','ろ','よ','も','ほ','の','と','そ','こ','お'],
      ];

      const smallMap = { 'あ':'ぁ','い':'ぃ','う':'ぅ','え':'ぇ','お':'ぉ','つ':'っ','や':'ゃ','ゆ':'ゅ','よ':'ょ','わ':'ゎ' };
      const dakutenMap = { 'か':'が','き':'ぎ','く':'ぐ','け':'げ','こ':'ご','さ':'ざ','し':'じ','す':'ず','せ':'ぜ','そ':'ぞ','た':'だ','ち':'ぢ','つ':'づ','て':'で','と':'ど','は':'ば','ひ':'び','ふ':'ぶ','へ':'べ','ほ':'ぼ','う':'ゔ' };
      const handakuMap = { 'は':'ぱ','ひ':'ぴ','ふ':'ぷ','へ':'ぺ','ほ':'ぽ' };

      let imeEl = document.getElementById('imeKeyboard');
      if (!imeEl) {
        imeEl = document.createElement('div');
        imeEl.id = 'imeKeyboard';
        const title = document.createElement('div'); title.className = 'ime-title'; title.textContent = '五十音キーボード';
        const wrap = document.createElement('div'); wrap.className = 'ime-wrap';
        // Right container to stack number row + main grid
        const right = document.createElement('div'); right.className = 'ime-right';

        // left side tools (vertical)
        const side = document.createElement('div'); side.className = 'ime-side';
        const sideDefs = [
          { id: 'dakuten', label: '゛', title: '濁点' },
          { id: 'handaku', label: '゜', title: '半濁点' },
          { id: 'small', label: '小', title: '小文字' },
          { id: 'choon', label: 'ー', title: '長音' },
          { id: 'back', label: '削除', title: '削除' },
        ];
        sideDefs.forEach((d) => { const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'ime-tool' + (d.toggle ? ' toggle' : ''); bt.dataset.action = d.id; bt.textContent = d.label; if (d.title) bt.title = d.title; side.appendChild(bt); });

        // number row (0..9) above kana grid
        const numbers = document.createElement('div'); numbers.className = 'ime-numbers';
        ;['0','1','2','3','4','5','6','7','8','9'].forEach((ch) => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'ime-key'; b.textContent = ch; b.dataset.char = ch; numbers.appendChild(b);
        });

        // main kana grid
        const grid = document.createElement('div'); grid.className = 'ime-grid';
        rows.forEach((row) => {
          row.forEach((ch) => {
            const b = document.createElement('button'); b.type = 'button'; b.className = 'ime-key';
            if (!ch) { b.disabled = true; b.textContent = ''; }
            else { b.textContent = ch; b.dataset.char = ch; }
            grid.appendChild(b);
          });
        });

        wrap.appendChild(side);
        right.appendChild(numbers);
        right.appendChild(grid);
        wrap.appendChild(right);

        // bottom tools (close only)
        const bottom = document.createElement('div'); bottom.className = 'ime-bottom';
        const close = document.createElement('button'); close.type = 'button'; close.className = 'ime-tool'; close.dataset.action = 'close'; close.textContent = '閉じる';
        bottom.appendChild(close);

        imeEl.appendChild(title); imeEl.appendChild(wrap); imeEl.appendChild(bottom); document.body.appendChild(imeEl);
      }

      let activeInput = null;

      let smallRevMap = null;
      let smallReg = null;
      function ensureAboveIME(input){
        if (!input) return;
        try {
          const doCalc = () => {
            const kb = imeEl.getBoundingClientRect();
            const r = input.getBoundingClientRect();
            const margin = 16;
            const safeBottom = kb.top - margin; // last visible y for input bottom
            const overlap = r.bottom - safeBottom;
            if (overlap > 0) {
              window.scrollBy({ top: overlap, left: 0, behavior: 'smooth' });
            }
          };
          requestAnimationFrame(doCalc);
          setTimeout(doCalc, 260); // run again after slide-up animation
        } catch {}
      }
      function applyBottomInset(){
        try {
          const h = imeEl.offsetHeight || imeEl.getBoundingClientRect().height || 0;
          document.body.style.paddingBottom = (baseBodyPadBottom + h + 16) + 'px';
        } catch {}
      }
      function clearBottomInset(){ try { document.body.style.paddingBottom = ''; } catch {} }
      function showIME(input){ activeInput = input; imeEl.classList.add('visible'); requestAnimationFrame(() => { applyBottomInset(); ensureAboveIME(input); setTimeout(() => { applyBottomInset(); ensureAboveIME(input); }, 260); }); }
      function hideIME(){ imeEl.classList.remove('visible'); activeInput = null; clearBottomInset(); const sm = imeEl.querySelector('.ime-tool.toggle'); if (sm) sm.classList.remove('active'); }

      function commitInputChanged(input){ try { input.dispatchEvent(new Event('input', { bubbles: true })); } catch { input.dispatchEvent(new Event('input')); } }
      function insertText(input, text){ if (!input) return; const s = input.selectionStart ?? input.value.length; const e = input.selectionEnd ?? s; const before = input.value.slice(0, s); const after = input.value.slice(e); input.value = before + text + after; const pos = s + text.length; try { input.setSelectionRange(pos, pos); } catch {} commitInputChanged(input); }
      function replacePrevCharWith(input, nextChar){ if (!input) return; const s = input.selectionStart ?? input.value.length; if (s <= 0) return; const before = input.value.slice(0, s-1); const after = input.value.slice(s); input.value = before + nextChar + after; const pos = (s-1) + nextChar.length; try { input.setSelectionRange(pos, pos); } catch {} commitInputChanged(input); }

      function applyDakuten(input){ const s = input.selectionStart ?? input.value.length; if (s <= 0) return; const prev = input.value.charAt(s-1); const rep = dakutenMap[prev]; if (rep) { replacePrevCharWith(input, rep); } }
      function applyHandakuten(input){ const s = input.selectionStart ?? input.value.length; if (s <= 0) return; const prev = input.value.charAt(s-1); const rep = handakuMap[prev]; if (rep) { replacePrevCharWith(input, rep); } }
      function applySmall(input){ const s = input.selectionStart ?? input.value.length; if (s <= 0) return; const prev = input.value.charAt(s-1); if (!smallRevMap) { smallRevMap = {}; Object.keys(smallMap).forEach(k => { smallRevMap[smallMap[k]] = k; }); smallReg = new RegExp('[' + Object.keys(smallRevMap).join('') + ']'); }
        if (smallMap[prev]) { replacePrevCharWith(input, smallMap[prev]); return; }
        if (smallRevMap[prev]) { replacePrevCharWith(input, smallRevMap[prev]); return; }
      }

      imeEl.addEventListener('click', (e) => {
        const t = e.target;
        if (!(t instanceof HTMLElement)) return;
        const char = t.dataset && t.dataset.char;
        const act = t.dataset && t.dataset.action;
        if (!activeInput) return;
        // Ensure input keeps focus
        try { activeInput.focus(); } catch {}
        if (char) {
          insertText(activeInput, char);
          return;
        }
        if (act) {
          if (act === 'dakuten') { applyDakuten(activeInput); return; }
          if (act === 'handaku') { applyHandakuten(activeInput); return; }
          if (act === 'small') { applySmall(activeInput); return; }
          if (act === 'choon') { insertText(activeInput, 'ー'); return; }
          if (act === 'back') {
            const s = activeInput.selectionStart ?? activeInput.value.length; const e2 = activeInput.selectionEnd ?? s; if (s === e2 && s > 0) { activeInput.setSelectionRange(s-1, e2); }
            insertText(activeInput, ''); return;
          }
          if (act === 'close') { hideIME(); return; }
        }
      });

      // show/hide behavior
      page.addEventListener('pointerdown', (e) => {
        const t = e.target;
        const isInput = t && t.classList && t.classList.contains('blank-input');
        if (isInput && !t.readOnly) {
          // Block default focus to avoid OS keyboard; then focus programmatically
          try { e.preventDefault(); } catch {}
          // Fallback for older mobile browsers: temporarily readonly to suppress OS keyboard
          const wasRO = !!t.readOnly; try { t.readOnly = true; } catch {}
          showIME(t);
          try { t.focus(); } catch {}
          // Re-enable editing if it wasn't readonly originally
          setTimeout(() => { try { if (!wasRO) t.readOnly = false; } catch {} }, 0);
        } else {
          // hide if clicking outside inputs and outside keyboard
          const path = e.composedPath ? e.composedPath() : [];
          if (!(t && (imeEl.contains(t) || (t.classList && t.classList.contains('blank-input')))) && !path.includes(imeEl)) {
            hideIME();
          }
        }
      });
      // Also hide when tapping outside on the document
      document.addEventListener('pointerdown', (e) => {
        if (!imeEl.classList.contains('visible')) return;
        const t = e.target;
        if (t && (imeEl.contains(t) || (t.classList && t.classList.contains('blank-input')))) return;
        hideIME();
      }, true);
      document.addEventListener('focusin', (e) => { const t = e.target; if (t && t.classList && t.classList.contains('blank-input') && !t.readOnly) { showIME(t); } });
      window.addEventListener('resize', () => { if (imeEl.classList.contains('visible')) { applyBottomInset(); if (activeInput) ensureAboveIME(activeInput); } });
    })();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
