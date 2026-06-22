/**
 * BudgetWing — Data Store
 * Manages budget items with localStorage persistence
 * and a simple event emitter for reactive updates.
 */

import { getPaletteColor } from './utils/colors.js';

const STORAGE_KEY = 'budgetwing_v1';

// ---- Event Emitter ----
const listeners = {};

function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
}

function emit(event, data) {
  (listeners[event] || []).forEach(fn => fn(data));
}

// ---- State ----
let state = {
  items: [],
  currency: '$',
  totalBudget: null,   // null = use sum of categories; number = user-set budget
  nextId: 1,
};

// ---- Persistence ----
function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = { ...state, ...saved };
    }
  } catch (e) {
    console.warn('BudgetWing: Could not load from localStorage', e);
  }
}

function saveToStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('BudgetWing: Could not save to localStorage', e);
  }
}

// ---- CRUD ----
function addItem({ label, amount, color, note = '' }) {
  const item = {
    id: state.nextId++,
    label: label.trim(),
    amount: parseFloat(amount) || 0,
    color: color || getPaletteColor(state.items.length),
    note: note.trim(),
    createdAt: Date.now(),
  };
  state.items.push(item);
  saveToStorage();
  emit('change', getAll());
  return item;
}

function updateItem(id, updates) {
  const idx = state.items.findIndex(i => i.id === id);
  if (idx === -1) return null;
  state.items[idx] = {
    ...state.items[idx],
    ...updates,
    amount: parseFloat(updates.amount ?? state.items[idx].amount) || 0,
    updatedAt: Date.now(),
  };
  saveToStorage();
  emit('change', getAll());
  return state.items[idx];
}

function deleteItem(id) {
  state.items = state.items.filter(i => i.id !== id);
  saveToStorage();
  emit('change', getAll());
}

function getAll() {
  const items = state.items.map(item => ({ ...item }));
  const savingsItem = items.find(item => item.label.toLowerCase() === 'savings');
  
  if (state.totalBudget != null && savingsItem) {
    const otherSum = items
      .filter(item => item.id !== savingsItem.id)
      .reduce((sum, item) => sum + item.amount, 0);
    savingsItem.amount = Math.max(0, state.totalBudget - otherSum);
  }
  
  return items;
}

/** Sum of all category amounts (effective) */
function getSpent() {
  return getAll().reduce((sum, i) => sum + i.amount, 0);
}

/**
 * The effective total budget:
 * - If the user set one explicitly → that value
 * - Otherwise → sum of all category amounts
 */
function getTotal() {
  return state.totalBudget != null ? state.totalBudget : getSpent();
}

function getTotalBudget() {
  return state.totalBudget;  // raw value, null if not set
}

function setTotalBudget(value) {
  const parsed = parseFloat(value);
  state.totalBudget = (isNaN(parsed) || parsed < 0) ? null : parsed;
  saveToStorage();
  emit('change', getAll());
}

function clearTotalBudget() {
  state.totalBudget = null;
  saveToStorage();
  emit('change', getAll());
}

function setCurrency(symbol) {
  state.currency = symbol;
  saveToStorage();
  emit('currencyChange', symbol);
}

function getCurrency() {
  return state.currency;
}

function importItems(items) {
  state.items = items.map((item, idx) => ({
    id: state.nextId++,
    label: String(item.label || item.name || 'Category').trim(),
    amount: parseFloat(item.amount || item.value || 0) || 0,
    color: item.color || getPaletteColor(idx),
    note: String(item.note || item.description || '').trim(),
    createdAt: Date.now(),
  }));
  saveToStorage();
  emit('change', getAll());
}

// Initialize
loadFromStorage();

// Seed with demo data if empty
if (state.items.length === 0) {
  const demos = [
    { label: 'Housing',         amount: 1500, color: '#4f9eff', note: 'Rent & utilities' },
    { label: 'Food & Groceries',amount:  600, color: '#3dffa0', note: 'Supermarket + dining' },
    { label: 'Transport',       amount:  350, color: '#ffb545', note: 'Fuel, transit, parking' },
    { label: 'Entertainment',   amount:  200, color: '#a259ff', note: 'Streaming, outings' },
    { label: 'Healthcare',      amount:  150, color: '#ff6bce', note: 'Insurance & meds' },
    { label: 'Savings',         amount:  400, color: '#00d4ff', note: 'Emergency fund' },
  ];
  demos.forEach(d => {
    state.items.push({ id: state.nextId++, ...d, createdAt: Date.now() });
  });
  saveToStorage();
}

export const store = {
  on,
  emit,
  addItem,
  updateItem,
  deleteItem,
  getAll,
  getTotal,
  getSpent,
  getTotalBudget,
  setTotalBudget,
  clearTotalBudget,
  setCurrency,
  getCurrency,
  importItems,
};
