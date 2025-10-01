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

  function renderTokens(container, tokens, answers, reportId, options = {}) {
    const useSolutions = !!options.showSolutions;
    const DEFAULT_SCALE = 2;
    tokens.forEach((t) => {
      if (typeof t === 'string') { appendString(container, t); return; }
      if (t.kind === 'text') {
        const wrap = document.createElement('span'); wrap.className = 'blank';
        const input = document.createElement('input'); input.type = 'text'; input.className = 'blank-input';
        input.placeholder = t.placeholder || '';
        if (t.placeholder) input.setAttribute('title', `例: ${t.placeholder}`);
        input.dataset.fieldId = t.id;
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
        const sel = document.createElement('select'); sel.className = 'blank-select'; sel.dataset.fieldId = t.id;
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

    select.addEventListener('change', () => { showSolutions = false; if (solutionBtn) { solutionBtn.classList.remove('active'); solutionBtn.textContent = '正解確認'; } renderReport(currentReport(), { showSolutions }); });
    if (resetBtn) resetBtn.addEventListener('click', () => { const r = currentReport(); if (!r) return; if (confirm('このレポートの入力内容をリセットしますか？')) { clearAnswers(r.id); renderReport(r, { showSolutions }); } });
    if (solutionBtn) solutionBtn.addEventListener('click', () => { showSolutions = !showSolutions; solutionBtn.classList.toggle('active', showSolutions); solutionBtn.textContent = showSolutions ? '解答を隠す' : '正解確認'; renderReport(currentReport(), { showSolutions }); });
    if (printBtn) printBtn.addEventListener('click', () => window.print());
  }

  document.addEventListener('DOMContentLoaded', init);
})();
