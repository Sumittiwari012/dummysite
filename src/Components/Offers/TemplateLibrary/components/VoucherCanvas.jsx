import React from 'react'
import { QrCells } from './QrCells'

// -----------------------------------------------------------------------
// The voucher canvas. Renders the named-field design object produced by
// baseDesign()/blankDesign() in lib/design.js — qr, qrLabel — plus a
// few simple decorative layers (frame, side panel, dots, ribbon), and
// finally the freeform `design.elements` array (shapes/text/images/QR
// added via the Canvas panel), in array order (front = last item).
// When `interactive` is true, every element — named or freeform — is
// clickable/draggable, shapes/images/text additionally get corner
// handles for resizing, and shapes/text/images additionally get a
// rotate handle above the selection box.
// -----------------------------------------------------------------------
function ShapeNode({ el, colors }) {
  // Shapes render with a thin black border and the interior filled in
  // el.color. Line has no interior, so it renders fully in el.color
  // instead. Falls back to black fill for older saved shapes without
  // a color.
  const fillColor = el.color || '#000000'
  const borderColor = '#000000'
  const strokeWidth = el.strokeWidth || 1
  const common = { fill: fillColor, stroke: borderColor, strokeWidth, opacity: el.opacity ?? 1 }

  switch (el.shape) {
    case 'rect':
      return <rect x={el.x} y={el.y} width={el.width} height={el.height} rx={el.cornerRadius || 0} {...common} />
    case 'ellipse':
      return <ellipse cx={el.x + el.width / 2} cy={el.y + el.height / 2} rx={el.width / 2} ry={el.height / 2} {...common} />
    case 'line':
      // No interior — the whole line renders in el.color.
      return <line x1={el.x} y1={el.y} x2={el.x + el.width} y2={el.y + el.height} stroke={fillColor} strokeWidth={el.strokeWidth || 1.5} opacity={el.opacity ?? 1} />
    case 'polygon': {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const r = Math.min(el.width, el.height) / 2
      const n = Math.max(3, el.sides || 5)
      const pts = Array.from({ length: n }).map((_, i) => {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / n
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
      }).join(' ')
      return <polygon points={pts} {...common} />
    }
    case 'star': {
      const cx = el.x + el.width / 2
      const cy = el.y + el.height / 2
      const rOuter = Math.min(el.width, el.height) / 2
      const rInner = rOuter * 0.45
      const n = Math.max(3, el.points || 5)
      const pts = Array.from({ length: n * 2 }).map((_, i) => {
        const r = i % 2 === 0 ? rOuter : rInner
        const a = -Math.PI / 2 + (i * Math.PI) / n
        return `${cx + r * Math.cos(a)},${cy + r * Math.sin(a)}`
      }).join(' ')
      return <polygon points={pts} {...common} />
    }
    case 'freeform': {
      if (el.path) {
        const localScale = (el.width + el.height) / 2 || 1
        const pathStroke = { ...common, strokeWidth: strokeWidth / localScale }
        return (
          <g transform={`translate(${el.x} ${el.y}) scale(${el.width} ${el.height})`}>
            <path d={el.path} {...pathStroke} />
          </g>
        )
      }
      if (el.points) {
        const pts = el.points
          .map(([ux, uy]) => `${el.x + ux * el.width},${el.y + uy * el.height}`)
          .join(' ')
        // Open polylines (e.g. chevron) have no interior — full color, stroke only.
        return el.closed === false
          ? <polyline points={pts} fill="none" stroke={fillColor} strokeWidth={el.strokeWidth || 1.5} opacity={el.opacity ?? 1} />
          : <polygon points={pts} {...common} />
      }
      return null
    }
    default:
      return null
  }
}

function elementBounds(key, el) {
  if (key === 'qr' || el.type === 'qr') {
    return { x: el.x, y: el.y, w: el.size, h: el.size, cx: el.x + el.size / 2, cy: el.y + el.size / 2 }
  }
  if (key === 'qrLabel') {
    const approxW = Math.max((el.line1?.length || 0), (el.line2?.length || 0)) * el.fontSize * 0.6
    return { x: el.x, y: el.y - el.fontSize, w: approxW, h: el.fontSize * 2.2, cx: el.x + approxW / 2, cy: el.y - el.fontSize * 0.3 }
  }
  if (el.type === 'text') {
    const approxW = (el.text?.length || 6) * el.fontSize * 0.55
    const h = el.fontSize * 1.3
    return { x: el.x, y: el.y - el.fontSize, w: Math.max(approxW, el.fontSize), h, cx: el.x + approxW / 2, cy: el.y - el.fontSize * 0.3 }
  }
  if (el.type === 'shape' || el.type === 'image') {
    return { x: el.x, y: el.y, w: el.width, h: el.height, cx: el.x + el.width / 2, cy: el.y + el.height / 2 }
  }
  return { x: el.x || 0, y: el.y || 0, w: 0, h: 0, cx: el.x || 0, cy: el.y || 0 }
}

// Shapes, images, and freeform text can all be resized via corner
// handles. For text, resizing scales fontSize (see the resize handler
// wherever onBeginResize is implemented) rather than a stored
// width/height box, since elementBounds derives text's box from
// fontSize + text length.
function isResizable(key, el) {
  return (el.type === 'shape' && el.shape !== 'line') || el.type === 'image' || el.type === 'text'
}

// Freeform shape/text/image elements expose a `rotation` field
// (see ElementFields.jsx's SizeAndRotation) — named slots (qr,
// qrLabel) don't rotate.
function isRotatable(key, el) {
  return el.type === 'shape' || el.type === 'text' || el.type === 'image'
}

export const VoucherCanvas = React.forwardRef(function VoucherCanvas(
  { design, interactive = false, selectedKey = null, onSelect, onBeginDrag, onBeginResize, onBeginRotate },
  svgRef
) {
  const uid = design.colors.accent.replace('#', '') + (interactive ? '-live' : '-thumb')
  const viewW = 200
  const viewH = viewW * (design.heightMM / Math.max(design.widthMM, 1))
  const c = design.colors
  const layers = design.layers || {}
  const elements = design.elements || []

  // Which *type* renders above which other type is controlled by
  // design.layerOrder (front = last), independent of when an element
  // was added — that's handled by ElementsPanel's Layers control.
  // Within a single type, elements keep their existing relative order
  // in `elements` (front = last of that type). Any type not present in
  // layerOrder (e.g. an older saved design) falls back to appearing in
  // its natural array position relative to other unknown-type elements,
  // stacked above all known-type groups.
  
  

  const handlePointerDown = (key) => (e) => {
    if (!interactive) return
    e.stopPropagation()
    e.preventDefault()
    onSelect && onSelect(key)
    onBeginDrag && onBeginDrag(key, e)
  }

  const handleResizePointerDown = (key, corner) => (e) => {
    if (!interactive) return
    e.stopPropagation()
    e.preventDefault()
    onBeginResize && onBeginResize(key, corner, e)
  }

  const handleRotatePointerDown = (key) => (e) => {
    if (!interactive) return
    e.stopPropagation()
    e.preventDefault()
    onBeginRotate && onBeginRotate(key, e)
  }

  const HANDLE = 2.2
  const ROTATE_OFFSET = 9 // distance (svg units) above the selection box

  const resizeHandles = (key, el) => {
    if (!interactive || selectedKey !== key || !isResizable(key, el)) return null
    const b = elementBounds(key, el)
    const corners = [
      { corner: 'tl', cx: b.x, cy: b.y },
      { corner: 'tr', cx: b.x + b.w, cy: b.y },
      { corner: 'bl', cx: b.x, cy: b.y + b.h },
      { corner: 'br', cx: b.x + b.w, cy: b.y + b.h },
    ]
    const cursorFor = { tl: 'nwse-resize', br: 'nwse-resize', tr: 'nesw-resize', bl: 'nesw-resize' }
    return corners.map(({ corner, cx, cy }) => (
      <rect
        key={corner}
        x={cx - HANDLE / 2} y={cy - HANDLE / 2} width={HANDLE} height={HANDLE}
        fill="#FFFFFF" stroke="#2E7DB0" strokeWidth={0.5}
        style={{ cursor: cursorFor[corner] }}
        onPointerDown={handleResizePointerDown(key, corner)}
      />
    ))
  }

  const rotateHandle = (key, el) => {
    if (!interactive || selectedKey !== key || !isRotatable(key, el)) return null
    const b = elementBounds(key, el)
    const topY = b.y - 1
    const handleY = topY - ROTATE_OFFSET
    return (
      <g>
        <line x1={b.cx} y1={topY} x2={b.cx} y2={handleY} stroke="#2E7DB0" strokeWidth={0.5} />
        <circle
          cx={b.cx} cy={handleY} r={HANDLE / 2 + 0.3}
          fill="#FFFFFF" stroke="#2E7DB0" strokeWidth={0.5}
          style={{ cursor: 'grab' }}
          onPointerDown={handleRotatePointerDown(key)}
        />
      </g>
    )
  }

  const selRing = (key, el) => {
    if (!interactive || selectedKey !== key) return null
    const b = elementBounds(key, el)
    return (
      <g>
        <rect
          x={b.x - 1} y={b.y - 1} width={b.w + 2} height={b.h + 2}
          fill="none" stroke="#2E7DB0" strokeWidth={0.6} strokeDasharray="1.4 1.2" rx={1.5}
        />
        {resizeHandles(key, el)}
        {rotateHandle(key, el)}
      </g>
    )
  }

  const wrap = (key, el, content) => {
    if (!content) return null
    return (
      <g key={key} onPointerDown={handlePointerDown(key)} style={{ cursor: interactive ? 'grab' : 'default' }}>
        {content}
        {selRing(key, el)}
      </g>
    )
  }

  const renderQr = () => {
    const el = design.qr
    if (!el || !el.visible || !el.value) return null
    return wrap('qr', el, <QrCells value={el.value} x={el.x} y={el.y} size={el.size} color={el.color || c.accentDark} />)
  }

  const renderQrLabel = () => {
    const el = design.qrLabel
    if (!el || !el.visible) return null
    return wrap('qrLabel', el,
      <g fill={el.color || c.accentDark} fontFamily={el.font} fontSize={el.fontSize} fontWeight={600}>
        <text x={el.x} y={el.y}>{el.line1}</text>
        <text x={el.x} y={el.y + el.fontSize * 1.2}>{el.line2}</text>
      </g>
    )
  }

  // Freeform elements added via the Canvas panel (Shapes/Text/Image/QR).
  const renderFreeformElement = (el) => {
    if (!el.visible) return null
    const rotation = el.rotation ? `rotate(${el.rotation} ${el.x + (el.width || 0) / 2} ${el.y + (el.height || 0) / 2})` : undefined

    let content = null
    if (el.type === 'shape') {
      content = <ShapeNode el={el} colors={c} />
    } else if (el.type === 'text') {
      const approxW = (el.text?.length || 6) * el.fontSize * 0.55
      const padX = el.fontSize * 0.35
      const padY = el.fontSize * 0.3
      const hasBg = el.bgColor && el.bgColor !== 'transparent'
      content = (
        <g>
          {hasBg && (
            <rect
              x={el.x - padX}
              y={el.y - el.fontSize - padY}
              width={approxW + padX * 2}
              height={el.fontSize * 1.3 + padY * 2}
              fill={el.bgColor}
              opacity={el.opacity ?? 1}
            />
          )}
          <text
            x={el.x} y={el.y}
            fontSize={el.fontSize} fontWeight={el.fontWeight || 600}
            fill={el.color || c.accentDark} opacity={el.opacity ?? 1} fontFamily={el.font}
          >
            {el.text}
          </text>
        </g>
      )
    } else if (el.type === 'image') {
      if (!el.src) return null
      content = (
        <image
          href={el.src} x={el.x} y={el.y} width={el.width} height={el.height}
          preserveAspectRatio={el.fit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice'}
          opacity={el.opacity ?? 1}
        />
      )
    } else if (el.type === 'qr') {
      content = <QrCells value={el.value} x={el.x} y={el.y} size={el.size} color={el.color || c.accentDark} />
    }

    if (!content) return null

    return (
      <g key={el.id} transform={rotation} onPointerDown={handlePointerDown(el.id)} style={{ cursor: interactive ? 'grab' : 'default' }}>
        {content}
        {selRing(el.id, el)}
      </g>
    )
  }

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${viewW} ${viewH}`}
      width="100%"
      height="100%"
      onPointerDown={() => interactive && onSelect && onSelect(null)}
      style={{ display: 'block', fontFamily: "'Inter', sans-serif", touchAction: 'none' }}
    >
      <defs>
        <clipPath id={`vclip-${uid}`}>
          <rect x={0.5} y={0.5} width={viewW - 1} height={viewH - 1} rx={3.5} />
        </clipPath>
      </defs>

      <g clipPath={`url(#vclip-${uid})`}>
        <rect x={0} y={0} width={viewW} height={viewH} fill={c.tint} />

        {layers.dots && (
          <g fill={c.accent} opacity={0.15}>
            {Array.from({ length: 6 }).map((_, row) =>
              Array.from({ length: 20 }).map((_, col) => (
                <circle key={`${row}-${col}`} cx={4 + col * 5} cy={4 + row * 5} r={0.5} />
              ))
            )}
          </g>
        )}

        {layers.sidePanel && (
          <rect x={0} y={0} width={viewW * 0.06} height={viewH} fill={c.accent} />
        )}

        {layers.ribbonStyle === 'diagonal' && (
          <polygon
            points={`${viewW - 30},0 ${viewW},0 ${viewW},30`}
            fill={layers.ribbonColor || c.accent}
          />
        )}

        {renderQr()}
        {renderQrLabel()}

        {elements.map(renderFreeformElement)}

        {layers.frame && (
          <rect x={0.5} y={0.5} width={viewW - 1} height={viewH - 1} rx={3.5} fill="none" stroke={c.accent} strokeWidth={0.6} />
        )}
      </g>
    </svg>
  )
})

export default VoucherCanvas