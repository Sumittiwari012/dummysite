import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import _ from 'lodash'
import {
  ArrowLeft, Plus, Trash2, Copy, Check, Save, Palette,
  Type, LayoutTemplate, Move, AlertTriangle, X, Eye
} from 'lucide-react'

import { baseDesign, ELEMENT_POS_KEYS, round1 } from './lib/design'
import {
  apiGetAllTemplates, apiCreateTemplate, apiUpdateTemplate, apiDeleteTemplate,
} from './lib/api'
import { VoucherCanvas } from './components/VoucherCanvas'
import { GlobalStyles } from './components/GlobalStyles'
import { CanvasPanel } from './panels/CanvasPanel'
import { ElementsPanel } from './panels/ElementsPanel'

// -----------------------------------------------------------------------
// Main studio: gallery of saved designs (Add button only, no presets) +
// full editor for the one configurable base design. Templates now live
// in the GripStyleBackend database via the Template API — this
// component fetches, creates, updates, and deletes through that API
// instead of localStorage.
// -----------------------------------------------------------------------
// `selectedTemplate`, `onBack`, and `onSelect` are all optional. Pass
// them when embedding this as a picker (e.g. from AddCoupon's "Select
// from library" button) — `onSelect(id)` fires once the person picks or
// saves a template, and `onBack()` wires up a back arrow to leave the
// picker without choosing anything (from the gallery, and also directly
// from the editor) — that arrow always returns to the Add Coupon
// section. Omit all three to use this as a standalone template-
// management screen instead.
export default function TemplateLibrary({ selectedTemplate = null, onBack = null, onSelect = null }) {
  const isPicker = typeof onSelect === 'function'
  const navigate = useNavigate()
  // Whoever mounts this may or may not wire up `onBack` (e.g. a route
  // like /offers/coupon rendering this directly, with no picker plumbing).
  // Either way there should always be a way back, so fall back to plain
  // browser history when no explicit onBack was given.
  const goBack = onBack || (() => navigate(-1))
  const [view, setView] = useState('gallery')

  // templates: id -> design (design.id is always a string). order: ids
  // in display order, as returned by GetAllTemplates (newest first).
  const [templates, setTemplates] = useState({})
  const [order, setOrder] = useState([])
  const [loadState, setLoadState] = useState('loading') // loading | ready | error
  const [loadError, setLoadError] = useState(null)
  const [deleteError, setDeleteError] = useState(null)

  const [draft, setDraft] = useState(null)
  const [draftId, setDraftId] = useState(null) // null until the draft has been saved to the backend
  const [selected, setSelected] = useState(null)
  const [panelTab, setPanelTab] = useState('canvas')
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error
  const [saveError, setSaveError] = useState(null)
  const [pendingDeleteId, setPendingDeleteId] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const [previewId, setPreviewId] = useState(null) // gallery-card id currently shown full-size, or null

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

  const refreshAll = useCallback(async () => {
    setLoadState('loading')
    setLoadError(null)
    try {
      const list = await apiGetAllTemplates()
      const nextTemplates = {}
      const nextOrder = []
      list.forEach((d) => {
        nextTemplates[d.id] = d
        nextOrder.push(d.id)
      })
      setTemplates(nextTemplates)
      setOrder(nextOrder)
      setLoadState('ready')
    } catch (e) {
      setLoadState('error')
      setLoadError(e.message || 'Could not load templates.')
    }
  }, [])

  useEffect(() => {
    refreshAll()
  }, [refreshAll])

  function openNew() {
    setDraft(baseDesign())
    setDraftId(null)
    setSelected(null)
    setPanelTab('canvas')
    setSaveState('idle')
    setSaveError(null)
    setView('editor')
  }

  function openEdit(id) {
    const source = templates[id]
    if (!source) return
    setDraft(_.cloneDeep(source))
    setDraftId(id)
    setSelected(null)
    setPanelTab('canvas')
    setSaveState('idle')
    setSaveError(null)
    setView('editor')
  }

  // Duplicating starts a brand-new (unsaved) draft — Save creates a
  // fresh row in the backend rather than overwriting the original.
  function duplicate(id) {
    const source = templates[id]
    if (!source) return
    const { id: _sourceId, ...rest } = source
    setDraft({ ..._.cloneDeep(rest), name: `${source.name} copy` })
    setDraftId(null)
    setSelected(null)
    setPanelTab('canvas')
    setSaveState('idle')
    setSaveError(null)
    setView('editor')
  }

  async function confirmDelete(id) {
    setDeletingId(id)
    setDeleteError(null)
    try {
      await apiDeleteTemplate(id)
      setTemplates((prev) => {
        const next = { ...prev }
        delete next[id]
        return next
      })
      setOrder((prev) => prev.filter((existingId) => existingId !== id))
      setPendingDeleteId(null)
    } catch (e) {
      setDeleteError(e.message || 'Could not delete this template.')
    } finally {
      setDeletingId(null)
    }
  }

  // `andSelect`: when true (only possible in picker mode), saves and
  // immediately hands the new/updated id back to the parent via onSelect.
  async function saveDraft(andSelect = false) {
    if (!draft) return
    setSaveState('saving')
    setSaveError(null)
    try {
      const saved = draftId
        ? await apiUpdateTemplate(draftId, draft)
        : await apiCreateTemplate(draft)

      setTemplates((prev) => ({ ...prev, [saved.id]: saved }))
      setOrder((prev) => (prev.includes(saved.id) ? prev : [saved.id, ...prev]))
      setDraftId(saved.id)
      setDraft(saved)
      setSaveState('saved')
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'idle' : s)), 1800)

      if (andSelect && isPicker) {
        onSelect(saved.id)
      }
    } catch (e) {
      setSaveState('error')
      setSaveError(e.message || 'Could not save this template.')
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

  const orderedDesigns = order.map((id) => templates[id]).filter(Boolean)

  // -----------------------------------------------------------------
  // GALLERY VIEW
  // -----------------------------------------------------------------
  if (view === 'gallery') {
    return (
      <div className="vs-wrap">
        <div className="vs-gallery-inner">
          <div className="vs-gallery-header">
            <div className="vs-gallery-header-left">
              <button type="button" onClick={goBack} className="vs-back vs-back--light" aria-label="Back">
                <ArrowLeft size={18} strokeWidth={2.25} />
              </button>
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

          {loadState === 'error' && (
            <p className="vs-storage-warning">
              <AlertTriangle size={14} strokeWidth={2.25} />
              {loadError || "Couldn't reach the template server."}
              <button type="button" className="vs-inline-retry" onClick={refreshAll}>Retry</button>
            </p>
          )}
          {deleteError && (
            <p className="vs-storage-warning">
              <AlertTriangle size={14} strokeWidth={2.25} />
              {deleteError}
            </p>
          )}

          {loadState === 'loading' ? (
            <div className="vs-empty">
              <LayoutTemplate size={28} strokeWidth={1.75} />
              <p className="vs-empty-title">Loading templates…</p>
            </div>
          ) : orderedDesigns.length === 0 ? (
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
                const isDeleting = deletingId === d.id
                return (
                  <div key={d.id} className={`vs-card ${isSelected ? 'vs-card--selected' : ''}`}>
                    <button
                      type="button"
                      className="vs-card-preview"
                      style={{ aspectRatio: `${d.widthMM} / ${d.heightMM}` }}
                      onClick={() => setPreviewId(d.id)}
                      aria-label={`Preview ${d.name || 'Untitled voucher'}`}
                    >
                      <VoucherCanvas design={d} />
                      <span className="vs-card-preview-hint">
                        <Eye size={14} strokeWidth={2.25} />
                        Preview
                      </span>
                    </button>
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
                        <button
                          type="button"
                          className="vs-btn vs-btn--danger vs-btn--small"
                          onClick={() => setPendingDeleteId(d.id)}
                          aria-label={`Delete ${d.name}`}
                          disabled={isDeleting}
                        >
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
            <div className="vs-preview-scrim" onClick={() => (deletingId ? null : setPendingDeleteId(null))} />
            <div className="vs-confirm-panel">
              <h3 className="vs-confirm-title">Delete this template?</h3>
              <p className="vs-confirm-text">This removes “{templates[pendingDeleteId]?.name}” and its ID permanently. You can't undo this.</p>
              <div className="vs-confirm-actions">
                <button type="button" className="vs-btn vs-btn--ghost" onClick={() => setPendingDeleteId(null)} disabled={deletingId === pendingDeleteId}>Cancel</button>
                <button type="button" className="vs-btn vs-btn--danger" onClick={() => confirmDelete(pendingDeleteId)} disabled={deletingId === pendingDeleteId}>
                  {deletingId === pendingDeleteId ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {previewId && templates[previewId] && (
          <div className="vs-preview-overlay" role="dialog" aria-modal="true" aria-label={`Preview of ${templates[previewId].name || 'Untitled voucher'}`}>
            <div className="vs-preview-scrim" onClick={() => setPreviewId(null)} />
            <div className="vs-preview-panel">
              <div className="vs-preview-header">
                <button
                  type="button"
                  className="vs-btn vs-btn--ghost vs-preview-back"
                  onClick={() => {
                    setPreviewId(null)
                    goBack()
                  }}
                >
                  <ArrowLeft size={15} strokeWidth={2.5} />
                  {onBack ? 'Add Coupon' : 'Back'}
                </button>
                <button type="button" className="vs-preview-close" onClick={() => setPreviewId(null)} aria-label="Close preview">
                  <X size={18} strokeWidth={2.25} />
                </button>
              </div>

              <div
                className="vs-preview-canvas"
                style={{ aspectRatio: `${templates[previewId].widthMM} / ${templates[previewId].heightMM}` }}
              >
                <VoucherCanvas design={templates[previewId]} />
              </div>

              <div className="vs-preview-info">
                <h3 className="vs-preview-name">{templates[previewId].name || 'Untitled voucher'}</h3>
                <p className="vs-preview-dim">
                  {templates[previewId].widthMM}mm × {templates[previewId].heightMM}mm
                  {' · '}
                  {(templates[previewId].widthMM / 25.4).toFixed(2)}in × {(templates[previewId].heightMM / 25.4).toFixed(2)}in
                </p>
              </div>

              <div className="vs-preview-actions">
                {isPicker && (
                  <button
                    type="button"
                    className="vs-btn vs-btn--primary"
                    onClick={() => {
                      onSelect(previewId)
                      setPreviewId(null)
                    }}
                  >
                    {previewId === selectedTemplate ? 'Selected' : 'Use this template'}
                  </button>
                )}
                <button
                  type="button"
                  className="vs-btn vs-btn--ghost"
                  onClick={() => {
                    const id = previewId
                    setPreviewId(null)
                    openEdit(id)
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className="vs-btn vs-btn--ghost"
                  onClick={() => {
                    const id = previewId
                    setPreviewId(null)
                    duplicate(id)
                  }}
                >
                  Duplicate
                </button>
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
          <button type="button" className="vs-btn vs-btn--ghost vs-btn--onDark" onClick={goBack}>
            <ArrowLeft size={14} strokeWidth={2.25} />
            {onBack ? 'Add Coupon' : 'Back'}
          </button>
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

        {saveState === 'error' && saveError && (
          <p className="vs-storage-warning vs-storage-warning--editor">
            <AlertTriangle size={14} strokeWidth={2.25} />
            {saveError}
          </p>
        )}

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