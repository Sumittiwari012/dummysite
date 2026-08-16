import React from 'react'
import { ELEMENT_LABELS } from '../lib/design'
import { ElementFields } from './ElementFields'

// Mirrors CanvasPanel's layout: a row of chips picks which element is
// active, then a single section below shows that element's fields —
// same pattern as CanvasPanel's SECTIONS chips + active-section body.
export function ElementsPanel({ draft, updateDraft, selected, setSelected }) {
  const keys = Object.keys(ELEMENT_LABELS).concat(['medallion']).filter((v, i, a) => a.indexOf(v) === i)
  const activeKey = selected && keys.includes(selected) ? selected : keys[0]

  return (
    <div className="vs-section-stack">
      <div className="vs-preset-row">
        {keys.map((key) => (
          <button
            type="button"
            key={key}
            className={`vs-chip ${activeKey === key ? 'vs-chip--active' : ''}`}
            onClick={() => setSelected(key)}
          >
            {ELEMENT_LABELS[key]}
          </button>
        ))}
      </div>

      <section className="vs-section">
        <div className="vs-section-header-row">
          <h4 className="vs-section-title">{ELEMENT_LABELS[activeKey]}</h4>
          <label className="vs-toggle-row vs-toggle-row--inline">
            <input
              type="checkbox"
              checked={draft[activeKey].visible}
              onChange={(e) => updateDraft(`${activeKey}.visible`, e.target.checked)}
            />
            <span>Visible</span>
          </label>
        </div>
        <ElementFields elKey={activeKey} draft={draft} updateDraft={updateDraft} />
      </section>
    </div>
  )
}

export default ElementsPanel