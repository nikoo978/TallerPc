import {
  getSettings,
  saveSettings,
  getBudgets,
  getBudget,
  saveBudget,
  deleteBudget,
  getQuickTemplates,
  saveQuickTemplate,
  deleteQuickTemplate,
  replaceAllData,
  getCloudSettingsCache,
  saveCloudSettingsCache,
  getCloudBudgetsCache,
  getCloudBudgetCache,
  saveCloudBudgetCache,
  deleteCloudBudgetCache,
  getCloudQuickTemplatesCache,
  saveCloudQuickTemplateCache,
  deleteCloudQuickTemplateCache,
  replaceCloudCache,
  clearCloudCache
} from './db.js';
import {
  isCloudConfigured,
  initializeCloud,
  getCloudUser,
  signInCloud,
  signUpCloud,
  signOutCloud,
  fetchCloudSnapshot,
  upsertCloudSettings,
  upsertCloudBudget,
  upsertCloudQuickTemplate,
  deleteCloudBudget,
  deleteCloudQuickTemplate,
  flushCloudQueue
} from './cloud.js';

const LEGACY_DEFAULT_TERMS = `El presente presupuesto se basa en la revisión técnica y en las condiciones observables al momento del diagnóstico. Fallas ocultas o adicionales detectadas durante el desarme o las pruebas podrán requerir una nueva autorización.
No se realizarán trabajos, cambios de repuestos ni ampliaciones del alcance sin autorización del cliente cuando impliquen costos adicionales.
La garantía cubre exclusivamente los repuestos provistos y la mano de obra detallada durante el plazo indicado. No cubre golpes, líquidos, sobretensiones externas, fallas ajenas a la reparación, intervenciones de terceros, malware ni uso inadecuado.
La disponibilidad y el precio de repuestos pueden variar hasta la aceptación del presupuesto. Cuando corresponda, se informará si el repuesto es nuevo, alternativo, reacondicionado o provisto por el cliente.
La recuperación o conservación de información no se garantiza salvo que se haya contratado expresamente un servicio de copia o recuperación de datos. Las unidades con fallas físicas pueden requerir evaluación especializada.
El cliente declara haber informado accesorios, claves y condiciones relevantes del equipo. Todo elemento recibido debe quedar asentado en la orden.
La aceptación del presupuesto autoriza únicamente los trabajos detallados. Cualquier modificación será informada antes de ejecutarse.`;

const DEFAULT_TERMS = `El presupuesto comprende exclusivamente los trabajos, materiales/repuestos y valores detallados. La aceptación autoriza ese alcance y no otros trabajos distintos o adicionales.
Todo servicio, material o costo adicional no incluido que resulte necesario durante la intervención será informado al cliente antes de realizarse, conforme al art. 22 de la Ley 24.240, salvo la excepción legal allí prevista.
En reparaciones se emplearán materiales nuevos o adecuados al equipo, salvo que en el presupuesto se identifique expresamente otra condición —por ejemplo usado, reacondicionado o provisto por el cliente— y exista acuerdo informado.
La garantía ofrecida rige por el plazo indicado para el trabajo y los repuestos provistos por el taller, desde la entrega o finalización efectiva del servicio. Será atendida por el prestador identificado en este documento, sin perjuicio de los derechos que correspondan al consumidor por la Ley 24.240.
Si dentro de los treinta (30) días posteriores a la conclusión del servicio se evidencian deficiencias o defectos del trabajo, se aplicará el régimen previsto por el art. 23 de la Ley 24.240, sin perjuicio de una garantía contractual más amplia cuando corresponda.
La recuperación o conservación de información requiere acuerdo específico y no puede garantizarse cuando el estado físico o lógico de la unidad lo impida. El cliente debe informar previamente si necesita copia de seguridad.
Los datos personales se utilizan para gestionar la relación de servicio y deben tratarse con confidencialidad y medidas de seguridad adecuadas. Las claves o PIN solo deben registrarse cuando sean estrictamente necesarios para la tarea técnica.
Ninguna cláusula de este documento limita derechos inderogables del consumidor. En caso de duda se aplicará la normativa de consumo vigente y la interpretación más favorable al consumidor.`;

const BRAND_PROFILE_VERSION = 5;
const DEFAULT_MARK_URL = './tech-mark.svg';
const THEME_STORAGE_KEY = 'presupuesto-tecnico-2-theme';
const PDF_DEPENDENCY_URLS = ['https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/+esm', 'https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm'];

const ACCENT_PALETTES = [
  { id: 'cyan', label: 'Cian técnico', color: '#20bdf2', strong: '#087ca1', ink: '#05627e', rgb: '32 189 242', on: '#03131c' },
  { id: 'blue', label: 'Azul cobalto', color: '#5b8cff', strong: '#315ec7', ink: '#244aa3', rgb: '91 140 255', on: '#06111c' },
  { id: 'teal', label: 'Turquesa', color: '#25c7b7', strong: '#138c82', ink: '#0b7169', rgb: '37 199 183', on: '#041512' },
  { id: 'green', label: 'Esmeralda', color: '#4bd47b', strong: '#209950', ink: '#16783d', rgb: '75 212 123', on: '#06140b' },
  { id: 'lime', label: 'Lima', color: '#a6d84e', strong: '#6d9c24', ink: '#567c18', rgb: '166 216 78', on: '#101604' },
  { id: 'amber', label: 'Ámbar', color: '#f2b84b', strong: '#b77a12', ink: '#8f5e09', rgb: '242 184 75', on: '#181004' },
  { id: 'orange', label: 'Naranja', color: '#ff8a3d', strong: '#c85d16', ink: '#a9470c', rgb: '255 138 61', on: '#1b0b02' },
  { id: 'coral', label: 'Coral', color: '#ff6f70', strong: '#c83e46', ink: '#a92d35', rgb: '255 111 112', on: '#1b0607' },
  { id: 'magenta', label: 'Magenta', color: '#e875d0', strong: '#b43e9d', ink: '#91307e', rgb: '232 117 208', on: '#190616' },
  { id: 'violet', label: 'Violeta', color: '#9b82ff', strong: '#6648cf', ink: '#5137ae', rgb: '155 130 255', on: '#0d071e' }
];

const VISUAL_PATTERNS = [
  { id: 'pinstripe', label: 'Pinstripe', hint: 'Líneas finas de identidad corporativa' },
  { id: 'microgrid', label: 'Microgrid', hint: 'Grilla editorial y tecnológica' },
  { id: 'dotgrid', label: 'Dot grid', hint: 'Retícula de puntos sobria' },
  { id: 'isometric', label: 'Isométrico', hint: 'Malla geométrica para marcas técnicas' },
  { id: 'hexmesh', label: 'Hex mesh', hint: 'Trama hexagonal industrial' },
  { id: 'diagonal', label: 'Diagonal', hint: 'Franjas discretas de movimiento' },
  { id: 'contour', label: 'Contour', hint: 'Líneas topográficas de marca' },
  { id: 'none', label: 'Liso', hint: 'Sin trama, máxima neutralidad' }
];

const LEGACY_PATTERN_MAP = {
  circuit: 'microgrid', grid: 'microgrid', blueprint: 'microgrid', dots: 'dotgrid', cross: 'isometric', waves: 'contour'
};

const DEFAULT_SETTINGS = {
  id: 'main',
  businessName: 'SERVICIO TÉCNICO PC',
  legalName: '',
  tagline: 'PC · Notebooks · Diagnóstico · Reparaciones',
  address: '',
  phone: '',
  email: '',
  cuit: '',
  taxCondition: '',
  socialSecurityRegistration: '',
  jurisdiction: '',
  privacyContact: '',
  technicians: ['Técnico responsable'],
  technician: 'Técnico responsable',
  technician2: '',
  serviceArea: '',
  licenseNumber: '',
  nextNumber: 1,
  warrantyDays: 90,
  validityDays: 7,
  executionDays: 5,
  defaultTemplate: 'classic',
  accentPalette: 'blue',
  visualPattern: 'pinstripe',
  patternIntensity: 28,
  documentPattern: true,
  terms: DEFAULT_TERMS,
  logo: null,
  brandProfileVersion: BRAND_PROFILE_VERSION
};

const STATUS_OPTIONS = [
  { value: 'Recibido', tone: 'green' },
  { value: 'Diagnosticando', tone: 'cyan' },
  { value: 'Presupuestado', tone: 'blue' },
  { value: 'Aprobado', tone: 'violet' },
  { value: 'En reparación', tone: 'blue' },
  { value: 'Listo', tone: 'green' },
  { value: 'Entregado', tone: 'orange' },
  { value: 'Rechazado', tone: 'red' }
];

const STATUS_COMPAT = {
  Borrador: 'Recibido',
  Pendiente: 'Presupuestado',
  Aceptado: 'Aprobado',
  Finalizado: 'Entregado',
  Ingresado: 'Recibido',
  'Visita programada': 'Diagnosticando',
  Relevado: 'Diagnosticando',
  'En ejecución': 'En reparación',
  Cancelado: 'Rechazado'
};

const COMMON_BRANDS = ['Acer', 'Apple', 'Asus', 'Banghó', 'Dell', 'EXO', 'HP', 'Lenovo', 'MSI', 'Positivo BGH', 'Samsung', 'Toshiba'];

const TECH_QUICK_SERVICES = [
  {
    id: 'lightning-surge', label: 'Daño por rayo', icon: '⚠', serviceType: 'Diagnóstico', priority: 'Alta', deviceType: 'PC',
    issue: 'El cliente informa que, luego de una tormenta eléctrica con caída de rayo en la zona, el equipo dejó de funcionar por completo y no volvió a encender.',
    diagnosis: 'Realizadas las verificaciones de alimentación, encendido y revisión general de hardware, se constata daño eléctrico severo y generalizado, compatible con una sobretensión transitoria asociada al evento eléctrico informado por el cliente. Se observan componentes críticos afectados en la fuente de alimentación y motherboard, con compromiso de módulos de memoria RAM, unidad de almacenamiento y monitor/pantalla. Por la extensión del daño existe además riesgo de afectación en otros circuitos y periféricos conectados. La falla no se limita a un único componente y no resulta técnicamente confiable efectuar una reparación parcial del conjunto.',
    result: 'EQUIPO IRRECUPERABLE / SIN REPARACIÓN TÉCNICA Y ECONÓMICAMENTE VIABLE.',
    work: 'No se recomienda reparación parcial. Se indica el reemplazo integral del equipo y del monitor/pantalla por unidades equivalentes. La recuperación de información de la unidad de almacenamiento queda sujeta a evaluación independiente y no puede garantizarse.',
    notes: 'Daño generalizado compatible con sobretensión asociada a tormenta eléctrica. El presente diagnóstico describe el estado técnico observado; no constituye peritaje sobre el origen externo del evento eléctrico.',
    items: [
      { detail: 'Reposición de PC completa de prestaciones equivalentes', condition: 'Repuesto / equipo', price: 0 },
      { detail: 'Reposición de monitor / pantalla equivalente', condition: 'Repuesto / equipo', price: 0 },
      { detail: 'Diagnóstico y evaluación de daño eléctrico generalizado', condition: 'Servicio', price: 0 }
    ]
  },
  {
    id: 'no-power-board', label: 'No enciende / placa', icon: '⚡', serviceType: 'Diagnóstico', priority: 'Alta',
    issue: 'El cliente informa que el equipo no enciende o no presenta señales normales de alimentación.',
    diagnosis: 'Se verificará cargador o fuente, línea de entrada, consumo, batería cuando corresponda, motherboard y componentes asociados. El diagnóstico definitivo queda sujeto a mediciones y pruebas de banco.',
    result: 'Pendiente de diagnóstico electrónico y confirmación de componentes afectados.',
    work: 'Diagnóstico de alimentación y placa principal, aislamiento de la falla, propuesta de reparación o reemplazo y pruebas funcionales.',
    items: [{ detail: 'Diagnóstico de encendido / alimentación', condition: 'Servicio', price: 0 }, { detail: 'Reparación electrónica o reemplazo de placa a definir', condition: 'Mano de obra', price: 0 }]
  },
  {
    id: 'display', label: 'Pantalla', icon: '▣', serviceType: 'Reparación', priority: 'Normal',
    issue: 'El cliente informa pantalla rota, sin imagen, con líneas, parpadeos o iluminación defectuosa.',
    diagnosis: 'Se verificará panel, flex de video, conectores, backlight y señal de video para determinar si la falla corresponde a pantalla o a otro componente.',
    result: 'Reparación sujeta a disponibilidad y compatibilidad del repuesto.',
    work: 'Desarme, reemplazo del componente afectado, montaje, limpieza y pruebas de imagen.',
    items: [{ detail: 'Pantalla / panel compatible', condition: 'Repuesto', price: 0 }, { detail: 'Reemplazo de pantalla y pruebas', condition: 'Mano de obra', price: 0 }]
  },
  {
    id: 'ssd-system', label: 'SSD + sistema', icon: '▤', serviceType: 'Instalación / actualización', priority: 'Normal',
    issue: 'Equipo lento, almacenamiento con fallas o solicitud de actualización a unidad SSD.',
    diagnosis: 'Se verificará estado SMART, rendimiento, capacidad disponible y compatibilidad del equipo con la unidad propuesta.',
    result: 'Actualización recomendada sujeta al estado del almacenamiento original y a la disponibilidad del repuesto.',
    work: 'Instalación de SSD, instalación o migración del sistema según corresponda, controladores, actualizaciones y pruebas básicas.',
    items: [{ detail: 'Unidad SSD compatible', condition: 'Repuesto', price: 0 }, { detail: 'Instalación, sistema y configuración', condition: 'Mano de obra', price: 0 }]
  },
  {
    id: 'maintenance', label: 'Mantenimiento', icon: '✓', serviceType: 'Mantenimiento', priority: 'Normal',
    issue: 'Solicitud de mantenimiento preventivo o equipo con temperatura elevada, ruido o suciedad acumulada.',
    diagnosis: 'Se inspeccionará sistema de refrigeración, ventiladores, disipadores, estado de pasta térmica y acumulación de polvo.',
    result: 'Mantenimiento preventivo sujeto al estado físico de ventiladores y sistema térmico.',
    work: 'Desarme controlado, limpieza interna, limpieza del sistema de refrigeración, renovación de material térmico cuando corresponda y pruebas de temperatura.',
    items: [{ detail: 'Mantenimiento preventivo y limpieza interna', condition: 'Servicio', price: 0 }]
  },
  {
    id: 'windows', label: 'Sistema operativo', icon: '⊞', serviceType: 'Software', priority: 'Normal',
    issue: 'Problemas de inicio, errores de sistema, lentitud o solicitud de reinstalación/configuración.',
    diagnosis: 'Se verificará integridad del sistema, almacenamiento, controladores y presencia de errores que puedan indicar una falla de hardware.',
    result: 'Intervención de software sujeta al estado del almacenamiento y a la disponibilidad de licencias del cliente.',
    work: 'Respaldo cuando haya sido solicitado y sea posible, instalación o reparación del sistema operativo, controladores, actualizaciones y pruebas.',
    items: [{ detail: 'Servicio de sistema operativo y configuración', condition: 'Servicio', price: 0 }]
  },
  {
    id: 'battery', label: 'Batería', icon: '▰', serviceType: 'Reparación', priority: 'Normal', deviceType: 'Notebook',
    issue: 'El cliente informa baja autonomía, apagados al desconectar o batería que no carga correctamente.',
    diagnosis: 'Se verificará estado de batería, cargador, circuito de carga y parámetros disponibles del sistema para confirmar la causa.',
    result: 'Reemplazo sujeto a disponibilidad de una batería compatible.',
    work: 'Reemplazo de batería, verificación de carga y descarga y prueba básica de autonomía.',
    items: [{ detail: 'Batería compatible', condition: 'Repuesto', price: 0 }, { detail: 'Reemplazo y pruebas de carga', condition: 'Mano de obra', price: 0 }]
  },
  {
    id: 'data-recovery', label: 'Recuperación datos', icon: '↥', serviceType: 'Recuperación de datos', priority: 'Alta',
    issue: 'El cliente solicita recuperar archivos de una unidad que presenta fallas, errores de lectura o pérdida de acceso.',
    diagnosis: 'Se realizará evaluación no destructiva del estado lógico y físico de la unidad. La posibilidad de recuperación depende del daño y no puede garantizarse antes de la evaluación.',
    result: 'Recuperación sujeta al estado de la unidad y al consentimiento del cliente para el procedimiento recomendado.',
    work: 'Diagnóstico de la unidad, intento de extracción o clonación segura cuando corresponda y entrega de los datos recuperados en un medio acordado.',
    items: [{ detail: 'Evaluación de unidad y recuperación de datos', condition: 'Servicio', price: 0 }]
  }
];

let settings = { ...DEFAULT_SETTINGS };
let localSettings = { ...DEFAULT_SETTINGS };
let cloudSettingsCache = null;
let deferredInstallPrompt = null;
let localBudgets = [];
let cloudBudgets = [];
let budgets = [];
let localQuickTemplates = [];
let cloudQuickTemplates = [];
let quickTemplates = [];
let activeOrderSource = 'local';
let editingSource = 'local';
let editingId = null;
let workingBudgetNumber = DEFAULT_SETTINGS.nextNumber;
let workingItems = [];
let pendingLogo = undefined;
let logoUrlCache = null;
let logoSourceCache = null;
let dirty = false;
let activePreviewTemplate = 'classic';
let previewBaseScale = 1;
let previewZoomFactor = 1;
let previewPinchStartDistance = 0;
let previewPinchStartZoom = 1;
let previewPinchCenter = null;
let cloudUser = null;
let cloudSyncBusy = false;
let localSettingsWasNew = false;
let pdfDownloadBusy = false;
let cloudSavePromptShown = false;


function refreshActiveCollections() {
  budgets = activeOrderSource === 'cloud' ? cloudBudgets : localBudgets;
  quickTemplates = cloudUser ? [...localQuickTemplates, ...cloudQuickTemplates] : [...localQuickTemplates];
}

function allVisibleBudgets() {
  const rows = cloudUser ? [...localBudgets, ...cloudBudgets] : [...localBudgets];
  const seen = new Set();
  return rows.filter((item) => {
    const key = `${item.id}:${item.updatedAt || ''}:${item.clientName || ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function setOrderSource(source, { render = true } = {}) {
  const next = source === 'cloud' && cloudUser ? 'cloud' : 'local';
  activeOrderSource = next;
  refreshActiveCollections();
  $$('#orderSourceTabs [data-order-source]').forEach((button) => {
    const active = button.dataset.orderSource === next;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  const cloudTab = $('#orderSourceTabs [data-order-source="cloud"]');
  if (cloudTab) cloudTab.disabled = !cloudUser;
  if (render) {
    renderBudgetsTable();
    refreshDatalists();
  }
}

function nextBudgetNumberForSource(source) {
  if (source === 'cloud') {
    const fromSettings = Math.max(1, Number(cloudSettingsCache?.nextNumber) || 1);
    const fromRows = cloudBudgets.reduce((max, item) => Math.max(max, Number(item.budgetNumber) || 0), 0) + 1;
    return Math.max(fromSettings, fromRows);
  }
  return Math.max(1, Number(localSettings.nextNumber) || 1);
}

function setEditorStorageSource(source, { force = false } = {}) {
  const select = $('#orderStorageScope');
  const next = source === 'cloud' && cloudUser ? 'cloud' : 'local';
  if (!force && editingId && next !== editingSource) return;
  editingSource = next;
  if (select) {
    select.value = next;
    select.disabled = Boolean(editingId);
    const cloudOption = select.querySelector('option[value="cloud"]');
    if (cloudOption) cloudOption.disabled = !cloudUser;
  }
}

async function purgeCloudDeviceData() {
  await clearCloudCache();
  cloudSettingsCache = null;
  cloudBudgets = [];
  cloudQuickTemplates = [];
  try {
    localStorage.removeItem('presupuesto-tecnico-2-cloud-queue');
    Object.keys(localStorage).filter((key) => key.startsWith('servitaller-storage-split-v1:')).forEach((key) => localStorage.removeItem(key));
  } catch (_) {}
  // Limpiar cualquier respuesta cloud que hubiera quedado en Cache Storage por versiones anteriores.
  if ('caches' in window) {
    try {
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        await Promise.all(requests.filter((request) => /\.supabase\.co\/(?:rest|auth)\/v1\//i.test(request.url)).map((request) => cache.delete(request)));
      }
    } catch (error) { console.warn('Limpieza de caché cloud:', error); }
  }
  activeOrderSource = 'local';
  editingSource = 'local';
  refreshActiveCollections();
}

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const currency = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const percentage = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });

function fmtMoney(value) {
  return currency.format(Number(value) || 0).replace('ARS', '$').replace(/\s+/g, ' ');
}

function financialDocumentLabel(label, mode, value) {
  return mode === 'percent' ? `${label} (${percentage.format(Number(value) || 0)} %)` : label;
}

function fmtDate(value) {
  if (!value) return '—';
  const parts = String(value).split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function fmtDateTime(value) {
  if (!value) return '—';
  const [date, time] = String(value).split('T');
  return `${fmtDate(date)}${time ? ` · ${time.slice(0, 5)} h` : ''}`;
}

function todayISO() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
}

function padNumber(value) {
  return String(Number(value) || 0).padStart(6, '0');
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function applyTheme(theme, { persist = false } = {}) {
  const nextTheme = theme === 'light' ? 'light' : 'dark';
  const isLight = nextTheme === 'light';
  document.documentElement.dataset.theme = nextTheme;
  document.documentElement.style.colorScheme = nextTheme;

  if (persist) {
    try { localStorage.setItem(THEME_STORAGE_KEY, nextTheme); } catch (_) {}
  }

  $$('[data-theme-toggle]').forEach((button) => {
    const action = isLight ? 'Cambiar a tema oscuro' : 'Cambiar a tema claro';
    button.setAttribute('aria-pressed', String(isLight));
    button.setAttribute('aria-label', action);
    button.title = action;
  });
  $$('[data-theme-icon]').forEach((icon) => { icon.textContent = isLight ? '☾' : '☀'; });

  const themeColor = $('meta[name="theme-color"]');
  if (themeColor) themeColor.content = isLight ? '#f4f1e9' : '#101316';
}

function toggleTheme() {
  applyTheme(document.documentElement.dataset.theme === 'light' ? 'dark' : 'light', { persist: true });
}

function appearancePalette(id) {
  return ACCENT_PALETTES.find((item) => item.id === id) || ACCENT_PALETTES[0];
}

function appearancePattern(id) {
  const normalized = LEGACY_PATTERN_MAP[id] || id;
  return VISUAL_PATTERNS.find((item) => item.id === normalized) || VISUAL_PATTERNS[0];
}

function applyAppearanceSettings(source = settings) {
  const palette = appearancePalette(source.accentPalette);
  const pattern = appearancePattern(source.visualPattern);
  const intensity = Math.max(0, Math.min(100, Number(source.patternIntensity ?? 28)));
  const root = document.documentElement;
  root.dataset.accent = palette.id;
  root.dataset.pattern = pattern.id;
  root.dataset.documentPattern = source.documentPattern === false ? 'off' : 'on';
  root.style.setProperty('--pt-accent', palette.color);
  root.style.setProperty('--pt-accent-strong', palette.strong);
  root.style.setProperty('--pt-accent-ink', palette.ink);
  root.style.setProperty('--pt-accent-rgb', palette.rgb);
  root.style.setProperty('--pt-on-accent', palette.on);
  root.style.setProperty('--pt-pattern-alpha', String((0.015 + (intensity / 100) * 0.115).toFixed(3)));
  root.style.setProperty('--pt-document-pattern-alpha', String((0.015 + (intensity / 100) * 0.055).toFixed(3)));
}

function renderAppearanceSettings() {
  const form = $('#settingsForm');
  const paletteInput = form?.elements.accentPalette;
  const patternInput = form?.elements.visualPattern;
  if (!form || !paletteInput || !patternInput) return;
  paletteInput.value = appearancePalette(settings.accentPalette).id;
  patternInput.value = appearancePattern(settings.visualPattern).id;
  $('#palettePicker').innerHTML = ACCENT_PALETTES.map((palette) => `
    <button type="button" class="palette-option ${palette.id === paletteInput.value ? 'active' : ''}" data-accent-choice="${palette.id}" role="radio" aria-checked="${palette.id === paletteInput.value}">
      <span class="palette-swatch" style="--swatch:${palette.color}"></span><span>${escapeHtml(palette.label)}</span>
    </button>`).join('');
  $('#patternPicker').innerHTML = VISUAL_PATTERNS.map((pattern) => `
    <button type="button" class="pattern-option ${pattern.id === patternInput.value ? 'active' : ''}" data-pattern-choice="${pattern.id}" data-pattern-preview="${pattern.id}" role="radio" aria-checked="${pattern.id === patternInput.value}">
      <span class="pattern-thumb"></span><span><strong>${escapeHtml(pattern.label)}</strong><small>${escapeHtml(pattern.hint)}</small></span>
    </button>`).join('');
  const intensity = Math.max(0, Math.min(100, Number(settings.patternIntensity ?? 28)));
  $('#patternIntensity').value = String(intensity);
  $('#patternIntensityValue').value = `${intensity}%`;
  $('#documentPatternToggle').checked = settings.documentPattern !== false;
}

function previewAppearanceFromForm() {
  const form = $('#settingsForm');
  if (!form) return;
  applyAppearanceSettings({
    ...settings,
    accentPalette: form.elements.accentPalette.value,
    visualPattern: form.elements.visualPattern.value,
    patternIntensity: Number($('#patternIntensity').value),
    documentPattern: $('#documentPatternToggle').checked
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function multiline(value = '') {
  return escapeHtml(value).replace(/\n/g, '<br>');
}

function normalizeStatus(value) {
  return STATUS_COMPAT[value] || value || 'Recibido';
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => el.classList.remove('show'), 2400);
}

function cloudMessage(error) {
  const raw = String(error?.message || '').toLowerCase();
  if (raw.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (raw.includes('email not confirmed')) return 'Confirmá primero el correo que envió Supabase.';
  if (raw.includes('user already registered')) return 'Ya existe una cuenta con ese correo.';
  if (raw.includes('rate limit')) return 'Supabase limitó temporalmente los registros. Esperá unos minutos e intentá nuevamente.';
  if (raw.includes('email address') && raw.includes('invalid')) return 'Ingresá una dirección de correo válida.';
  if (raw.includes('password')) return 'La contraseña debe tener al menos 8 caracteres.';
  if (raw.includes('failed to fetch') || !navigator.onLine) return 'Sin conexión. Los cambios quedaron guardados en este dispositivo.';
  return error?.message || 'No se pudo completar la operación en la nube.';
}

function setCloudAuthMessage(message = '', isError = false) {
  const box = $('#cloudAuthMessage');
  if (!box) return;
  box.textContent = message;
  box.classList.toggle('error', isError);
}

function renderCloudState(mode = 'idle') {
  const configured = isCloudConfigured();
  const online = navigator.onLine;
  const user = cloudUser || getCloudUser();
  const connected = Boolean(user);
  const title = $('#cloudStateTitle');
  const summary = $('#cloudStateSummary');
  const detail = $('#cloudStatusDetail');
  const shortcut = $('#cloudAccountShortcut');
  const dots = [$('#connectionDot'), $('#cloudStateDot')].filter(Boolean);

  dots.forEach((dot) => {
    dot.classList.remove('cloud-offline', 'cloud-error', 'cloud-syncing');
    if (mode === 'syncing') dot.classList.add('cloud-syncing');
    else if (!online) dot.classList.add('cloud-offline');
    else if (mode === 'error') dot.classList.add('cloud-error');
    else if (!connected) dot.classList.add('cloud-offline');
  });

  if (!configured) {
    $('#offlineStatus').textContent = online ? 'Guardado en este equipo' : 'Trabajando sin conexión';
    if (title) title.textContent = 'Nube no configurada';
    if (summary) summary.textContent = 'La aplicación continúa funcionando localmente.';
    if (detail) detail.textContent = 'Datos protegidos en este dispositivo';
  } else if (connected) {
    $('#offlineStatus').textContent = mode === 'syncing' ? 'Actualizando nube…' : (online ? 'Cuenta cloud conectada' : 'Cuenta cloud · sin conexión');
    if (title) title.textContent = user.email || 'Cuenta conectada';
    if (summary) summary.textContent = online ? 'Las órdenes cloud están separadas de las órdenes locales.' : 'Las órdenes cloud visibles pertenecen únicamente a esta sesión/cuenta.';
    if (detail) detail.textContent = user.email || 'Cuenta conectada';
  } else {
    $('#offlineStatus').textContent = online ? 'Guardado en este equipo' : 'Trabajando sin conexión';
    if (title) title.textContent = 'Sólo en este dispositivo';
    if (summary) summary.textContent = 'Conectá una cuenta para abrir su espacio cloud separado.';
    if (detail) detail.textContent = 'Conectá una cuenta para sincronizar';
  }

  if (shortcut) shortcut.textContent = connected ? 'Gestionar cuenta' : 'Conectar nube';
  $('#cloudAuthBtn')?.classList.toggle('hidden', connected || !configured);
  $('#cloudSyncBtn')?.classList.toggle('hidden', !connected);
  $('#cloudSignOutBtn')?.classList.toggle('hidden', !connected);
  $('#cloudSwitchAccountBtn')?.classList.toggle('hidden', !connected);
  if ($('#cloudSyncBtn')) $('#cloudSyncBtn').disabled = cloudSyncBusy || !online;
  const cloudTab = $('#orderSourceTabs [data-order-source="cloud"]');
  if (cloudTab) cloudTab.disabled = !connected;
  const scopeSelect = $('#orderStorageScope');
  if (scopeSelect) {
    const cloudOption = scopeSelect.querySelector('option[value="cloud"]');
    if (cloudOption) cloudOption.disabled = !connected;
    if (!connected && scopeSelect.value === 'cloud') setEditorStorageSource('local', { force: true });
  }
  if (!connected && activeOrderSource === 'cloud') setOrderSource('local');
}

function openCloudAuthDialog() {
  if (cloudUser) {
    showView('settings');
    $('#cloudSyncBtn')?.focus();
    return;
  }
  const dialog = $('#cloudAuthDialog');
  const form = $('#cloudAuthForm');
  form.reset();
  setCloudAuthMessage();
  dialog.showModal();
  requestAnimationFrame(() => form.elements.email.focus());
}

function closeCloudAuthDialog() {
  const dialog = $('#cloudAuthDialog');
  if (dialog?.open) dialog.close();
}

function recordTime(record) {
  return String(record?.updatedAt || record?.createdAt || '');
}

function mergeCloudRecords(localRecords = [], remoteRecords = []) {
  const localMap = new Map(localRecords.map((record) => [record.id, record]));
  const remoteMap = new Map(remoteRecords.map((record) => [record.id, record]));
  const merged = [];
  const upload = [];
  new Set([...localMap.keys(), ...remoteMap.keys()]).forEach((id) => {
    const local = localMap.get(id);
    const remote = remoteMap.get(id);
    if (local && !remote) {
      merged.push(local);
      upload.push(local);
    } else if (!local && remote) {
      merged.push(remote);
    } else if (recordTime(local) >= recordTime(remote)) {
      merged.push(local);
      if (recordTime(local) > recordTime(remote)) upload.push(local);
    } else {
      merged.push(remote);
    }
  });
  return { merged, upload };
}

async function settingsToCloud(value) {
  const logoDataUrl = await blobToDataURL(value.logo);
  const clean = { ...value, logo: undefined, logoDataUrl };
  delete clean.logo;
  delete clean._cloudDirty;
  delete clean._storageSource;
  return clean;
}

function settingsFromCloud(value) {
  if (!value) return null;
  const restored = { ...value, logo: value.logoDataUrl ? dataURLToBlob(value.logoDataUrl) : null };
  delete restored.logoDataUrl;
  return restored;
}

async function synchronizeCloudData({ notify = true } = {}) {
  if (!cloudUser || !navigator.onLine || cloudSyncBusy) return;
  cloudSyncBusy = true;
  renderCloudState('syncing');
  try {
    await flushCloudQueue();

    // Subir primero cualquier edición cloud que haya quedado pendiente en el caché separado.
    const [cachedSettings, cachedBudgets, cachedTemplates] = await Promise.all([
      getCloudSettingsCache(), getCloudBudgetsCache(), getCloudQuickTemplatesCache()
    ]);
    if (cachedSettings?._cloudDirty) {
      const payload = { ...cachedSettings }; delete payload._cloudDirty;
      await upsertCloudSettings(await settingsToCloud(payload));
    }
    for (const budget of cachedBudgets.filter((item) => item._cloudDirty)) {
      const payload = { ...budget }; delete payload._cloudDirty;
      await upsertCloudBudget(payload);
    }
    for (const template of cachedTemplates.filter((item) => item._cloudDirty)) {
      const payload = { ...template }; delete payload._cloudDirty;
      await upsertCloudQuickTemplate(payload);
    }

    const remote = await fetchCloudSnapshot();

    // Migración v2.2: en versiones anteriores una misma orden se guardaba localmente y se subía a la nube.
    // Si el ID existe en la cuenta remota, se reclasifica como cloud y se retira del almacén Local una única vez.
    const splitMigrationKey = `servitaller-storage-split-v1:${cloudUser.id}`;
    let splitDone = false;
    try { splitDone = localStorage.getItem(splitMigrationKey) === 'done'; } catch (_) {}
    if (!splitDone) {
      const remoteBudgetIds = new Set((remote.budgets || []).map((item) => item.id));
      const remoteTemplateIds = new Set((remote.quickTemplates || []).map((item) => item.id));
      const localBudgetOverlaps = localBudgets.filter((item) => remoteBudgetIds.has(item.id));
      const localTemplateOverlaps = localQuickTemplates.filter((item) => remoteTemplateIds.has(item.id));
      for (const item of localBudgetOverlaps) await deleteBudget(item.id);
      for (const item of localTemplateOverlaps) await deleteQuickTemplate(item.id);
      if (localBudgetOverlaps.length) localBudgets = await getBudgets();
      if (localTemplateOverlaps.length) localQuickTemplates = (await getQuickTemplates()).map((item) => ({ ...item, _storageSource: 'local' }));
      try { localStorage.setItem(splitMigrationKey, 'done'); } catch (_) {}
    }

    let remoteSettings = remote.settings ? applyBigPowerProfile(settingsFromCloud(remote.settings) || {}) : null;
    if (!remoteSettings) {
      remoteSettings = { ...localSettings, id: 'main', updatedAt: new Date().toISOString() };
      await upsertCloudSettings(await settingsToCloud(remoteSettings));
    }

    cloudSettingsCache = remoteSettings;
    cloudBudgets = (remote.budgets || []).map((budget) => ({ ...budget, password: '', _cloudDirty: false }));
    cloudQuickTemplates = (remote.quickTemplates || []).map((template) => ({ ...template, _cloudDirty: false, _storageSource: 'cloud' }));
    await replaceCloudCache(cloudSettingsCache, cloudBudgets, cloudQuickTemplates);

    // La configuración visible sigue siendo local; la copia de cuenta vive sólo en el caché cloud.
    settings = localSettings;
    pendingLogo = undefined;
    refreshActiveCollections();
    renderQuickServices();
    renderCustomTemplatesList();
    refreshDatalists();
    renderBudgetsTable();
    if (notify) toast('Nube actualizada');
    renderCloudState();
    if (!dirty && $('#saveState')) {
      $('#saveState').textContent = editingSource === 'cloud' ? 'Guardado en nube' : 'Guardado local';
      $('#saveState').classList.add('saved');
    }
  } catch (error) {
    console.error('Sincronización:', error);
    if ([401, 403].includes(Number(error?.status))) {
      cloudUser = null;
      await purgeCloudDeviceData();
      settings = { ...localSettings };
      setOrderSource('local');
      renderCloudState('error');
      if (notify) toast('La sesión cloud venció y sus datos fueron eliminados de este dispositivo.');
    } else {
      renderCloudState('error');
      if (notify) toast(cloudMessage(error));
    }
  } finally {
    cloudSyncBusy = false;
    renderCloudState();
  }
}

async function handleCloudSignIn(event) {
  event.preventDefault();
  const form = $('#cloudAuthForm');
  if (!form.reportValidity()) return;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  setCloudAuthMessage('Ingresando…');
  try {
    cloudUser = await signInCloud(email, password);
    renderCloudState('syncing');
    await synchronizeCloudData({ notify: false });
    closeCloudAuthDialog();
    toast('Cuenta conectada y sincronizada');
  } catch (error) {
    setCloudAuthMessage(cloudMessage(error), true);
  }
}

async function handleCloudSignUp() {
  const form = $('#cloudAuthForm');
  if (!form.reportValidity()) return;
  const email = form.elements.email.value.trim();
  const password = form.elements.password.value;
  setCloudAuthMessage('Creando cuenta…');
  try {
    const result = await signUpCloud(email, password);
    if (!result.signedIn) {
      setCloudAuthMessage('Cuenta creada. Revisá tu correo y confirmalo antes de ingresar.');
      return;
    }
    cloudUser = result.user;
    renderCloudState('syncing');
    await synchronizeCloudData({ notify: false });
    closeCloudAuthDialog();
    toast('Cuenta creada y datos sincronizados');
  } catch (error) {
    setCloudAuthMessage(cloudMessage(error), true);
  }
}

async function handleCloudSignOut() {
  if (!confirm('¿Cerrar la sesión? Las órdenes y datos descargados de esta cuenta se eliminarán de este dispositivo. Tus datos locales permanecerán intactos.')) return;
  const hadCloudEditor = editingSource === 'cloud';
  await signOutCloud();
  cloudUser = null;
  cloudSavePromptShown = false;
  await purgeCloudDeviceData();
  settings = { ...localSettings };
  pendingLogo = undefined;
  closePreview({ historyMode: 'none' });
  closeQuickTemplateDialog();
  fillSettingsForm();
  renderQuickServices();
  renderCustomTemplatesList();
  setOrderSource('local');
  if (hadCloudEditor) resetEditor();
  else setEditorStorageSource('local', { force: true });
  renderCloudState();
  toast('Sesión cerrada · datos de nube eliminados del dispositivo');
}

async function handleCloudSwitchAccount() {
  if (!confirm('¿Cambiar de cuenta? Se eliminarán de este dispositivo todas las órdenes y datos descargados de la cuenta actual.')) return;
  const hadCloudEditor = editingSource === 'cloud';
  await signOutCloud();
  cloudUser = null;
  await purgeCloudDeviceData();
  settings = { ...localSettings };
  pendingLogo = undefined;
  closePreview({ historyMode: 'none' });
  closeQuickTemplateDialog();
  fillSettingsForm();
  setOrderSource('local');
  if (hadCloudEditor) resetEditor();
  else setEditorStorageSource('local', { force: true });
  renderCloudState();
  openCloudAuthDialog();
}

async function syncCloudAction(action, pendingMessage = 'Guardado localmente; sincronización pendiente') {
  if (!cloudUser) return false;
  try {
    await action();
    renderCloudState();
    return true;
  } catch (error) {
    console.error('Nube:', error);
    renderCloudState('error');
    toast(pendingMessage);
    return false;
  }
}

function setDirty(value = true) {
  dirty = value;
  const state = $('#saveState');
  if (!state) return;
  state.textContent = value ? 'Cambios sin guardar' : 'Guardado';
  state.classList.toggle('saved', !value);
}

function initials(name) {
  const words = String(name || 'ST').replace(/[-·|]/g, ' ').split(/\s+/).filter(Boolean);
  const skip = new Set(['SERVICIO', 'TÉCNICO', 'TECNICO', 'DE', 'DEL']);
  const chosen = words.filter((word) => !skip.has(word.toUpperCase())).slice(0, 2);
  return (chosen.length ? chosen : words.slice(0, 2)).map((word) => word[0]).join('').toUpperCase() || 'ST';
}

function normalizeTechnicians(value = {}) {
  const configured = Array.isArray(value.technicians) ? value.technicians : [];
  const legacy = [value.technician, value.technician2];
  return [...new Set([...configured, ...legacy]
    .map((name) => String(name || '').trim())
    .filter(Boolean))];
}

function settingsWithTechnicians(value = {}) {
  const technicians = normalizeTechnicians(value);
  return {
    ...value,
    technicians,
    technician: technicians[0] || '',
    technician2: technicians[1] || ''
  };
}

function primaryTechnician(fallback = 'Técnico responsable') {
  return normalizeTechnicians(settings)[0] || fallback;
}

function applyBigPowerProfile(savedSettings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...savedSettings };
  if (!Array.isArray(savedSettings.technicians)) {
    const legacyTechnicians = [savedSettings.technician, savedSettings.technician2]
      .map((name) => String(name || '').trim()).filter(Boolean);
    merged.technicians = legacyTechnicians.length ? legacyTechnicians : [...DEFAULT_SETTINGS.technicians];
  }
  if ((Number(savedSettings.brandProfileVersion) || 0) >= BRAND_PROFILE_VERSION) return settingsWithTechnicians(merged);

  const previousName = String(savedSettings.businessName || '').trim().toUpperCase();
  if (!previousName || previousName === 'BIG POWER' || previousName === 'SERVICIOS ELÉCTRICOS') merged.businessName = DEFAULT_SETTINGS.businessName;
  if (!savedSettings.tagline || /eléctric/i.test(savedSettings.tagline)) merged.tagline = DEFAULT_SETTINGS.tagline;
  if (/big power/i.test(String(savedSettings.email || ''))) merged.email = '';
  if (/jun[ií]n/i.test(String(savedSettings.address || '')) && previousName === 'BIG POWER') merged.address = '';
  if (/jun[ií]n/i.test(String(savedSettings.serviceArea || '')) && previousName === 'BIG POWER') merged.serviceArea = '';
  if (!savedSettings.terms || String(savedSettings.terms).trim() === LEGACY_DEFAULT_TERMS.trim()) merged.terms = DEFAULT_TERMS;
  // Migrar únicamente la combinación visual que era el default anterior. Las elecciones personalizadas se preservan.
  if ((savedSettings.accentPalette || 'cyan') === 'cyan' && (savedSettings.visualPattern || 'circuit') === 'circuit') {
    merged.accentPalette = 'blue';
    merged.visualPattern = 'pinstripe';
    merged.patternIntensity = 28;
  }
  merged.logo = previousName === 'BIG POWER' ? null : (savedSettings.logo ?? null);
  merged.brandProfileVersion = BRAND_PROFILE_VERSION;
  return settingsWithTechnicians(merged);
}

function updateBrandUI() {
  $('#sidebarBusiness').textContent = settings.businessName || 'SERVICIO TÉCNICO PC';
  $('#sidebarTagline').textContent = settings.tagline || 'PC · Notebooks · Reparaciones';
  $('#mobileBusiness').textContent = settings.businessName || 'SERVICIO TÉCNICO PC';
  document.title = `${settings.businessName || 'TallerPc'} · TallerPc`;
}

function ensureLogoUrl(blob) {
  if (!blob) return null;
  if (blob === logoSourceCache && logoUrlCache) return logoUrlCache;
  if (logoUrlCache) URL.revokeObjectURL(logoUrlCache);
  logoSourceCache = blob;
  logoUrlCache = URL.createObjectURL(blob);
  return logoUrlCache;
}

function currentLogoBlob() {
  return pendingLogo !== undefined ? pendingLogo : settings.logo;
}

function defaultBrandLockupHtml(className = '') {
  return `<span class="brand-lockup ${className}" role="img" aria-label="Servicio técnico">
    <img class="brand-lockup-mark" src="${DEFAULT_MARK_URL}" alt="" />
    <span class="brand-lockup-word">TALLER <span class="brand-lockup-thin">PC</span></span>
  </span>`;
}

function refreshLogoUI() {
  const blob = currentLogoBlob();
  const box = $('#logoPreview');
  box.innerHTML = '';
  if (blob) {
    const img = new Image();
    img.src = ensureLogoUrl(blob);
    img.alt = `Logo de ${settings.businessName || 'Servicio técnico'}`;
    box.appendChild(img);
  } else {
    box.innerHTML = defaultBrandLockupHtml('settings-brand-lockup');
  }
  $('#removeLogoBtn').classList.toggle('hidden', !blob);
}

function updateViewHistory(view, mode = 'auto') {
  if (mode === 'none') return;
  const state = { bigPowerView: view };
  const fragment = view === 'new' ? '#inicio' : `#${view}`;
  if (mode === 'replace') {
    history.replaceState(state, '', fragment);
    return;
  }
  const currentView = history.state?.bigPowerView;
  if (currentView === view) return;
  if (view === 'new') {
    history.replaceState(state, '', fragment);
    return;
  }
  if (currentView && currentView !== 'new') history.replaceState({ bigPowerView: 'new' }, '', '#inicio');
  history.pushState(state, '', fragment);
}

function initializeAppHistory() {
  if (history.state?.bigPowerEntry) {
    history.replaceState({ bigPowerView: 'new', bigPowerEntry: true }, '', '#inicio');
    return;
  }
  history.replaceState({ bigPowerView: 'new', bigPowerRoot: true }, '', '#inicio');
  history.pushState({ bigPowerView: 'new', bigPowerEntry: true }, '', '#inicio');
}

function showView(view, { historyMode = 'auto' } = {}) {
  $$('.view').forEach((section) => section.classList.toggle('active-view', section.id === `view-${view}`));
  $$('.nav-item').forEach((button) => button.classList.toggle('active', button.dataset.view === view));
  document.body.classList.remove('menu-open');
  if (view === 'orders') renderBudgetsTable();
  updateViewHistory(view, historyMode);
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function currentViewName() {
  return $('.view.active-view')?.id.replace('view-', '') || 'new';
}

function allQuickServices() {
  return [...TECH_QUICK_SERVICES, ...quickTemplates];
}

function renderQuickServices() {
  $('#quickServices').innerHTML = allQuickServices().map((service) => `
    <button class="quick-service ${service.custom ? 'custom' : ''}" type="button" data-service="${escapeHtml(service.id)}" title="Aplicar ${escapeHtml(service.label)}">
      <span>${escapeHtml(service.icon || '⚡')}</span>${escapeHtml(service.label)}${service.custom ? '<i>PROPIA</i>' : ''}
    </button>
  `).join('');
}

function renderCustomTemplatesList() {
  const list = $('#customTemplatesList');
  if (!list) return;
  if (!quickTemplates.length) {
    list.innerHTML = '<div class="custom-templates-empty"><strong>Todavía no creaste plantillas propias</strong><span>Guardá una desde una orden o creala manualmente.</span></div>';
    return;
  }
  list.innerHTML = quickTemplates.map((template) => `
    <article class="custom-template-card" data-template-id="${escapeHtml(template.id)}">
      <div class="custom-template-icon">${escapeHtml(template.icon || '⚡')}</div>
      <div><strong>${escapeHtml(template.label)}</strong><span>${escapeHtml([template.serviceType, template.priority, template._storageSource === 'cloud' ? 'Nube' : 'Local'].filter(Boolean).join(' · '))}</span></div>
      <div class="custom-template-actions"><button class="mini-link" type="button" data-edit-quick-template="${escapeHtml(template.id)}">Editar</button><button class="mini-link danger" type="button" data-delete-quick-template="${escapeHtml(template.id)}">Eliminar</button></div>
    </article>
  `).join('');
}

function renderStatusPicker(selected = 'Recibido') {
  selected = normalizeStatus(selected);
  const options = STATUS_OPTIONS.some((x) => x.value === selected)
    ? STATUS_OPTIONS
    : [{ value: selected, tone: 'cyan' }, ...STATUS_OPTIONS];
  $('#statusPicker').innerHTML = options.map((status) => `
    <button class="status-button tone-${status.tone} ${status.value === selected ? 'active' : ''}" type="button" data-status="${escapeHtml(status.value)}">
      <span class="state-light"></span>${escapeHtml(status.value)}
    </button>
  `).join('');
  $('#budgetForm').elements.status.value = selected;
}

function setDeviceType(value) {
  const known = ['Notebook', 'PC', 'All in One', 'Monitor', 'Otro'];
  const safe = known.includes(value) ? value : 'Notebook';
  $('#budgetForm').elements.equipmentType.value = safe;
  $$('.device-btn').forEach((button) => button.classList.toggle('active', button.dataset.device === safe));
}

function setTemplate(value, { markDirty = true } = {}) {
  const template = value === 'workshop' ? 'workshop' : 'classic';
  $('#budgetForm').elements.template.value = template;
  $$('.template-option').forEach((button) => button.classList.toggle('active', button.dataset.template === template));
  activePreviewTemplate = template;
  $$('.preview-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.previewTemplate === template));
  if (markDirty) setDirty();
  renderPreview(template);
}

function setDefaultTemplate(value) {
  const template = value === 'workshop' ? 'workshop' : 'classic';
  $('#settingsForm').elements.defaultTemplate.value = template;
  $$('#defaultTemplatePicker button').forEach((button) => button.classList.toggle('active', button.dataset.template === template));
}

function defaultItem(detail = '', condition = 'Repuesto') {
  return { id: uid(), qty: 1, detail, condition, warranty: settings.warrantyDays, price: 0 };
}

function setWorkingBudgetNumber(value, { markDirty = false } = {}) {
  const next = Math.max(1, Math.trunc(Number(value) || 1));
  workingBudgetNumber = next;
  const input = $('#budgetNumberInput');
  if (input && Number(input.value) !== next) input.value = String(next);
  $('#editorTitle').textContent = `Orden #${padNumber(next)}`;
  if (markDirty) setDirty();
  return next;
}

function resetEditor() {
  editingId = null;
  editingSource = 'local';
  workingBudgetNumber = localSettings.nextNumber;
  workingItems = [];
  const form = $('#budgetForm');
  form.reset();
  form.elements.date.value = todayISO();
  form.elements.status.value = 'Recibido';
  form.elements.equipmentType.value = 'Notebook';
  form.elements.serviceType.value = 'Diagnóstico';
  form.elements.priority.value = 'Normal';
  form.elements.validityDays.value = settings.validityDays;
  form.elements.warrantyDays.value = settings.warrantyDays;
  form.elements.executionDays.value = settings.executionDays;
  form.elements.surcharge.value = 0;
  form.elements.discount.value = 0;
  form.elements.deposit.value = 0;
  form.elements.surchargeMode.value = 'amount';
  form.elements.discountMode.value = 'amount';
  form.elements.depositMode.value = 'amount';
  form.elements.paymentMethod.value = 'Efectivo';
  form.elements.template.value = settings.defaultTemplate || 'classic';
  setWorkingBudgetNumber(workingBudgetNumber);
  setEditorStorageSource('local', { force: true });
  $('.order-identity .eyebrow').textContent = 'ORDEN DE SERVICIO / PRESUPUESTO';
  $$('.collapsible').forEach((el) => el.classList.add('hidden'));
  $$('[data-toggle]').forEach((button) => button.classList.remove('active'));
  setDeviceType('Notebook');
  renderStatusPicker('Recibido');
  refreshTechnicianOptions();
  renderItems();
  updateFinancialModeControls();
  setTemplate(settings.defaultTemplate || 'classic', { markDirty: false });
  setDirty(false);
  updateFinancials();
}

function renderItems() {
  const container = $('#itemsContainer');
  if (!workingItems.length) {
    container.innerHTML = '<div class="items-empty">Sin ítems todavía. Aplicá una plantilla o agregá materiales y mano de obra.</div>';
    updateFinancials();
    return;
  }
  container.innerHTML = workingItems.map((item, index) => `
    <div class="item-row" data-id="${item.id}">
      <div class="item-index">${index + 1}</div>
      <label class="mini-field item-detail"><span>Descripción</span><input class="input" data-item-field="detail" value="${escapeHtml(item.detail || '')}" placeholder="Material, servicio o mano de obra" /></label>
      <label class="mini-field item-qty"><span>Cant.</span><input class="input" data-item-field="qty" type="number" min="1" step="1" value="${Number(item.qty) || 1}" /></label>
      <label class="mini-field item-price"><span>Precio unit.</span><input class="input" data-item-field="price" type="number" min="0" step="1" value="${Number(item.price) || 0}" /></label>
      <strong class="item-line-total">${fmtMoney((Number(item.qty) || 0) * (Number(item.price) || 0))}</strong>
      <button class="icon-danger" type="button" data-remove-item="${item.id}" aria-label="Eliminar ítem">×</button>
      <details class="item-advanced">
        <summary>Rubro y garantía</summary>
        <div class="item-advanced-grid">
          <label class="mini-field"><span>Rubro</span><input class="input" data-item-field="condition" value="${escapeHtml(item.condition || '')}" placeholder="Material / Mano de obra / Servicio" /></label>
          <label class="mini-field"><span>Garantía</span><div class="suffix-input"><input class="input" data-item-field="warranty" type="number" min="0" value="${Number(item.warranty) || 0}" /><span>días</span></div></label>
        </div>
      </details>
    </div>
  `).join('');
  updateFinancials();
}

function normalizeFinancialMode(value) {
  return value === 'percent' ? 'percent' : 'amount';
}

function financialInputValue(form, name, mode) {
  const raw = Math.max(0, Number(form.elements[name]?.value) || 0);
  return mode === 'percent' ? Math.min(100, raw) : raw;
}

function updateFinancialModeControls() {
  const form = $('#budgetForm');
  if (!form) return;
  ['surcharge', 'discount', 'deposit'].forEach((name) => {
    const mode = normalizeFinancialMode(form.elements[`${name}Mode`]?.value);
    const input = form.elements[name];
    const toggle = $(`[data-financial-toggle="${name}"]`);
    if (!input || !toggle) return;
    toggle.textContent = mode === 'percent' ? '%' : '$';
    toggle.classList.toggle('is-percent', mode === 'percent');
    toggle.setAttribute('aria-pressed', String(mode === 'percent'));
    toggle.title = mode === 'percent' ? 'Expresado como porcentaje. Presioná para usar pesos.' : 'Expresado en pesos. Presioná para usar porcentaje.';
    input.step = mode === 'percent' ? '0.1' : '1';
    input.inputMode = 'decimal';
    if (mode === 'percent') input.max = '100';
    else input.removeAttribute('max');
  });
}

function toggleFinancialMode(name) {
  const form = $('#budgetForm');
  const modeInput = form?.elements[`${name}Mode`];
  if (!modeInput) return;
  modeInput.value = normalizeFinancialMode(modeInput.value) === 'percent' ? 'amount' : 'percent';
  updateFinancialModeControls();
  updateFinancials();
  setDirty();
}

function getFinancials() {
  const form = $('#budgetForm');
  const subtotal = workingItems.reduce((sum, item) => sum + (Number(item.qty) || 0) * (Number(item.price) || 0), 0);
  const surchargeMode = normalizeFinancialMode(form.elements.surchargeMode?.value);
  const discountMode = normalizeFinancialMode(form.elements.discountMode?.value);
  const depositMode = normalizeFinancialMode(form.elements.depositMode?.value);
  const surchargeValue = financialInputValue(form, 'surcharge', surchargeMode);
  const discountValue = financialInputValue(form, 'discount', discountMode);
  const depositValue = financialInputValue(form, 'deposit', depositMode);
  const surcharge = surchargeMode === 'percent' ? subtotal * surchargeValue / 100 : surchargeValue;
  const discount = discountMode === 'percent' ? subtotal * discountValue / 100 : discountValue;
  const total = Math.max(0, subtotal + surcharge - discount);
  const deposit = depositMode === 'percent' ? total * depositValue / 100 : depositValue;
  const balance = Math.max(0, total - deposit);
  return {
    subtotal,
    surcharge,
    discount,
    deposit,
    total,
    balance,
    surchargeMode,
    discountMode,
    depositMode,
    surchargeValue,
    discountValue,
    depositValue
  };
}

function updateFinancials() {
  if (!$('#budgetForm')) return;
  const f = getFinancials();
  $('#itemsSubtotal').textContent = fmtMoney(f.subtotal);
  $('#quoteTotal').textContent = fmtMoney(f.subtotal);
  $('#serviceTotal').textContent = fmtMoney(f.total);
  $('#balanceTotal').textContent = fmtMoney(f.balance);
  $('#mobileBalance').textContent = fmtMoney(f.balance);
  $$('.item-row').forEach((row) => {
    const item = workingItems.find((x) => x.id === row.dataset.id);
    if (item) $('.item-line-total', row).textContent = fmtMoney((Number(item.qty) || 0) * (Number(item.price) || 0));
  });
  updateLegalReadiness();
}

function readFormBudget() {
  const form = $('#budgetForm');
  const data = Object.fromEntries(new FormData(form).entries());
  const f = getFinancials();
  const existingRows = editingSource === 'cloud' ? cloudBudgets : localBudgets;
  const existing = editingId ? existingRows.find((b) => b.id === editingId) : null;
  const budgetNumber = Math.max(1, Math.trunc(Number(data.budgetNumber) || Number(workingBudgetNumber) || 1));
  workingBudgetNumber = budgetNumber;
  return {
    ...data,
    id: editingId || uid(),
    budgetNumber,
    status: normalizeStatus(data.status),
    validityDays: Number(data.validityDays) || settings.validityDays,
    warrantyDays: Number(data.warrantyDays) || settings.warrantyDays,
    executionDays: Number(data.executionDays) || settings.executionDays,
    surcharge: f.surchargeValue,
    discount: f.discountValue,
    deposit: f.depositValue,
    surchargeMode: f.surchargeMode,
    discountMode: f.discountMode,
    depositMode: f.depositMode,
    subtotal: f.subtotal,
    total: f.total,
    balance: f.balance,
    items: workingItems.map((item) => ({
      ...item,
      qty: Number(item.qty) || 0,
      price: Number(item.price) || 0,
      warranty: Number(item.warranty) || 0
    })),
    template: data.template === 'workshop' ? 'workshop' : 'classic',
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

async function handleSaveBudget() {
  const budget = readFormBudget();
  if (!String(budget.clientName || '').trim()) {
    toast('Ingresá el nombre del cliente');
    $('#budgetForm').elements.clientName.focus();
    return;
  }
  if (editingSource === 'cloud' && !cloudUser) {
    toast('Iniciá sesión para guardar una orden en la nube');
    openCloudAuthDialog();
    return;
  }

  const sourceRows = editingSource === 'cloud' ? cloudBudgets : localBudgets;
  const numberInUse = sourceRows.find((saved) => saved.id !== budget.id && Number(saved.budgetNumber) === Number(budget.budgetNumber));
  if (numberInUse) {
    toast(`El número ${padNumber(budget.budgetNumber)} ya existe en ${editingSource === 'cloud' ? 'la nube' : 'este dispositivo'}`);
    $('#budgetNumberInput')?.focus();
    return;
  }

  if (editingSource === 'cloud') {
    const cached = { ...budget, password: budget.password || '', _cloudDirty: true };
    await saveCloudBudgetCache(cached);
    cloudBudgets = await getCloudBudgetsCache();
    let synced = false;
    if (navigator.onLine) {
      synced = await syncCloudAction(async () => {
        await upsertCloudBudget(budget);
        await saveCloudBudgetCache({ ...cached, _cloudDirty: false });
      }, 'Guardado en el caché de nube; sincronización pendiente');
      cloudBudgets = await getCloudBudgetsCache();
    }
    editingId = budget.id;
    const cloudNext = Math.max(nextBudgetNumberForSource('cloud'), Number(budget.budgetNumber) + 1);
    cloudSettingsCache = { ...(cloudSettingsCache || localSettings), id: 'main', nextNumber: cloudNext, updatedAt: new Date().toISOString() };
    await saveCloudSettingsCache({ ...cloudSettingsCache, _cloudDirty: !navigator.onLine });
    if (navigator.onLine) await syncCloudAction(async () => upsertCloudSettings(await settingsToCloud(cloudSettingsCache)), 'Numeración cloud pendiente de sincronizar');
    setEditorStorageSource('cloud', { force: true });
    refreshActiveCollections();
    setDirty(false);
    refreshDatalists();
    renderBudgetsTable();
    $('#saveState').textContent = synced ? 'Guardado en nube' : 'Nube pendiente de sincronizar';
    $('#saveState').classList.toggle('saved', synced);
    toast(synced ? 'Orden guardada en la nube' : 'Orden guardada para sincronizar con la nube');
    return;
  }

  await saveBudget({ ...budget, _storageSource: 'local' });
  editingId = budget.id;
  const nextNumber = Math.max(Number(localSettings.nextNumber) || 1, Number(budget.budgetNumber) + 1);
  if (nextNumber !== Number(localSettings.nextNumber)) {
    localSettings.nextNumber = nextNumber;
    localSettings.updatedAt = new Date().toISOString();
    settings = localSettings;
    await saveSettings(localSettings);
  }
  localBudgets = await getBudgets();
  refreshActiveCollections();
  setWorkingBudgetNumber(budget.budgetNumber);
  setEditorStorageSource('local', { force: true });
  setDirty(false);
  refreshDatalists();
  renderBudgetsTable();
  $('#saveState').textContent = 'Guardado local';
  $('#saveState').classList.add('saved');
  toast('Orden guardada en este dispositivo');
}

function fillEditorFromBudget(budget, { duplicate = false, source = activeOrderSource } = {}) {
  const form = $('#budgetForm');
  editingId = duplicate ? null : budget.id;
  editingSource = duplicate ? 'local' : (source === 'cloud' ? 'cloud' : 'local');
  workingBudgetNumber = duplicate ? settings.nextNumber : budget.budgetNumber;
  workingItems = (budget.items || []).map((item) => ({ ...item, id: duplicate ? uid() : (item.id || uid()) }));
  form.reset();
  form.elements.budgetNumber.value = String(workingBudgetNumber);
  const skip = new Set(['id', 'items', 'createdAt', 'updatedAt', 'budgetNumber', 'total', 'subtotal', 'balance']);
  Object.entries(budget).forEach(([key, value]) => {
    if (skip.has(key)) return;
    const field = form.elements.namedItem(key);
    if (field) field.value = value ?? '';
  });
  if (duplicate) {
    form.elements.date.value = todayISO();
    form.elements.status.value = 'Recibido';
    form.elements.deposit.value = 0;
    form.elements.depositMode.value = 'amount';
  }
  form.elements.validityDays.value ||= settings.validityDays;
  form.elements.warrantyDays.value ||= settings.warrantyDays;
  form.elements.executionDays.value ||= settings.executionDays;
  form.elements.template.value = budget.template || settings.defaultTemplate || 'classic';
  setDeviceType(budget.equipmentType || 'Notebook');
  refreshTechnicianOptions(budget.assignedTechnician || '');
  renderStatusPicker(duplicate ? 'Recibido' : normalizeStatus(budget.status));
  renderItems();
  updateFinancialModeControls();
  setTemplate(form.elements.template.value, { markDirty: false });
  setWorkingBudgetNumber(workingBudgetNumber);
  setEditorStorageSource(editingSource, { force: true });
  setDirty(duplicate);
  updateFinancials();
}

async function openBudget(id) {
  if (dirty && !confirm('Hay cambios sin guardar. ¿Abrir otra orden igualmente?')) return;
  const budget = activeOrderSource === 'cloud' ? await getCloudBudgetCache(id) : await getBudget(id);
  if (!budget) return;
  fillEditorFromBudget(budget, { source: activeOrderSource });
  showView('new');
}

async function duplicateBudget(id) {
  if (dirty && !confirm('Hay cambios sin guardar. ¿Crear una copia igualmente?')) return;
  const budget = activeOrderSource === 'cloud' ? await getCloudBudgetCache(id) : await getBudget(id);
  if (!budget) return;
  fillEditorFromBudget(budget, { duplicate: true, source: 'local' });
  showView('new');
  toast('Copia creada como orden local');
}

async function removeBudget(id) {
  const budget = budgets.find((b) => b.id === id);
  if (!budget) return;
  const sourceLabel = activeOrderSource === 'cloud' ? 'de la nube' : 'local';
  if (!confirm(`¿Eliminar la orden #${padNumber(budget.budgetNumber)} ${sourceLabel}?`)) return;

  if (activeOrderSource === 'cloud') {
    await deleteCloudBudgetCache(id);
    cloudBudgets = await getCloudBudgetsCache();
    if (cloudUser) await syncCloudAction(() => deleteCloudBudget(id), 'Eliminada del dispositivo; borrado cloud pendiente');
    toast('Orden eliminada de la nube de esta cuenta');
  } else {
    await deleteBudget(id);
    localBudgets = await getBudgets();
    toast('Orden local eliminada');
  }
  refreshActiveCollections();
  renderBudgetsTable();
  refreshDatalists();
}

function templateItemsToText(items = []) {
  return items.map((item) => [item.condition || 'Servicio', item.detail || '', Number(item.price) || 0].join(' | ')).join('\n');
}

function parseTemplateItems(value = '') {
  return String(value).split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line) => {
    const [condition = 'Servicio', detail = '', rawPrice = '0'] = line.split('|').map((part) => part.trim());
    const normalizedPrice = String(rawPrice).replace(/\s/g, '').replace(/\.(?=\d{3}(?:\D|$))/g, '').replace(',', '.');
    return { detail: detail || condition, condition: detail ? condition : 'Servicio', price: Math.max(0, Number(normalizedPrice) || 0) };
  });
}

function quickTemplateDraftFromCurrent() {
  const form = $('#budgetForm');
  return {
    label: '',
    icon: '⚡',
    serviceType: form.elements.serviceType.value || 'Reparación',
    priority: form.elements.priority.value || 'Normal',
    deviceType: form.elements.equipmentType.value || '',
    issue: form.elements.issue.value || '',
    diagnosis: form.elements.diagnosis.value || '',
    result: form.elements.result.value || '',
    work: form.elements.requiredWork.value || '',
    notes: form.elements.notes.value || '',
    items: workingItems.map(({ detail, condition, price }) => ({ detail, condition, price: Number(price) || 0 }))
  };
}

function openQuickTemplateDialog(template = null, { seedFromCurrent = false } = {}) {
  const dialog = $('#quickTemplateDialog');
  const form = $('#quickTemplateForm');
  const source = template || (seedFromCurrent ? quickTemplateDraftFromCurrent() : {});
  form.reset();
  form.elements.id.value = source.id || '';
  form.elements.label.value = source.label || '';
  form.elements.icon.value = source.icon || '⚡';
  form.elements.serviceType.value = source.serviceType || 'Reparación';
  form.elements.priority.value = source.priority || 'Normal';
  form.elements.deviceType.value = source.deviceType || '';
  form.elements.issue.value = source.issue || '';
  form.elements.diagnosis.value = source.diagnosis || '';
  form.elements.work.value = source.work || '';
  form.elements.result.value = source.result || '';
  form.elements.notes.value = source.notes || '';
  form.elements.itemsText.value = templateItemsToText(source.items || []);
  $('#quickTemplateDialogTitle').textContent = source.id ? 'Editar plantilla' : 'Nueva plantilla';
  dialog.showModal();
  requestAnimationFrame(() => form.elements.label.focus());
}

function closeQuickTemplateDialog() {
  const dialog = $('#quickTemplateDialog');
  if (dialog.open) dialog.close();
}

async function handleSaveQuickTemplate(event) {
  event.preventDefault();
  const form = $('#quickTemplateForm');
  if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  const previous = quickTemplates.find((template) => template.id === data.id);
  const source = previous?._storageSource === 'cloud' ? 'cloud' : 'local';
  const now = new Date().toISOString();
  const template = {
    id: data.id || uid(), custom: true,
    label: String(data.label || '').trim(), icon: String(data.icon || '⚡').trim() || '⚡',
    serviceType: data.serviceType || 'Reparación', priority: data.priority || 'Normal', deviceType: data.deviceType || '',
    issue: String(data.issue || '').trim(), diagnosis: String(data.diagnosis || '').trim(), result: String(data.result || '').trim(),
    work: String(data.work || '').trim(), notes: String(data.notes || '').trim(), items: parseTemplateItems(data.itemsText),
    createdAt: previous?.createdAt || now, updatedAt: now, _storageSource: source
  };

  if (source === 'cloud') {
    if (!cloudUser) { toast('La plantilla pertenece a una cuenta cloud que ya no está conectada'); return; }
    await saveCloudQuickTemplateCache({ ...template, _cloudDirty: true });
    if (navigator.onLine) {
      await syncCloudAction(async () => {
        await upsertCloudQuickTemplate(template);
        await saveCloudQuickTemplateCache({ ...template, _cloudDirty: false });
      }, 'Plantilla cloud guardada; sincronización pendiente');
    }
    cloudQuickTemplates = await getCloudQuickTemplatesCache();
  } else {
    await saveQuickTemplate({ ...template, _storageSource: 'local' });
    localQuickTemplates = (await getQuickTemplates()).map((item) => ({ ...item, _storageSource: 'local' }));
  }
  refreshActiveCollections();
  renderQuickServices(); renderCustomTemplatesList(); closeQuickTemplateDialog();
  toast(previous ? 'Plantilla actualizada' : 'Plantilla creada localmente');
}

async function removeQuickTemplate(id) {
  const template = quickTemplates.find((item) => item.id === id);
  if (!template || !confirm(`¿Eliminar la plantilla “${template.label}”?`)) return;
  if (template._storageSource === 'cloud') {
    if (!cloudUser) return;
    await deleteCloudQuickTemplateCache(id);
    cloudQuickTemplates = await getCloudQuickTemplatesCache();
    await syncCloudAction(() => deleteCloudQuickTemplate(id), 'Plantilla quitada del dispositivo; borrado cloud pendiente');
  } else {
    await deleteQuickTemplate(id);
    localQuickTemplates = (await getQuickTemplates()).map((item) => ({ ...item, _storageSource: 'local' }));
  }
  refreshActiveCollections(); renderQuickServices(); renderCustomTemplatesList();
  toast('Plantilla eliminada');
}

function applyQuickService(id) {
  const service = allQuickServices().find((x) => x.id === id);
  if (!service) return;
  const form = $('#budgetForm');
  const hasText = form.elements.diagnosis.value.trim() || form.elements.requiredWork.value.trim();
  if (hasText && !confirm('¿Reemplazar el diagnóstico y trabajo actuales por esta plantilla?')) return;
  if (service.deviceType) setDeviceType(service.deviceType);
  form.elements.issue.value = service.issue;
  form.elements.diagnosis.value = service.diagnosis;
  form.elements.result.value = service.result;
  form.elements.requiredWork.value = service.work;
  if (service.serviceType) form.elements.serviceType.value = service.serviceType;
  if (service.priority) form.elements.priority.value = service.priority;
  if (service.notes && !form.elements.notes.value.trim()) form.elements.notes.value = service.notes;
  const hasUsefulItems = workingItems.some((item) => String(item.detail || '').trim() || Number(item.price));
  if (!hasUsefulItems) {
    workingItems = (service.items || []).map((item) => ({
      id: uid(), qty: 1, detail: item.detail, condition: item.condition,
      warranty: settings.warrantyDays, price: item.price
    }));
    renderItems();
  }
  setDirty();
  updateFinancials();
  toast(`Plantilla “${service.label}” aplicada`);
}

function statusTone(status) {
  return STATUS_OPTIONS.find((x) => x.value === normalizeStatus(status))?.tone || 'cyan';
}

function renderBudgetsTable() {
  const body = $('#budgetsTableBody');
  if (!body) return;
  const q = ($('#budgetSearch')?.value || '').trim().toLowerCase();
  const status = $('#statusFilter')?.value || '';
  const rows = budgets.filter((budget) => {
    const equipment = [budget.equipmentType, budget.brand, budget.model, budget.serial].filter(Boolean).join(' ');
    const haystack = `${padNumber(budget.budgetNumber)} ${budget.clientName || ''} ${budget.clientPhone || ''} ${equipment} ${budget.assignedTechnician || ''} ${budget.serviceType || ''}`.toLowerCase();
    return (!q || haystack.includes(q)) && (!status || normalizeStatus(budget.status) === status);
  });

  body.innerHTML = rows.map((budget) => {
    const total = Number(budget.total ?? budget.subtotal ?? 0);
    const tone = statusTone(budget.status);
    const equipment = [budget.equipmentType, budget.brand, budget.model].filter(Boolean).join(' · ') || '—';
    const equipmentDetail = [budget.serial ? `S/N ${budget.serial}` : '', budget.serviceType].filter(Boolean).join(' · ');
    return `
      <tr>
        <td class="order-number"><strong>#${padNumber(budget.budgetNumber)}</strong><small>${fmtDate(budget.date)}</small></td>
        <td class="order-client"><strong>${escapeHtml(budget.clientName || '—')}</strong><small>${escapeHtml(budget.clientPhone || '')}</small></td>
        <td class="order-device"><strong>${escapeHtml(equipment)}</strong><small>${escapeHtml(equipmentDetail)}</small></td>
        <td><span class="status-chip tone-${tone}"><span></span>${escapeHtml(normalizeStatus(budget.status))}</span></td>
        <td><span class="doc-chip">${escapeHtml(budget.assignedTechnician || 'Sin asignar')}</span></td>
        <td class="num"><strong>${fmtMoney(total)}</strong>${Number(budget.balance) > 0 ? `<small>Saldo ${fmtMoney(budget.balance)}</small>` : ''}</td>
        <td class="row-actions">
          <details class="row-menu">
            <summary aria-label="Acciones">···</summary>
            <div class="row-menu-popover">
              <button type="button" data-edit="${budget.id}">Editar</button>
              <button type="button" data-duplicate="${budget.id}">Duplicar</button>
              <button type="button" data-print-order="${budget.id}">Vista / PDF</button>
              <button class="danger" type="button" data-delete="${budget.id}">Eliminar</button>
            </div>
          </details>
        </td>
      </tr>`;
  }).join('');

  const noRows = !rows.length;
  $('.table-wrap', $('#view-orders')).classList.toggle('hidden', noRows);
  $('#emptyBudgets').classList.toggle('hidden', !noRows);

  $('#statOrders').textContent = budgets.length;
  const pendingBalance = budgets.reduce((sum, b) => sum + Math.max(0, Number(b.balance) || 0), 0);
  $('#statBalance').textContent = fmtMoney(pendingBalance);
  $('#statRepair').textContent = budgets.filter((b) => normalizeStatus(b.status) === 'En reparación').length;
}

function refreshDatalists() {
  const catalogBudgets = allVisibleBudgets();
  const clients = new Map();
  catalogBudgets.forEach((b) => {
    const key = String(b.clientName || '').trim().toLowerCase();
    if (key && !clients.has(key)) clients.set(key, b);
  });
  $('#clientNames').innerHTML = [...clients.values()]
    .map((b) => `<option value="${escapeHtml(b.clientName)}">${escapeHtml(b.clientPhone || '')}</option>`).join('');

  const brands = new Set(COMMON_BRANDS);
  catalogBudgets.forEach((b) => { if (b.brand) brands.add(String(b.brand).trim()); });
  $('#brandList').innerHTML = [...brands].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))
    .map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
  refreshModelList();
}

function refreshModelList() {
  const brand = String($('#budgetForm')?.elements.brand?.value || '').trim().toLowerCase();
  const models = new Set();
  allVisibleBudgets().forEach((b) => {
    if (!b.model) return;
    if (!brand || String(b.brand || '').trim().toLowerCase() === brand) models.add(String(b.model).trim());
  });
  $('#modelList').innerHTML = [...models].filter(Boolean).sort((a, b) => a.localeCompare(b, 'es'))
    .map((value) => `<option value="${escapeHtml(value)}"></option>`).join('');
}

function refreshTechnicianOptions(selected = null) {
  const select = $('#assignedTechnician');
  if (!select) return;
  const current = selected ?? select.value;
  const technicians = normalizeTechnicians(settings);
  select.innerHTML = '<option value="">Sin asignar</option>' + technicians.map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  if (current && !technicians.includes(current)) select.insertAdjacentHTML('beforeend', `<option value="${escapeHtml(current)}">${escapeHtml(current)}</option>`);
  select.value = current || '';
}

function renderTechnicianSettings(focusIndex = null, values = null) {
  const list = $('#techniciansList');
  if (!list) return;
  const technicians = Array.isArray(values) ? values : normalizeTechnicians(settings);
  list.innerHTML = technicians.length ? technicians.map((name, index) => `
    <div class="technician-row" data-technician-index="${index}">
      <label class="field"><span>Técnico ${index + 1}</span><input class="input" name="technicianName" value="${escapeHtml(name)}" placeholder="Nombre completo" /></label>
      <button class="icon-danger" type="button" data-remove-technician="${index}" aria-label="Quitar a ${escapeHtml(name || `Técnico ${index + 1}`)}">×</button>
    </div>
  `).join('') : '<div class="technicians-empty">No hay técnicos cargados. Agregá el primero para poder asignarlo a los trabajos.</div>';
  if (focusIndex !== null) requestAnimationFrame(() => list.querySelector(`[data-technician-index="${focusIndex}"] input`)?.focus());
}

function readTechniciansFromSettingsForm() {
  return [...new Set($$('[name="technicianName"]', $('#settingsForm'))
    .map((input) => input.value.trim())
    .filter(Boolean))];
}

function autofillKnownClient() {
  const form = $('#budgetForm');
  const name = form.elements.clientName.value.trim().toLowerCase();
  if (!name) return;
  const match = allVisibleBudgets().find((b) => String(b.clientName || '').trim().toLowerCase() === name);
  if (!match) return;
  ['clientPhone', 'clientEmail', 'clientTaxId'].forEach((field) => {
    if (!form.elements[field].value && match[field]) form.elements[field].value = match[field];
  });
}

function fillSettingsForm() {
  const form = $('#settingsForm');
  Object.entries(settings).forEach(([key, value]) => {
    if (['logo', 'technicians', 'technician', 'technician2'].includes(key)) return;
    const field = form.elements.namedItem(key);
    if (field) field.value = value ?? '';
  });
  renderTechnicianSettings();
  setDefaultTemplate(settings.defaultTemplate || 'classic');
  renderAppearanceSettings();
  applyAppearanceSettings(settings);
  refreshLogoUI();
  updateBrandUI();
  refreshTechnicianOptions();
  renderCustomTemplatesList();
}

async function handleSaveSettings() {
  const form = $('#settingsForm');
  const data = Object.fromEntries(new FormData(form).entries());
  data.technicians = readTechniciansFromSettingsForm();
  delete data.technicianName;
  data.technician = data.technicians[0] || '';
  data.technician2 = data.technicians[1] || '';
  data.nextNumber = Math.max(1, Number(data.nextNumber) || DEFAULT_SETTINGS.nextNumber);
  data.warrantyDays = Math.max(0, Number(data.warrantyDays) || 0);
  data.validityDays = Math.max(1, Number(data.validityDays) || DEFAULT_SETTINGS.validityDays);
  data.executionDays = Math.max(1, Number(data.executionDays) || DEFAULT_SETTINGS.executionDays);
  data.defaultTemplate = data.defaultTemplate === 'workshop' ? 'workshop' : 'classic';
  data.accentPalette = appearancePalette(data.accentPalette).id;
  data.visualPattern = appearancePattern(data.visualPattern).id;
  data.patternIntensity = Math.max(0, Math.min(100, Number(data.patternIntensity ?? 28)));
  data.documentPattern = $('#documentPatternToggle').checked;
  settings = settingsWithTechnicians({
    ...localSettings,
    ...data,
    logo: pendingLogo !== undefined ? pendingLogo : settings.logo,
    updatedAt: new Date().toISOString()
  });
  pendingLogo = undefined;
  localSettings = { ...settings };
  await saveSettings(localSettings);
  let cloudSynced = false;
  if (cloudUser) {
    cloudSynced = await syncCloudAction(async () => {
      await upsertCloudSettings(await settingsToCloud(localSettings));
      cloudSettingsCache = { ...localSettings, _cloudDirty: false };
      await saveCloudSettingsCache(cloudSettingsCache);
    });
  }
  if (!editingId) setWorkingBudgetNumber(settings.nextNumber);
  updateBrandUI();
  applyAppearanceSettings(settings);
  renderAppearanceSettings();
  refreshLogoUI();
  refreshTechnicianOptions();
  toast(cloudSynced ? 'Ajustes guardados y sincronizados' : 'Ajustes guardados localmente');
}

function termsAsList() {
  return String(settings.terms || DEFAULT_TERMS).split(/\n+/).map((x) => x.trim()).filter(Boolean);
}

function previewLogoHtml(className = 'doc-logo') {
  const blob = currentLogoBlob();
  if (blob) return `<img class="${className}" src="${ensureLogoUrl(blob)}" alt="Logo de ${escapeHtml(settings.businessName || 'Servicio técnico')}" />`;
  return `<img class="${className} default-brand-mark" src="${DEFAULT_MARK_URL}" alt="Isotipo de servicio técnico" />`;
}

function previewDocumentBrandHtml(className = 'document-brand-lockup') {
  if (currentLogoBlob()) return previewLogoHtml('doc-logo uploaded-doc-logo');
  return defaultBrandLockupHtml(className);
}

function providerLegalName() {
  return String(settings.legalName || settings.businessName || 'Prestador del servicio').trim();
}

function providerFiscalIdentity() {
  return [
    settings.cuit ? `CUIT ${settings.cuit}` : '',
    settings.taxCondition || '',
    settings.socialSecurityRegistration ? `Inscripción previsional: ${settings.socialSecurityRegistration}` : '',
    settings.licenseNumber ? `Registro/matrícula: ${settings.licenseNumber}` : ''
  ].filter(Boolean).join(' · ');
}

function warrantyLegalText(budget) {
  const days = Math.max(0, Number(budget.warrantyDays) || 0);
  const start = budget.deliveryDate ? `desde la entrega prevista el ${fmtDate(budget.deliveryDate)}` : 'desde la entrega o finalización efectiva del servicio';
  return days
    ? `${days} días ${start}; responsable: ${providerLegalName()}${settings.address ? `, ${settings.address}` : ''}. Alcance según trabajo y repuestos provistos detallados, sin perjuicio de los derechos legales del consumidor.`
    : `No se ofrece una garantía contractual adicional específica; subsisten los derechos que resulten aplicables por la normativa vigente. Responsable: ${providerLegalName()}.`;
}

function legalReadinessFor(budget, template = budget?.template || 'classic') {
  const missing = [];
  if (!String(settings.legalName || '').trim()) missing.push('razón social/titular');
  if (!String(settings.address || '').trim()) missing.push('domicilio del prestador');
  if (!String(settings.cuit || '').trim()) missing.push('CUIT');
  if (!String(settings.taxCondition || '').trim()) missing.push('condición fiscal');
  if (!String(settings.phone || settings.email || '').trim()) missing.push('contacto del prestador');
  if (!String(budget?.clientName || '').trim()) missing.push('cliente');
  if (!String(budget?.date || '').trim()) missing.push('fecha');
  if (!String(budget?.equipmentType || '').trim()) missing.push('equipo');
  if (template === 'classic') {
    if (!String(budget?.requiredWork || '').trim()) missing.push('trabajo a realizar');
    if (!(budget?.items || []).some((item) => String(item.detail || '').trim())) missing.push('detalle de materiales/mano de obra');
    if (!(Number(budget?.executionDays) > 0)) missing.push('plazo de ejecución');
    if (!(Number(budget?.validityDays) > 0)) missing.push('plazo de aceptación');
    if (budget?.warrantyDays === '' || budget?.warrantyDays === undefined || budget?.warrantyDays === null) missing.push('garantía');
  } else {
    if (!String(budget?.issue || '').trim()) missing.push('falla informada');
  }
  return { complete: missing.length === 0, missing };
}

function legalDraftBanner() {
  // Los faltantes formales se muestran únicamente como recordatorio dentro de la app.
  // Nunca se imprimen ni se incorporan al PDF que recibe el cliente.
  return '';
}

function updateLegalReadiness() {
  const box = $('#legalReadiness');
  const form = $('#budgetForm');
  if (!box || !form) return;
  const budget = {
    template: form.elements.template.value,
    clientName: form.elements.clientName.value,
    date: form.elements.date.value,
    equipmentType: form.elements.equipmentType.value,
    issue: form.elements.issue.value,
    requiredWork: form.elements.requiredWork.value,
    executionDays: form.elements.executionDays.value,
    validityDays: form.elements.validityDays.value,
    warrantyDays: form.elements.warrantyDays.value,
    items: workingItems
  };
  const readiness = legalReadinessFor(budget, budget.template);
  box.classList.toggle('complete', readiness.complete);
  box.classList.toggle('incomplete', !readiness.complete);
  $('strong', box).textContent = readiness.complete ? 'Formalidad básica completa' : 'Documento todavía incompleto';
  $('small', box).textContent = readiness.complete
    ? 'Los datos nacionales básicos de identificación y contenido están completos.'
    : `Falta: ${readiness.missing.join(', ')}.`;
}

function renderElectricalClassicTemplate(budget) {
  const f = getFinancials();
  const terms = termsAsList();
  const items = budget.items.length ? budget.items : [defaultItem('Sin ítems cargados', '—')];
  const technician = budget.assignedTechnician || primaryTechnician('Técnico responsable');
  const equipmentName = [budget.equipmentType, budget.brand, budget.model].filter(Boolean).join(' · ') || '—';
  const hardware = [
    budget.processor ? `CPU: ${budget.processor}` : '',
    budget.memory ? `RAM: ${budget.memory}` : '',
    budget.storage ? `Almacenamiento: ${budget.storage}` : '',
    budget.operatingSystem ? `SO: ${budget.operatingSystem}` : ''
  ].filter(Boolean).join(' · ') || 'No relevados';
  return `
    <article class="a4-page classic-document electrical-document">
      <header class="classic-header">
        <div class="classic-brand">
          <div class="classic-brand-line">${previewDocumentBrandHtml('document-brand-lockup classic-document-brand')}</div>
          <div class="classic-brand-details">
            <p><strong>${escapeHtml(settings.businessName || 'SERVICIO TÉCNICO PC')}</strong>${settings.legalName && settings.legalName !== settings.businessName ? ` · ${escapeHtml(settings.legalName)}` : ''}</p>
            <p>${escapeHtml(settings.tagline || 'PC · Notebooks · Diagnóstico · Reparaciones')}</p>
            <p>${escapeHtml([settings.phone, settings.address, settings.serviceArea, settings.jurisdiction].filter(Boolean).join(' · '))}</p>
            ${providerFiscalIdentity() ? `<p>${escapeHtml(providerFiscalIdentity())}</p>` : ''}
            ${settings.email ? `<p class="classic-brand-email">${escapeHtml(settings.email)}</p>` : ''}
          </div>
        </div>
        <div class="classic-docbox"><small>DOCUMENTO</small><strong>PRESUPUESTO</strong><span>N.º ${padNumber(budget.budgetNumber)}</span></div>
      </header>
      ${legalDraftBanner(budget, 'classic')}

      <div class="classic-titlebar"><strong>PRESUPUESTO / INFORME TÉCNICO</strong><span>Fecha: ${fmtDate(budget.date)}</span><span>Aceptación: ${budget.validityDays} días</span><span>Ejecución estimada: ${budget.executionDays} días</span></div>

      <table class="classic-info"><tbody>
        <tr><th>CLIENTE</th><td>${escapeHtml(budget.clientName || '—')}</td><th>TELÉFONO</th><td>${escapeHtml(budget.clientPhone || '—')}</td></tr>
        <tr><th>DNI / CUIT</th><td>${escapeHtml(budget.clientTaxId || '—')}</td><th>EMAIL</th><td>${escapeHtml(budget.clientEmail || '—')}</td></tr>
        <tr><th>EQUIPO</th><td>${escapeHtml(equipmentName)}</td><th>SERIE</th><td>${escapeHtml(budget.serial || '—')}</td></tr>
        <tr><th>ACCESORIOS</th><td>${escapeHtml(budget.accessories || '—')}</td><th>ESTADO</th><td>${escapeHtml(normalizeStatus(budget.status))}</td></tr>
        <tr><th>SERVICIO</th><td>${escapeHtml(budget.serviceType || '—')}</td><th>TÉCNICO</th><td>${escapeHtml(technician)}</td></tr>
      </tbody></table>

      <section class="classic-section"><h2>FALLA INFORMADA POR EL CLIENTE</h2><p>${multiline(budget.issue || 'Sin detalle cargado.')}</p></section>
      <section class="classic-section"><h2>DIAGNÓSTICO TÉCNICO</h2><p>${multiline(budget.diagnosis || 'Pendiente de diagnóstico.')}</p></section>
      <table class="classic-result"><tbody>
        <tr><th>DATOS DEL EQUIPO</th><td>${escapeHtml(hardware)}</td></tr>
        <tr><th>ESTADO DE INGRESO</th><td>${escapeHtml([budget.exterior, budget.charger ? `Cargador/fuente: ${budget.charger}` : '', budget.backupRequested ? `Backup: ${budget.backupRequested}` : ''].filter(Boolean).join(' · ') || 'Sin observaciones')}</td></tr>
        <tr><th>TRABAJO REQUERIDO</th><td>${multiline(budget.requiredWork || 'Sin trabajo detallado.')}</td></tr>
        <tr><th>RESULTADO / CONCLUSIÓN</th><td>${multiline(budget.result || '—')}</td></tr>
        <tr><th>GARANTÍA OFRECIDA</th><td>${escapeHtml(warrantyLegalText(budget))}</td></tr>
      </tbody></table>

      <section class="classic-section"><h2>REPUESTOS, SERVICIOS Y MANO DE OBRA</h2>
        <table class="classic-items"><thead><tr><th>CANT.</th><th>DETALLE</th><th>RUBRO</th><th>GAR.</th><th>IMPORTE</th></tr></thead><tbody>
          ${items.map((item) => `<tr><td>${Number(item.qty) || 0}</td><td>${escapeHtml(item.detail || '—')}</td><td>${escapeHtml(item.condition || '—')}</td><td>${Number(item.warranty ?? budget.warrantyDays) || 0} días</td><td class="num">${fmtMoney((Number(item.qty) || 0) * (Number(item.price) || 0))}</td></tr>`).join('')}
        </tbody><tfoot>
          ${f.surcharge ? `<tr><td colspan="4">${financialDocumentLabel('Recargo', f.surchargeMode, f.surchargeValue)}</td><td class="num">${fmtMoney(f.surcharge)}</td></tr>` : ''}
          ${f.discount ? `<tr><td colspan="4">${financialDocumentLabel('Descuento', f.discountMode, f.discountValue)}</td><td class="num">- ${fmtMoney(f.discount)}</td></tr>` : ''}
          <tr><td colspan="4">TOTAL</td><td class="num">${fmtMoney(f.total)}</td></tr>
        </tfoot></table>
      </section>

      <section class="classic-section conditions"><h2>CONDICIONES / OBSERVACIONES</h2><ul>${terms.map((term) => `<li>${escapeHtml(term)}</li>`).join('')}</ul>${budget.notes ? `<p class="doc-note"><strong>Observaciones:</strong> ${escapeHtml(budget.notes)}</p>` : ''}</section>
      <div class="classic-finance-line"><span>Forma de pago: <strong>${escapeHtml(budget.paymentMethod || '—')}</strong></span><span>${financialDocumentLabel('Seña / cobrado', f.depositMode, f.depositValue)}: <strong>${fmtMoney(f.deposit)}</strong></span><span>Saldo: <strong>${fmtMoney(f.balance)}</strong></span></div>
      <p class="legal-reference">Presupuesto de reparación emitido con referencia a Ley 24.240, arts. 19 a 24, y normas de consumo aplicables. Los costos no incluidos requieren comunicación previa. La aceptación comprende exclusivamente el alcance detallado. Este documento no reemplaza la factura o comprobante fiscal que corresponda.</p>
      <div class="accept-row"><span><i></i> ACEPTO EL PRESUPUESTO</span><span><i></i> NO ACEPTO</span></div>
      <div class="signature-row"><div><span></span>Firma / aclaración del cliente</div><div><span></span>${escapeHtml(technician)} · Firma / sello</div></div>
    </article>`;
}

function renderElectricalWorkshopTemplate(budget) {
  const f = getFinancials();
  const status = normalizeStatus(budget.status);
  const technician = budget.assignedTechnician || primaryTechnician('Sin asignar');
  const equipmentName = [budget.equipmentType, budget.brand, budget.model].filter(Boolean).join(' · ') || '—';
  const hardware = [budget.processor, budget.memory, budget.storage, budget.operatingSystem].filter(Boolean).join(' · ') || 'No relevado';
  const economicReference = f.total > 0 ? fmtMoney(f.total) : 'A presupuestar';
  const itemCount = (budget.items || []).filter((item) => String(item.detail || '').trim() || Number(item.price)).length;
  const orderTextLength = [budget.issue, budget.exterior, budget.diagnosis, budget.requiredWork, budget.result, budget.notes]
    .map((value) => String(value || '').length)
    .reduce((sum, value) => sum + value, 0);
  const densityClass = orderTextLength > 1150 ? ' workshop-dense' : orderTextLength > 650 ? ' workshop-compact' : '';
  return `
    <article class="a4-page workshop-document electrical-document${densityClass}">
      <header class="workshop-doc-header">
        <div class="workshop-business"><div class="workshop-brand-line">${previewDocumentBrandHtml('document-brand-lockup workshop-document-brand')}</div><p><strong>${escapeHtml(settings.businessName || 'SERVICIO TÉCNICO PC')}</strong>${settings.legalName && settings.legalName !== settings.businessName ? ` · ${escapeHtml(settings.legalName)}` : ''}</p><p>${escapeHtml([settings.phone, settings.address, settings.jurisdiction].filter(Boolean).join(' · '))}</p>${providerFiscalIdentity() ? `<p>${escapeHtml(providerFiscalIdentity())}</p>` : ''}</div>
        <div class="workshop-number"><small>ORDEN DE SERVICIO</small><strong>#${padNumber(budget.budgetNumber)}</strong><span>${fmtDate(budget.date)}</span></div>
      </header>
      ${legalDraftBanner(budget, 'workshop')}

      <div class="workshop-strip"><span>ESTADO</span><strong>${escapeHtml(status)}</strong><span>PRIORIDAD</span><strong>${escapeHtml(budget.priority || 'Normal')}</strong><span>TÉCNICO</span><strong>${escapeHtml(technician)}</strong></div>

      <section class="workshop-box workshop-intake"><h2>RECEPCIÓN · CLIENTE Y EQUIPO</h2><div class="box-grid four">
        <div><small>CLIENTE</small><strong>${escapeHtml(budget.clientName || '—')}</strong></div>
        <div><small>TELÉFONO</small><strong>${escapeHtml(budget.clientPhone || '—')}</strong></div>
        <div><small>DNI / CUIT</small><strong>${escapeHtml(budget.clientTaxId || '—')}</strong></div>
        <div><small>EQUIPO</small><strong>${escapeHtml(equipmentName)}</strong></div>
        <div><small>N.º DE SERIE</small><strong>${escapeHtml(budget.serial || '—')}</strong></div>
        <div><small>ACCESORIOS</small><strong>${escapeHtml(budget.accessories || '—')}</strong></div>
        <div><small>CARGADOR / FUENTE</small><strong>${escapeHtml(budget.charger || '—')}</strong></div>
        <div><small>CREDENCIAL</small><strong>${budget.password ? 'Registrada internamente' : 'No informada'}</strong></div>
      </div></section>

      <section class="workshop-box workshop-intake-detail"><h2>INGRESO Y FALLA INFORMADA</h2><div class="box-grid two compact-grid">
        <div><small>DATOS TÉCNICOS RELEVADOS</small><p>${escapeHtml(hardware)}</p><small class="inline-label">BACKUP</small><p>${escapeHtml(budget.backupRequested || 'No solicitado')}</p></div>
        <div><small>ESTADO FÍSICO DE INGRESO</small><p>${multiline(budget.exterior || 'Sin observaciones cargadas.')}</p></div>
      </div><div class="workshop-text issue-text"><small>FALLA INFORMADA POR EL CLIENTE</small><p>${multiline(budget.issue || '—')}</p></div></section>

      <section class="workshop-authorization"><strong>ALCANCE DE ESTA ORDEN</strong><p>Constancia de recepción y autorización para diagnóstico/revisión técnica razonable. No autoriza por sí sola reparaciones, repuestos ni costos no presupuestados. Cualquier costo adicional debe comunicarse antes de ejecutarse cuando corresponda. No reemplaza factura ni comprobante fiscal.</p></section>

      <section class="workshop-box work-diagnosis compact-diagnosis"><h2>DIAGNÓSTICO / ESTADO DEL TRABAJO</h2><div class="box-grid two">
        <div><small>DIAGNÓSTICO TÉCNICO</small><p>${multiline(budget.diagnosis || 'Pendiente de diagnóstico.')}</p></div>
        <div><small>TRABAJO PROPUESTO / REALIZADO</small><p>${multiline(budget.requiredWork || 'Pendiente de definición.')}</p></div>
      </div>${budget.result ? `<div class="workshop-result"><small>RESULTADO / CONCLUSIÓN</small><strong>${escapeHtml(budget.result)}</strong></div>` : ''}</section>

      <section class="workshop-economy"><div><small>REFERENCIA ECONÓMICA</small><strong>${economicReference}</strong><span>${itemCount ? `${itemCount} concepto${itemCount === 1 ? '' : 's'} cargado${itemCount === 1 ? '' : 's'} · detalle en Presupuesto` : 'Detalle económico a emitir en Presupuesto'}</span></div><div><small>SEÑA / COBRADO</small><strong>${fmtMoney(f.deposit)}</strong></div><div><small>SALDO</small><strong>${fmtMoney(f.balance)}</strong></div><div><small>FORMA DE PAGO</small><strong>${escapeHtml(budget.paymentMethod || '—')}</strong></div></section>

      <section class="workshop-order-conditions"><div><strong>CONDICIONES ESENCIALES</strong><ul><li>Los trabajos y precios definitivos se formalizan en el Presupuesto cuando corresponda; esta Orden no implica aceptación automática de costos.</li><li>Garantía de trabajos efectivamente realizados: ${escapeHtml(warrantyLegalText(budget))}</li><li>Los datos personales se usan para gestionar el servicio. Contacto: ${escapeHtml(settings.privacyContact || settings.email || settings.phone || 'prestador identificado en el encabezado')}.</li></ul></div>${budget.notes ? `<div class="workshop-order-notes"><strong>OBSERVACIONES</strong><p>${multiline(budget.notes)}</p></div>` : ''}${budget.deliveryDate ? `<div class="workshop-delivery"><strong>FINALIZACIÓN PREVISTA</strong><span>${fmtDate(budget.deliveryDate)}</span></div>` : ''}</section>

      <footer class="workshop-signatures"><div><span></span><strong>Cliente / responsable</strong><small>Conforme recepción y autorización de diagnóstico</small></div><div><span></span><strong>${escapeHtml(technician)}</strong><small>Firma / sello técnico</small></div></footer>
    </article>`;
}

function applyPreviewZoom() {
  const area = $('#printArea');
  if (!area) return;
  const effectiveZoom = Math.max(0.2, Math.min(3, previewBaseScale * previewZoomFactor));
  area.style.zoom = String(effectiveZoom);
  const output = $('#previewZoomValue');
  if (output) output.value = `${Math.round(previewZoomFactor * 100)}%`;
  const range = $('#previewZoomRange');
  if (range) range.value = String(Math.round(previewZoomFactor * 100));
}

function setPreviewZoom(factor, { clientX = null, clientY = null, preservePoint = true } = {}) {
  const stage = $('#previewStage');
  const area = $('#printArea');
  const oldEffectiveZoom = Math.max(0.2, Math.min(3, previewBaseScale * previewZoomFactor));
  let anchor = null;
  if (preservePoint && stage && area) {
    const stageRect = stage.getBoundingClientRect();
    const areaRect = area.getBoundingClientRect();
    const anchorX = Number.isFinite(clientX) ? clientX : stageRect.left + stage.clientWidth / 2;
    const anchorY = Number.isFinite(clientY) ? clientY : stageRect.top + stage.clientHeight / 2;
    anchor = {
      clientX: anchorX,
      clientY: anchorY,
      contentX: (anchorX - areaRect.left) / oldEffectiveZoom,
      contentY: (anchorY - areaRect.top) / oldEffectiveZoom
    };
  }
  previewZoomFactor = Math.max(0.5, Math.min(3, Number(factor) || 1));
  applyPreviewZoom();
  if (!anchor || !stage || !area) return;
  const newEffectiveZoom = Math.max(0.2, Math.min(3, previewBaseScale * previewZoomFactor));
  // Leer la geometría fuerza el recálculo inmediatamente. Esto evita acumular
  // varios requestAnimationFrame mientras se arrastra el deslizador y mantiene
  // estable el punto bajo el cursor, el centro del pellizco o el centro visible.
  const areaRect = area.getBoundingClientRect();
  const targetX = areaRect.left + anchor.contentX * newEffectiveZoom;
  const targetY = areaRect.top + anchor.contentY * newEffectiveZoom;
  stage.scrollLeft += targetX - anchor.clientX;
  stage.scrollTop += targetY - anchor.clientY;
}

function changePreviewZoom(command) {
  if (command === 'fit') {
    setPreviewZoom(1, { preservePoint: false });
    requestAnimationFrame(() => $('#previewStage')?.scrollTo({ top: 0, left: 0, behavior: 'smooth' }));
    return;
  }
}

function fitPreview({ reset = false } = {}) {
  const stage = $('#previewStage');
  const area = $('#printArea');
  if (!stage || !area || $('#previewModal')?.classList.contains('hidden')) return;
  const a4WidthPx = 210 * 96 / 25.4;
  const available = Math.max(260, stage.clientWidth - (window.innerWidth <= 920 ? 20 : 40));
  previewBaseScale = Math.max(0.32, Math.min(1, available / a4WidthPx));
  if (reset) previewZoomFactor = 1;
  applyPreviewZoom();
  if (reset) requestAnimationFrame(() => stage.scrollTo({ top: 0, left: 0 }));
}

function renderPreview(template = activePreviewTemplate) {
  const area = $('#printArea');
  if (!area) return;
  const budget = readFormBudget();
  activePreviewTemplate = template === 'workshop' ? 'workshop' : 'classic';
  $$('.preview-tabs button').forEach((button) => button.classList.toggle('active', button.dataset.previewTemplate === activePreviewTemplate));
  area.innerHTML = activePreviewTemplate === 'workshop' ? renderElectricalWorkshopTemplate(budget) : renderElectricalClassicTemplate(budget);
  requestAnimationFrame(fitPreview);
}

function openPreview(template = null, { historyMode = 'auto' } = {}) {
  if (template) setTemplate(template, { markDirty: false });
  renderPreview($('#budgetForm').elements.template.value);
  const modal = $('#previewModal');
  const wasClosed = modal.classList.contains('hidden');
  modal.classList.remove('hidden');
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => fitPreview({ reset: wasClosed }));
  if (wasClosed && historyMode !== 'none') {
    history.pushState({ bigPowerView: currentViewName(), bigPowerLayer: 'preview' }, '', '#vista-previa');
  }
}

function closePreview({ historyMode = 'auto' } = {}) {
  const modal = $('#previewModal');
  if (!modal || modal.classList.contains('hidden')) return;
  modal.classList.add('hidden');
  document.body.classList.remove('modal-open');
  previewPinchStartDistance = 0;
  previewPinchCenter = null;
  if (historyMode !== 'none' && history.state?.bigPowerLayer === 'preview') history.back();
}

function printBudget() {
  renderPreview(activePreviewTemplate);
  setTimeout(() => window.print(), 30);
}

function pdfFilenamePart(value, fallback) {
  const clean = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim();
  return clean || fallback;
}

function pdfCodeDate(value) {
  const iso = /^\d{4}-\d{2}-\d{2}/.exec(String(value || ''))?.[0] || todayISO();
  const [year, month, day] = iso.split('-');
  return `${day}${month}${year.slice(-2)}`;
}

function pdfUniqueCode(budget) {
  const documentNumber = String(Math.max(0, Number(budget.budgetNumber) || 0)).padStart(5, '0');
  const creationDate = pdfCodeDate(budget.createdAt || budget.date);
  return `${documentNumber}${creationDate}`;
}

function setPdfDownloadBusy(busy) {
  pdfDownloadBusy = busy;
  ['downloadPdfBtn', 'railDownloadPdfBtn', 'mobileDownloadPdfBtn', 'downloadPreviewPdfBtn'].forEach((id) => {
    const button = $(`#${id}`);
    if (!button) return;
    button.dataset.idleLabel ||= button.textContent;
    button.disabled = busy;
    button.textContent = busy ? 'Preparando PDF…' : button.dataset.idleLabel;
  });
}

async function downloadCurrentPdf() {
  if (pdfDownloadBusy) return;
  const budget = readFormBudget();
  if (!String(budget.clientName || '').trim()) {
    toast('Ingresá el nombre del cliente para nombrar el PDF');
    $('#budgetForm').elements.clientName.focus();
    return;
  }

  const template = budget.template === 'workshop' ? 'workshop' : 'classic';
  const readiness = legalReadinessFor(budget, template);
  if (!readiness.complete && !confirm(`Recordatorio antes de emitir: faltan ${readiness.missing.join(', ')}. Este aviso no aparecerá en el PDF. ¿Descargar igualmente?`)) return;
  const documentName = template === 'workshop' ? 'Orden de servicio' : 'Presupuesto técnico';
  const number = padNumber(budget.budgetNumber);
  const client = pdfFilenamePart(budget.clientName, 'Cliente');
  const uniqueCode = pdfUniqueCode(budget);
  const filename = `${client}-${uniqueCode}.pdf`;
  const html = template === 'workshop' ? renderElectricalWorkshopTemplate(budget) : renderElectricalClassicTemplate(budget);

  setPdfDownloadBusy(true);
  try {
    const { downloadA4Pdf } = await import('./pdf-export.js');
    const result = await downloadA4Pdf({
      html,
      filename,
      title: `${documentName} Nro ${number} - ${client}`,
      subject: `${documentName} A4 de ${settings.businessName || 'Servicio técnico'} para ${client}`
    });
    if (result.delivery === 'cancelled') toast('Guardado del PDF cancelado');
    else if (result.delivery === 'share') toast(`PDF listo en iOS: ${filename}`);
    else toast(`PDF A4 descargado: ${filename}`);
  } catch (error) {
    console.error('Descarga PDF:', error);
    const detail = String(error?.message || 'Error desconocido').replace(/\s+/g, ' ').slice(0, 92);
    toast(`No se pudo generar el PDF: ${detail}`);
  } finally {
    setPdfDownloadBusy(false);
  }
}

async function previewStoredBudget(id) {
  if (dirty && !confirm('Hay cambios sin guardar. ¿Abrir otra orden igualmente?')) return;
  const budget = activeOrderSource === 'cloud' ? await getCloudBudgetCache(id) : await getBudget(id);
  if (!budget) return;
  fillEditorFromBudget(budget, { source: activeOrderSource });
  showView('new');
  openPreview(budget.template || 'classic');
}

async function blobToDataURL(blob) {
  if (!blob) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function dataURLToBlob(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const [meta, data] = dataUrl.split(',');
  if (!meta || !data) return null;
  const mime = /data:([^;]+)/.exec(meta)?.[1] || 'application/octet-stream';
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function exportBackup() {
  const cleanSettings = { ...localSettings, logo: undefined, logoDataUrl: await blobToDataURL(localSettings.logo) };
  const safeBudgets = localBudgets.map((budget) => ({ ...budget, credentialProvided: Boolean(budget.password), password: '' }));
  const safeTemplates = localQuickTemplates.map(({ _storageSource, _cloudDirty, ...template }) => template);
  const payload = { app: 'presupuestos-tecnicos', product: 'servitaller', version: 8, exportedAt: new Date().toISOString(), scope: 'local-device', settings: cleanSettings, budgets: safeBudgets, quickTemplates: safeTemplates, privacy: { accessCredentialsExcluded: true, cloudDataExcluded: true } };
  downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `backup-servitaller-${todayISO()}.json`);
  toast('Backup exportado sin claves/PIN');
}

async function importBackup(file) {
  try {
    const data = JSON.parse(await file.text());
    if (data?.app !== 'presupuestos-tecnicos' || !data.settings || !Array.isArray(data.budgets)) throw new Error('Formato inválido');
    if (!confirm(`Se reemplazarán los datos locales por ${data.budgets.length} órdenes del backup. ¿Continuar?`)) return;
    const restoredSettings = applyBigPowerProfile({ ...data.settings, logo: data.settings.logoDataUrl ? dataURLToBlob(data.settings.logoDataUrl) : null });
    delete restoredSettings.logoDataUrl;
    await replaceAllData(restoredSettings, data.budgets, Array.isArray(data.quickTemplates) ? data.quickTemplates : []);
    location.reload();
  } catch (error) {
    console.error(error);
    toast('No se pudo importar el backup');
  }
}

function attachEvents() {
  $$('[data-theme-toggle]').forEach((button) => button.addEventListener('click', toggleTheme));

  $$('.nav-item').forEach((button) => button.addEventListener('click', () => {
    const view = button.dataset.view;
    if (view === 'new' && !button.classList.contains('active')) {
      if (dirty && !confirm('Hay cambios sin guardar. ¿Crear una orden nueva igualmente?')) return;
      resetEditor();
    }
    showView(view);
  }));

  const createNew = () => {
    if (dirty && !confirm('Hay cambios sin guardar. ¿Crear una orden nueva igualmente?')) return;
    resetEditor();
    showView('new');
  };

  $('#newBudgetBtn').addEventListener('click', createNew);
  $('#mobileNewBtn').addEventListener('click', createNew);
  $('#ordersNewBtn').addEventListener('click', createNew);
  $('#emptyNewBtn').addEventListener('click', createNew);
  $('#saveBudgetBtn').addEventListener('click', handleSaveBudget);
  $('#mobileSaveBtn').addEventListener('click', handleSaveBudget);
  $('#previewBudgetBtn').addEventListener('click', () => openPreview());
  $('#railPreviewBtn').addEventListener('click', () => openPreview());
  $('#mobilePreviewBtn').addEventListener('click', () => openPreview());
  $('#printBudgetBtn').addEventListener('click', printBudget);
  ['downloadPdfBtn', 'railDownloadPdfBtn', 'mobileDownloadPdfBtn', 'downloadPreviewPdfBtn'].forEach((id) => {
    $(`#${id}`)?.addEventListener('click', downloadCurrentPdf);
  });

  $('#mobileMenuBtn').addEventListener('click', () => document.body.classList.toggle('menu-open'));
  $('#openManualBtn').addEventListener('click', () => showView('manual'));
  $('#openVersionsBtn').addEventListener('click', () => showView('versions'));
  $('#manualHomeBtn').addEventListener('click', () => showView('new'));
  $('#versionsHomeBtn').addEventListener('click', () => showView('new'));
  $$('[data-manual-link]').forEach((link) => link.addEventListener('click', (event) => {
    event.preventDefault();
    document.querySelector(link.getAttribute('href'))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));

  $$('[data-toggle]').forEach((button) => button.addEventListener('click', () => {
    const target = document.getElementById(button.dataset.toggle);
    target?.classList.toggle('hidden');
    button.classList.toggle('active', !target?.classList.contains('hidden'));
  }));

  $$('.device-btn').forEach((button) => button.addEventListener('click', () => {
    setDeviceType(button.dataset.device);
    setDirty();
  }));

  $('#statusPicker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-status]');
    if (!button) return;
    renderStatusPicker(button.dataset.status);
    setDirty();
  });

  $('#quickServices').addEventListener('click', (event) => {
    const button = event.target.closest('[data-service]');
    if (button) applyQuickService(button.dataset.service);
  });
  $('#saveAsQuickTemplateBtn').addEventListener('click', () => openQuickTemplateDialog(null, { seedFromCurrent: true }));

  $('#addItemBtn').addEventListener('click', () => {
    workingItems.push(defaultItem());
    renderItems();
    setDirty();
    setTimeout(() => $('#itemsContainer .item-row:last-child [data-item-field="detail"]')?.focus(), 0);
  });

  $('#itemsContainer').addEventListener('input', (event) => {
    const row = event.target.closest('.item-row');
    const field = event.target.dataset.itemField;
    if (!row || !field) return;
    const item = workingItems.find((x) => x.id === row.dataset.id);
    if (!item) return;
    item[field] = ['qty', 'price', 'warranty'].includes(field) ? Number(event.target.value) : event.target.value;
    updateFinancials();
    setDirty();
  });

  $('#itemsContainer').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-item]');
    if (!button) return;
    workingItems = workingItems.filter((item) => item.id !== button.dataset.removeItem);
    renderItems();
    setDirty();
  });

  $('#budgetForm').addEventListener('input', (event) => {
    if (event.target.closest('#itemsContainer')) return;
    if (event.target.name === 'budgetNumber' && event.target.value) {
      workingBudgetNumber = Math.max(1, Math.trunc(Number(event.target.value) || 1));
      $('#editorTitle').textContent = `Orden #${padNumber(workingBudgetNumber)}`;
    }
    if (['surcharge', 'discount', 'deposit'].includes(event.target.name)) updateFinancials();
    setDirty();
  });
  $('#budgetForm').addEventListener('click', (event) => {
    const toggle = event.target.closest('[data-financial-toggle]');
    if (toggle) toggleFinancialMode(toggle.dataset.financialToggle);
  });
  $('#budgetForm').addEventListener('change', (event) => {
    if (event.target.name === 'clientName') autofillKnownClient();
    if (event.target.name === 'brand') refreshModelList();
    if (event.target.name === 'budgetNumber') setWorkingBudgetNumber(event.target.value, { markDirty: true });
    if (['surcharge', 'discount', 'deposit'].includes(event.target.name)) updateFinancials();
    setDirty();
  });
  $('#budgetForm').elements.clientName.addEventListener('blur', autofillKnownClient);

  $('#templatePicker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-template]');
    if (button) setTemplate(button.dataset.template);
  });

  $('#previewModal').addEventListener('click', (event) => {
    if (event.target.closest('[data-close-preview]')) closePreview();
    const tab = event.target.closest('[data-preview-template]');
    if (tab) setTemplate(tab.dataset.previewTemplate);
    const zoom = event.target.closest('[data-preview-zoom]');
    if (zoom) changePreviewZoom(zoom.dataset.previewZoom);
  });

  $('#previewZoomRange').addEventListener('input', (event) => {
    setPreviewZoom(Number(event.target.value) / 100);
  });

  const previewStage = $('#previewStage');
  previewStage.addEventListener('touchstart', (event) => {
    if (event.touches.length !== 2) return;
    previewPinchStartDistance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    previewPinchStartZoom = previewZoomFactor;
    previewPinchCenter = {
      clientX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
      clientY: (event.touches[0].clientY + event.touches[1].clientY) / 2
    };
  }, { passive: true });
  previewStage.addEventListener('touchmove', (event) => {
    if (event.touches.length !== 2 || !previewPinchStartDistance) return;
    event.preventDefault();
    const distance = Math.hypot(
      event.touches[0].clientX - event.touches[1].clientX,
      event.touches[0].clientY - event.touches[1].clientY
    );
    previewPinchCenter = {
      clientX: (event.touches[0].clientX + event.touches[1].clientX) / 2,
      clientY: (event.touches[0].clientY + event.touches[1].clientY) / 2
    };
    setPreviewZoom(previewPinchStartZoom * (distance / previewPinchStartDistance), previewPinchCenter);
  }, { passive: false });
  previewStage.addEventListener('touchend', (event) => {
    if (event.touches.length < 2) {
      previewPinchStartDistance = 0;
      previewPinchCenter = null;
    }
  }, { passive: true });
  previewStage.addEventListener('wheel', (event) => {
    if (!event.ctrlKey) return;
    event.preventDefault();
    setPreviewZoom(previewZoomFactor * (event.deltaY < 0 ? 1.08 : 1 / 1.08), { clientX: event.clientX, clientY: event.clientY });
  }, { passive: false });
  previewStage.addEventListener('dblclick', (event) => {
    const targetZoom = previewZoomFactor > 1.05 ? 1 : 1.75;
    setPreviewZoom(targetZoom, { clientX: event.clientX, clientY: event.clientY });
  });

  $('#budgetSearch').addEventListener('input', renderBudgetsTable);
  $('#statusFilter').addEventListener('change', renderBudgetsTable);
  $('#orderSourceTabs')?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-order-source]');
    if (!button || button.disabled) return;
    setOrderSource(button.dataset.orderSource);
  });
  $('#orderStorageScope')?.addEventListener('change', (event) => {
    const requested = event.target.value;
    if (editingId) {
      setEditorStorageSource(editingSource, { force: true });
      toast('El origen no puede cambiarse mientras editás una orden existente. Usá Duplicar para crear una copia local.');
      return;
    }
    if (requested === 'cloud' && !cloudUser) {
      setEditorStorageSource('local', { force: true });
      openCloudAuthDialog();
      return;
    }
    setEditorStorageSource(requested, { force: true });
    setWorkingBudgetNumber(nextBudgetNumberForSource(requested));
    $('#saveState').textContent = requested === 'cloud' ? 'Nueva · destino nube' : 'Nueva · destino local';
  });

  $('#budgetsTableBody').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit]');
    const duplicate = event.target.closest('[data-duplicate]');
    const remove = event.target.closest('[data-delete]');
    const print = event.target.closest('[data-print-order]');
    if (edit) openBudget(edit.dataset.edit);
    if (duplicate) duplicateBudget(duplicate.dataset.duplicate);
    if (remove) removeBudget(remove.dataset.delete);
    if (print) previewStoredBudget(print.dataset.printOrder);
    if (event.target.tagName === 'BUTTON') event.target.closest('.row-menu')?.removeAttribute('open');
  });

  $('#saveSettingsBtn').addEventListener('click', handleSaveSettings);
  $('#palettePicker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-accent-choice]');
    if (!button) return;
    $('#settingsForm').elements.accentPalette.value = button.dataset.accentChoice;
    $$('#palettePicker .palette-option').forEach((item) => {
      const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-checked', String(active));
    });
    previewAppearanceFromForm();
  });
  $('#patternPicker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-pattern-choice]');
    if (!button) return;
    $('#settingsForm').elements.visualPattern.value = button.dataset.patternChoice;
    $$('#patternPicker .pattern-option').forEach((item) => {
      const active = item === button; item.classList.toggle('active', active); item.setAttribute('aria-checked', String(active));
    });
    previewAppearanceFromForm();
  });
  $('#patternIntensity').addEventListener('input', (event) => {
    $('#patternIntensityValue').value = `${event.target.value}%`;
    previewAppearanceFromForm();
  });
  $('#documentPatternToggle').addEventListener('change', previewAppearanceFromForm);
  $('#addTechnicianBtn').addEventListener('click', () => {
    const values = $$('[name="technicianName"]', $('#settingsForm')).map((input) => input.value);
    values.push('');
    renderTechnicianSettings(values.length - 1, values);
  });
  $('#techniciansList').addEventListener('click', (event) => {
    const remove = event.target.closest('[data-remove-technician]');
    if (!remove) return;
    const index = Number(remove.dataset.removeTechnician);
    const values = $$('[name="technicianName"]', $('#settingsForm')).map((input) => input.value).filter((_, itemIndex) => itemIndex !== index);
    renderTechnicianSettings(null, values);
  });
  $('#cloudAccountShortcut').addEventListener('click', openCloudAuthDialog);
  $('#cloudAuthBtn').addEventListener('click', openCloudAuthDialog);
  $('#cloudSyncBtn').addEventListener('click', () => synchronizeCloudData());
  $('#cloudSwitchAccountBtn')?.addEventListener('click', handleCloudSwitchAccount);
  $('#cloudSignOutBtn').addEventListener('click', handleCloudSignOut);
  $('#cloudAuthForm').addEventListener('submit', handleCloudSignIn);
  $('#cloudSignUpBtn').addEventListener('click', handleCloudSignUp);
  $$('[data-close-cloud]').forEach((button) => button.addEventListener('click', closeCloudAuthDialog));
  $('#cloudAuthDialog').addEventListener('click', (event) => {
    if (event.target === $('#cloudAuthDialog')) closeCloudAuthDialog();
  });
  $('#newQuickTemplateBtn').addEventListener('click', () => openQuickTemplateDialog());
  $('#quickTemplateForm').addEventListener('submit', handleSaveQuickTemplate);
  $$('[data-close-template]').forEach((button) => button.addEventListener('click', closeQuickTemplateDialog));
  $('#quickTemplateDialog').addEventListener('click', (event) => {
    if (event.target === $('#quickTemplateDialog')) closeQuickTemplateDialog();
  });
  $('#customTemplatesList').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-quick-template]');
    const remove = event.target.closest('[data-delete-quick-template]');
    if (edit) openQuickTemplateDialog(quickTemplates.find((template) => template.id === edit.dataset.editQuickTemplate));
    if (remove) removeQuickTemplate(remove.dataset.deleteQuickTemplate);
  });
  $('#defaultTemplatePicker').addEventListener('click', (event) => {
    const button = event.target.closest('[data-template]');
    if (button) setDefaultTemplate(button.dataset.template);
  });
  $('#logoInput').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      toast('El logo debe pesar menos de 3 MB');
      event.target.value = '';
      return;
    }
    pendingLogo = file;
    logoSourceCache = null;
    refreshLogoUI();
  });
  $('#removeLogoBtn').addEventListener('click', () => {
    pendingLogo = null;
    $('#logoInput').value = '';
    logoSourceCache = null;
    refreshLogoUI();
  });
  $('#exportBackupBtn').addEventListener('click', exportBackup);
  $('#importBackupInput').addEventListener('change', (event) => {
    const file = event.target.files?.[0];
    if (file) importBackup(file);
    event.target.value = '';
  });

  document.addEventListener('click', (event) => {
    $$('.row-menu[open]').forEach((menu) => { if (!menu.contains(event.target)) menu.open = false; });
    if (document.body.classList.contains('menu-open') && !event.target.closest('.sidebar') && !event.target.closest('#mobileMenuBtn')) document.body.classList.remove('menu-open');
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closePreview();
      closeQuickTemplateDialog();
      closeCloudAuthDialog();
      document.body.classList.remove('menu-open');
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
      event.preventDefault();
      if ($('#view-new').classList.contains('active-view')) handleSaveBudget();
      if ($('#view-settings').classList.contains('active-view')) handleSaveSettings();
    }
    if (!event.ctrlKey && !event.metaKey && !event.altKey && event.key.toLowerCase() === 'n' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName || '')) createNew();
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    $('#installAppBtn')?.classList.remove('hidden');
  });
  window.addEventListener('appinstalled', () => {
    deferredInstallPrompt = null;
    $('#installAppBtn')?.classList.add('hidden');
    toast('Aplicación instalada');
  });
  $('#installAppBtn')?.addEventListener('click', async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    $('#installAppBtn')?.classList.add('hidden');
  });
  window.addEventListener('resize', () => requestAnimationFrame(fitPreview));
  window.addEventListener('popstate', (event) => {
    const state = event.state || {};
    const view = ['new', 'orders', 'settings', 'manual', 'versions'].includes(state.bigPowerView) ? state.bigPowerView : 'new';
    if (state.bigPowerLayer !== 'preview') closePreview({ historyMode: 'none' });
    closeCloudAuthDialog();
    closeQuickTemplateDialog();
    showView(view, { historyMode: 'none' });
    if (state.bigPowerLayer === 'preview') openPreview(null, { historyMode: 'none' });
  });

  ['gesturestart', 'gesturechange', 'gestureend'].forEach((type) => {
    document.addEventListener(type, (event) => event.preventDefault(), { passive: false });
  });

  window.addEventListener('online', () => {
    updateConnectionStatus();
    synchronizeCloudData({ notify: false });
  });
  window.addEventListener('offline', updateConnectionStatus);
  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function updateConnectionStatus() {
  renderCloudState();
}

async function requestPersistentStorage() {
  try { if (navigator.storage?.persist) await navigator.storage.persist(); } catch (_) {}
}

async function warmPdfDependencies() {
  if (!navigator.onLine || !('caches' in window)) return;
  try {
    const cache = await caches.open('servitaller-pdf-deps-v1');
    await Promise.allSettled(PDF_DEPENDENCY_URLS.map(async (url) => {
      const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
      if (response.ok) await cache.put(url, response.clone());
    }));
  } catch (error) {
    console.warn('PDF offline cache:', error);
  }
}

async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try { const registration = await navigator.serviceWorker.register('./service-worker.js'); await registration.update(); } catch (error) { console.warn('Service Worker:', error); }
}

async function init() {
  applyTheme(document.documentElement.dataset.theme || 'dark');
  initializeAppHistory();
  renderQuickServices();
  attachEvents();
  const [savedSettings, savedBudgets, savedQuickTemplates] = await Promise.all([getSettings(), getBudgets(), getQuickTemplates()]);
  localSettingsWasNew = !savedSettings;
  const needsBrandMigration = (Number(savedSettings?.brandProfileVersion) || 0) < BRAND_PROFILE_VERSION;
  const needsTechnicianMigration = Boolean(savedSettings) && !Array.isArray(savedSettings.technicians);
  localSettings = applyBigPowerProfile(savedSettings || {});
  localSettings.terms ||= DEFAULT_TERMS;
  localSettings.defaultTemplate ||= 'classic';
  localSettings.updatedAt ||= new Date().toISOString();
  if (needsTechnicianMigration) localSettings.updatedAt = new Date().toISOString();
  settings = localSettings;
  applyAppearanceSettings(settings);
  if (!savedSettings || needsBrandMigration || needsTechnicianMigration || !savedSettings.updatedAt) await saveSettings(localSettings);

  localBudgets = savedBudgets;
  localQuickTemplates = savedQuickTemplates.map((template) => ({ ...template, _storageSource: 'local' }));
  cloudBudgets = [];
  cloudQuickTemplates = [];
  refreshActiveCollections();
  renderQuickServices();
  fillSettingsForm();
  refreshDatalists();
  const filter = $('#statusFilter');
  filter.innerHTML = '<option value="">Todos los estados</option>' + STATUS_OPTIONS.map((s) => `<option>${escapeHtml(s.value)}</option>`).join('');
  resetEditor();
  setOrderSource('local');

  cloudUser = await initializeCloud();
  if (cloudUser) {
    await synchronizeCloudData({ notify: false });
  } else {
    // Si la sesión anterior expiró o fue cerrada fuera de la app, no deben quedar datos cloud persistidos.
    await purgeCloudDeviceData();
    settings = localSettings;
    fillSettingsForm();
    setOrderSource('local');
  }
  renderCloudState();
  await requestPersistentStorage();
  await registerServiceWorker();
  warmPdfDependencies();

  showView('new', { historyMode: 'none' });
  if (!savedSettings) toast('TallerPc listo para crear la primera orden');
}

init().catch((error) => {
  console.error(error);
  toast('No se pudo iniciar la aplicación');
});
