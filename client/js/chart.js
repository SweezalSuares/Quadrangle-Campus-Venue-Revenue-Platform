const PALETTE = ['#B8860B', '#2F6F4E', '#A6402A', '#5B6472', '#7C9CC7', '#C9A227', '#8E5B4F'];

function escapeSvg(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[character]);
}

function chartColor(dataset, index) {
  const colors = dataset.backgroundColor;
  return Array.isArray(colors) ? (colors[index] || PALETTE[index % PALETTE.length]) :
    (dataset.borderColor || colors || PALETTE[index % PALETTE.length]);
}

function cleanValues(dataset) {
  return (dataset.data || []).map((value) => {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, number) : 0;
  });
}

function renderNativeSvg(canvas, config, fallbackText) {
  const labels = config.data.labels || [];
  const datasets = (config.data.datasets || []).map((dataset) => ({
    ...dataset,
    values: cleanValues(dataset),
  }));
  const hasData = datasets.some((dataset) => dataset.values.some((value) => value > 0));
  const wrapper = document.createElement('div');
  wrapper.className = 'chart-native';
  wrapper.style.minHeight = '180px';
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', fallbackText);

  if (config.type === 'pie' || config.type === 'doughnut') {
    const dataset = datasets[0] || { values: [] };
    const values = dataset.values;
    const total = values.reduce((sum, value) => sum + value, 0);
    const cx = 118;
    const cy = 112;
    const radius = 62;
    const circumference = 2 * Math.PI * radius;
    let offset = 0;
    const slices = values.map((value, index) => {
      const length = total ? (value / total) * circumference : 0;
      const slice = `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="${escapeSvg(chartColor(dataset, index))}" stroke-width="${config.type === 'doughnut' ? 34 : 124}" stroke-dasharray="${length} ${circumference - length}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += length;
      return slice;
    }).join('');
    const legend = labels.map((label, index) => {
      const y = 44 + index * 25;
      return `<rect x="232" y="${y - 11}" width="10" height="10" rx="2" fill="${escapeSvg(chartColor(dataset, index))}"/><text x="250" y="${y}" fill="#5B6472" font-size="12">${escapeSvg(label)}: ${values[index] || 0}</text>`;
    }).join('');
    wrapper.innerHTML = `<svg width="100%" height="220" viewBox="0 0 480 240" aria-hidden="true"><circle cx="${cx}" cy="${cy}" r="${radius}" fill="none" stroke="#E5E8ED" stroke-width="${config.type === 'doughnut' ? 34 : 124}"/>${hasData ? slices : ''}${!hasData ? `<text x="${cx}" y="${cy + 4}" fill="#697386" font-size="13" text-anchor="middle">No data yet</text>` : ''}${legend || (!hasData ? '<text x="232" y="112" fill="#697386" font-size="13">Add venues and bookings to populate this chart.</text>' : '')}</svg>`;
    canvas.replaceWith(wrapper);
    return;
  }

  const series = datasets.length ? datasets : [{ label: '', values: [] }];
  const pointCount = Math.max(labels.length, ...series.map((dataset) => dataset.values.length), 1);
  const chartLabels = Array.from({ length: pointCount }, (_, index) =>
    labels[index] || (hasData ? `Item ${index + 1}` : 'No data yet')
  );
  const maxValue = series.reduce((max, dataset) =>
    dataset.values.reduce((seriesMax, value) => Math.max(seriesMax, value), max), 1
  );
  const left = 46;
  const right = 470;
  const top = 20;
  const bottom = 188;
  const plotWidth = right - left;
  const plotHeight = bottom - top;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const y = top + (plotHeight * index) / 4;
    return `<line x1="${left}" y1="${y}" x2="${right}" y2="${y}" stroke="#E5E8ED"/><text x="${left - 8}" y="${y + 4}" fill="#697386" font-size="10" text-anchor="end">${Math.round(maxValue * (4 - index) / 4)}</text>`;
  }).join('');
  const xLabels = chartLabels.map((label, index) => {
    const x = left + (plotWidth * (index + 0.5)) / pointCount;
    return `<text x="${x}" y="${bottom + 20}" fill="#697386" font-size="10" text-anchor="middle">${escapeSvg(String(label).slice(0, 12))}</text>`;
  }).join('');
  let marks = '';

  if (config.type === 'line') {
    marks = series.map((dataset, seriesIndex) => {
      const color = escapeSvg(chartColor(dataset, seriesIndex));
      const points = chartLabels.map((_, index) => {
        const x = left + (plotWidth * (index + 0.5)) / pointCount;
        const y = bottom - ((dataset.values[index] || 0) / maxValue) * plotHeight;
        return `${x},${y}`;
      });
      return `<polyline points="${points.join(' ')}" fill="none" stroke="${color}" stroke-width="3"/>${points.map((point) => {
        const [x, y] = point.split(',');
        return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
      }).join('')}`;
    }).join('');
  } else {
    const groupWidth = plotWidth / pointCount;
    const barWidth = Math.min(34, (groupWidth * 0.72) / series.length);
    marks = series.map((dataset, seriesIndex) => dataset.values.map((value, index) => {
      const x = left + groupWidth * index + groupWidth / 2 +
        (seriesIndex - (series.length - 1) / 2) * barWidth - barWidth / 2;
      const height = (value / maxValue) * plotHeight;
      return `<rect x="${x}" y="${bottom - height}" width="${barWidth}" height="${height}" rx="2" fill="${escapeSvg(chartColor(dataset, seriesIndex))}"/>`;
    }).join('')).join('');
  }

  wrapper.innerHTML = `<svg width="100%" height="220" viewBox="0 0 480 240" aria-hidden="true">${grid}<line x1="${left}" y1="${bottom}" x2="${right}" y2="${bottom}" stroke="#AAB2BF"/>${marks}${xLabels}${!hasData ? '<text x="258" y="106" fill="#697386" font-size="13" text-anchor="middle">No data yet — add venues and bookings to populate this chart.</text>' : ''}</svg>`;
  canvas.replaceWith(wrapper);
}

export function renderSafeChart(canvasId, config, fallbackText) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const hasData = (config.data.datasets || []).some((dataset) =>
    cleanValues(dataset).some((value) => value > 0)
  );
  if (typeof Chart === 'undefined' || !hasData) {
    renderNativeSvg(canvas, config, fallbackText);
    return;
  }
  new Chart(canvas, config);
}
