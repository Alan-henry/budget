/**
 * BudgetWing — Sankey Diagram Component
 * Visualizes budget as a flow from a central "Total Budget" source
 * through categories to individual spending nodes.
 * Uses d3-sankey with animated gradient flows and glow effects.
 */

import * as d3 from 'd3';
import { sankey, sankeyLinkHorizontal, sankeyLeft } from 'd3-sankey';
import { hexToRgba } from '../utils/colors.js';

export class SankeyChart {
  constructor({ svgEl, tooltipEl, store }) {
    this.svgEl = svgEl;
    this.tooltipEl = tooltipEl;
    this.store = store;
  }

  render() {
    this._doRender();
  }

  _doRender() {
    const rawItems = this.store.getAll();
    const currency = this.store.getCurrency();
    const budgetTotal = this.store.getTotal();
    const spent = this.store.getSpent();
    const isSet = this.store.getTotalBudget() != null;

    let items = [...rawItems];
    const hasSavings = rawItems.some(item => item.label.toLowerCase() === 'savings');
    if (isSet && budgetTotal > spent && !hasSavings) {
      items.push({
        id: 'unallocated',
        label: 'Unallocated',
        amount: budgetTotal - spent,
        color: '#2a344d',
        note: 'Remaining budget',
        isUnallocated: true,
      });
    }

    const total = Math.max(budgetTotal, items.reduce((sum, d) => sum + d.amount, 0));

    const container = this.svgEl.parentElement;
    const rect = container.getBoundingClientRect();
    const W = (rect.width  || container.clientWidth  || 900);
    const H = (rect.height || container.clientHeight || 600);

    const svg = d3.select(this.svgEl);
    svg.selectAll('*').remove();
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

    if (items.length === 0) return;

    const pad = { top: 40, right: 80, bottom: 40, left: 120 };

    // ---- Build Sankey nodes & links ----
    // Structure: Total → Category nodes → (optionally) sub-amount nodes
    // For a rich diagram: add a "Remaining" vs "Spent" split if we have notes,
    // otherwise just Total → each Category.

    const nodeList = [
      { id: 'total', label: 'Total Budget', color: '#4f9eff', isHub: true },
      ...items.map(item => ({
        id: item.isUnallocated ? 'unallocated' : `cat-${item.id}`,
        label: item.label,
        color: item.color,
        amount: item.amount,
        note: item.note,
        originalId: item.isUnallocated ? null : item.id,
        isUnallocated: item.isUnallocated || false,
      })),
    ];

    const linkList = items.map(item => ({
      source: 'total',
      target: item.isUnallocated ? 'unallocated' : `cat-${item.id}`,
      value: item.amount,
      color: item.color,
    }));

    const sankeyNodes = nodeList.map(n => ({ ...n }));
    // Keep string IDs — d3-sankey uses .nodeId(d => d.id) to match by string
    const sankeyLinks = linkList.map(l => ({ ...l }));

    // ---- Sankey layout ----
    const sankeyLayout = sankey()
      .nodeId(d => d.id)
      .nodeWidth(28)           // wider bars — clearly visible
      .nodePadding(Math.max(8, (H - pad.top - pad.bottom) / (items.length * 2.2)))
      .nodeAlign(sankeyLeft)
      .extent([[pad.left, pad.top], [W - pad.right, H - pad.bottom]]);

    const graph = sankeyLayout({
      nodes: sankeyNodes,
      links: sankeyLinks,
    });

    // ---- Defs: gradients + filters ----
    const defs = svg.append('defs');

    // Per-link gradient (source color → target color)
    graph.links.forEach((link, i) => {
      const gradId = `sankey-grad-${i}`;
      const grad = defs.append('linearGradient')
        .attr('id', gradId)
        .attr('gradientUnits', 'userSpaceOnUse')
        .attr('x1', link.source.x1)
        .attr('x2', link.target.x0);
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#4f9eff').attr('stop-opacity', 0.7);
      grad.append('stop').attr('offset', '100%').attr('stop-color', link.color).attr('stop-opacity', 0.65);
    });

    // ---- ClipPath: clips the entire stream area to between the two node columns ----
    const srcNode = graph.nodes.find(n => n.isHub);
    const tgtX0 = graph.nodes
      .filter(n => !n.isHub)
      .reduce((min, n) => Math.min(min, n.x0), W);

    const clipX = srcNode ? srcNode.x1 : pad.left;
    const clipW = tgtX0 - clipX;

    defs.append('clipPath').attr('id', 'clip-links')
      .append('rect')
      .attr('x', clipX)
      .attr('y', 0)
      .attr('width', Math.max(0, clipW))
      .attr('height', H);

    // Glow filter (subtle — applied to full link group, not per-path)
    const glow = defs.append('filter').attr('id', 'sankey-glow').attr('x', '-5%').attr('y', '-5%').attr('width', '110%').attr('height', '110%');
    glow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 3).attr('result', 'blur');
    const glowMerge = glow.append('feMerge');
    glowMerge.append('feMergeNode').attr('in', 'blur');
    glowMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Node glow filter
    const nodeGlow = defs.append('filter').attr('id', 'node-glow').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    nodeGlow.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 4).attr('result', 'blur');
    const ngMerge = nodeGlow.append('feMerge');
    ngMerge.append('feMergeNode').attr('in', 'blur');
    ngMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    const tooltip = this.tooltipEl;

    // ---- Links ----
    const linkPath = sankeyLinkHorizontal();

    const linkG = svg.append('g')
      .attr('class', 'sankey-links')
      .attr('clip-path', 'url(#clip-links)');  // <-- clips all streams to [srcNode.x1 .. tgtX0]

    const links = linkG.selectAll('.sankey-link')
      .data(graph.links)
      .enter()
      .append('g')
      .attr('class', 'sankey-link');

    // Invisible wide hit area
    links.append('path')
      .attr('d', linkPath)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', d => Math.max(8, d.width))
      .style('cursor', 'pointer');

    // Visible gradient flow path
    // stroke-linecap:'butt' ensures streams clip exactly at node bar edges
    const visibleLinks = links.append('path')
      .attr('d', linkPath)
      .attr('fill', 'none')
      .attr('stroke', (_, i) => `url(#sankey-grad-${i})`)
      .attr('stroke-width', d => Math.max(3, d.width))
      .attr('stroke-opacity', 0)
      .attr('stroke-linecap', 'butt')
      .style('transition', 'stroke-opacity 0.3s ease');

    // Animate links in
    visibleLinks
      .transition()
      .delay((_, i) => i * 120 + 300)
      .duration(600)
      .ease(d3.easeCubicOut)
      .attr('stroke-opacity', 0.55);

    // Link hover
    links
      .on('mouseenter', function(event, d) {
        d3.select(this).select('path:nth-child(2)')
          .transition().duration(150)
          .attr('stroke-opacity', 0.85)
          .attr('stroke-width', Math.max(4, d.width * 1.08));

        const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;
        const lbl = String(d.target.label || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const note = String(d.target.note || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        tooltip.innerHTML = `
          <div class="tooltip-label" style="color:${d.color}">${lbl}</div>
          <div class="tooltip-amount">${currency}${d.value.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="tooltip-pct">${pct}% of total budget${note ? ' · ' + note : ''}</div>
        `;
        tooltip.classList.add('visible');
        _positionTooltip(event, tooltip);
      })
      .on('mousemove', (event) => _positionTooltip(event, tooltip))
      .on('mouseleave', function(event, d) {
        d3.select(this).select('path:nth-child(2)')
          .transition().duration(200)
          .attr('stroke-opacity', 0.55)
          .attr('stroke-width', Math.max(3, d.width));
        tooltip.classList.remove('visible');
      });

    // ---- Nodes ----
    const nodeG = svg.append('g').attr('class', 'sankey-nodes');

    const nodes = nodeG.selectAll('.sankey-node')
      .data(graph.nodes)
      .enter()
      .append('g')
      .attr('class', 'sankey-node')
      .attr('transform', d => `translate(${d.x0},${d.y0})`)
      .style('cursor', d => (d.isHub || d.isUnallocated) ? 'default' : 'pointer');

    const nodeW = d => d.x1 - d.x0;
    const nodeH = d => Math.max(6, d.y1 - d.y0);

    // Node glow bg — stays within node bounds (no overflow)
    nodes.append('rect')
      .attr('x', 0)
      .attr('width', nodeW)
      .attr('height', nodeH)
      .attr('rx', 3)
      .attr('fill', d => hexToRgba(d.color, 0.18))
      .attr('stroke', 'none');

    // Node bar (animated height, sharp edges so streams align cleanly)
    nodes.append('rect')
      .attr('x', 0)
      .attr('width', nodeW)
      .attr('height', 0)
      .attr('rx', 0)
      .attr('fill', d => d.color)
      .attr('opacity', 0.95)
      .attr('filter', 'url(#node-glow)')
      .transition()
      .delay((_, i) => i * 80)
      .duration(500)
      .ease(d3.easeBackOut.overshoot(1))
      .attr('height', nodeH);

    // Node hover — only widen target nodes, no x-shift to stay aligned with streams
    nodes.filter(d => !d.isHub)
      .on('mouseenter', function(event, d) {
        d3.select(this).select('rect:nth-child(2)')
          .transition().duration(150)
          .attr('opacity', 1);

        const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;
        const lbl2 = String(d.label || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        const note2 = String(d.note || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
        tooltip.innerHTML = `
          <div class="tooltip-label" style="color:${d.color}">${lbl2}</div>
          <div class="tooltip-amount">${currency}${(d.value || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="tooltip-pct">${pct}% of total budget${note2 ? ' · ' + note2 : ''}</div>
        `;
        tooltip.classList.add('visible');
        _positionTooltip(event, tooltip);

        // Highlight connected links
        linkG.selectAll('.sankey-link path:nth-child(2)')
          .attr('stroke-opacity', l => l.target.id === d.id ? 0.9 : 0.15);
      })
      .on('mousemove', (event) => _positionTooltip(event, tooltip))
      .on('mouseleave', function(event, d) {
        d3.select(this).select('rect:nth-child(2)')
          .transition().duration(200)
          .attr('opacity', 0.95);
        tooltip.classList.remove('visible');
        linkG.selectAll('.sankey-link path:nth-child(2)')
          .attr('stroke-opacity', 0.55);
      })
      .on('click', (_, d) => {
        if (d.isUnallocated) return;
        if (d.originalId != null) {
          const item = this.store.getAll().find(i => i.id === d.originalId);
          if (item) window.dispatchEvent(new CustomEvent('edit-item', { detail: item }));
        }
      });

    // ---- Labels ----
    const labelG = svg.append('g').attr('class', 'sankey-labels');

    const labels = labelG.selectAll('.sankey-label')
      .data(graph.nodes)
      .enter()
      .append('g')
      .attr('class', 'sankey-label')
      .style('opacity', 0);

    // Hub label — left of node
    labels.filter(d => d.isHub)
      .append('text')
      .attr('x', d => d.x0 - 10)
      .attr('y', d => (d.y0 + d.y1) / 2)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', "'Space Grotesk', sans-serif")
      .attr('font-size', '15')
      .attr('font-weight', '700')
      .attr('fill', '#e8eeff')
      .text(d => d.label);

    // Hub sub-label
    labels.filter(d => d.isHub)
      .append('text')
      .attr('x', d => d.x0 - 10)
      .attr('y', d => (d.y0 + d.y1) / 2 + 18)
      .attr('text-anchor', 'end')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', "'Inter', sans-serif")
      .attr('font-size', '12')
      .attr('fill', 'rgba(138,155,196,0.8)')
      .text(`${currency}${total.toLocaleString()}`);

    // Category labels — right of node
    labels.filter(d => !d.isHub)
      .append('text')
      .attr('x', d => d.x1 + 10)
      .attr('y', d => (d.y0 + d.y1) / 2 - 6)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', "'Inter', sans-serif")
      .attr('font-size', '13')
      .attr('font-weight', '600')
      .attr('fill', d => d.color)
      .text(d => d.label);

    // Category amount
    labels.filter(d => !d.isHub)
      .append('text')
      .attr('x', d => d.x1 + 10)
      .attr('y', d => (d.y0 + d.y1) / 2 + 10)
      .attr('text-anchor', 'start')
      .attr('dominant-baseline', 'middle')
      .attr('font-family', "'Inter', sans-serif")
      .attr('font-size', '11')
      .attr('fill', 'rgba(138,155,196,0.8)')
      .text(d => {
        const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : 0;
        return `${currency}${(d.value || 0).toLocaleString()} · ${pct}%`;
      });

    // Animate labels
    labels.transition()
      .delay((_, i) => i * 80 + 500)
      .duration(400)
      .style('opacity', 1);

    // ---- Title / hint ----
    svg.append('text')
      .attr('x', W / 2)
      .attr('y', H - 10)
      .attr('text-anchor', 'middle')
      .attr('font-size', '11')
      .attr('fill', 'rgba(74, 86, 128, 0.7)')
      .attr('font-family', "'Inter', sans-serif")
      .text('Hover flows to inspect · Click a category bar to edit');

    function _positionTooltip(event, el) {
      const x = event.clientX + 14;
      const y = event.clientY - 10;
      el.style.left = `${Math.min(x, window.innerWidth - 260)}px`;
      el.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
    }
  }

  destroy() {
    if (this.tooltipEl) this.tooltipEl.classList.remove('visible');
  }
}
