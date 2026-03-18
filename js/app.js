/**
 * Notebook Blog – app.js
 * Loads subject JSON files from /main/ and renders notes + mind maps.
 */

// List of subject JSON files located in /main/
const SUBJECTS = [
  'main/matematicas.json',
  'main/historia.json',
  'main/biologia.json',
  'main/programacion.json'
];

// Palette for branch / sub-node colours (cycles through subjects)
const PALETTES = {
  '#4a90d9': { branch: '#2980b9', sub: '#85c1e9' },
  '#c0392b': { branch: '#a93226', sub: '#e59b94' },
  '#27ae60': { branch: '#1e8449', sub: '#82e0aa' },
  '#8e44ad': { branch: '#76389a', sub: '#c39bd3' }
};

// ── State ──────────────────────────────────────────────────────────────────
let subjects = [];     // loaded subject objects
let activeIndex = -1;  // currently displayed subject index

// ── Signature modal state ──────────────────────────────────────────────────
let sigModal = null;
let modalCanvas = null;
let modalCtx = null;
let modalDrawing = false;
let modalLastX = 0;
let modalLastY = 0;
let modalOnSave = null; // callback when save is confirmed

// ── Bootstrap ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderLoadingState();
  initSignatureModal();
  try {
    subjects = await loadAllSubjects();
    buildSidebar();
    showWelcome();
  } catch (err) {
    console.error('Error loading subjects:', err);
    document.getElementById('main-content').innerHTML =
      '<div class="empty-state"><p>⚠️ No se pudieron cargar las materias.</p></div>';
  }
}

// ── Data loading ───────────────────────────────────────────────────────────
async function loadAllSubjects() {
  const results = await Promise.all(
    SUBJECTS.map(path =>
      fetch(path)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
          return r.json();
        })
        .catch(err => {
          console.warn(`Could not load ${path}:`, err);
          return null;
        })
    )
  );
  return results.filter(Boolean);
}

// ── Sidebar ────────────────────────────────────────────────────────────────
function buildSidebar() {
  const nav = document.getElementById('subject-nav');
  nav.innerHTML = '';

  subjects.forEach((subject, i) => {
    const btn = document.createElement('button');
    btn.className = 'subject-btn';
    btn.style.setProperty('--accent', subject.color);
    btn.setAttribute('aria-label', `Ver materia: ${subject.materia}`);
    btn.innerHTML = `
      <span class="icon">${subject.icono}</span>
      <span class="label">
        ${escapeHtml(subject.materia)}
        <small>${escapeHtml(subject.profesor)}</small>
      </span>`;
    btn.addEventListener('click', () => selectSubject(i));
    nav.appendChild(btn);
  });
}

// ── Subject view ───────────────────────────────────────────────────────────
function selectSubject(index) {
  activeIndex = index;

  // Update sidebar active state
  document.querySelectorAll('.subject-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === index);
  });

  const subject = subjects[index];
  const container = document.getElementById('main-content');
  container.innerHTML = renderSubject(subject);

  // Bind mind-map toggle buttons after render
  container.querySelectorAll('.mindmap-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const mapEl = btn.nextElementSibling;
      const isOpen = btn.classList.toggle('open');
      mapEl.classList.toggle('visible', isOpen);
      btn.querySelector('.arrow').textContent = isOpen ? '▲' : '▼';
    });
  });

  // Bind signature events after render
  bindSignatureEvents(container);
}

// ── Rendering ──────────────────────────────────────────────────────────────
function renderLoadingState() {
  document.getElementById('main-content').innerHTML =
    '<div class="loading"><div class="spinner"></div><p>Cargando materias…</p></div>';
}

function showWelcome() {
  const container = document.getElementById('main-content');

  container.innerHTML = `
    <div class="welcome">
      <div class="notebook-cover">📓</div>
      <h2>Bienvenido a tu Libreta de Notas</h2>
      <p>Selecciona una materia en la barra lateral o toca uno de los accesos directos para ver los apuntes.</p>
      <div class="subject-pills" id="welcome-pills"></div>
    </div>`;

  const pillsContainer = container.querySelector('#welcome-pills');
  subjects.forEach((s, i) => {
    const btn = document.createElement('button');
    btn.className = 'pill-btn';
    btn.style.setProperty('--pill-color', s.color);
    btn.textContent = `${s.icono} ${s.materia}`;
    btn.addEventListener('click', () => selectSubject(i));
    pillsContainer.appendChild(btn);
  });
}

function renderSubject(subject) {
  const palette = PALETTES[subject.color] || { branch: '#555', sub: '#aaa' };

  const notesHtml = subject.apuntes
    .map((note, i) => renderNote(note, i + 1, subject.color, palette, subject.materia))
    .join('');

  return `
    <div class="subject-header">
      <div class="badge" style="background:${subject.color}">
        ${subject.icono} ${escapeHtml(subject.materia)}
      </div>
      <h2>${escapeHtml(subject.materia)}</h2>
      <div class="meta">
        <span>👨‍🏫 ${escapeHtml(subject.profesor)}</span>
        <span>📖 ${escapeHtml(subject.descripcion)}</span>
        <span class="note-count">${subject.apuntes.length} apunte${subject.apuntes.length !== 1 ? 's' : ''}</span>
      </div>
    </div>
    <div class="notes-grid">${notesHtml}</div>`;
}

function renderNote(note, num, color, palette, subjectName) {
  const dateStr = formatDate(note.fecha);
  const mapHtml = renderMindMap(note.mapa_mental, color, palette);
  const sigHtml = renderSignatureSection(subjectName, note.id);

  return `
    <article class="note-card">
      <div class="note-card-header">
        <div class="note-number" style="background:${color}">${num}</div>
        <div class="info">
          <h3>${escapeHtml(note.titulo)}</h3>
          <div class="note-meta">
            <span>📅 ${dateStr}</span>
            <span>🏷️ Apunte #${note.id}</span>
          </div>
        </div>
      </div>
      <div class="note-body">${escapeHtml(note.contenido)}</div>
      <div class="mindmap-section">
        <button class="mindmap-toggle" aria-expanded="false">
          🗺️ Mapa mental – ${escapeHtml(note.mapa_mental.nodo_central)}
          <em class="arrow">▼</em>
        </button>
        <div class="mindmap-container">${mapHtml}</div>
      </div>
      ${sigHtml}
    </article>`;
}

function renderMindMap(map, rootColor, palette) {
  const branchesHtml = map.ramas
    .map(rama => {
      const subNodesHtml = rama.subtemas
        .map(s => `<div class="sub-node" style="--sub-color:${palette.sub};color:${palette.branch}">${escapeHtml(s)}</div>`)
        .join('');
      return `
        <div class="branch" style="--branch-color:${palette.branch};--sub-color:${palette.sub}">
          <div class="branch-node" style="background:${palette.branch}">${escapeHtml(rama.tema)}</div>
          <div class="sub-nodes">${subNodesHtml}</div>
        </div>`;
    })
    .join('');

  return `
    <div class="tree" style="--branch-color:${palette.branch}">
      <div class="tree-root">
        <div class="tree-root-node" style="background:${rootColor};--branch-color:${palette.branch}">
          ${escapeHtml(map.nodo_central)}
        </div>
      </div>
      <div class="tree-branches">${branchesHtml}</div>
    </div>`;
}

// ── Helpers ────────────────────────────────────────────────────────────────
function formatDate(isoDate) {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
  ];
  const m = parseInt(month, 10) - 1;
  return `${parseInt(day, 10)} de ${months[m]} de ${year}`;
}

function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Signatures ─────────────────────────────────────────────────────────────
function sigStorageKey(subjectName, noteId) {
  return `nb_sig_${encodeURIComponent(subjectName)}_${noteId}`;
}

function renderSignatureSection(subjectName, noteId) {
  const existing = localStorage.getItem(sigStorageKey(subjectName, noteId));
  const displayHtml = existing
    ? `<img class="sig-image" src="${existing}" alt="Firma guardada" />`
    : '<p class="sig-empty">Sin firma registrada</p>';
  const deleteBtn = existing
    ? `<button class="sig-btn sig-delete" aria-label="Borrar firma">🗑️ Borrar</button>`
    : '';

  return `
    <div class="signature-section" data-subject="${escapeHtml(subjectName)}" data-note-id="${noteId}">
      <div class="signature-header">✍️ Firma de comprobante</div>
      <div class="signature-display">${displayHtml}</div>
      <div class="signature-actions">
        <button class="sig-btn sig-open-pad">${existing ? '✏️ Editar firma' : '✍️ Agregar firma'}</button>
        ${deleteBtn}
      </div>
    </div>`;
}

function bindSignatureEvents(container) {
  container.querySelectorAll('.signature-section').forEach(section => {
    const subjectName = section.dataset.subject;
    const noteId = section.dataset.noteId;

    section.querySelector('.sig-open-pad').addEventListener('click', () => {
      openSignatureModal(subjectName, noteId, section);
    });

    const existingDelBtn = section.querySelector('.sig-delete');
    if (existingDelBtn) {
      existingDelBtn.addEventListener('click', () => handleDeleteSignature(section, subjectName, noteId));
    }
  });
}

function handleDeleteSignature(section, subjectName, noteId) {
  localStorage.removeItem(sigStorageKey(subjectName, noteId));
  section.querySelector('.signature-display').innerHTML =
    '<p class="sig-empty">Sin firma registrada</p>';
  section.querySelector('.sig-open-pad').textContent = '✍️ Agregar firma';
  const delBtn = section.querySelector('.sig-delete');
  if (delBtn) delBtn.remove();
}

// ── Fullscreen signature modal ─────────────────────────────────────────────
function initSignatureModal() {
  sigModal = document.createElement('div');
  sigModal.className = 'sig-modal';
  sigModal.setAttribute('role', 'dialog');
  sigModal.setAttribute('aria-modal', 'true');
  sigModal.setAttribute('aria-label', 'Área de firma');
  sigModal.innerHTML = `
    <div class="sig-modal-header">
      <span class="sig-modal-title">✍️ Firma de comprobante</span>
      <button class="sig-modal-close" aria-label="Cerrar">✖ Cerrar</button>
    </div>
    <div class="sig-modal-hint">Dibuja tu firma en el área de abajo</div>
    <div class="sig-modal-canvas-wrap">
      <canvas aria-label="Área de firma"></canvas>
    </div>
    <div class="sig-modal-actions">
      <button class="sig-btn sig-delete" id="sig-modal-clear">🧹 Limpiar</button>
      <button class="sig-btn sig-save" id="sig-modal-save">💾 Guardar firma</button>
    </div>`;
  document.body.appendChild(sigModal);

  modalCanvas = sigModal.querySelector('canvas');
  modalCtx = modalCanvas.getContext('2d');

  function getPos(e) {
    const rect = modalCanvas.getBoundingClientRect();
    const scaleX = modalCanvas.width / rect.width;
    const scaleY = modalCanvas.height / rect.height;
    const src = e.touches ? e.touches[0] : e;
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY
    };
  }

  function startDraw(e) {
    e.preventDefault();
    modalDrawing = true;
    const pos = getPos(e);
    modalLastX = pos.x;
    modalLastY = pos.y;
  }

  function draw(e) {
    if (!modalDrawing) return;
    e.preventDefault();
    const pos = getPos(e);
    modalCtx.beginPath();
    modalCtx.moveTo(modalLastX, modalLastY);
    modalCtx.lineTo(pos.x, pos.y);
    modalCtx.strokeStyle = '#1a1a2e';
    modalCtx.lineWidth = 2.5;
    modalCtx.lineCap = 'round';
    modalCtx.lineJoin = 'round';
    modalCtx.stroke();
    modalLastX = pos.x;
    modalLastY = pos.y;
  }

  function endDraw() { modalDrawing = false; }

  modalCanvas.addEventListener('mousedown', startDraw);
  modalCanvas.addEventListener('mousemove', draw);
  modalCanvas.addEventListener('mouseup', endDraw);
  modalCanvas.addEventListener('mouseleave', endDraw);
  modalCanvas.addEventListener('touchstart', startDraw, { passive: false });
  modalCanvas.addEventListener('touchmove', draw, { passive: false });
  modalCanvas.addEventListener('touchend', endDraw);

  // Block all touch-scroll events inside the modal so the page never moves
  sigModal.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

  sigModal.querySelector('.sig-modal-close').addEventListener('click', closeSignatureModal);

  document.getElementById('sig-modal-clear').addEventListener('click', () => {
    modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
  });

  document.getElementById('sig-modal-save').addEventListener('click', () => {
    const composite = document.createElement('canvas');
    composite.width = modalCanvas.width;
    composite.height = modalCanvas.height;
    const cCtx = composite.getContext('2d');
    cCtx.fillStyle = '#ffffff';
    cCtx.fillRect(0, 0, composite.width, composite.height);
    cCtx.drawImage(modalCanvas, 0, 0);
    const dataUrl = composite.toDataURL('image/jpeg', 0.7);
    if (!dataUrl.startsWith('data:image/')) return;
    if (modalOnSave) modalOnSave(dataUrl);
    closeSignatureModal();
  });
}

function openSignatureModal(subjectName, noteId, section) {
  sigModal.classList.add('open');
  document.body.classList.add('no-scroll');

  // Size the canvas to fill the wrap after the modal is visible
  requestAnimationFrame(() => {
    const wrap = sigModal.querySelector('.sig-modal-canvas-wrap');
    const rect = wrap.getBoundingClientRect();
    modalCanvas.width = Math.round(rect.width);
    modalCanvas.height = Math.round(rect.height);
    modalCtx.clearRect(0, 0, modalCanvas.width, modalCanvas.height);
  });

  modalOnSave = (dataUrl) => {
    localStorage.setItem(sigStorageKey(subjectName, noteId), dataUrl);

    // Update the displayed signature thumbnail
    const display = section.querySelector('.signature-display');
    display.innerHTML = `<img class="sig-image" src="${dataUrl}" alt="Firma guardada" />`;

    // Update open-pad button label
    section.querySelector('.sig-open-pad').textContent = '✏️ Editar firma';

    // Ensure the delete button exists and has a handler
    const actions = section.querySelector('.signature-actions');
    if (!actions.querySelector('.sig-delete')) {
      const delBtn = document.createElement('button');
      delBtn.className = 'sig-btn sig-delete';
      delBtn.setAttribute('aria-label', 'Borrar firma');
      delBtn.textContent = '🗑️ Borrar';
      delBtn.addEventListener('click', () => handleDeleteSignature(section, subjectName, noteId));
      actions.appendChild(delBtn);
    }
  };
}

function closeSignatureModal() {
  sigModal.classList.remove('open');
  document.body.classList.remove('no-scroll');
  modalOnSave = null;
  modalDrawing = false;
}
