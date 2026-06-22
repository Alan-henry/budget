/**
 * BudgetWing — Mind Map Component
 * D3 force-directed graph — NotebookLM-style web of nodes
 * Central hub node connected to budget category nodes
 * Nodes sized by budget amount, draggable, with glow effects
 */

import * as d3 from 'd3';
import { hexToRgba } from '../utils/colors.js';

export class MindMap {
  constructor({ svgEl, tooltipEl, store }) {
    this.svgEl = svgEl;
    this.tooltipEl = tooltipEl;
    this.store = store;
    this.simulation = null;
  }

  render() {
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
    const W = container.clientWidth || 800;
    const H = container.clientHeight || 600;

    const svg = d3.select(this.svgEl);
    svg.selectAll('*').remove();
    svg.attr('width', W).attr('height', H).attr('viewBox', `0 0 ${W} ${H}`);

    if (items.length === 0) return;

    // ---- Build graph data ----
    const hubId = '__hub__';
    const nodes = [
      {
        id: hubId,
        label: 'Budget',
        sublabel: `${currency}${total.toLocaleString()}`,
        color: '#ffffff',
        isHub: true,
        r: 52,
      },
      ...items.map(item => ({
        id: item.id,
        label: item.label,
        sublabel: `${currency}${item.amount.toLocaleString()}`,
        color: item.color,
        amount: item.amount,
        pct: total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0,
        note: item.note,
        isHub: false,
        isUnallocated: item.isUnallocated || false,
        // radius proportional to amount, clamped
        r: Math.max(28, Math.min(64, 20 + Math.sqrt(item.amount / (total || 1)) * 90)),
      })),
    ];

    const links = items.map(item => ({
      source: hubId,
      target: item.id,
    }));

    // ---- Defs: glows + gradients ----
    const defs = svg.append('defs');

    nodes.forEach(node => {
      if (node.isHub) return;
      const gradId = `grad-${node.id}`;
      const grad = defs.append('radialGradient')
        .attr('id', gradId)
        .attr('cx', '35%').attr('cy', '35%').attr('r', '65%');
      grad.append('stop').attr('offset', '0%').attr('stop-color', node.color).attr('stop-opacity', 0.9);
      grad.append('stop').attr('offset', '100%').attr('stop-color', node.color).attr('stop-opacity', 0.45);

      const filterId = `glow-${node.id}`;
      const filt = defs.append('filter').attr('id', filterId).attr('x', '-50%').attr('y', '-50%').attr('width', '200%').attr('height', '200%');
      filt.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 6).attr('result', 'blur');
      const merge = filt.append('feMerge');
      merge.append('feMergeNode').attr('in', 'blur');
      merge.append('feMergeNode').attr('in', 'SourceGraphic');
    });

    // Hub glow
    const hubFilt = defs.append('filter').attr('id', 'hub-glow').attr('x', '-60%').attr('y', '-60%').attr('width', '220%').attr('height', '220%');
    hubFilt.append('feGaussianBlur').attr('in', 'SourceGraphic').attr('stdDeviation', 10).attr('result', 'blur');
    const hubMerge = hubFilt.append('feMerge');
    hubMerge.append('feMergeNode').attr('in', 'blur');
    hubMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Hub gradient
    const hubGrad = defs.append('radialGradient').attr('id', 'hub-grad').attr('cx', '35%').attr('cy', '35%').attr('r', '65%');
    hubGrad.append('stop').attr('offset', '0%').attr('stop-color', '#a0c8ff').attr('stop-opacity', 1);
    hubGrad.append('stop').attr('offset', '100%').attr('stop-color', '#3a6eff').attr('stop-opacity', 0.7);

    // ---- Simulation ----
    if (this.simulation) this.simulation.stop();

    this.simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(d => {
        const target = nodes.find(n => n.id === d.target.id || n.id === d.target);
        return 120 + (target?.r || 30);
      }).strength(0.6))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(W / 2, H / 2).strength(0.08))
      .force('collision', d3.forceCollide(d => d.r + 18).strength(0.8))
      .alphaDecay(0.028)
      .velocityDecay(0.35);

    // ---- Canvas group (zoomable) ----
    const zoom = d3.zoom()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        gCanvas.attr('transform', event.transform);
      });
    svg.call(zoom);

    const gCanvas = svg.append('g').attr('class', 'mm-canvas');

    // ---- Links ----
    const link = gCanvas.append('g').attr('class', 'mm-links')
      .selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('class', 'mm-link')
      .attr('stroke', d => {
        const target = nodes.find(n => n.id === d.target || n.id === d.target?.id);
        return target?.color || '#4f9eff';
      })
      .attr('stroke-width', d => {
        const target = nodes.find(n => n.id === d.target || n.id === d.target?.id);
        const pct = target ? (target.amount / (total || 1)) : 0;
        return Math.max(1.5, pct * 8);
      })
      .attr('stroke-opacity', 0.35)
      .attr('stroke-dasharray', '0')
      .style('stroke-linecap', 'round');

    // Animate links on entry
    link.style('opacity', 0)
      .transition().delay((_, i) => i * 80 + 200).duration(500)
      .style('opacity', 1);

    // ---- Nodes ----
    const node = gCanvas.append('g').attr('class', 'mm-nodes')
      .selectAll('.mm-node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'mm-node')
      .style('cursor', d => (d.isHub || d.isUnallocated) ? 'default' : 'pointer')
      .call(this._drag(this.simulation));

    // Outer ring (pulse effect for hub)
    node.filter(d => d.isHub)
      .append('circle')
      .attr('r', d => d.r + 12)
      .attr('fill', 'none')
      .attr('stroke', '#4f9eff')
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.3)
      .attr('stroke-dasharray', '6 4')
      .attr('class', 'hub-ring');

    // Background glow circle
    node.filter(d => !d.isHub)
      .append('circle')
      .attr('r', d => d.r + 6)
      .attr('fill', d => hexToRgba(d.color, 0.08))
      .attr('stroke', 'none');

    // Main circle
    node.append('circle')
      .attr('r', 0)
      .attr('fill', d => d.isHub ? 'url(#hub-grad)' : `url(#grad-${d.id})`)
      .attr('stroke', d => d.isHub ? 'rgba(160,200,255,0.5)' : `${d.color}80`)
      .attr('stroke-width', d => d.isHub ? 2 : 1.5)
      .attr('filter', d => d.isHub ? 'url(#hub-glow)' : `url(#glow-${d.id})`)
      .transition()
      .delay((_, i) => i * 60)
      .duration(600)
      .ease(d3.easeBackOut.overshoot(1.2))
      .attr('r', d => d.r);

    // Node label (main)
    node.append('text')
      .attr('dy', d => d.isHub ? -6 : (d.label.length > 10 ? -7 : 0))
      .attr('font-size', d => d.isHub ? 14 : Math.max(9, Math.min(13, d.r * 0.28)))
      .attr('font-weight', '700')
      .attr('fill', d => d.isHub ? '#e8eeff' : '#fff')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('pointer-events', 'none')
      .style('opacity', 0)
      .text(d => d.label.length > 12 ? d.label.slice(0, 11) + '…' : d.label)
      .transition().delay((_, i) => i * 60 + 300).duration(400)
      .style('opacity', 1);

    // Sub-label (amount)
    node.append('text')
      .attr('dy', d => d.isHub ? 12 : (d.label.length > 10 ? 8 : 14))
      .attr('font-size', d => d.isHub ? 12 : Math.max(8, Math.min(11, d.r * 0.22)))
      .attr('font-weight', '500')
      .attr('fill', d => d.isHub ? 'rgba(160,200,255,0.85)' : 'rgba(255,255,255,0.7)')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('pointer-events', 'none')
      .style('opacity', 0)
      .text(d => d.sublabel)
      .transition().delay((_, i) => i * 60 + 400).duration(400)
      .style('opacity', 1);

    // Hub rotating dashes animation
    svg.selectAll('.hub-ring')
      .each(function() {
        const el = d3.select(this);
        const animate = () => {
          el.attr('stroke-dashoffset', 0)
            .transition()
            .duration(6000)
            .ease(d3.easeLinear)
            .attr('stroke-dashoffset', -100)
            .on('end', animate);
        };
        animate();
      });

    // ---- Hover interactions ----
    const tooltip = this.tooltipEl;

    node.filter(d => !d.isHub)
      .on('mouseenter', (event, d) => {
        d3.select(event.currentTarget).select('circle:last-of-type')
          .transition().duration(150).ease(d3.easeBackOut.overshoot(1.5))
          .attr('r', d.r * 1.12)
          .attr('stroke-width', 3);

        // Highlight connected link
        link.attr('stroke-opacity', l => {
          const tgt = l.target.id || l.target;
          return tgt === d.id ? 0.8 : 0.15;
        }).attr('stroke-width', l => {
          const tgt = l.target.id || l.target;
          const pct = d.amount / (total || 1);
          return (tgt === d.id) ? Math.max(2, pct * 10) : 1;
        });

        tooltip.innerHTML = `
          <div class="tooltip-label" style="color:${d.color}">${d.label}</div>
          <div class="tooltip-amount">${d.sublabel}</div>
          <div class="tooltip-pct">${d.pct}% of total budget${d.note ? ' · ' + d.note : ''}</div>
        `;
        tooltip.classList.add('visible');
        this._positionTooltip(event, tooltip);
      })
      .on('mousemove', (event) => {
        this._positionTooltip(event, tooltip);
      })
      .on('mouseleave', (event, d) => {
        d3.select(event.currentTarget).select('circle:last-of-type')
          .transition().duration(200)
          .attr('r', d.r)
          .attr('stroke-width', 1.5);

        link.attr('stroke-opacity', 0.35)
          .attr('stroke-width', l => {
            const target = nodes.find(n => n.id === l.target.id || n.id === l.target);
            const pct = target ? (target.amount / (total || 1)) : 0;
            return Math.max(1.5, pct * 8);
          });

        tooltip.classList.remove('visible');
      })
      .on('click', (_, d) => {
        if (d.isUnallocated) return;
        const item = this.store.getAll().find(i => i.id === d.id);
        if (item) window.dispatchEvent(new CustomEvent('edit-item', { detail: item }));
      });

    // ---- Tick ----
    this.simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node.attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Auto-fit on stabilize
    this.simulation.on('end', () => {
      this._fitView(svg, gCanvas, W, H, zoom);
    });

    // Timeout fit in case simulation runs long
    setTimeout(() => {
      if (this.simulation.alpha() > 0.01) {
        this._fitView(svg, gCanvas, W, H, zoom);
      }
    }, 3000);
  }

  _fitView(svg, gCanvas, W, H, zoom) {
    const bounds = gCanvas.node().getBBox();
    if (!bounds.width || !bounds.height) return;
    const padding = 60;
    const scaleX = (W - padding * 2) / bounds.width;
    const scaleY = (H - padding * 2) / bounds.height;
    const scale = Math.min(scaleX, scaleY, 1.2);
    const tx = W / 2 - (bounds.x + bounds.width / 2) * scale;
    const ty = H / 2 - (bounds.y + bounds.height / 2) * scale;
    svg.transition().duration(800).ease(d3.easeCubicInOut)
      .call(zoom.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }

  _drag(simulation) {
    return d3.drag()
      .on('start', (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x; d.fy = d.y;
      })
      .on('drag', (event, d) => {
        d.fx = event.x; d.fy = event.y;
      })
      .on('end', (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null; d.fy = null;
      });
  }

  _positionTooltip(event, tooltip) {
    const x = event.clientX + 14;
    const y = event.clientY - 10;
    tooltip.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    tooltip.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
  }

  destroy() {
    if (this.simulation) {
      this.simulation.stop();
      this.simulation = null;
    }
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('visible');
    }
  }
}
