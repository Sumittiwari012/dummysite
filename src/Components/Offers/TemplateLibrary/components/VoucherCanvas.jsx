import React from 'react'
import { QrCells } from './QrCells'
import { BackgroundPattern } from './BackgroundPattern'
import { RibbonLayer } from './RibbonLayer'
// -----------------------------------------------------------------------
// The voucher canvas. Renders the design; when `interactive` is true,
// every configurable element is clickable and draggable.
// -----------------------------------------------------------------------
export const VoucherCanvas = React.forwardRef(function VoucherCanvas(
  { design, interactive = false, selectedKey = null, onSelect, onBeginDrag },
  svgRef
) {
  const uid = design.colors.accent.replace('#', '') + (interactive ? '-live' : '-thumb')
  const viewW = 200
  const viewH = viewW * (design.heightMM / Math.max(design.widthMM, 1))
  const sx = viewW / 200
  const sy = viewH / 100
  const c = design.colors

  const col = (el, fallback) => (el && el.color) || fallback

  const handlePointerDown = (key) => (e) => {
    if (!interactive) return
    e.stopPropagation()
    e.preventDefault()
    onSelect && onSelect(key)
    onBeginDrag && onBeginDrag(key, e)
  }

  const selRing = (key, cx, cy, w, h) => {
    if (!interactive || selectedKey !== key) return null
    return (
      <rect
        x={cx - w / 2} y={cy - h / 2} width={w} height={h}
        fill="none" stroke="#2E7DB0" strokeWidth={0.6} strokeDasharray="1.4 1.2" rx={1.5}
      />
    )
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${viewW} ${viewH}`}
      width="100%"
      height="100%"
      onPointerDown={() => interactive && onSelect && onSelect(null)}
      style={{ display: 'block', fontFamily: design.fontBody, touchAction: 'none' }}
    >
      <defs>
        <linearGradient id={`vgrad-${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={c.accent} />
          <stop offset="100%" stopColor={c.accentDark} />
        </linearGradient>
        <clipPath id={`vclip-${uid}`}>
          <rect x={0.5 * sx} y={0.5 * sy} width={viewW - sx} height={viewH - sy} rx={3.5} />
        </clipPath>
        <clipPath id={`vsidepanelclip-${uid}`}>
          <rect x={150 * sx} y={0} width={50 * sx} height={viewH} />
        </clipPath>
      </defs>

      <g clipPath={`url(#vclip-${uid})`}>
        <rect x={0} y={0} width={viewW} height={viewH} fill={c.tint} />

        {design.layers.backgroundImage && (
          <image
            href={design.layers.backgroundImage}
            x={0} y={0} width={viewW} height={viewH}
            preserveAspectRatio="xMidYMid slice"
            opacity={design.layers.backgroundImageOpacity ?? 1}
          />
        )}

        <BackgroundPattern
          style={design.layers.backgroundPattern}
          viewW={viewW}
          viewH={viewH}
          sx={sx}
          sy={sy}
          colors={c}
          patternColor={design.layers.backgroundPatternColor}
          customOpacity={design.layers.backgroundPatternOpacity}
        />

        {design.layers.sidePanel && (
          <>
            <rect x={150 * sx} y={0} width={50 * sx} height={viewH} fill={c.accentDark} />
            <g clipPath={`url(#vsidepanelclip-${uid})`}>
              <g transform={`translate(${150 * sx}, 0)`}>
                <BackgroundPattern
                  style={design.layers.sidePanelPattern}
                  viewW={50 * sx}
                  viewH={viewH}
                  sx={sx}
                  sy={sy}
                  colors={c}
                  patternColor={design.layers.sidePanelPatternColor}
                  customOpacity={design.layers.sidePanelPatternOpacity}
                />
              </g>
            </g>
            {design.layers.dots && [0, 1, 2, 3].map((col2) =>
              [0, 1, 2, 3, 4, 5].map((row) => (
                <circle
                  key={`dot-${col2}-${row}`}
                  cx={(159 + col2 * 11) * sx}
                  cy={(9 + row * 16) * sy}
                  r={1.5 * Math.min(sx, sy)}
                  fill="#FFFFFF"
                  opacity="0.16"
                />
              ))
            )}
            
          </>
        )}

        <RibbonLayer
          style={design.layers.ribbonStyle}
          viewW={viewW}
          viewH={viewH}
          sx={sx}
          sy={sy}
          uid={uid}
          ribbonColor={design.layers.ribbonColor}
        />

        {design.cornerFlag.visible && (
          <g onPointerDown={handlePointerDown('cornerFlag')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <path
              d={`M0 0 H${design.cornerFlag.width} V16 L${design.cornerFlag.width - 8} 11 L${design.cornerFlag.width - 16} 16 L${design.cornerFlag.width - 24} 11 L${design.cornerFlag.width - 32} 16 L${design.cornerFlag.width - 40} 11 L0 16 Z`}
              fill={c.accentDark}
            />
            <text
              x={design.cornerFlag.x} y={design.cornerFlag.y}
              textAnchor="middle" fontSize={5.5} fontWeight="700" letterSpacing="0.3"
              fill={col(design.cornerFlag, c.onDark)} fontFamily={design.fontBody}
            >
              {design.cornerFlag.text}
            </text>
            {selRing('cornerFlag', design.cornerFlag.x, design.cornerFlag.y - 2, design.cornerFlag.width, 16)}
          </g>
        )}

        {design.headline.visible && (
          <g onPointerDown={handlePointerDown('headline')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <text
              x={design.headline.x} y={design.headline.y}
              fontSize={design.headline.fontSize} fontWeight="800"
              fill={col(design.headline, c.accentDark)} fontFamily={design.fontDisplay}
            >
              {design.headline.text}
            </text>
            {selRing('headline', design.headline.x + design.headline.fontSize * 1.6, design.headline.y - design.headline.fontSize * 0.4, design.headline.fontSize * 3.6, design.headline.fontSize * 1.3)}
          </g>
        )}

        {design.subtitle.visible && (
          <g onPointerDown={handlePointerDown('subtitle')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <text
              x={design.subtitle.x} y={design.subtitle.y}
              fontSize={design.subtitle.fontSize} fontWeight="600" letterSpacing="0.15em"
              fill={col(design.subtitle, c.accentDark)} opacity="0.75" fontFamily={design.fontBody}
            >
              {design.subtitle.text}
            </text>
            {selRing('subtitle', design.subtitle.x + design.subtitle.fontSize * 3.2, design.subtitle.y - design.subtitle.fontSize * 0.4, design.subtitle.fontSize * 7, design.subtitle.fontSize * 1.4)}
          </g>
        )}

        {design.expiry.visible && (
          <g onPointerDown={handlePointerDown('expiry')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <text
              x={design.expiry.x} y={design.expiry.y}
              fontSize={design.expiry.fontSize} fontWeight="700" letterSpacing="0.04em"
              fill={col(design.expiry, c.accentDark)} opacity="0.85" fontFamily={design.fontBody}
            >
              {design.expiry.text}
            </text>
            {selRing('expiry', design.expiry.x + design.expiry.fontSize * 4.4, design.expiry.y - design.expiry.fontSize * 0.4, design.expiry.fontSize * 9.6, design.expiry.fontSize * 1.4)}
          </g>
        )}

        {design.qr.visible && (
          <g onPointerDown={handlePointerDown('qr')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <QrCells value={design.qr.value} x={design.qr.x} y={design.qr.y} size={design.qr.size} color={col(design.qr, c.accentDark)} />
            {selRing('qr', design.qr.x + design.qr.size / 2, design.qr.y + design.qr.size / 2, design.qr.size + 1.5, design.qr.size + 1.5)}
          </g>
        )}

        {design.qrLabel.visible && (
          <g onPointerDown={handlePointerDown('qrLabel')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <text
              x={design.qrLabel.x} y={design.qrLabel.y}
              fontSize={design.qrLabel.fontSize} fontWeight="700" letterSpacing="0.06em"
              fill={col(design.qrLabel, c.accentDark)} opacity="0.8" fontFamily={design.fontBody}
            >
              {design.qrLabel.line1}
            </text>
            <text
              x={design.qrLabel.x} y={design.qrLabel.y + design.qrLabel.fontSize * 1.15}
              fontSize={design.qrLabel.fontSize} fontWeight="700" letterSpacing="0.06em"
              fill={col(design.qrLabel, c.accentDark)} opacity="0.8" fontFamily={design.fontBody}
            >
              {design.qrLabel.line2}
            </text>
            {selRing('qrLabel', design.qrLabel.x + design.qrLabel.fontSize * 3.2, design.qrLabel.y, design.qrLabel.fontSize * 7, design.qrLabel.fontSize * 3.2)}
          </g>
        )}

        {design.terms.visible && (
          <g onPointerDown={handlePointerDown('terms')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <text
              x={design.terms.x} y={design.terms.y}
              fontSize={design.terms.fontSize} fill={col(design.terms, c.accentDark)} opacity="0.6" fontFamily={design.fontBody}
            >
              {design.terms.text}
            </text>
            {selRing('terms', design.terms.x + design.terms.fontSize * 12, design.terms.y - design.terms.fontSize * 0.4, design.terms.fontSize * 25, design.terms.fontSize * 1.4)}
          </g>
        )}

        {design.medallion.visible && (
          <g onPointerDown={handlePointerDown('medallion')} style={{ cursor: interactive ? 'grab' : 'default' }}>
            <circle cx={design.medallion.cx} cy={design.medallion.cy} r={design.medallion.r} fill={design.medallion.fill || c.tint} stroke={design.medallion.stroke || c.accentDark} strokeWidth="1.5" />
            <circle cx={design.medallion.cx} cy={design.medallion.cy} r={design.medallion.r * 0.8} fill="none" stroke={c.accent} strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />
            <text
              x={design.medallion.cx} y={design.medallion.cy - design.medallion.r * 0.05}
              textAnchor="middle" fontSize={design.medallion.valueFontSize} fontWeight="800"
              fill={design.medallion.stroke || c.accentDark} fontFamily={design.fontDisplay}
            >
              {design.medallion.value}
            </text>
            <text
              x={design.medallion.cx} y={design.medallion.cy + design.medallion.r * 0.36}
              textAnchor="middle" fontSize={design.medallion.labelFontSize} fontWeight="700" letterSpacing="0.1em"
              fill={design.medallion.stroke || c.accentDark} opacity="0.8" fontFamily={design.fontBody}
            >
              {design.medallion.label}
            </text>
            {selRing('medallion', design.medallion.cx, design.medallion.cy, design.medallion.r * 2 + 3, design.medallion.r * 2 + 3)}
          </g>
        )}
      </g>

      {design.layers.frame && (
        <rect x={0.75 * sx} y={0.75 * sy} width={viewW - 1.5 * sx} height={viewH - 1.5 * sy} rx={3.5} fill="none" stroke={c.accentDark} strokeWidth="1.5" opacity="0.25" />
      )}
    </svg>
  )
})

export default VoucherCanvas