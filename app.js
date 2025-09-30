// app.js
// 動的にレポートを描画し、入力をローカル保存します。

(function () {
  const page = document.getElementById('page');
  const select = document.getElementById('reportSelect');
  const resetBtn = document.getElementById('resetBtn');
  const printBtn = document.getElementById('printBtn');

  // --- helpers ---
  const lsKey = (id) => `report:${id}:answers`;

  function longestLen(arr) {
    return arr.reduce((m, s) => Math.max(m, [...String(s)].length), 0);
  }

  function saveAnswers(id) {
    const data = {};
    page.querySelectorAll('[data-field-id]').forEach((el) => {
      data[el.dataset.fieldId] = el.value || '';
    });
    try { localStorage.setItem(lsKey(id), JSON.stringify(data)); } catch {}
  }

  function loadAnswers(id) {
    try { return JSON.parse(localStorage.getItem(lsKey(id)) || '{}'); } catch { return {}; }
  }

  function clearAnswers(id) {
    try { localStorage.removeItem(lsKey(id)); } catch {}
  }

  function setChWidth(el, ch) {
    const n = Math.max(3, Number(ch) || 0);
    el.style.setProperty('--ch', n);
  }

  // Pixel-based measurement to avoid clipping.
  const __measure = (() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    return function measure(text, el) {
      const cs = getComputedStyle(el);
      const font = cs.font || `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
      ctx.font = font;
      return ctx.measureText(String(text || '')).width;
    };
  })();

  function applyExactPixelWidth(el, text, extra = 0) {
    const cs = getComputedStyle(el);
    const pad = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
    const border = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
    const w = __measure(text, el) + pad + border + extra;
    el.style.width = `${Math.ceil(w)}px`;
  }

  // Count visual width: treat full-width/CJK chars as 2.
  function isWideChar(codePoint) {
    return (
      // Hangul Jamo + Syllables
      (codePoint >= 0x1100 && codePoint <= 0x11FF) ||
      (codePoint >= 0xAC00 && codePoint <= 0xD7A3) ||
      // CJK ranges and symbols
      (codePoint >= 0x2E80 && codePoint <= 0xA4CF) ||
      (codePoint >= 0xF900 && codePoint <= 0xFAFF) ||
      (codePoint >= 0xFE10 && codePoint <= 0xFE19) ||
      (codePoint >= 0xFE30 && codePoint <= 0xFE6F) ||
      (codePoint >= 0xFF00 && codePoint <= 0xFF60) ||
      (codePoint >= 0xFFE0 && codePoint <= 0xFFE6)
    );
  }

  function displayWidth(str) {
    let w = 0;
    for (const ch of String(str || '')) {
      const cp = ch.codePointAt(0);
      w += isWideChar(cp) ? 2 : 1;
    }
    return w;
  }

  function appendString(container, str) {
    const parts = String(str).split('\n');
    parts.forEach((p, i) => {
      if (i > 0) container.appendChild(document.createElement('br'));
      container.appendChild(document.createTextNode(p));
    });
  }

  function renderTokens(container, tokens, answers, reportId) {
    tokens.forEach((t) => {
      if (typeof t === 'string') {
        appendString(container, t);
        return;
      }

      if (t.kind === 'text') {
        const wrap = document.createElement('span');
        wrap.className = 'blank';
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'blank-input';
        input.placeholder = t.placeholder || '';
        input.setAttribute('title', t.placeholder ? `例: ${t.placeholder}` : '自由記述');
        input.dataset.fieldId = t.id;
        input.value = answers[t.id] || '';
        const DEFAULT_SCALE = 2; // デフォルトは今の約2倍
        const baseRaw = t.size != null ? t.size : (t.placeholder ? displayWidth(t.placeholder) : 6) * DEFAULT_SCALE;
        setChWidth(input, baseRaw);
        // Pixel width for no clipping
        const baseText = t.placeholder || '';
        applyExactPixelWidth(input, baseText);
        input.addEventListener('input', () => {
          // Update pixel width to fit current value exactly
          applyExactPixelWidth(input, input.value || baseText);
          saveAnswers(reportId);
        });
        wrap.appendChild(input);
        container.appendChild(wrap);
        return;
      }

      if (t.kind === 'choice') {
        const wrap = document.createElement('span');
        wrap.className = 'blank';
        const sel = document.createElement('select');
        sel.className = 'blank-select';
        sel.dataset.fieldId = t.id;
        const opts = (t.options || []).map(String);
        const placeholder = `（${opts.join('・')}）`;
        const empty = document.createElement('option');
        empty.value = '';
        empty.textContent = placeholder; // 選ぶ前に候補を表示
        sel.appendChild(empty);
        opts.forEach((opt) => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          sel.appendChild(o);
        });
        sel.value = answers[t.id] || '';
        const DEFAULT_SCALE = 2; // デフォルトは今の約2倍
        const widestOpt = opts.reduce((m, s) => Math.max(m, displayWidth(s)), 0);
        const baseRaw = t.size != null
          ? t.size
          : Math.max(displayWidth(placeholder), widestOpt) * DEFAULT_SCALE;
        setChWidth(sel, baseRaw);
        const currentText = sel.options[sel.selectedIndex]?.text || placeholder;
        // Add extra width for dropdown arrow
        applyExactPixelWidth(sel, currentText, 18);
        sel.addEventListener('change', () => {
          const text = sel.options[sel.selectedIndex]?.text || placeholder;
          applyExactPixelWidth(sel, text, 18);
          saveAnswers(reportId);
        });
        wrap.appendChild(sel);
        container.appendChild(wrap);
      }
    });
  }

  function renderReport(report) {
    page.innerHTML = '';

    const answers = loadAnswers(report.id);

    const header = document.createElement('div');
    header.className = 'page-header';
    const t = document.createElement('div');
    t.className = 'title';
    t.textContent = report.title || report.name || '違和感レポート';
    const st = document.createElement('div');
    st.className = 'subtitle';
    st.textContent = report.subtitle || '';
    header.appendChild(t);
    if (report.subtitle) header.appendChild(st);
    page.appendChild(header);

    (report.sections || []).forEach((sec) => {
      const section = document.createElement('section');
      section.className = 'section';
      const h = document.createElement('div');
      h.className = 'section-title';
      h.textContent = sec.title || '';
      section.appendChild(h);

      (sec.blocks || []).forEach((blk) => {
        if (blk.title) {
          const bt = document.createElement('div');
          bt.className = 'block-title';
          bt.textContent = blk.title;
          section.appendChild(bt);
        }
        const p = document.createElement('p');
        p.className = 'paragraph';
        renderTokens(p, blk.tokens || [], answers, report.id);
        section.appendChild(p);
      });

      page.appendChild(section);
    });

    const notes = document.createElement('div');
    notes.className = 'notes';
    notes.innerHTML = '空欄はタップして入力/選択できます。入力内容は端末内に自動保存されます。';
    page.appendChild(notes);
  }

  // --- bootstrap ---
  function populateSelect() {
    select.innerHTML = '';
    (window.reports || []).forEach((r) => {
      const o = document.createElement('option');
      o.value = r.id;
      o.textContent = r.name || r.title || r.id;
      select.appendChild(o);
    });
  }

  function currentReport() {
    const id = select.value;
    return (window.reports || []).find((r) => r.id === id) || window.reports[0];
  }

  function init() {
    populateSelect();
    const first = window.reports && window.reports[0];
    if (first) select.value = first.id;
    renderReport(currentReport());

    select.addEventListener('change', () => {
      renderReport(currentReport());
    });

    resetBtn.addEventListener('click', () => {
      const r = currentReport();
      if (!r) return;
      if (confirm('このレポートの入力内容をリセットしますか？')) {
        clearAnswers(r.id);
        renderReport(r);
      }
    });

    printBtn.addEventListener('click', () => window.print());
  }

  document.addEventListener('DOMContentLoaded', init);
})();
