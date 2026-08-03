import React, { useState } from 'react';
import { BarChart3, TrendingUp } from 'lucide-react';
import { getSevenDaySeries } from '../utils/storage';

export default function ComparisonChart({ sessions, profiles }) {
  const [chartMode, setChartMode] = useState('bar'); // 'bar' or 'line'
  const [hoveredIndex, setHoveredIndex] = useState(null);

  const series = getSevenDaySeries(sessions);
  const p1 = profiles.p1;
  const p2 = profiles.p2;

  // Calculate maximum value for Y-axis scale
  const allVals = [...series.p1Daily, ...series.p2Daily];
  const maxVal = Math.max(...allVals, 120); // default at least 2 hours
  const yMax = Math.ceil(maxVal / 30) * 30; // Round up to nearest half hour (30m)

  // Calculate cumulative trend for Line graph
  let p1Cum = 0;
  let p2Cum = 0;
  const p1Trend = series.p1Daily.map(v => (p1Cum += v));
  const p2Trend = series.p2Daily.map(v => (p2Cum += v));
  const trendMax = Math.max(...p1Trend, ...p2Trend, 300);
  const yTrendMax = Math.ceil(trendMax / 60) * 60;

  const formatHrsMins = (totalMins) => {
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hrs === 0) return `${mins}m`;
    return mins === 0 ? `${hrs}h` : `${hrs}h ${mins}m`;
  };

  // Dimensions for SVG Line Chart
  const svgWidth = 600;
  const svgHeight = 240;
  const paddingX = 40;
  const paddingY = 30;
  const plotWidth = svgWidth - paddingX * 2;
  const plotHeight = svgHeight - paddingY * 2;

  const getLinePoint = (val, index, total, max) => {
    const x = paddingX + (index / (total - 1)) * plotWidth;
    const y = paddingY + plotHeight - (val / max) * plotHeight;
    return `${x},${y}`;
  };

  const p1Path = p1Trend.map((v, i) => getLinePoint(v, i, p1Trend.length, yTrendMax)).join(' ');
  const p2Path = p2Trend.map((v, i) => getLinePoint(v, i, p2Trend.length, yTrendMax)).join(' ');

  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 className="card-title" style={{ marginBottom: '0.25rem' }}>
            <BarChart3 size={22} color="#F59E0B" /> Side-by-Side Study Comparison
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Compare daily focused hours and track your momentum across the past week.
          </p>
        </div>

        {/* Mode Toggle & Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.8rem', fontWeight: 700 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--p1-dark)' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--p1-color)', display: 'inline-block' }} />
              {p1.avatar} {p1.name}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--p2-dark)' }}>
              <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: 'var(--p2-color)', display: 'inline-block' }} />
              {p2.avatar} {p2.name}
            </span>
          </div>

          <div className="tabs-container" style={{ minWidth: '220px' }}>
            <button
              className={`tab-btn ${chartMode === 'bar' ? 'active' : ''}`}
              onClick={() => setChartMode('bar')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            >
              📊 Daily Bars
            </button>
            <button
              className={`tab-btn ${chartMode === 'line' ? 'active' : ''}`}
              onClick={() => setChartMode('line')}
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
            >
              📈 Weekly Trend
            </button>
          </div>
        </div>
      </div>

      {chartMode === 'bar' ? (
        /* Animated SVG / CSS Bar Chart */
        <div>
          <div style={{ display: 'flex', height: '260px', alignItems: 'flex-end', justifyContent: 'space-between', padding: '1rem 0 0', position: 'relative' }}>
            
            {/* Background Grid Scale Lines */}
            {[1, 0.75, 0.5, 0.25].map((mult, idx) => (
              <div key={idx} style={{
                position: 'absolute',
                bottom: `${mult * 220}px`,
                left: 0,
                right: 0,
                borderTop: '1px dashed var(--border-color)',
                zIndex: 0,
                pointerEvents: 'none'
              }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', position: 'absolute', right: 0, top: '-16px' }}>
                  {formatHrsMins(Math.round(yMax * mult))}
                </span>
              </div>
            ))}

            {series.dateLabels.map((label, idx) => {
              const p1Mins = series.p1Daily[idx];
              const p2Mins = series.p2Daily[idx];
              
              const p1HeightPercent = Math.max(4, Math.round((p1Mins / yMax) * 100));
              const p2HeightPercent = Math.max(4, Math.round((p2Mins / yMax) * 100));
              
              const isHovered = hoveredIndex === idx;

              return (
                <div
                  key={idx}
                  onMouseEnter={() => setHoveredIndex(idx)}
                  onMouseLeave={() => setHoveredIndex(null)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end',
                    position: 'relative',
                    zIndex: 1,
                    padding: '0 0.5rem',
                    cursor: 'pointer',
                    background: isHovered ? 'var(--bg-hover)' : 'transparent',
                    borderRadius: 'var(--radius-md)',
                    transition: 'var(--transition)'
                  }}
                >
                  {/* Tooltip on Hover */}
                  {isHovered && (
                    <div style={{
                      position: 'absolute',
                      top: '-10px',
                      background: 'var(--bg-secondary)',
                      border: '1px solid var(--border-highlight)',
                      padding: '0.6rem 0.8rem',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: 'var(--shadow-lg)',
                      zIndex: 10,
                      whiteSpace: 'nowrap',
                      pointerEvents: 'none',
                      textAlign: 'left'
                    }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '0.2rem', marginBottom: '0.4rem' }}>
                        {series.days[idx]} ({label})
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--p1-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <span>{p1.avatar} {p1.name}:</span>
                        <span>{formatHrsMins(p1Mins)}</span>
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--p2-dark)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
                        <span>{p2.avatar} {p2.name}:</span>
                        <span>{formatHrsMins(p2Mins)}</span>
                      </div>
                    </div>
                  )}

                  {/* Dual Bars */}
                  <div style={{ display: 'flex', gap: '6px', height: '220px', alignItems: 'flex-end', width: '100%', maxWidth: '44px', justifyContent: 'center' }}>
                    
                    {/* Friend 1 Bar */}
                    <div
                      style={{
                        width: '18px',
                        height: `${p1Mins > 0 ? p1HeightPercent : 2}%`,
                        background: p1Mins > 0 ? 'var(--p1-gradient)' : 'var(--bg-active)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxShadow: p1Mins > 0 ? '0 2px 6px rgba(245, 158, 11, 0.2)' : 'none'
                      }}
                    />

                    {/* Friend 2 Bar */}
                    <div
                      style={{
                        width: '18px',
                        height: `${p2Mins > 0 ? p2HeightPercent : 2}%`,
                        background: p2Mins > 0 ? 'var(--p2-gradient)' : 'var(--bg-active)',
                        borderRadius: '4px 4px 0 0',
                        transition: 'height 0.6s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        boxShadow: p2Mins > 0 ? '0 2px 6px rgba(6, 182, 212, 0.2)' : 'none'
                      }}
                    />
                  </div>

                  {/* X Axis Label */}
                  <div style={{
                    fontSize: '0.8rem',
                    fontWeight: label === 'Today' ? 800 : 600,
                    color: label === 'Today' ? 'var(--text-primary)' : 'var(--text-secondary)',
                    marginTop: '0.6rem'
                  }}>
                    {label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Cumulative Weekly Line Chart */
        <div style={{ textAlign: 'center', overflowX: 'auto' }}>
          <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} style={{ width: '100%', maxWidth: '800px', height: 'auto', margin: '0 auto', overflow: 'visible' }}>
            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((mult, i) => {
              const y = paddingY + plotHeight - (mult * plotHeight);
              return (
                <g key={i}>
                  <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} stroke="var(--border-color)" strokeDasharray="4 4" />
                  <text x={svgWidth - paddingX + 5} y={y + 4} fontSize="10" fill="var(--text-muted)">
                    {formatHrsMins(Math.round(yTrendMax * mult))}
                  </text>
                </g>
              );
            })}

            {/* Friend 1 Line & Points */}
            <polyline
              fill="none"
              stroke="var(--p1-color)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={p1Path}
            />
            {p1Trend.map((v, idx) => {
              const coords = getLinePoint(v, idx, p1Trend.length, yTrendMax).split(',').map(Number);
              return (
                <circle
                  key={`p1-${idx}`}
                  cx={coords[0]}
                  cy={coords[1]}
                  r="5"
                  fill="var(--bg-secondary)"
                  stroke="var(--p1-dark)"
                  strokeWidth="3"
                >
                  <title>{p1.name}: {formatHrsMins(v)} total on {series.dateLabels[idx]}</title>
                </circle>
              );
            })}

            {/* Friend 2 Line & Points */}
            <polyline
              fill="none"
              stroke="var(--p2-color)"
              strokeWidth="3.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={p2Path}
            />
            {p2Trend.map((v, idx) => {
              const coords = getLinePoint(v, idx, p2Trend.length, yTrendMax).split(',').map(Number);
              return (
                <circle
                  key={`p2-${idx}`}
                  cx={coords[0]}
                  cy={coords[1]}
                  r="5"
                  fill="var(--bg-secondary)"
                  stroke="var(--p2-dark)"
                  strokeWidth="3"
                >
                  <title>{p2.name}: {formatHrsMins(v)} total on {series.dateLabels[idx]}</title>
                </circle>
              );
            })}

            {/* X Axis labels */}
            {series.dateLabels.map((label, idx) => {
              const x = paddingX + (idx / (series.dateLabels.length - 1)) * plotWidth;
              return (
                <text key={`label-${idx}`} x={x} y={svgHeight - 4} textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--text-secondary)">
                  {label}
                </text>
              );
            })}
          </svg>
          
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
            <TrendingUp size={15} color="#10B981" />
            <span>Line slopes indicate daily momentum and consistency throughout the week.</span>
          </div>
        </div>
      )}
    </div>
  );
}
