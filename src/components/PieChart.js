/**
 * BudgetWing — Pie Chart Component
 * D3 animated donut chart with hover tooltips and legend
 */

import * as d3 from 'd3';
import { hexToRgba } from '../utils/colors.js';

export class PieChart {
  constructor({ svgEl, legendEl, tooltipEl, store }) {
    this.svg = svgEl;
    this.legendEl = legendEl;
    this.tooltipEl = tooltipEl;
    this.store = store;
    this.activeSlice = null;

    this._setupTooltip();
  }

  _setupTooltip() {
    // Use a floating div tooltip for pie chart
    if (!this.tooltipEl) {
      this.tooltipEl = document.createElement('div');
      this.tooltipEl.className = 'tooltip';
      document.body.appendChild(this.tooltipEl);
    }
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

    const container = this.svg.parentElement;
    const pieView = document.getElementById('pie-view');
    const W = pieView ? pieView.clientWidth - 320 : (container.clientWidth || 500);
    const H = pieView ? pieView.clientHeight - 48 : (container.clientHeight || 500);
    const size = Math.min(W, H, 580);
    const outerR = size / 2 - 16;
    const innerR = outerR * 0.50;

    const svgEl = d3.select(this.svg);
    svgEl.selectAll('*').remove();
    svgEl.attr('width', size).attr('height', size).attr('viewBox', `0 0 ${size} ${size}`);

    if (items.length === 0) return;

    const g = svgEl.append('g').attr('transform', `translate(${size / 2},${size / 2})`);

    const pie = d3.pie().value(d => d.amount).sort(null).padAngle(0.025);
    const arc = d3.arc().innerRadius(innerR).outerRadius(outerR).cornerRadius(6);
    const arcHover = d3.arc().innerRadius(innerR).outerRadius(outerR + 12).cornerRadius(6);

    const arcs = pie(items);

    // Drop shadow filter
    const defs = svgEl.append('defs');
    const filter = defs.append('filter').attr('id', 'pie-glow');
    filter.append('feGaussianBlur').attr('stdDeviation', '4').attr('result', 'blur');
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode').attr('in', 'blur');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Slices
    const slices = g.selectAll('.pie-slice')
      .data(arcs)
      .enter()
      .append('path')
      .attr('class', 'pie-slice')
      .attr('fill', d => d.data.color)
      .attr('stroke', 'rgba(7,11,22,0.6)')
      .attr('stroke-width', 2)
      .attr('d', d => {
        const i = d3.interpolate({ startAngle: 0, endAngle: 0 }, d);
        return arc(i(0));
      })
      .style('cursor', d => d.data.isUnallocated ? 'default' : 'pointer');

    // Entry animation
    slices.transition()
      .duration(800)
      .delay((_, i) => i * 60)
      .ease(d3.easeCubicOut)
      .attrTween('d', function(d) {
        const i = d3.interpolate({ startAngle: d.startAngle, endAngle: d.startAngle }, d);
        return t => arc(i(t));
      });

    // Hover interactions
    const tooltip = this.tooltipEl;

    slices
      .on('mouseenter', (event, d) => {
        const pct = total > 0 ? ((d.data.amount / total) * 100).toFixed(1) : 0;
        d3.select(event.currentTarget)
          .transition().duration(150).ease(d3.easeBackOut.overshoot(1.5))
          .attr('d', arcHover);

        tooltip.innerHTML = `
          <div class="tooltip-label">${d.data.label}</div>
          <div class="tooltip-amount">${currency}${d.data.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          <div class="tooltip-pct">${pct}% of total${d.data.note ? ' · ' + d.data.note : ''}</div>
        `;
        tooltip.classList.add('visible');
        this._positionTooltip(event, tooltip);

        // Highlight legend
        document.querySelectorAll('.legend-item').forEach(el => {
          el.style.opacity = el.dataset.id == d.data.id ? '1' : '0.4';
        });
      })
      .on('mousemove', (event) => {
        this._positionTooltip(event, tooltip);
      })
      .on('mouseleave', (event) => {
        d3.select(event.currentTarget)
          .transition().duration(200).ease(d3.easeBackOut.overshoot(1.2))
          .attr('d', arc);
        tooltip.classList.remove('visible');
        document.querySelectorAll('.legend-item').forEach(el => el.style.opacity = '1');
      });

    // Center text — total
    const centerG = g.append('g').attr('class', 'pie-center');
    centerG.append('text')
      .attr('class', 'pie-center-text')
      .attr('y', -14)
      .attr('font-size', '13')
      .attr('font-weight', '500')
      .attr('fill', 'rgba(138,155,196,0.8)')
      .text('TOTAL');

    centerG.append('text')
      .attr('class', 'pie-center-text')
      .attr('y', 12)
      .attr('font-size', String(Math.max(18, Math.min(28, innerR * 0.3))))
      .attr('font-weight', '700')
      .attr('fill', '#e8eeff')
      .text(`${currency}${total.toLocaleString('en-US', { minimumFractionDigits: 0 })}`);

    centerG.append('text')
      .attr('class', 'pie-center-text')
      .attr('y', 32)
      .attr('font-size', '12')
      .attr('fill', 'rgba(138,155,196,0.6)')
      .text(`${rawItems.length} categories`);

    // Animate center text
    centerG.style('opacity', 0)
      .transition().delay(600).duration(400)
      .style('opacity', 1);

    // Legend
    this._renderLegend(items, total, currency);
  }

  _renderLegend(items, total, currency) {
    this.legendEl.innerHTML = '';
    items.forEach(item => {
      const pct = total > 0 ? ((item.amount / total) * 100).toFixed(1) : 0;
      const el = document.createElement('div');
      el.className = 'legend-item';
      el.dataset.id = item.id;
      el.style.borderLeft = `3px solid ${item.color}`;
      el.innerHTML = `
        <div class="legend-dot" style="background:${item.color};box-shadow:0 0 8px ${item.color}60;"></div>
        <span class="legend-name" title="${item.label}">${item.label}</span>
        <span class="legend-pct">${pct}%</span>
        <span class="legend-val">${currency}${item.amount.toLocaleString()}</span>
      `;
      if (item.isUnallocated) {
        el.style.cursor = 'default';
      } else {
        el.addEventListener('click', () => {
          window.dispatchEvent(new CustomEvent('edit-item', { detail: item }));
        });
      }
      this.legendEl.appendChild(el);
    });
  }

  _positionTooltip(event, tooltip) {
    const x = event.clientX + 14;
    const y = event.clientY - 10;
    tooltip.style.left = `${Math.min(x, window.innerWidth - 220)}px`;
    tooltip.style.top = `${Math.min(y, window.innerHeight - 100)}px`;
  }

  destroy() {
    if (this.tooltipEl) {
      this.tooltipEl.classList.remove('visible');
    }
  }
}
