import React from 'react'
import { ELEMENT_LABELS } from '../lib/design'
import { ElementFields } from './ElementFields'

export function ElementsPanel({ draft, updateDraft, selected, setSelected }) {
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

export default ElementsPanel
