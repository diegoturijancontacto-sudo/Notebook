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

// ── Bootstrap ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);

async function init() {
  renderLoadingState();
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
    .map((note, i) => renderNote(note, i + 1, subject.color, palette))
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

function renderNote(note, num, color, palette) {
  const dateStr = formatDate(note.fecha);
  const mapHtml = renderMindMap(note.mapa_mental, color, palette);

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
