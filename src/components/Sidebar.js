/**
 * BudgetWing — Sidebar Component
 * Manages the budget item list, totals, edit mode for total budget,
 * and the allocation progress bar.
 */

export class Sidebar {
  constructor({ store }) {
    this.store = store;
    this._editMode = false;

    this.totalAmountEl  = document.getElementById('total-amount');
    this.totalItemsEl   = document.getElementById('total-items');
    this.budgetListEl   = document.getElementById('budget-list');

    // Budget card elements
    this.budgetDisplay  = document.getElementById('budget-display');
    this.budgetEdit     = document.getElementById('budget-edit');
    this.btnEditBudget  = document.getElementById('btn-edit-budget');
    this.budgetInput    = document.getElementById('budget-input');
    this.budgetCurrSym  = document.getElementById('budget-currency-sym');
    this.btnSaveBudget  = document.getElementById('btn-budget-save');
    this.btnClearBudget = document.getElementById('btn-budget-clear');
    this.barFill        = document.getElementById('budget-bar-fill');
    this.barSpent       = document.getElementById('budget-bar-spent');
    this.barRemain      = document.getElementById('budget-bar-remain');
    this.barWrap        = document.getElementById('budget-bar-wrap');

    this._bindEvents();
  }

  _bindEvents() {
    // Toggle edit mode
    this.btnEditBudget.addEventListener('click', () => {
      this._editMode ? this._closeEdit() : this._openEdit();
    });

    // Save budget
    this.btnSaveBudget.addEventListener('click', () => {
      const val = parseFloat(this.budgetInput.value);
      if (!isNaN(val) && val >= 0) {
        this.store.setTotalBudget(val);
      }
      this._closeEdit();
    });

    // Confirm with Enter
    this.budgetInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.btnSaveBudget.click();
      if (e.key === 'Escape') this._closeEdit();
    });

    // Auto mode — clear user-set budget
    this.btnClearBudget.addEventListener('click', () => {
      this.store.clearTotalBudget();
      this._closeEdit();
    });
  }

  _openEdit() {
    this._editMode = true;
    const current = this.store.getTotalBudget();
    this.budgetInput.value = current != null ? current : '';
    this.budgetCurrSym.textContent = this.store.getCurrency();
    this.budgetDisplay.classList.add('hidden');
    this.budgetEdit.classList.remove('hidden');
    setTimeout(() => this.budgetInput.focus(), 50);
  }

  _closeEdit() {
    this._editMode = false;
    this.budgetEdit.classList.add('hidden');
    this.budgetDisplay.classList.remove('hidden');
  }

  render() {
    const items    = this.store.getAll();
    const total    = this.store.getTotal();    // effective total (user-set or sum)
    const spent    = this.store.getSpent();    // sum of categories
    const currency = this.store.getCurrency();
    const isSet    = this.store.getTotalBudget() != null;

    // ---- Total amount display ----
    this.totalAmountEl.textContent = `${currency}${total.toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })}`;
    this.totalItemsEl.textContent = `${items.length} ${items.length === 1 ? 'category' : 'categories'}`;

    // Update currency prefix in edit mode too
    this.budgetCurrSym.textContent = currency;

    // ---- Progress bar (only when user has set a budget) ----
    if (isSet && total > 0) {
      this.barWrap.classList.remove('hidden');
      const pct  = Math.min((spent / total) * 100, 100);
      const over = spent > total;
      const diff = Math.abs(total - spent);

      this.barFill.style.width = `${pct}%`;
      this.barFill.classList.toggle('over-budget', over);

      this.barSpent.textContent  = `${currency}${spent.toLocaleString()} allocated`;
      this.barRemain.textContent = over
        ? `${currency}${diff.toLocaleString()} over`
        : `${currency}${diff.toLocaleString()} left`;
      this.barRemain.className   = `budget-bar-remain ${over ? 'negative' : 'positive'}`;
    } else {
      this.barWrap.classList.add('hidden');
    }

    // ---- Budget list ----
    this.budgetListEl.innerHTML = '';

    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'budget-list-empty';
      empty.textContent = 'No categories yet.\nClick "Add Category" to start.';
      this.budgetListEl.appendChild(empty);
      return;
    }

    const sorted = [...items].sort((a, b) => b.amount - a.amount);
    sorted.forEach(item => {
      const el = document.createElement('div');
      el.className = 'budget-item';
      el.innerHTML = `
        <div class="item-dot" style="background:${item.color};color:${item.color};"></div>
        <span class="item-label" title="${item.label}">${item.label}</span>
        <span class="item-amount">${currency}${item.amount.toLocaleString()}</span>
      `;
      el.addEventListener('click', () => {
        window.dispatchEvent(new CustomEvent('edit-item', { detail: item }));
      });
      this.budgetListEl.appendChild(el);
    });
  }

  updateCurrency() {
    this.budgetCurrSym.textContent = this.store.getCurrency();
  }
}
