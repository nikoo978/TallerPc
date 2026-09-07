const DB_NAME = 'presupuestos-tecnicos';
const DB_VERSION = 3;
const SETTINGS_STORE = 'settings';
const BUDGETS_STORE = 'budgets';
const QUICK_TEMPLATES_STORE = 'quickTemplates';
const CLOUD_SETTINGS_STORE = 'cloudSettings';
const CLOUD_BUDGETS_STORE = 'cloudBudgets';
const CLOUD_QUICK_TEMPLATES_STORE = 'cloudQuickTemplates';

function ensureBudgetStore(db, name) {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, { keyPath: 'id' });
  store.createIndex('budgetNumber', 'budgetNumber', { unique: false });
  store.createIndex('updatedAt', 'updatedAt', { unique: false });
}

function ensureTemplateStore(db, name) {
  if (db.objectStoreNames.contains(name)) return;
  const store = db.createObjectStore(name, { keyPath: 'id' });
  store.createIndex('label', 'label', { unique: false });
  store.createIndex('updatedAt', 'updatedAt', { unique: false });
}

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
      if (!db.objectStoreNames.contains(BUDGETS_STORE)) {
        const store = db.createObjectStore(BUDGETS_STORE, { keyPath: 'id' });
        store.createIndex('budgetNumber', 'budgetNumber', { unique: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(QUICK_TEMPLATES_STORE)) {
        const store = db.createObjectStore(QUICK_TEMPLATES_STORE, { keyPath: 'id' });
        store.createIndex('label', 'label', { unique: false });
        store.createIndex('updatedAt', 'updatedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(CLOUD_SETTINGS_STORE)) db.createObjectStore(CLOUD_SETTINGS_STORE, { keyPath: 'id' });
      ensureBudgetStore(db, CLOUD_BUDGETS_STORE);
      ensureTemplateStore(db, CLOUD_QUICK_TEMPLATES_STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function withStore(storeName, mode, callback) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    let result;
    try { result = callback(store); } catch (error) { reject(error); return; }
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getAllSorted(storeName, label = false) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(storeName, 'readonly').objectStore(storeName).getAll();
    req.onsuccess = () => {
      const rows = req.result || [];
      rows.sort(label
        ? (a, b) => String(a.label || '').localeCompare(String(b.label || ''), 'es')
        : (a, b) => (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || ''));
      resolve(rows);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function getSettings() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(SETTINGS_STORE, 'readonly').objectStore(SETTINGS_STORE).get('main');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSettings(settings) {
  return withStore(SETTINGS_STORE, 'readwrite', (store) => store.put({ ...settings, id: 'main' }));
}

export function getBudgets() { return getAllSorted(BUDGETS_STORE); }
export async function getBudget(id) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(BUDGETS_STORE, 'readonly').objectStore(BUDGETS_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
export function saveBudget(budget) { return withStore(BUDGETS_STORE, 'readwrite', (store) => store.put(budget)); }
export function deleteBudget(id) { return withStore(BUDGETS_STORE, 'readwrite', (store) => store.delete(id)); }

export function getQuickTemplates() { return getAllSorted(QUICK_TEMPLATES_STORE, true); }
export function saveQuickTemplate(template) { return withStore(QUICK_TEMPLATES_STORE, 'readwrite', (store) => store.put(template)); }
export function deleteQuickTemplate(id) { return withStore(QUICK_TEMPLATES_STORE, 'readwrite', (store) => store.delete(id)); }

export async function getCloudSettingsCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(CLOUD_SETTINGS_STORE, 'readonly').objectStore(CLOUD_SETTINGS_STORE).get('main');
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
export function saveCloudSettingsCache(value) { return withStore(CLOUD_SETTINGS_STORE, 'readwrite', (store) => store.put({ ...value, id: 'main' })); }
export function getCloudBudgetsCache() { return getAllSorted(CLOUD_BUDGETS_STORE); }
export function getCloudBudgetCache(id) {
  return openDB().then((db) => new Promise((resolve, reject) => {
    const req = db.transaction(CLOUD_BUDGETS_STORE, 'readonly').objectStore(CLOUD_BUDGETS_STORE).get(id);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  }));
}
export function saveCloudBudgetCache(budget) { return withStore(CLOUD_BUDGETS_STORE, 'readwrite', (store) => store.put(budget)); }
export function deleteCloudBudgetCache(id) { return withStore(CLOUD_BUDGETS_STORE, 'readwrite', (store) => store.delete(id)); }
export function getCloudQuickTemplatesCache() { return getAllSorted(CLOUD_QUICK_TEMPLATES_STORE, true); }
export function saveCloudQuickTemplateCache(template) { return withStore(CLOUD_QUICK_TEMPLATES_STORE, 'readwrite', (store) => store.put(template)); }
export function deleteCloudQuickTemplateCache(id) { return withStore(CLOUD_QUICK_TEMPLATES_STORE, 'readwrite', (store) => store.delete(id)); }

export async function replaceCloudCache(settings, budgets = [], quickTemplates = []) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CLOUD_SETTINGS_STORE, CLOUD_BUDGETS_STORE, CLOUD_QUICK_TEMPLATES_STORE], 'readwrite');
    const settingsStore = tx.objectStore(CLOUD_SETTINGS_STORE);
    const budgetsStore = tx.objectStore(CLOUD_BUDGETS_STORE);
    const templateStore = tx.objectStore(CLOUD_QUICK_TEMPLATES_STORE);
    settingsStore.clear(); budgetsStore.clear(); templateStore.clear();
    if (settings) settingsStore.put({ ...settings, id: 'main' });
    (budgets || []).forEach((budget) => budgetsStore.put(budget));
    (quickTemplates || []).forEach((template) => templateStore.put(template));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function clearCloudCache() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([CLOUD_SETTINGS_STORE, CLOUD_BUDGETS_STORE, CLOUD_QUICK_TEMPLATES_STORE], 'readwrite');
    tx.objectStore(CLOUD_SETTINGS_STORE).clear();
    tx.objectStore(CLOUD_BUDGETS_STORE).clear();
    tx.objectStore(CLOUD_QUICK_TEMPLATES_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function replaceAllData(settings, budgets, quickTemplates = []) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([SETTINGS_STORE, BUDGETS_STORE, QUICK_TEMPLATES_STORE], 'readwrite');
    const settingsStore = tx.objectStore(SETTINGS_STORE);
    const budgetsStore = tx.objectStore(BUDGETS_STORE);
    const quickTemplatesStore = tx.objectStore(QUICK_TEMPLATES_STORE);
    settingsStore.clear(); budgetsStore.clear(); quickTemplatesStore.clear();
    settingsStore.put({ ...settings, id: 'main' });
    (budgets || []).forEach((budget) => budgetsStore.put(budget));
    (quickTemplates || []).forEach((template) => quickTemplatesStore.put(template));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
