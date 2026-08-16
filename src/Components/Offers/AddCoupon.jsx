import React, { useCallback, useEffect, useState } from 'react'
import { Ticket, LibraryBig, AlertTriangle } from 'lucide-react'
import TemplateLibrary, { VoucherCanvas, getSavedTemplates } from './TemplateLibrary'

const DISCOUNT_TYPES = [
  { value: 'percentage', label: 'Percentage' },
  { value: 'flat', label: 'Flat discount' },
]

const EMPTY_FORM = {
  name: '',
  discountType: 'percentage',
  discountValue: '',
  minSpend: '',
  issueLastDate: '',
  expiry: '',
  template: '', // holds a saved template's id (now a numeric backend id, as a string)
}

// Rendered by CouponVoucher when "Add Coupon" is tapped — swapped in via
// local state, not a route, so there's no /offers/coupon/add URL. The
// template library lives in its own file (./TemplateLibrary) but is
// wired the same way: tapping "Select from library" swaps this form out
// for <TemplateLibrary />, and picking a card (or hitting back) swaps it
// back in. Still no separate URL — just a second imported component.
//
// Templates themselves are no longer a fixed list — they're whatever the
// person has designed and saved in the library (persisted via the
// Template API), each identified by an id. This form just stores that
// id on the coupon. Since `getSavedTemplates()` hits the backend, it's
// async — loaded here through `refreshTemplates` rather than read
// synchronously.
function AddCoupon({ onCancel = () => {}, onSubmit = () => {} }) {
  const [form, setForm] = useState(EMPTY_FORM)
  const [view, setView] = useState('form') // 'form' | 'library'
  const [savedTemplates, setSavedTemplates] = useState([])
  const [templatesLoading, setTemplatesLoading] = useState(true)
  const [templatesError, setTemplatesError] = useState(null)

  const refreshTemplates = useCallback(async () => {
    setTemplatesLoading(true)
    setTemplatesError(null)
    try {
      const list = await getSavedTemplates()
      setSavedTemplates(list)
    } catch (e) {
      // getSavedTemplates() already swallows its own errors and resolves
      // to [], but keep this in case that ever changes.
      setSavedTemplates([])
      setTemplatesError('Could not load your saved templates.')
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  // Load on mount, then refresh whenever we come back from the library,
  // since the person may have added, edited, or deleted templates there.
  useEffect(() => {
    if (view === 'form') {
      refreshTemplates()
    }
  }, [view, refreshTemplates])

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    onSubmit(form)
  }

  const handleSelectTemplate = (templateId) => {
    setForm((prev) => ({ ...prev, template: templateId }))
    setView('form')
    // refreshTemplates() also runs via the effect above once `view`
    // flips back to 'form', so the newly picked/saved template shows up.
  }

  if (view === 'library') {
    return (
      <TemplateLibrary
        selectedTemplate={form.template}
        onBack={() => setView('form')}
        onSelect={handleSelectTemplate}
      />
    )
  }

  const activeTemplate = savedTemplates.find((t) => t.id === form.template)

  return (
    <div className="ac-wrap">
      <div className="ac-banner">
        <span className="ac-banner__icon">
          <Ticket size={20} strokeWidth={2} color="#FFFFFF" />
        </span>
        <div>
          <p className="ac-banner__eyebrow">New coupon</p>
          <h2 className="ac-banner__title">Add Coupon</h2>
        </div>
      </div>

      <form className="ac-form" onSubmit={handleSubmit}>
        <label className="ac-field">
          <span className="ac-label">Coupon name</span>
          <input
            type="text"
            required
            value={form.name}
            onChange={handleChange('name')}
            placeholder="e.g. Welcome20"
            className="ac-input"
          />
        </label>

        <div className="ac-row">
          <label className="ac-field">
            <span className="ac-label">Discount type</span>
            <select
              value={form.discountType}
              onChange={handleChange('discountType')}
              className="ac-input"
            >
              {DISCOUNT_TYPES.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="ac-field">
            <span className="ac-label">
              {form.discountType === 'percentage' ? 'Value (%)' : 'Value ($)'}
            </span>
            <input
              type="number"
              min="0"
              step="0.01"
              required
              value={form.discountValue}
              onChange={handleChange('discountValue')}
              placeholder="0"
              className="ac-input"
            />
          </label>
        </div>

        <label className="ac-field">
          <span className="ac-label">Minimum spend ($)</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.minSpend}
            onChange={handleChange('minSpend')}
            placeholder="0"
            className="ac-input"
          />
        </label>

        <div className="ac-row">
          <label className="ac-field">
            <span className="ac-label">Coupon issuing last date</span>
            <input
              type="date"
              required
              value={form.issueLastDate}
              onChange={handleChange('issueLastDate')}
              className="ac-input"
            />
          </label>

          <label className="ac-field">
            <span className="ac-label">Coupon expiry date</span>
            <input
              type="date"
              required
              value={form.expiry}
              onChange={handleChange('expiry')}
              className="ac-input"
            />
          </label>
        </div>

        <label className="ac-field">
          <span className="ac-label">Select coupon template</span>

          {templatesError && (
            <p className="ac-templates-warning">
              <AlertTriangle size={14} strokeWidth={2.25} />
              {templatesError}
              <button type="button" className="ac-inline-retry" onClick={refreshTemplates}>Retry</button>
            </p>
          )}

          {templatesLoading ? (
            <div className="ac-no-templates">
              <p>Loading your saved templates…</p>
            </div>
          ) : savedTemplates.length === 0 ? (
            <div className="ac-no-templates">
              <p>No saved templates yet. Design one in the library, then pick it here.</p>
              <button type="button" onClick={() => setView('library')} className="ac-library-btn">
                <LibraryBig size={15} strokeWidth={2.25} />
                Open template library
              </button>
            </div>
          ) : (
            <div className="ac-template-row">
              <select
                value={form.template}
                onChange={handleChange('template')}
                className="ac-input ac-template-select"
              >
                <option value="" disabled>Choose a template…</option>
                {savedTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name || 'Untitled voucher'}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setView('library')}
                className="ac-library-btn"
              >
                <LibraryBig size={15} strokeWidth={2.25} />
                Select from library
              </button>
            </div>
          )}

          {activeTemplate && (
            <div className="ac-template-preview">
              <div
                className="ac-template-preview-canvas"
                style={{ aspectRatio: `${activeTemplate.widthMM} / ${activeTemplate.heightMM}` }}
              >
                <VoucherCanvas design={activeTemplate} />
              </div>
              <span className="ac-template-hint">
                {activeTemplate.widthMM}mm × {activeTemplate.heightMM}mm · id: {activeTemplate.id}
              </span>
            </div>
          )}
        </label>

        <div className="ac-actions">
          <button type="button" onClick={onCancel} className="ac-cancel">
            Cancel
          </button>
          <button type="submit" className="ac-submit">
            Create Coupon
          </button>
        </div>
      </form>

      <style>{`
        .ac-wrap {
          background: #FFFFFF;
          border-radius: 16px;
          overflow: hidden;
          box-shadow: 0 8px 20px -12px rgba(28, 26, 36, 0.35);
        }

        .ac-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 18px;
          background: linear-gradient(155deg, #B9762E 0%, #8F5720 100%);
        }

        .ac-banner__icon {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.16);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .ac-banner__eyebrow {
          margin: 0 0 2px;
          font-size: 11.5px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: rgba(255, 255, 255, 0.75);
        }

        .ac-banner__title {
          margin: 0;
          font-family: 'Space Grotesk', sans-serif;
          font-weight: 700;
          font-size: 18px;
          color: #FFFFFF;
        }

        .ac-form {
          padding: 18px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .ac-row {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
        }

        @media (min-width: 480px) {
          .ac-row { grid-template-columns: 1fr 1fr; }
        }

        .ac-field {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ac-label {
          font-size: 12.5px;
          font-weight: 600;
          color: #6B6680;
        }

        .ac-input {
          font-family: 'Inter', sans-serif;
          font-size: 14px;
          color: #1C1A24;
          background: #F7F6FA;
          border: 1.5px solid #E3E1EA;
          border-radius: 10px;
          padding: 10px 12px;
          outline: none;
          transition: border-color 0.15s ease;
        }

        .ac-input:focus {
          border-color: #B9762E;
        }

        .ac-no-templates {
          border: 1.5px dashed #E3E1EA;
          border-radius: 10px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .ac-no-templates p {
          margin: 0;
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          color: #6B6680;
        }

        .ac-templates-warning {
          display: flex;
          align-items: center;
          gap: 6px;
          margin: 0;
          padding: 10px 12px;
          border-radius: 8px;
          background: #FDEEEE;
          color: #8E2E2E;
          font-family: 'Inter', sans-serif;
          font-size: 12.5px;
          font-weight: 600;
        }

        .ac-inline-retry {
          margin-left: auto;
          border: none;
          background: transparent;
          color: #8E2E2E;
          font-weight: 700;
          font-size: 12.5px;
          text-decoration: underline;
          cursor: pointer;
          padding: 0;
        }

        .ac-template-row {
          display: flex;
          gap: 8px;
          align-items: stretch;
          flex-wrap: wrap;
        }

        .ac-template-select {
          flex: 1;
          min-width: 140px;
        }

        .ac-library-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: 1.5px dashed #B9762E;
          background: #FBF3E8;
          border-radius: 10px;
          padding: 10px 12px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 13px;
          color: #8F5720;
          cursor: pointer;
          white-space: nowrap;
          transition: background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .ac-library-btn:hover { background: #F5E7D2; }
        .ac-library-btn:focus-visible { outline: 3px solid #1C1A24; outline-offset: 2px; }

        .ac-template-preview {
          margin-top: 4px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .ac-template-preview-canvas {
          width: 100%;
          max-width: 320px;
          border-radius: 10px;
          overflow: hidden;
          border: 1.5px solid #E3E1EA;
        }

        .ac-template-hint {
          font-family: 'Inter', sans-serif;
          font-size: 11.5px;
          color: #9C98AC;
        }

        .ac-actions {
          display: flex;
          gap: 10px;
          margin-top: 4px;
        }

        .ac-cancel {
          flex: 1;
          border: 1.5px solid #E3E1EA;
          background: #FFFFFF;
          border-radius: 10px;
          padding: 12px;
          font-family: 'Inter', sans-serif;
          font-weight: 600;
          font-size: 14px;
          color: #1C1A24;
          cursor: pointer;
          transition: background 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .ac-cancel:hover { background: #F7F6FA; }
        .ac-cancel:focus-visible { outline: 3px solid #1C1A24; outline-offset: 2px; }

        .ac-submit {
          flex: 1;
          border: none;
          background: linear-gradient(155deg, #B9762E 0%, #8F5720 100%);
          border-radius: 10px;
          padding: 12px;
          font-family: 'Inter', sans-serif;
          font-weight: 700;
          font-size: 14px;
          color: #FFFFFF;
          cursor: pointer;
          transition: opacity 0.15s ease;
          -webkit-tap-highlight-color: transparent;
        }
        .ac-submit:hover { opacity: 0.92; }
        .ac-submit:focus-visible { outline: 3px solid #1C1A24; outline-offset: 2px; }

        @media (prefers-reduced-motion: reduce) {
          .ac-input, .ac-cancel, .ac-submit, .ac-library-btn { transition: none; }
        }
      `}</style>
    </div>
  )
}

export default AddCoupon