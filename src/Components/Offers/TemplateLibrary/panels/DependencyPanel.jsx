import React from 'react'
import { Link2, X } from 'lucide-react'
import { DEPENDENCY_FIELDS, DEPENDENCY_TARGET_FIELDS, ELEMENT_LABELS } from '../lib/design'

const NAMED_KEYS = Object.keys(DEPENDENCY_TARGET_FIELDS)

// Resolves what the currently-selected canvas item is and whether a
// dependency token can be inserted into it:
//  - a named slot (headline, terms, qr, medallion, ...) → its field is
//    looked up in DEPENDENCY_TARGET_FIELDS
//  - a freeform element from draft.elements → only type 'text' qualifies
function resolveTarget(draft, selected) {
  if (!selected) return null

  if (NAMED_KEYS.includes(selected)) {
    const field = DEPENDENCY_TARGET_FIELDS[selected]
    const node = draft[selected]
    if (!node) return null
    return {
      label: ELEMENT_LABELS[selected] || selected,
      currentValue: node[field] || '',
      path: `${selected}.${field}`,
    }
  }

  const el = (draft.elements || []).find((item) => item.id === selected)
  if (!el || el.type !== 'text') return null
  return {
    label: el.text?.trim() ? el.text.slice(0, 18) : 'Text element',
    currentValue: el.text || '',
    path: null,
    elementId: el.id,
  }
}

export function DependenciesPanel({ draft, updateDraft, selected }) {
  const target = resolveTarget(draft, selected)
  const dependencies = draft.dependencies || {}

  // Inserting a token does two things to the design JSON:
  //  1. appends the token text into whichever field is selected (same
  //     as before)
  //  2. sets draft.dependencies[key] to its template value, so the
  //     saved JSON records that this field is in use — this is the
  //     part that actually persists through save/load, independent of
  //     where on the canvas the token ended up.
  function insertToken(key, template) {
    if (!target) return

    if (target.path) {
      updateDraft(target.path, `${target.currentValue}${template}`)
    } else {
      const elements = draft.elements || []
      const next = elements.map((el) =>
        el.id === target.elementId ? { ...el, text: `${target.currentValue}${template}` } : el
      )
      updateDraft('elements', next)
    }

    updateDraft(`dependencies.${key}`, template)
  }

  // Marks a dependency as unused again (blanks it in the JSON) without
  // touching whatever text was already placed on the canvas — the
  // person can still delete/edit the token text themselves.
  function clearDependency(key) {
    updateDraft(`dependencies.${key}`, '')
  }

  return (
    <section className="vs-section">
      <h4 className="vs-section-title">Dependencies</h4>

      <p className="vs-section-hint">
        These map 1:1 to <code>MCoupon</code> fields. Click one to insert its token into the
        currently selected text element — the field's value is then stored on the template; unused
        fields are saved blank.
      </p>

      {!target && (
        <p className="vs-section-hint vs-section-hint--muted">
          Select a text element on the canvas (headline, terms, a text box, etc.) to insert a
          dependency into it.
        </p>
      )}

      {target && (
        <p className="vs-section-hint">
          Inserting into: <strong>{target.label}</strong>
        </p>
      )}

      <div className="vs-preset-row">
        {DEPENDENCY_FIELDS.map((f) => {
          const used = !!dependencies[f.key]
          return (
            <button
              type="button"
              key={f.key}
              className={`vs-chip ${used ? 'vs-chip--active' : ''}`}
              onClick={() => insertToken(f.key, f.template)}
              disabled={!target}
              title={target ? `Insert ${f.template}` : 'Select a text element first'}
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