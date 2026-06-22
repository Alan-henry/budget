/**
 * BudgetWing — Main Entry Point
 * Wires all components together, handles navigation + events
 */

import './style.css';
import { store } from './store.js';
import { PieChart } from './components/PieChart.js';
import { MindMap } from './components/MindMap.js';
import { SankeyChart } from './components/SankeyChart.js';
import { BudgetEditor } from './components/BudgetEditor.js';
import { Sidebar } from './components/Sidebar.js';

// ---- DOM refs ----
const pieView     = document.getElementById('pie-view');
const mindmapView = document.getElementById('mindmap-view');
const sankeyView  = document.getElementById('sankey-view');
const emptyState  = document.getElementById('empty-state');
const btnPie      = document.getElementById('btn-pie');
const btnMindmap  = document.getElementById('btn-mindmap');
const btnSankey   = document.getElementById('btn-sankey');
const btnAdd      = document.getElementById('btn-add-budget');
const btnImport   = document.getElementById('btn-import');
const fileInput   = document.getElementById('file-input');
const viewTitle   = document.getElementById('view-title');
const viewSubtitle = document.getElementById('view-subtitle');
const currencySelect = document.getElementById('currency-select');

const ALL_VIEWS = { pie: pieView, mindmap: mindmapView, sankey: sankeyView };

// ---- State ----
let activeView = 'pie';

// ---- Component instances ----
const sidebar = new Sidebar({ store });

const pieTooltip = document.createElement('div');
pieTooltip.className = 'tooltip';
pieTooltip.style.position = 'fixed';
document.body.appendChild(pieTooltip);

const pieChart = new PieChart({
  svgEl: document.getElementById('pie-chart'),
  legendEl: document.getElementById('pie-legend'),
  tooltipEl: pieTooltip,
  store,
});

const mmTooltip = document.getElementById('mindmap-tooltip');
const mindMap = new MindMap({
  svgEl: document.getElementById('mindmap-chart'),
  tooltipEl: mmTooltip,
  store,
});

const skTooltip = document.getElementById('sankey-tooltip');
const sankeyChart = new SankeyChart({
  svgEl: document.getElementById('sankey-chart'),
  tooltipEl: skTooltip,
  store,
});

const editor = new BudgetEditor({ store });

// ---- Render ----
function renderAll() {
  sidebar.render();
  const items = store.getAll();

  if (items.length === 0) {
    emptyState.classList.remove('hidden');
    Object.values(ALL_VIEWS).forEach(v => v.classList.remove('active'));
    return;
  }

  emptyState.classList.add('hidden');
  Object.entries(ALL_VIEWS).forEach(([key, el]) => {
    el.classList.toggle('active', key === activeView);
  });

  // Defer chart rendering one frame so CSS display change is applied
  // and the SVG element has non-zero dimensions from layout
  requestAnimationFrame(() => {
    if (activeView === 'pie')          pieChart.render();
    else if (activeView === 'mindmap') mindMap.render();
    else if (activeView === 'sankey')  sankeyChart.render();
  });
}

// ---- View Switching ----
const VIEW_META = {
  pie:     { title: 'Pie Chart',    subtitle: 'Visualize your budget allocation at a glance' },
  mindmap: { title: 'Mind Map',     subtitle: 'Explore your budget as a connected web of nodes' },
  sankey:  { title: 'Sankey Flow',  subtitle: 'Trace where your money flows — proportional stream diagram' },
};

function setView(view) {
  activeView = view;
  btnPie.classList.toggle('active',     view === 'pie');
  btnMindmap.classList.toggle('active', view === 'mindmap');
  btnSankey.classList.toggle('active',  view === 'sankey');

  const meta = VIEW_META[view] || VIEW_META.pie;
  viewTitle.textContent    = meta.title;
  viewSubtitle.textContent = meta.subtitle;

  renderAll();
}

btnPie.addEventListener('click',     () => setView('pie'));
btnMindmap.addEventListener('click', () => setView('mindmap'));
btnSankey.addEventListener('click',  () => setView('sankey'));

// ---- Add budget ----
btnAdd.addEventListener('click', () => editor.open(null));

// ---- Import JSON ----
btnImport.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    try {
      const data = JSON.parse(ev.target.result);
      const items = Array.isArray(data) ? data : data.items || data.categories || [];
      if (items.length === 0) throw new Error('No items found');
      store.importItems(items);
    } catch (err) {
      alert('Could not parse JSON file. Expected an array of { label, amount } objects.');
    }
    fileInput.value = '';
  };
  reader.readAsText(file);
});

// ---- Currency ----
currencySelect.value = store.getCurrency();
currencySelect.addEventListener('change', (e) => {
  store.setCurrency(e.target.value);
  editor.updateCurrency(e.target.value);
  sidebar.updateCurrency();
});

// ---- Store events ----
store.on('change',         () => renderAll());
store.on('currencyChange', () => renderAll());

// ---- Resize ----
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(renderAll, 200);
});

// ---- Boot ----
setView('pie');
