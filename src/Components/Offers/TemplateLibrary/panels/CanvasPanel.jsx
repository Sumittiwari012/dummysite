import React, { useState } from 'react'
import { SIZE_PRESETS, DISPLAY_FONTS, BODY_FONTS } from '../lib/design'
import { Field, NumberField, ColorField } from './FormFields'
import { PatternPickerField } from './PatternPickerField'
import { RibbonPickerField } from './RibbonPickerField'

const SECTIONS = [
  { key: 'size', label: 'Print size' },
  { key: 'colors', label: 'Colors' },
  { key: 'fonts', label: 'Fonts' },
  { key: 'background', label: 'Background' },
  { key: 'sidePanel', label: 'Side panel' },
  { key: 'ribbon', label: 'Ribbon' },
  { key: 'frame', label: 'Frame' },
]

export function CanvasPanel({ draft, updateDraft }) {
  const [activeSection, setActiveSection] = useState('size')

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
      )}

      {activeSection === 'colors' && (
        <section className="vs-section">
          <h4 className="vs-section-title">Colors</h4>
          <ColorField label="Accent" value={draft.colors.accent} fallback="#B9762E" onChange={(v) => updateDraft('colors.accent', v)} onClear={() => updateDraft('colors.accent', '#B9762E')} />
          <ColorField label="Accent (dark)" value={draft.colors.accentDark} fallback="#8F5720" onChange={(v) => updateDraft('colors.accentDark', v)} onClear={() => updateDraft('colors.accentDark', '#8F5720')} />
          <ColorField label="Background tint" value={draft.colors.tint} fallback="#FBF3E8" onChange={(v) => updateDraft('colors.tint', v)} onClear={() => updateDraft('colors.tint', '#FBF3E8')} />
          <ColorField label="Text on dark panel" value={draft.colors.onDark} fallback="#FFFFFF" onChange={(v) => updateDraft('colors.onDark', v)} onClear={() => updateDraft('colors.onDark', '#FFFFFF')} />
        </section>
      )}

      {activeSection === 'fonts' && (
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
      )}

      {activeSection === 'background' && (
        <>
          <section className="vs-section">
            <h4 className="vs-section-title">Background image</h4>
            <Field label="Image URL">
              <input
                className="vs-input"
                type="url"
                placeholder="https://example.com/image.jpg"
                value={draft.layers.backgroundImage || ''}
                onChange={(e) => updateDraft('layers.backgroundImage', e.target.value || null)}
              />
            </Field>

            {draft.layers.backgroundImage && (
              <>
                <Field label="Image opacity">
                  <div className="vs-intensity-row">
                    <input
                      type="range"
                      min={0.05}
                      max={1}
                      step={0.05}
                      value={draft.layers.backgroundImageOpacity ?? 1}
                      onChange={(e) => updateDraft('layers.backgroundImageOpacity', parseFloat(e.target.value))}
                      className="vs-intensity-slider"
                    />
                    <span className="vs-intensity-value">
                      {Math.round((draft.layers.backgroundImageOpacity ?? 1) * 100)}%
                    </span>
                  </div>
                </Field>
                <button
                  type="button"
                  className="vs-btn vs-btn--ghost vs-btn--small"
                  onClick={() => {
                    updateDraft('layers.backgroundImage', null)
                    updateDraft('layers.backgroundImageOpacity', null)
                  }}
                >
                  Remove image
                </button>
              </>
            )}
          </section>

          <PatternPickerField
            title="Background pattern"
            styleValue={draft.layers.backgroundPattern}
            colorValue={draft.layers.backgroundPatternColor}
            opacityValue={draft.layers.backgroundPatternOpacity}
            accentFallback={draft.colors.accent}
            onChangeStyle={(v) => updateDraft('layers.backgroundPattern', v)}
            onChangeColor={(v) => updateDraft('layers.backgroundPatternColor', v)}
            onChangeOpacity={(v) => updateDraft('layers.backgroundPatternOpacity', v)}
          />
        </>
      )}

      {activeSection === 'sidePanel' && (
        <section className="vs-section">
          <h4 className="vs-section-title">Side panel</h4>
          <label className="vs-toggle-row">
            <input
              type="checkbox"
              checked={draft.layers.sidePanel}
              onChange={(e) => updateDraft('layers.sidePanel', e.target.checked)}
            />
            <span>Show side panel</span>
          </label>

          {draft.layers.sidePanel && (
            <>
              <PatternPickerField
                title="Side panel pattern"
                styleValue={draft.layers.sidePanelPattern}
                colorValue={draft.layers.sidePanelPatternColor}
                opacityValue={draft.layers.sidePanelPatternOpacity}
                accentFallback={draft.colors.onDark}
                onChangeStyle={(v) => updateDraft('layers.sidePanelPattern', v)}
                onChangeColor={(v) => updateDraft('layers.sidePanelPatternColor', v)}
                onChangeOpacity={(v) => updateDraft('layers.sidePanelPatternOpacity', v)}
              />
              <label className="vs-toggle-row">
                <input
                  type="checkbox"
                  checked={draft.layers.dots}
                  onChange={(e) => updateDraft('layers.dots', e.target.checked)}
                />
                <span>Dot pattern on panel</span>
              </label>
            </>
          )}
        </section>
      )}

      {activeSection === 'ribbon' && (
        <RibbonPickerField
          styleValue={draft.layers.ribbonStyle}
          colorValue={draft.layers.ribbonColor}
          accentFallback={draft.colors.accent}
          onChangeStyle={(v) => updateDraft('layers.ribbonStyle', v)}
          onChangeColor={(v) => updateDraft('layers.ribbonColor', v)}
        />
      )}

      {activeSection === 'frame' && (
        <section className="vs-section">
          <h4 className="vs-section-title">Frame</h4>
          <label className="vs-toggle-row">
            <input
              type="checkbox"
              checked={draft.layers.frame}
              onChange={(e) => updateDraft('layers.frame', e.target.checked)}
            />
            <span>Outer frame border</span>
          </label>
        </section>
      )}
    </div>
  )
}

export default CanvasPanel