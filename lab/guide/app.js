(function () {
  const steps = window.LAB_STEPS;
  const $ = (id) => document.getElementById(id);

  const store = {
    get(k, d) { try { const v = localStorage.getItem('jaizlab.' + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem('jaizlab.' + k, JSON.stringify(v)); } catch { /* ignore */ } }
  };

  let current = Math.min(store.get('step', 0), steps.length - 1);
  let done = new Set(store.get('done', []));

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // ---------- render blocks ----------
  function renderBlock(b) {
    switch (b.t) {
      case 'p': return `<p>${b.html}</p>`;
      case 'h': return `<h3>${b.html}</h3>`;
      case 'file': return `<div class="file-tag">📄 ${esc(b.path)}</div>`;
      case 'list': {
        const tag = b.ordered ? 'ol' : 'ul';
        return `<${tag}>${b.items.map(i => `<li>${i}</li>`).join('')}</${tag}>`;
      }
      case 'explain':
        return `<h3>Explain</h3><ul>${b.items.map(i => `<li>${i}</li>`).join('')}</ul>`;
      case 'code': {
        const id = 'c' + Math.random().toString(36).slice(2);
        return `<div class="code"><div class="code-head"><span class="label">${esc(b.label || 'Terminal')}</span>` +
          `<button class="copy" data-target="${id}">Copy</button></div><pre id="${id}">${esc(b.text)}</pre></div>`;
      }
      case 'diagram': return `<pre class="diagram">${esc(b.text)}</pre>`;
      case 'table':
        return `<table><thead><tr>${b.head.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>` +
          b.rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('') + `</tbody></table>`;
      case 'trainer': return box('trainer', b.title || 'Trainer: say / ask', b.html);
      case 'expected': return box('expected', 'Expected result', b.html);
      case 'warn': return box('warn', b.title || 'Important', b.html);
      case 'lab': return box('lab', b.title || 'Web lab tip', b.html);
      default: return '';
    }
  }
  const box = (cls, title, html) => `<div class="box ${cls}"><div class="box-title">${title}</div>${html}</div>`;

  // ---------- parts menu ----------
  const parts = [];
  steps.forEach((s, i) => { if (!parts.length || parts[parts.length - 1].name !== s.part) parts.push({ name: s.part, first: i }); });
  $('partSelect').innerHTML = parts.map(p => `<option value="${p.first}">${esc(p.name)}</option>`).join('');
  $('partSelect').addEventListener('change', (e) => go(+e.target.value));

  // ---------- show step ----------
  function show() {
    const s = steps[current];
    $('stepMeta').textContent = s.part;
    $('stepTitle').textContent = s.title;
    $('stepBody').innerHTML = s.body.map(renderBlock).join('');
    $('stepCounter').textContent = `Step ${current + 1} of ${steps.length}`;
    $('prevBtn').disabled = current === 0;
    $('nextBtn').disabled = current === steps.length - 1;
    $('doneBox').checked = done.has(current);
    const part = parts.filter(p => p.first <= current).pop();
    $('partSelect').value = part.first;
    const pct = Math.round((done.size / steps.length) * 100);
    $('progressBar').style.width = pct + '%';
    $('progressText').textContent = `${done.size}/${steps.length} done`;
    $('stepScroll').scrollTop = 0;
    store.set('step', current);
  }
  function go(i) { current = Math.max(0, Math.min(steps.length - 1, i)); show(); }

  $('prevBtn').onclick = () => go(current - 1);
  $('nextBtn').onclick = () => { done.add(current); store.set('done', [...done]); go(current + 1); };
  $('doneBox').onchange = (e) => {
    e.target.checked ? done.add(current) : done.delete(current);
    store.set('done', [...done]); show();
  };

  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowRight') $('nextBtn').click();
    else if (e.key === 'ArrowLeft') go(current - 1);
    else if (e.key === 'g' || e.key === 'G') toggleGuide();
  });

  // ---------- copy buttons ----------
  $('stepBody').addEventListener('click', async (e) => {
    const btn = e.target.closest('.copy');
    if (!btn) return;
    const text = $(btn.dataset.target).textContent;
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta);
      ta.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } ta.remove();
    }
    btn.textContent = ok ? 'Copied ✓' : 'Copy failed';
    btn.classList.toggle('ok', ok);
    setTimeout(() => { btn.textContent = 'Copy'; btn.classList.remove('ok'); }, 1500);
  });

  // ---------- font size ----------
  let fs = store.get('fs', 17);
  const applyFs = () => { document.documentElement.style.setProperty('--fs', fs + 'px'); store.set('fs', fs); };
  $('fontUp').onclick = () => { fs = Math.min(fs + 1, 28); applyFs(); };
  $('fontDown').onclick = () => { fs = Math.max(fs - 1, 12); applyFs(); };
  applyFs();

  // ---------- guide toggle ----------
  function toggleGuide() {
    const hidden = $('split').classList.toggle('guide-hidden');
    $('toggleGuide').textContent = hidden ? '⇥ Guide' : '⇤ Guide';
    store.set('hidden', hidden);
  }
  $('toggleGuide').onclick = toggleGuide;
  if (store.get('hidden', false)) toggleGuide();

  // ---------- resizable divider ----------
  const guide = $('guide'), divider = $('divider');
  const savedW = store.get('width', null);
  if (savedW) guide.style.width = savedW;
  divider.addEventListener('mousedown', (e) => {
    e.preventDefault();
    document.body.classList.add('dragging'); divider.classList.add('dragging');
    const move = (ev) => {
      const pct = Math.max(20, Math.min(75, (ev.clientX / window.innerWidth) * 100));
      guide.style.width = pct + '%';
    };
    const up = () => {
      document.body.classList.remove('dragging'); divider.classList.remove('dragging');
      store.set('width', guide.style.width);
      window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up);
    };
    window.addEventListener('mousemove', move); window.addEventListener('mouseup', up);
  });

  show();
})();
