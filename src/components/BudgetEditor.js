/**
 * BudgetWing — Budget Editor Panel
 * Slide-in panel for add/edit/delete budget categories
 */

import { PALETTE } from '../utils/colors.js';

export class BudgetEditor {
  constructor({ store }) {
    this.store = store;
    this.editingId = null;

    this.overlay = document.getElementById('editor-overlay');
    this.panel = document.getElementById('editor-panel');
    this.form = document.getElementById('editor-form');
    this.titleEl = document.getElementById('editor-title');
    this.closeBtn = document.getElementById('editor-close');
    this.deleteBtn = document.getElementById('btn-delete');
    this.saveBtn = document.getElementById('btn-save');
    this.swatchesEl = document.getElementById('color-swatches');
    this.labelInput = document.getElementById('edit-label');
    this.amountInput = document.getElementById('edit-amount');
    this.noteInput = document.getElementById('edit-note');
    this.idInput = document.getElementById('edit-id');
    this.currencyPrefix = document.getElementById('currency-prefix');

    this._selectedColor = PALETTE[0];
    this._buildSwatches();
    this._bindEvents();
  }

  _buildSwatches() {
    this.swatchesEl.innerHTML = '';
    PALETTE.forEach(color => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'color-swatch';
      btn.style.background = color;
      btn.style.boxShadow = `0 0 8px ${color}60`;
      btn.dataset.color = color;
      btn.setAttribute('aria-label', `Select color ${color}`);
      btn.addEventListener('click', () => this._selectColor(color));
      this.swatchesEl.appendChild(btn);
    });
    this._selectColor(PALETTE[0]);
  }

  _selectColor(color) {
    this._selectedColor = color;
    this.swatchesEl.querySelectorAll('.color-swatch').forEach(btn => {
      btn.classList.toggle('selected', btn.dataset.color === color);
    });
  }

  _bindEvents() {
    this.closeBtn.addEventListener('click', () => this.close());
    this.overlay.addEventListener('click', () => this.close());

    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      this._save();
    });

    this.deleteBtn.addEventListener('click', () => {
      if (this.editingId !== null) {
        this.store.deleteItem(this.editingId);
        this.close();
      }
    });

    // Handle typing in label input
    this.labelInput.addEventListener('input', () => {
      this._updateAmountInputState();
    });

    // Global event to open editor with existing item
    window.addEventListener('edit-item', (e) => {
      this.open(e.detail);
    });
  }

  _save() {
    const label = this.labelInput.value.trim();
    const amount = parseFloat(this.amountInput.value) || 0;
    const note = this.noteInput.value.trim();
    const color = this._selectedColor;

    if (!label) {
      this.labelInput.focus();
      this.labelInput.classList.add('error');
      setTimeout(() => this.labelInput.classList.remove('error'), 1500);
      return;
    }

    if (this.editingId !== null) {
      this.store.updateItem(this.editingId, { label, amount, color, note });
    } else {
      this.store.addItem({ label, amount, color, note });
    }

    this.close();
  }

  _updateAmountInputState() {
    const labelVal = this.labelInput.value.trim().toLowerCase();
    const isSavings = labelVal === 'savings';
    const hasTotalBudget = this.store.getTotalBudget() != null;
    const isReadOnlySavings = isSavings && hasTotalBudget;

    if (isReadOnlySavings) {
      this.amountInput.readOnly = true;
      this.amountInput.classList.add('readonly-input');
      
      const items = this.store.getAll();
      const otherSum = items
        .filter(item => item.id !== this.editingId)
        .reduce((sum, item) => sum + item.amount, 0);
      const remainder = Math.max(0, this.store.getTotalBudget() - otherSum);
      this.amountInput.value = remainder;

      let helper = this.amountInput.parentElement.nextElementSibling;
      if (!helper || !helper.classList.contains('input-helper')) {
        helper = document.createElement('div');
        helper.className = 'input-helper';
        helper.style.fontSize = '11px';
        helper.style.color = 'var(--text-secondary)';
        helper.style.marginTop = '4px';
        this.amountInput.parentElement.after(helper);
      }
      helper.textContent = 'Amount is calculated automatically from the total budget.';
    } else {
      this.amountInput.readOnly = false;
      this.amountInput.classList.remove('readonly-input');
      const helper = this.amountInput.parentElement.nextElementSibling;
      if (helper && helper.classList.contains('input-helper')) {
        helper.remove();
      }
    }
  }

  open(item = null) {
    this.editingId = item ? item.id : null;

    if (item) {
      this.titleEl.textContent = 'Edit Category';
      this.labelInput.value = item.label;
      this.amountInput.value = item.amount;
      this.noteInput.value = item.note || '';
      this.idInput.value = item.id;
      this._selectColor(item.color || PALETTE[0]);
      this.deleteBtn.classList.remove('hidden');
      this.saveBtn.textContent = 'Save Changes';
    } else {
      this.titleEl.textContent = 'Add Category';
      this.form.reset();
      this.idInput.value = '';
      // Auto-pick next palette color
      const used = this.store.getAll().length;
      this._selectColor(PALETTE[used % PALETTE.length]);
      this.deleteBtn.classList.add('hidden');
      this.saveBtn.textContent = 'Add Category';
    }

    this._updateAmountInputState();

    // Update currency prefix
    this.currencyPrefix.textContent = this.store.getCurrency();

    this.overlay.classList.remove('hidden');
    this.panel.classList.remove('hidden');
    
    setTimeout(() => {
      const isReadOnly = this.amountInput.readOnly;
      if (isReadOnly && item) {
        this.noteInput.focus();
      } else {
        this.labelInput.focus();
      }
    }, 100);
  }

  close() {
    this.overlay.classList.add('hidden');
    this.panel.classList.add('hidden');
    this.editingId = null;
    this.amountInput.readOnly = false;
    this.amountInput.classList.remove('readonly-input');
    const helper = this.amountInput.parentElement.nextElementSibling;
    if (helper && helper.classList.contains('input-helper')) {
      helper.remove();
    }
  }

  updateCurrency(symbol) {
    this.currencyPrefix.textContent = symbol;
  }
}
