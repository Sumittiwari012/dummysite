import React from 'react'
import { Link2, X } from 'lucide-react'
import { DEPENDENCY_FIELDS, makeId } from '../lib/design'

// Dependencies are no longer tied to whatever's selected on the canvas.
// Clicking a chip always drops a brand-new freeform text element
// containing the token (e.g. "{{Name}}") onto the canvas. From there
// it's just a normal text element — the person can drag it, restyle
// it, or delete it like anything else. The dependency is still marked
// "used" on draft.dependencies so it round-trips through save/load.
export function DependenciesPanel({ draft, updateDraft, onSelect }) {
  const dependencies = draft.dependencies || {}
  const elements = draft.elements || []

  function insertToken(key, template) {
    const newEl = {
      id: makeId('text'),
      type: 'text',
      text: template,
      x: 20,
      y: 20 + (elements.length % 8) * 6, // stagger repeated inserts so they don't stack exactly
      fontSize: 5,
      fontWeight: 600,
      color: null,
      bgColor: 'transparent',
      opacity: 1,
      font: "'Inter', sans-serif",
      visible: true,
    }
    updateDraft('elements', [...elements, newEl])
    updateDraft(`dependencies.${key}`, template)
    onSelect && onSelect(newEl.id) // select it immediately so it's easy to drag/style
  }

  function clearDependency(key) {
    updateDraft(`dependencies.${key}`, '')
  }

  return (
    <section className="vs-section">
      <h4 className="vs-section-title">Dependencies</h4>

      <p className="vs-section-hint">
        These map 1:1 to <code>MCoupon</code> fields. Click one to drop its token onto the
        canvas as a new text box — move it, restyle it, or delete it like any other element.
      </p>

      <div className="vs-preset-row">
        {DEPENDENCY_FIELDS.map((f) => {
          const used = !!dependencies[f.key]
          return (
            <button
              type="button"
              key={f.key}
              className={`vs-chip ${used ? 'vs-chip--active' : ''}`}
              onClick={() => insertToken(f.key, f.template)}
              title={`Insert ${f.template}`}
            >
              <Link2 size={12} strokeWidth={2.25} />
              {f.key}
              {used && (
                <span
                  role="button"
                  tabIndex={0}
                  className="vs-chip-clear"
                  onClick={(e) => { e.stopPropagation(); clearDependency(f.key) }}
                  aria-label={`Clear ${f.key} dependency`}
                >
                  <X size={11} strokeWidth={2.5} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default DependenciesPanel