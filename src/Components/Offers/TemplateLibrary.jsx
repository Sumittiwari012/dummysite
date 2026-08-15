import React, { useCallback, useEffect, useRef, useState } from 'react'
import _ from 'lodash'
import QRCode from 'qrcode'
import {
  ArrowLeft, Plus, Trash2, Copy, Check, Save, Palette,
  Type, LayoutTemplate, RefreshCcw, Move
} from 'lucide-react'
// npm install qrcode lodash

// -----------------------------------------------------------------------
// The single base voucher design. Every color, font, illustration layer,
// text position, QR position/size, and the physical print size (mm) live
// on this object and are editable in the studio. Nothing here is fixed.
// -----------------------------------------------------------------------
function baseDesign() {
  return {
    name: 'Untitled voucher',
    widthMM: 152.4, // 6in
    heightMM: 76.2, // 3in
    colors: {
      accent: '#B9762E',
      accentDark: '#8F5720',
      tint: '#FBF3E8',
      onDark: '#FFFFFF',
    },
    fontDisplay: "'Space Grotesk', sans-serif",
    fontBody: "'Inter', sans-serif",
    layers: {
      texture: true,
      sidePanel: true,
      dots: true,
      ribbon: true,
      frame: true,
    },
    cornerFlag: { visible: true, text: 'LOREM IPSUM', x: 23, y: 10.5, width: 46, color: null },
    headline: { visible: true, text: 'SAVE', x: 10, y: 32, fontSize: 15, color: null },
    subtitle: { visible: true, text: 'VOUCHER', x: 10, y: 41, fontSize: 5.5, color: null },
    expiry: { visible: true, text: 'VALID THRU 12/31/26', x: 10, y: 51, fontSize: 5, color: null },
    qr: { visible: true, value: 'https://yourstore.com/redeem', x: 10, y: 57, size: 17, color: null },
    qrLabel: { visible: true, line1: 'SCAN TO', line2: 'REDEEM', x: 30, y: 64, fontSize: 4.3, color: null },
    terms: { visible: true, text: 'Terms & conditions apply. Not valid with other offers.', x: 10, y: 93, fontSize: 3.3, color: null },
    medallion: {
      visible: true, cx: 121, cy: 50, r: 22,
      value: '25%', valueFontSize: 10,
      label: 'OFF', labelFontSize: 5.5,
      fill: null, stroke: null,
    },
  }
}

const ELEMENT_POS_KEYS = {
  cornerFlag: ['x', 'y'],
  headline: ['x', 'y'],
  subtitle: ['x', 'y'],
  expiry: ['x', 'y'],
  qr: ['x', 'y'],
  qrLabel: ['x', 'y'],
  terms: ['x', 'y'],
  medallion: ['cx', 'cy'],
}

const ELEMENT_LABELS = {
  cornerFlag: 'Corner flag',
  headline: 'Headline word',
  subtitle: 'Subtitle label',
  expiry: 'Expiry date',
  qr: 'QR code',
  qrLabel: 'QR caption',
  terms: 'Terms text',
  medallion: 'Value medallion',
}

const DISPLAY_FONTS = [
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'Fraunces', value: "'Fraunces', serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
]
const BODY_FONTS = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Manrope', value: "'Manrope', sans-serif" },
  { label: 'IBM Plex Sans', value: "'IBM Plex Sans', sans-serif" },
  { label: 'Source Serif 4', value: "'Source Serif 4', serif" },
]

const SIZE_PRESETS = [
  { label: '3" x 6"', widthMM: 152.4, heightMM: 76.2 },
  { label: 'Credit card', widthMM: 85.6, heightMM: 54 },
  { label: 'A6', widthMM: 148, heightMM: 105 },
  { label: 'Square', widthMM: 100, heightMM: 100 },
]

function genId() {
  return 'vt_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function round1(n) {
  return Math.round(n * 10) / 10
}

// -----------------------------------------------------------------------
// Persistence. Everything funnels through these two functions — swap
// them out for real API calls (e.g. GET/PUT /api/coupon-templates) and
// nothing else in this file needs to change. The shape saved is always
// { designs: { [id]: design }, order: [id, ...] }.
// -----------------------------------------------------------------------
const STORAGE_KEY = 'coupon-voucher-designs'

function loadDesignStore() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return { designs: {}, order: [] }
    const parsed = JSON.parse(raw)
    return { designs: parsed.designs || {}, order: parsed.order || [] }
  } catch (e) {
    return { designs: {}, order: [] }
  }
}

function saveDesignStore(designs, order) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ designs, order }))
    return true
  } catch (e) {
    return false
  }
}

// Read-only helper other components (e.g. the Add Coupon form) can use
// to list saved templates without importing the whole editor.
export function getSavedTemplates() {
  const { designs, order } = loadDesignStore()
  return order.map((id) => designs[id]).filter(Boolean)
}

export function getSavedTemplateById(id) {
  const { designs } = loadDesignStore()
  return designs[id] || null
}

// -----------------------------------------------------------------------
// QR rendering — real scannable modules via the `qrcode` package.
// -----------------------------------------------------------------------
function QrCells({ value, x, y, size, color, quietZone = 1.5 }) {
  const [qr, setQr] = useState(null)
  useEffect(() => {
    let cancelled = false
    try {
      const matrix = QRCode.create(value || ' ', { errorCorrectionLevel: 'M' })
      if (!cancelled) setQr(matrix)
    } catch (e) {
      if (!cancelled) setQr(null)
    }
    return () => { cancelled = true }
  }, [value])

  if (!qr) return <rect x={x} y={y} width={size} height={size} fill="#FFFFFF" />

  const n = qr.modules.size
  const data = qr.modules.data
  const total = n + quietZone * 2
  const cell = size / total
  const cells = []
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (data[row * n + col]) {
        cells.push(
          <rect
            key={`${row}-${col}`}
            x={x + (col + quietZone) * cell}
            y={y + (row + quietZone) * cell}
            width={cell}
            height={cell}
            fill={color}
          />
        )
      }
    }
  }
  return (
    <g>
      <rect x={x} y={y} width={size} height={size} fill="#FFFFFF" />
      {cells}
    </g>
  )
}

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
      </defs>

      <g clipPath={`url(#vclip-${uid})`}>
        <rect x={0} y={0} width={viewW} height={viewH} fill={c.tint} />

        {design.layers.texture && (
          <>
            <polygon points={`0,0 ${60 * sx},0 ${30 * sx},${38 * sy}`} fill={c.accent} opacity="0.12" />
            <polygon points={`${60 * sx},0 ${100 * sx},0 ${70 * sx},${30 * sy} ${40 * sx},${20 * sy}`} fill={c.accent} opacity="0.08" />
            <polygon points={`0,${38 * sy} ${30 * sx},${38 * sy} ${10 * sx},${viewH} 0,${viewH}`} fill={c.accentDark} opacity="0.08" />
            <polygon points={`${10 * sx},${viewH} ${60 * sx},${viewH} ${30 * sx},${60 * sy}`} fill={c.accent} opacity="0.1" />
          </>
        )}

        {design.layers.sidePanel && (
          <>
            <rect x={150 * sx} y={0} width={50 * sx} height={viewH} fill={c.accentDark} />
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
            <circle cx={197 * sx} cy={10 * sy} r={22 * Math.min(sx, sy)} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.1" />
            <circle cx={153 * sx} cy={92 * sy} r={26 * Math.min(sx, sy)} fill="none" stroke="#FFFFFF" strokeWidth="1" opacity="0.1" />
          </>
        )}

        {design.layers.ribbon && (
          <rect
            x={112 * sx} y={-10 * sy} width={18 * sx} height={viewH + 20 * sy}
            fill={`url(#vgrad-${uid})`}
            transform={`rotate(8 ${121 * sx} ${50 * sy})`}
            opacity="0.95"
          />
        )}

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

// -----------------------------------------------------------------------
// Small reusable field controls for the properties panel
// -----------------------------------------------------------------------
function Field({ label, children }) {
  return (
    <label className="vs-field">
      <span className="vs-field-label">{label}</span>
      {children}
    </label>
  )
}

function NumberField({ label, value, onChange, step = 0.5, min, max, suffix }) {
  return (
    <Field label={label}>
      <div className="vs-number-wrap">
        <input
          type="number"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value)
            onChange(Number.isFinite(v) ? v : 0)
          }}
          className="vs-input vs-input--number"
        />
        {suffix && <span className="vs-suffix">{suffix}</span>}
      </div>
    </Field>
  )
}

function ColorField({ label, value, fallback, onChange, onClear }) {
  return (
    <Field label={label}>
      <div className="vs-color-wrap">
        <input
          type="color"
          value={value || fallback}
          onChange={(e) => onChange(e.target.value)}
          className="vs-color-input"
        />
        <span className="vs-color-hex">{(value || fallback).toUpperCase()}</span>
        {value && (
          <button type="button" className="vs-color-clear" onClick={onClear} aria-label={`Reset ${label} to default`}>
            <RefreshCcw size={12} strokeWidth={2.25} />
          </button>
        )}
      </div>
    </Field>
  )
}

// -----------------------------------------------------------------------
// Main studio: gallery of saved designs (Add button only, no presets) +
// full editor for the one configurable base design.
// -----------------------------------------------------------------------
// `selectedTemplate`, `onBack`, and `onSelect` are all optional. Pass
// them when embedding this as a picker (e.g. from AddCoupon's "Select
// from library" button) — `onSelect(id)` fires once the person picks or
// saves a template, and `onBack()` wires up a back arrow to leave the
// picker without choosing anything. Omit all three to use this as a
// standalone template-management screen instead.
export default function TemplateLibrary({ selectedTemplate = null, onBack = null, onSelect = null }) {
  const isPicker = typeof onSelect === 'function'
  const [view, setView] = useState('gallery')
  const [store, setStore] = useState(() => loadDesignStore())
  const designs = store.designs
  const order = store.order
  const [storageOk, setStorageOk] = useState(true)

  const [draft, setDraft] = useState(null)
  const [draftId, setDraftId] = useState(null)
  const [selected, setSelected] = useState(null)
  const [panelTab, setPanelTab] = useState('canvas')
  const [saveState, setSaveState] = useState('idle')
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const svgRef = useRef(null)
  const dragRef = useRef(null)
  const viewDimsRef = useRef({ w: 200, h: 100 })

  useEffect(() => {
    if (!draft) return
    viewDimsRef.current = {
      w: 200,
      h: 200 * (draft.heightMM / Math.max(draft.widthMM, 1)),
    }
  }, [draft])

  function persist(nextDesigns, nextOrder) {
    const ok = saveDesignStore(nextDesigns, nextOrder)
    if (ok) {
      setStore({ designs: nextDesigns, order: nextOrder })
      setStorageOk(true)
    } else {
      setStorageOk(false)
    }
    return ok
  }

  function openNew() {
    setDraft(baseDesign())
    setDraftId(genId())
    setSelected(null)
    setPanelTab('canvas')
    setSaveState('idle')
    setView('editor')
  }

  function openEdit(id) {
    const source = designs[id]
    if (!source) return
    setDraft(_.cloneDeep(source))
    setDraftId(id)
    setSelected(null)
    setPanelTab('canvas')
    setSaveState('idle')
    setView('editor')
  }

  function duplicate(id) {
    const source = designs[id]
    if (!source) return
    setDraft({ ..._.cloneDeep(source), name: `${source.name} copy` })
    setDraftId(genId())
    setSelected(null)
    setPanelTab('canvas')
    setSaveState('idle')
    setView('editor')
  }

  function confirmDelete(id) {
    const nextDesigns = { ...designs }
    delete nextDesigns[id]
    const nextOrder = order.filter((existingId) => existingId !== id)
    persist(nextDesigns, nextOrder)
    setPendingDeleteId(null)
  }

  // `andSelect`: when true (only possible in picker mode), saves and
  // immediately hands the new/updated id back to the parent via onSelect.
  function saveDraft(andSelect = false) {
    if (!draft || !draftId) return
    setSaveState('saving')
    const nextDesigns = { ...designs, [draftId]: { ...draft, id: draftId, updatedAt: Date.now() } }
    const nextOrder = order.includes(draftId) ? order : [...order, draftId]
    const ok = persist(nextDesigns, nextOrder)
    if (ok) {
      setSaveState('saved')
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1800)
      if (andSelect && isPicker) {
        onSelect(draftId)
      }
    } else {
      setSaveState('error')
    }
  }

  function updateDraft(path, value) {
    setDraft((prev) => {
      const next = _.cloneDeep(prev)
      _.set(next, path, value)
      return next
    })
  }

  const onDragMove = useCallback((e) => {
    const d = dragRef.current
    if (!d || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const { w: viewW, h: viewH } = viewDimsRef.current
    const scaleX = viewW / rect.width
    const scaleY = viewH / rect.height
    const dx = (e.clientX - d.clientX) * scaleX
    const dy = (e.clientY - d.clientY) * scaleY
    d.clientX = e.clientX
    d.clientY = e.clientY
    const [px, py] = ELEMENT_POS_KEYS[d.key] || ['x', 'y']
    setDraft((prev) => {
      if (!prev) return prev
      const next = _.cloneDeep(prev)
      next[d.key][px] = round1(next[d.key][px] + dx)
      next[d.key][py] = round1(next[d.key][py] + dy)
      return next
    })
  }, [])

  const onDragEnd = useCallback(() => {
    dragRef.current = null
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
  }, [onDragMove])

  const onBeginDrag = useCallback((key, e) => {
    dragRef.current = { key, clientX: e.clientX, clientY: e.clientY }
    window.addEventListener('pointermove', onDragMove)
    window.addEventListener('pointerup', onDragEnd)
  }, [onDragMove, onDragEnd])

  useEffect(() => () => {
    window.removeEventListener('pointermove', onDragMove)
    window.removeEventListener('pointerup', onDragEnd)
  }, [onDragMove, onDragEnd])

  function copyId(id) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(id).catch(() => {})
    }
    setCopiedId(id)
    setTimeout(() => setCopiedId((cur) => (cur === id ? null : cur)), 1400)
  }

  const orderedDesigns = order.map((id) => designs[id]).filter(Boolean)

  // -----------------------------------------------------------------
  // GALLERY VIEW
  // -----------------------------------------------------------------
  if (view === 'gallery') {
    return (
      <div className="vs-wrap">
        <div className="vs-gallery-inner">
          <div className="vs-gallery-header">
            <div className="vs-gallery-header-left">
              {onBack && (
                <button type="button" onClick={onBack} className="vs-back vs-back--light" aria-label="Back">
                  <ArrowLeft size={18} strokeWidth={2.25} />
                </button>
              )}
              <div>
                <p className="vs-eyebrow vs-eyebrow--dark">{isPicker ? 'Choose a template' : 'Coupon design studio'}</p>
                <h2 className="vs-title">Your saved templates</h2>
              </div>
            </div>
            <button type="button" className="vs-btn vs-btn--primary" onClick={openNew}>
              <Plus size={16} strokeWidth={2.5} />
              Add template
            </button>
          </div>

          {!storageOk && (
            <p className="vs-storage-warning">Couldn't reach saved-template storage right now — new saves may not persist.</p>
          )}

          {orderedDesigns.length === 0 ? (
            <div className="vs-empty">
              <LayoutTemplate size={28} strokeWidth={1.75} />
              <p className="vs-empty-title">No templates yet</p>
              <p className="vs-empty-text">Start from the base voucher design and customize every color, font, position, and size — then save it with an ID you can fetch later.</p>
              <button type="button" className="vs-btn vs-btn--primary" onClick={openNew}>
                <Plus size={16} strokeWidth={2.5} />
                Add template
              </button>
            </div>
          ) : (
            <div className="vs-grid">
              {orderedDesigns.map((d) => {
                const isSelected = isPicker && d.id === selectedTemplate
                return (
                  <div key={d.id} className={`vs-card ${isSelected ? 'vs-card--selected' : ''}`}>
                    <div className="vs-card-preview" style={{ aspectRatio: `${d.widthMM} / ${d.heightMM}` }}>
                      <VoucherCanvas design={d} />
                    </div>
                    <div className="vs-card-body">
                      <div className="vs-card-heading">
                        <span className="vs-card-name">
                          {isSelected && <Check size={13} strokeWidth={3} className="vs-card-check" />}
                          {d.name || 'Untitled voucher'}
                        </span>
                        <span className="vs-card-dim">{d.widthMM}×{d.heightMM}mm</span>
                      </div>
                      <button type="button" className="vs-card-id" onClick={() => copyId(d.id)} title="Copy ID to fetch this design from your backend">
                        {copiedId === d.id ? <Check size={11} strokeWidth={2.5} /> : <Copy size={11} strokeWidth={2.25} />}
                        <span>{d.id}</span>
                      </button>
                      {isPicker && (
                        <button type="button" className="vs-btn vs-btn--primary vs-btn--small" onClick={() => onSelect(d.id)}>
                          {isSelected ? 'Selected' : 'Use this template'}
                        </button>
                      )}
                      <div className="vs-card-actions">
                        <button type="button" className="vs-btn vs-btn--ghost vs-btn--small" onClick={() => openEdit(d.id)}>Edit</button>
                        <button type="button" className="vs-btn vs-btn--ghost vs-btn--small" onClick={() => duplicate(d.id)}>Duplicate</button>
                        <button type="button" className="vs-btn vs-btn--danger vs-btn--small" onClick={() => setPendingDeleteId(d.id)} aria-label={`Delete ${d.name}`}>
                          <Trash2 size={13} strokeWidth={2.25} />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {pendingDeleteId && (
          <div className="vs-preview-overlay" role="dialog" aria-modal="true">
            <div className="vs-preview-scrim" onClick={() => setPendingDeleteId(null)} />
            <div className="vs-confirm-panel">
              <h3 className="vs-confirm-title">Delete this template?</h3>
              <p className="vs-confirm-text">This removes “{designs[pendingDeleteId]?.name}” and its ID permanently. You can't undo this.</p>
              <div className="vs-confirm-actions">
                <button type="button" className="vs-btn vs-btn--ghost" onClick={() => setPendingDeleteId(null)}>Cancel</button>
                <button type="button" className="vs-btn vs-btn--danger" onClick={() => confirmDelete(pendingDeleteId)}>Delete</button>
              </div>
            </div>
          </div>
        )}

        <GlobalStyles />
      </div>
    )
  }

  // -----------------------------------------------------------------
  // EDITOR VIEW — its own separate window/screen
  // -----------------------------------------------------------------
  return (
    <div className="vs-wrap vs-wrap--editor">
      <div className="vs-editor">
        <div className="vs-editor-header">
          <button type="button" onClick={() => setView('gallery')} className="vs-back" aria-label="Back to saved templates">
            <ArrowLeft size={18} strokeWidth={2.25} />
          </button>
          <div className="vs-editor-heading">
            <p className="vs-eyebrow">Editing template</p>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => updateDraft('name', e.target.value)}
              className="vs-name-input"
              aria-label="Template name"
            />
          </div>
          {isPicker ? (
            <button type="button" className="vs-btn vs-btn--primary" onClick={() => saveDraft(true)} disabled={saveState === 'saving'}>
              {saveState === 'saved' ? <Check size={16} strokeWidth={2.5} /> : <Save size={16} strokeWidth={2.25} />}
              {saveState === 'saving' ? 'Saving…' : saveState === 'error' ? 'Retry' : 'Save & use'}
            </button>
          ) : (
            <button type="button" className="vs-btn vs-btn--primary" onClick={() => saveDraft(false)} disabled={saveState === 'saving'}>
              {saveState === 'saved' ? <Check size={16} strokeWidth={2.5} /> : <Save size={16} strokeWidth={2.25} />}
              {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'error' ? 'Retry save' : 'Save template'}
            </button>
          )}
        </div>

        <div className="vs-editor-body">
          <div className="vs-canvas-pane">
            <div
              className="vs-canvas-frame"
              style={{ aspectRatio: `${draft.widthMM} / ${draft.heightMM}` }}
            >
              <VoucherCanvas
                ref={svgRef}
                design={draft}
                interactive
                selectedKey={selected}
                onSelect={setSelected}
                onBeginDrag={onBeginDrag}
              />
            </div>
            <p className="vs-canvas-hint">
              <Move size={13} strokeWidth={2.25} />
              Click any element to select it, or drag it to reposition. {draft.widthMM}mm × {draft.heightMM}mm — {(draft.widthMM / 25.4).toFixed(2)}in × {(draft.heightMM / 25.4).toFixed(2)}in
            </p>
          </div>

          <div className="vs-panel">
            <div className="vs-panel-tabs">
              <button type="button" className={`vs-tab ${panelTab === 'canvas' ? 'vs-tab--active' : ''}`} onClick={() => setPanelTab('canvas')}>
                <Palette size={14} strokeWidth={2.25} /> Canvas
              </button>
              <button type="button" className={`vs-tab ${panelTab === 'elements' ? 'vs-tab--active' : ''}`} onClick={() => setPanelTab('elements')}>
                <Type size={14} strokeWidth={2.25} /> Elements
              </button>
            </div>

            <div className="vs-panel-body">
              {panelTab === 'canvas' ? (
                <CanvasPanel draft={draft} updateDraft={updateDraft} />
              ) : (
                <ElementsPanel draft={draft} updateDraft={updateDraft} selected={selected} setSelected={setSelected} />
              )}
            </div>
          </div>
        </div>
      </div>

      <GlobalStyles />
    </div>
  )
}

function CanvasPanel({ draft, updateDraft }) {
  return (
    <div className="vs-section-stack">
      <section className="vs-section">
        <h4 className="vs-section-title">Print size</h4>
        <div className="vs-preset-row">
          {SIZE_PRESETS.map((p) => (
            <button
              type="button"
              key={p.label}
              className={`vs-chip ${draft.widthMM === p.widthMM && draft.heightMM === p.heightMM ? 'vs-chip--active' : ''}`}
              onClick={() => {
                updateDraft('widthMM', p.widthMM)
                updateDraft('heightMM', p.heightMM)
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="vs-field-row">
          <NumberField label="Width (mm)" value={draft.widthMM} step={0.1} min={20} onChange={(v) => updateDraft('widthMM', v)} suffix="mm" />
          <NumberField label="Height (mm)" value={draft.heightMM} step={0.1} min={20} onChange={(v) => updateDraft('heightMM', v)} suffix="mm" />
        </div>
      </section>

      <section className="vs-section">
        <h4 className="vs-section-title">Colors</h4>
        <ColorField label="Accent" value={draft.colors.accent} fallback="#B9762E" onChange={(v) => updateDraft('colors.accent', v)} onClear={() => updateDraft('colors.accent', '#B9762E')} />
        <ColorField label="Accent (dark)" value={draft.colors.accentDark} fallback="#8F5720" onChange={(v) => updateDraft('colors.accentDark', v)} onClear={() => updateDraft('colors.accentDark', '#8F5720')} />
        <ColorField label="Background tint" value={draft.colors.tint} fallback="#FBF3E8" onChange={(v) => updateDraft('colors.tint', v)} onClear={() => updateDraft('colors.tint', '#FBF3E8')} />
        <ColorField label="Text on dark panel" value={draft.colors.onDark} fallback="#FFFFFF" onChange={(v) => updateDraft('colors.onDark', v)} onClear={() => updateDraft('colors.onDark', '#FFFFFF')} />
      </section>

      <section className="vs-section">
        <h4 className="vs-section-title">Fonts</h4>
        <Field label="Display font (headline, medallion value)">
          <select className="vs-input" value={draft.fontDisplay} onChange={(e) => updateDraft('fontDisplay', e.target.value)}>
            {DISPLAY_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
        <Field label="Body font (labels, fine print)">
          <select className="vs-input" value={draft.fontBody} onChange={(e) => updateDraft('fontBody', e.target.value)}>
            {BODY_FONTS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
          </select>
        </Field>
      </section>

      <section className="vs-section">
        <h4 className="vs-section-title">Illustration layers</h4>
        {[
          ['texture', 'Polygon texture'],
          ['sidePanel', 'Side panel'],
          ['dots', 'Dot pattern on panel'],
          ['ribbon', 'Diagonal ribbon'],
          ['frame', 'Outer frame border'],
        ].map(([key, label]) => (
          <label key={key} className="vs-toggle-row">
            <input type="checkbox" checked={draft.layers[key]} onChange={(e) => updateDraft(`layers.${key}`, e.target.checked)} />
            <span>{label}</span>
          </label>
        ))}
      </section>
    </div>
  )
}

function ElementsPanel({ draft, updateDraft, selected, setSelected }) {
  const keys = Object.keys(ELEMENT_LABELS).concat(['medallion']).filter((v, i, a) => a.indexOf(v) === i)

  return (
    <div className="vs-section-stack">
      <section className="vs-section">
        <h4 className="vs-section-title">Select an element</h4>
        <div className="vs-element-list">
          {keys.map((key) => (
            <button
              type="button"
              key={key}
              className={`vs-element-item ${selected === key ? 'vs-element-item--active' : ''}`}
              onClick={() => setSelected(key)}
            >
              <span>{ELEMENT_LABELS[key]}</span>
              <input
                type="checkbox"
                checked={draft[key].visible}
                onClick={(e) => e.stopPropagation()}
                onChange={(e) => updateDraft(`${key}.visible`, e.target.checked)}
                aria-label={`Toggle ${ELEMENT_LABELS[key]} visibility`}
              />
            </button>
          ))}
        </div>
      </section>

      {selected && (
        <section className="vs-section">
          <h4 className="vs-section-title">{ELEMENT_LABELS[selected]}</h4>
          <ElementFields elKey={selected} draft={draft} updateDraft={updateDraft} />
        </section>
      )}
    </div>
  )
}

function ElementFields({ elKey, draft, updateDraft }) {
  const el = draft[elKey]
  const fallbackColor = draft.colors.accentDark

  if (elKey === 'qr') {
    return (
      <>
        <Field label="Redemption link / code">
          <input className="vs-input" type="text" value={el.value} onChange={(e) => updateDraft('qr.value', e.target.value)} />
        </Field>
        <div className="vs-field-row">
          <NumberField label="X" value={el.x} onChange={(v) => updateDraft('qr.x', v)} />
          <NumberField label="Y" value={el.y} onChange={(v) => updateDraft('qr.y', v)} />
        </div>
        <NumberField label="Size" value={el.size} min={6} onChange={(v) => updateDraft('qr.size', v)} />
        <ColorField label="Color" value={el.color} fallback={fallbackColor} onChange={(v) => updateDraft('qr.color', v)} onClear={() => updateDraft('qr.color', null)} />
      </>
    )
  }

  if (elKey === 'medallion') {
    return (
      <>
        <div className="vs-field-row">
          <NumberField label="Center X" value={el.cx} onChange={(v) => updateDraft('medallion.cx', v)} />
          <NumberField label="Center Y" value={el.cy} onChange={(v) => updateDraft('medallion.cy', v)} />
        </div>
        <NumberField label="Radius" value={el.r} min={5} onChange={(v) => updateDraft('medallion.r', v)} />
        <Field label="Value text">
          <input className="vs-input" type="text" value={el.value} onChange={(e) => updateDraft('medallion.value', e.target.value)} />
        </Field>
        <NumberField label="Value font size" value={el.valueFontSize} min={2} onChange={(v) => updateDraft('medallion.valueFontSize', v)} />
        <Field label="Label text">
          <input className="vs-input" type="text" value={el.label} onChange={(e) => updateDraft('medallion.label', e.target.value)} />
        </Field>
        <NumberField label="Label font size" value={el.labelFontSize} min={2} onChange={(v) => updateDraft('medallion.labelFontSize', v)} />
        <ColorField label="Fill" value={el.fill} fallback={draft.colors.tint} onChange={(v) => updateDraft('medallion.fill', v)} onClear={() => updateDraft('medallion.fill', null)} />
        <ColorField label="Stroke / text" value={el.stroke} fallback={fallbackColor} onChange={(v) => updateDraft('medallion.stroke', v)} onClear={() => updateDraft('medallion.stroke', null)} />
      </>
    )
  }

  if (elKey === 'cornerFlag') {
    return (
      <>
        <Field label="Text">
          <input className="vs-input" type="text" value={el.text} onChange={(e) => updateDraft('cornerFlag.text', e.target.value)} />
        </Field>
        <div className="vs-field-row">
          <NumberField label="X" value={el.x} onChange={(v) => updateDraft('cornerFlag.x', v)} />
          <NumberField label="Y" value={el.y} onChange={(v) => updateDraft('cornerFlag.y', v)} />
        </div>
        <NumberField label="Flag width" value={el.width} min={20} onChange={(v) => updateDraft('cornerFlag.width', v)} />
        <ColorField label="Text color" value={el.color} fallback={draft.colors.onDark} onChange={(v) => updateDraft('cornerFlag.color', v)} onClear={() => updateDraft('cornerFlag.color', null)} />
      </>
    )
  }

  if (elKey === 'qrLabel') {
    return (
      <>
        <Field label="Line 1">
          <input className="vs-input" type="text" value={el.line1} onChange={(e) => updateDraft('qrLabel.line1', e.target.value)} />
        </Field>
        <Field label="Line 2">
          <input className="vs-input" type="text" value={el.line2} onChange={(e) => updateDraft('qrLabel.line2', e.target.value)} />
        </Field>
        <div className="vs-field-row">
          <NumberField label="X" value={el.x} onChange={(v) => updateDraft('qrLabel.x', v)} />
          <NumberField label="Y" value={el.y} onChange={(v) => updateDraft('qrLabel.y', v)} />
        </div>
        <NumberField label="Font size" value={el.fontSize} min={2} onChange={(v) => updateDraft('qrLabel.fontSize', v)} />
        <ColorField label="Color" value={el.color} fallback={fallbackColor} onChange={(v) => updateDraft('qrLabel.color', v)} onClear={() => updateDraft('qrLabel.color', null)} />
      </>
    )
  }

  // headline, subtitle, expiry, terms share the same shape
  return (
    <>
      <Field label="Text">
        <input className="vs-input" type="text" value={el.text} onChange={(e) => updateDraft(`${elKey}.text`, e.target.value)} />
      </Field>
      <div className="vs-field-row">
        <NumberField label="X" value={el.x} onChange={(v) => updateDraft(`${elKey}.x`, v)} />
        <NumberField label="Y" value={el.y} onChange={(v) => updateDraft(`${elKey}.y`, v)} />
      </div>
      <NumberField label="Font size" value={el.fontSize} min={2} onChange={(v) => updateDraft(`${elKey}.fontSize`, v)} />
      <ColorField label="Color" value={el.color} fallback={fallbackColor} onChange={(v) => updateDraft(`${elKey}.color`, v)} onClear={() => updateDraft(`${elKey}.color`, null)} />
    </>
  )
}

function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700;800&family=Inter:wght@400;500;600;700&family=Fraunces:opsz,wght@9..144,600;9..144,800&family=Playfair+Display:wght@700;800&family=IBM+Plex+Mono:wght@600;700&family=Manrope:wght@500;700&family=IBM+Plex+Sans:wght@400;600;700&family=Source+Serif+4:wght@600;700&display=swap');

      .vs-wrap { background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 8px 20px -12px rgba(28,26,36,0.35); font-family: 'Inter', sans-serif; }

      @media (min-width: 900px) {
        .vs-wrap {
          position: fixed;
          inset: 0;
          z-index: 100;
          border-radius: 0;
          box-shadow: none;
          overflow-y: auto;
        }
        .vs-gallery-inner {
          width: 100%;
          max-width: 1040px;
          margin: 0 auto;
          padding: 32px;
        }
      }
      .vs-eyebrow { margin: 0 0 2px; font-size: 11.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: rgba(255,255,255,0.6); }
      .vs-title { margin: 0; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 20px; color: #1C1A24; }

      .vs-gallery-inner { padding: 22px; }
      .vs-gallery-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 20px; }
      .vs-gallery-header-left { display: flex; align-items: flex-start; gap: 12px; }
      .vs-gallery-header .vs-eyebrow { color: #9C98AC; }
      .vs-eyebrow--dark { color: #B9762E; }
      .vs-back--light { background: #F7F6FA; color: #1C1A24; margin-top: 2px; }
      .vs-back--light:hover { background: #EDEBF2; }

      .vs-storage-warning { margin: 0 0 16px; padding: 10px 12px; border-radius: 8px; background: #FDEEEE; color: #8E2E2E; font-size: 12.5px; font-weight: 600; }

      .vs-empty { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 10px; padding: 48px 24px; border: 1.5px dashed #E3E1EA; border-radius: 14px; color: #6B6680; }
      .vs-empty svg { color: #B9762E; }
      .vs-empty-title { margin: 0; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 16px; color: #1C1A24; }
      .vs-empty-text { margin: 0 0 6px; font-size: 13.5px; max-width: 380px; line-height: 1.5; }

      .vs-grid { display: grid; grid-template-columns: 1fr; gap: 14px; }
      @media (min-width: 480px) { .vs-grid { grid-template-columns: 1fr 1fr; } }
      @media (min-width: 900px) { .vs-grid { grid-template-columns: repeat(3, 1fr); } }

      .vs-card { border: 1.5px solid #E3E1EA; border-radius: 12px; overflow: hidden; background: #FFFFFF; display: flex; flex-direction: column; }
      .vs-card--selected { border-color: #B9762E; background: #FBF3E8; }
      .vs-card-preview { width: 100%; overflow: hidden; }
      .vs-card-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 6px; }
      .vs-card-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
      .vs-card-name { display: flex; align-items: center; gap: 5px; font-weight: 700; font-size: 13.5px; color: #1C1A24; }
      .vs-card-check { flex-shrink: 0; color: #B9762E; }
      .vs-card-dim { font-size: 10.5px; color: #9C98AC; white-space: nowrap; }
      .vs-card-id { display: flex; align-items: center; gap: 5px; border: none; background: #F7F6FA; border-radius: 6px; padding: 4px 7px; font-size: 10.5px; color: #6B6680; cursor: pointer; width: fit-content; max-width: 100%; }
      .vs-card-id span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: 'IBM Plex Mono', monospace; }
      .vs-card-id:hover { background: #EDEBF2; }
      .vs-card-actions { display: flex; gap: 6px; margin-top: 2px; }

      .vs-btn { display: flex; align-items: center; justify-content: center; gap: 6px; border-radius: 10px; padding: 10px 14px; font-weight: 700; font-size: 13.5px; cursor: pointer; border: 1.5px solid transparent; transition: opacity 0.15s ease, background 0.15s ease; -webkit-tap-highlight-color: transparent; white-space: nowrap; }
      .vs-btn--primary { background: #1C1A24; color: #FFFFFF; }
      .vs-btn--primary:hover { opacity: 0.9; }
      .vs-btn--primary:disabled { opacity: 0.6; cursor: default; }
      .vs-btn--ghost { background: #F7F6FA; border-color: #E3E1EA; color: #1C1A24; }
      .vs-btn--ghost:hover { background: #EDEBF2; }
      .vs-btn--danger { background: #FDEEEE; border-color: #F6D8D8; color: #8E2E2E; }
      .vs-btn--danger:hover { background: #FADCDC; }
      .vs-btn--small { padding: 7px 10px; font-size: 12px; flex: 1; }
      .vs-btn:focus-visible { outline: 3px solid #1C1A24; outline-offset: 2px; }

      .vs-preview-overlay { position: fixed; inset: 0; z-index: 300; display: flex; align-items: center; justify-content: center; padding: 20px; }
      .vs-preview-scrim { position: absolute; inset: 0; background: rgba(28,26,36,0.55); }
      .vs-confirm-panel { position: relative; background: #FFFFFF; border-radius: 14px; padding: 20px; max-width: 340px; width: 100%; box-shadow: 0 20px 40px -20px rgba(28,26,36,0.5); }
      .vs-confirm-title { margin: 0 0 6px; font-family: 'Space Grotesk', sans-serif; font-size: 16px; color: #1C1A24; }
      .vs-confirm-text { margin: 0 0 16px; font-size: 13px; color: #6B6680; line-height: 1.5; }
      .vs-confirm-actions { display: flex; gap: 8px; }
      .vs-confirm-actions .vs-btn { flex: 1; }

      .vs-wrap--editor { border-radius: 0; }
      .vs-editor { display: flex; flex-direction: column; min-height: 560px; }
      .vs-editor-header { display: flex; align-items: center; gap: 12px; padding: 16px 18px; background: #1C1A24; }
      .vs-editor-heading { flex: 1; min-width: 0; }
      .vs-name-input { border: none; background: transparent; outline: none; font-family: 'Space Grotesk', sans-serif; font-weight: 700; font-size: 18px; color: #FFFFFF; width: 100%; padding: 2px 0; border-bottom: 1.5px solid transparent; }
      .vs-name-input:focus { border-bottom-color: rgba(255,255,255,0.4); }
      .vs-back { width: 34px; height: 34px; flex-shrink: 0; border-radius: 9px; border: none; background: rgba(255,255,255,0.12); color: #FFFFFF; display: flex; align-items: center; justify-content: center; cursor: pointer; -webkit-tap-highlight-color: transparent; }
      .vs-back:hover { background: rgba(255,255,255,0.2); }
      .vs-back:focus-visible { outline: 3px solid #FFFFFF; outline-offset: 2px; }

      .vs-editor-body { display: flex; flex-direction: column; flex: 1; }
      @media (min-width: 900px) { .vs-editor-body { flex-direction: row; } }

      .vs-canvas-pane { padding: 20px 18px; display: flex; flex-direction: column; gap: 10px; align-items: center; background: #FAF9FB; }
      @media (min-width: 900px) { .vs-canvas-pane { flex: 1.4; justify-content: center; } }
      .vs-canvas-frame { width: 100%; max-width: 560px; border-radius: 10px; overflow: hidden; box-shadow: 0 12px 28px -16px rgba(28,26,36,0.4); background: #fff; }
      .vs-canvas-hint { display: flex; align-items: center; gap: 6px; margin: 0; font-size: 12px; color: #9C98AC; text-align: center; }

      .vs-panel { border-top: 1.5px solid #E3E1EA; background: #FFFFFF; }
      @media (min-width: 900px) { .vs-panel { flex: 1; border-top: none; border-left: 1.5px solid #E3E1EA; max-width: 340px; overflow-y: auto; } }

      .vs-panel-tabs { display: flex; border-bottom: 1.5px solid #E3E1EA; }
      .vs-tab { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; padding: 12px; border: none; background: transparent; font-weight: 700; font-size: 12.5px; color: #9C98AC; cursor: pointer; border-bottom: 2px solid transparent; }
      .vs-tab--active { color: #1C1A24; border-bottom-color: #1C1A24; }
      .vs-tab:focus-visible { outline: 3px solid #1C1A24; outline-offset: -3px; }

      .vs-panel-body { padding: 16px; }
      .vs-section-stack { display: flex; flex-direction: column; gap: 20px; }
      .vs-section-title { margin: 0 0 10px; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; color: #9C98AC; }

      .vs-preset-row { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 10px; }
      .vs-chip { border: 1.5px solid #E3E1EA; background: #FFFFFF; border-radius: 999px; padding: 6px 11px; font-weight: 600; font-size: 12px; color: #6B6680; cursor: pointer; }
      .vs-chip:hover { background: #F7F6FA; }
      .vs-chip--active { background: #1C1A24; border-color: #1C1A24; color: #FFFFFF; }

      .vs-field-row { display: flex; gap: 10px; }
      .vs-field-row .vs-field { flex: 1; }
      .vs-field { display: flex; flex-direction: column; gap: 5px; margin-bottom: 10px; }
      .vs-field-label { font-size: 11.5px; font-weight: 600; color: #6B6680; }
      .vs-input { border: 1.5px solid #E3E1EA; border-radius: 8px; padding: 8px 10px; font-size: 13px; color: #1C1A24; background: #FFFFFF; outline: none; font-family: 'Inter', sans-serif; }
      .vs-input:focus { border-color: #1C1A24; }
      .vs-input--number { width: 100%; }
      .vs-number-wrap { position: relative; display: flex; align-items: center; }
      .vs-suffix { position: absolute; right: 10px; font-size: 11px; color: #9C98AC; pointer-events: none; }

      .vs-color-wrap { display: flex; align-items: center; gap: 8px; }
      .vs-color-input { width: 30px; height: 30px; border-radius: 7px; border: 1.5px solid #E3E1EA; padding: 0; cursor: pointer; background: none; }
      .vs-color-hex { font-family: 'IBM Plex Mono', monospace; font-size: 11.5px; color: #6B6680; flex: 1; }
      .vs-color-clear { border: none; background: #F7F6FA; border-radius: 6px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; color: #6B6680; cursor: pointer; }
      .vs-color-clear:hover { background: #EDEBF2; }

      .vs-toggle-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; font-size: 13px; color: #1C1A24; cursor: pointer; }
      .vs-toggle-row input { width: 16px; height: 16px; accent-color: #1C1A24; }

      .vs-element-list { display: flex; flex-direction: column; gap: 6px; }
      .vs-element-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; border: 1.5px solid #E3E1EA; background: #FFFFFF; border-radius: 9px; padding: 9px 10px; font-size: 13px; font-weight: 600; color: #1C1A24; cursor: pointer; text-align: left; }
      .vs-element-item:hover { background: #F7F6FA; }
      .vs-element-item--active { border-color: #1C1A24; background: #F7F6FA; }
      .vs-element-item input { width: 15px; height: 15px; accent-color: #1C1A24; }

      @media (prefers-reduced-motion: reduce) {
        .vs-btn, .vs-chip, .vs-card-id { transition: none; }
      }
    `}</style>
  )
}