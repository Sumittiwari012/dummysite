import React, { useState } from 'react'
import { SIZE_PRESETS } from '../lib/design'
import { ShapesPanel } from './ShapesPanel'
import { TextPanel } from './TextPanel'
import { ImagePanel } from './ImagePanel'
import { DependenciesPanel } from './DependencyPanel'

const SECTIONS = [
  { key: 'size', label: 'Size' },
  { key: 'shapes', label: 'Shapes' },
  { key: 'text', label: 'Text' },
  { key: 'image', label: 'Image' },
  { key: 'dependencies', label: 'Dependencies' },
]

export function CanvasPanel({ draft, updateDraft, onAddElement, selected }) {
  const [activeSection, setActiveSection] = useState('size')

  const activePreset = SIZE_PRESETS.find(
    (p) => p.widthMM === draft.widthMM && p.heightMM === draft.heightMM
  )

  const applyPreset = (preset) => {
    updateDraft('widthMM', preset.widthMM)
    updateDraft('heightMM', preset.heightMM)
  }

  return (
    <div className="vs-section-stack">
      <div className="vs-preset-row">
        {SECTIONS.map((s) => (
          <button
            type="button"
            key={s.key}
            className={`vs-chip ${activeSection === s.key ? 'vs-chip--active' : ''}`}
            onClick={() => setActiveSection(s.key)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {activeSection === 'size' && (
        <section className="vs-section">
          <h4 className="vs-section-title">Size</h4>
          <div className="vs-preset-row">
            {SIZE_PRESETS.map((p) => (
              <button
                type="button"
                key={p.label}
                className={`vs-chip ${activePreset?.label === p.label ? 'vs-chip--active' : ''}`}
                onClick={() => applyPreset(p)}
              >
                {p.label}
              </button>
            ))}
          </div>

          <div className="vs-field-row">
            <label className="vs-field">
              <span className="vs-field-label">Width (mm)</span>
              <input
                type="number"
                className="vs-input vs-input--number"
                value={draft.widthMM}
                step={0.1}
                min={1}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  updateDraft('widthMM', Number.isFinite(v) ? v : draft.widthMM)
                }}
              />
            </label>
            <label className="vs-field">
              <span className="vs-field-label">Height (mm)</span>
              <input
                type="number"
                className="vs-input vs-input--number"
                value={draft.heightMM}
                step={0.1}
                min={1}
                onChange={(e) => {
                  const v = parseFloat(e.target.value)
                  updateDraft('heightMM', Number.isFinite(v) ? v : draft.heightMM)
                }}
              />
            </label>
          </div>

          <p className="vs-section-hint">
            {draft.widthMM}mm × {draft.heightMM}mm — {(draft.widthMM / 25.4).toFixed(2)}in × {(draft.heightMM / 25.4).toFixed(2)}in
          </p>
        </section>
      )}

      {activeSection === 'shapes' && (
        <ShapesPanel draft={draft} updateDraft={updateDraft} onAdd={onAddElement} />
      )}

      {activeSection === 'text' && (
        <TextPanel draft={draft} updateDraft={updateDraft} onAdd={onAddElement} />
      )}

      {activeSection === 'image' && (
        <ImagePanel draft={draft} updateDraft={updateDraft} onAdd={onAddElement} />
      )}

      {activeSection === 'dependencies' && (
        <DependenciesPanel draft={draft} updateDraft={updateDraft} selected={selected} />
      )}
    </div>
  )
}

export default CanvasPanel