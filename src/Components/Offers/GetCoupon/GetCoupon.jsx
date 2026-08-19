import './GetCoupon.css'
import React, { useEffect, useMemo, useState, useCallback } from 'react'
import {
  RefreshCw,
  Search,
  TicketX,
  Eye,
  Pencil,
  Trash2,
  CopyPlus,
  X,
  Loader2,
} from 'lucide-react'
// Adjust this path to wherever the templateLibrary package actually lives
// relative to this file (it's the index.js you shared).
import _ from 'lodash'
// Only the renderer + default design shape come from the shared package.
// The actual fetch lives below, in this file, so you can repoint or
// reshape it (headers, auth, response envelope, etc.) without touching
// templateLibrary/api.js.
import { VoucherCanvas } from '../components/VoucherCanvas'
import { baseDesign } from '../lib/design'

// Adjust if your API is mounted elsewhere / behind a different host.
const API_BASE = 'https://dummypossetup.runasp.net'

// Calls the backend's GetCouponUi, which returns the template's config
// with the coupon's name + expiry already substituted server-side.
// Still merged over baseDesign() so any field an older template is
// missing falls back to a sane default.
async function fetchCouponUiDesign(couponId, templateId) {
  const res = await fetch(
    `${API_BASE}/api/Coupon/GetCouponUi?couponId=${couponId}&templateId=${templateId}`
  )
  if (!res.ok) throw new Error(`Failed to load coupon artwork (${res.status}).`)
  const config = unwrapEnvelope(await res.json())

  const merged = _.merge(baseDesign(), config || {})
  merged.id = String(templateId)
  return merged
}

function formatDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

// Converts a date to the yyyy-MM-dd shape <input type="date"> expects.
function toDateInputValue(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

// The API now always replies as { success, data }. This unwraps that
// envelope while still tolerating a bare array/object for safety.
function unwrapEnvelope(json) {
  if (json && typeof json === 'object' && 'data' in json) return json.data
  return json
}

function normalizeCoupon(raw) {
  // Backend is PascalCase JSON by default in ASP.NET; normalize to camelCase
  // so the component doesn't care which casing convention is in play.
  return {
    id: raw.id ?? raw.Id,
    name: raw.name ?? raw.Name,
    discountTypeId: raw.discountTypeId ?? raw.DiscountTypeId,
    discountTypeName: raw.discountTypeName ?? raw.DiscountTypeName ?? null,
    discountPercentage: raw.discountPercentage ?? raw.DiscountPercentage ?? 0,
    discountAmount: raw.discountAmount ?? raw.DiscountAmount ?? 0,
    minSpendAmount: raw.minSpendAmount ?? raw.MinSpendAmount ?? 0,
    issuingLastdate: raw.issuingLastdate ?? raw.IssuingLastdate,
    expiryDate: raw.expiryDate ?? raw.ExpiryDate,
    couponType: raw.couponTypeId ?? raw.CouponTypeId ?? raw.couponType ?? raw.CouponType,
    couponTypeName: raw.couponTypeName ?? raw.CouponTypeName ?? null,
    templateId: raw.templateId ?? raw.TemplateId,
    createdDate: raw.createdDate ?? raw.CreatedDate,
  }
}

function normalizeLookup(raw) {
  return {
    id: raw.id ?? raw.Id,
    name: raw.name ?? raw.Name ?? raw.title ?? raw.Title ?? `#${raw.id ?? raw.Id}`,
  }
}

// Shape used by the edit form. Kept separate from the row's display shape
// since inputs need strings, not Dates/numbers with API casing quirks.
function couponToFormState(coupon) {
  return {
    name: coupon.name ?? '',
    discountTypeId: coupon.discountTypeId ?? '',
    couponType: coupon.couponType ?? '',
    discountPercentage: coupon.discountPercentage ?? 0,
    discountAmount: coupon.discountAmount ?? 0,
    minSpendAmount: coupon.minSpendAmount ?? 0,
    issuingLastdate: toDateInputValue(coupon.issuingLastdate),
    expiryDate: toDateInputValue(coupon.expiryDate),
    templateId: coupon.templateId ?? '',
  }
}

// Pure merge: layers coupon-specific fields onto a design that already
// came from GetCouponUi (name + expiry already baked in server-side).
// Only fills in what that endpoint doesn't set: the discount medallion,
// the QR payload, and the corner flag text. `design` is never mutated.
function applyCouponOverrides(design, coupon) {
  if (!design) return null

  const discountLabel =
    coupon.discountPercentage > 0
      ? `${coupon.discountPercentage}%`
      : coupon.discountAmount > 0
      ? `₹${coupon.discountAmount}`
      : design.medallion?.value

  return {
    ...design,
    medallion: design.medallion && { ...design.medallion, value: discountLabel },
    headline: design.headline && {
      ...design.headline,
      text: coupon.name ? coupon.name.toUpperCase() : design.headline.text,
    },
    qr: design.qr && {
      ...design.qr,
      value: coupon.name
        ? `${design.qr.value}${design.qr.value.includes('?') ? '&' : '?'}code=${encodeURIComponent(coupon.name)}`
        : design.qr.value,
    },
    cornerFlag: design.cornerFlag && {
      ...design.cornerFlag,
      text: coupon.name ? coupon.name.toUpperCase() : design.cornerFlag.text,
    },
  }
}

function GetCoupon({ onCancel }) {
  const [coupons, setCoupons] = useState([])
  const [discountTypes, setDiscountTypes] = useState([])
  const [couponTypes, setCouponTypes] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  // Per-row busy state, e.g. { 12: 'delete' } while a delete is in flight.
  const [rowBusy, setRowBusy] = useState({})
  const [banner, setBanner] = useState(null) // { type: 'error' | 'success', text }

  const [previewCoupon, setPreviewCoupon] = useState(null)

  // Coupon artwork is fetched lazily via GetCouponUi and cached by coupon
  // id (not templateId — the response has that specific coupon's name and
  // expiry baked in server-side, so it can't be shared across coupons).
  // In-memory only: a full page reload clears it and the next preview
  // refetches fresh from the backend.
  const [couponDesignCache, setCouponDesignCache] = useState({}) // { [couponId]: design }
  const [couponDesignStatus, setCouponDesignStatus] = useState({}) // { [couponId]: 'loading' | 'error' }

  const ensureCouponDesign = useCallback(
    async (coupon) => {
      if (coupon?.templateId == null) return
      if (couponDesignCache[coupon.id] || couponDesignStatus[coupon.id] === 'loading') return

      setCouponDesignStatus((cur) => ({ ...cur, [coupon.id]: 'loading' }))
      try {
        const design = await fetchCouponUiDesign(coupon.id, coupon.templateId)
        setCouponDesignCache((cur) => ({ ...cur, [coupon.id]: design }))
        setCouponDesignStatus((cur) => {
          const next = { ...cur }
          delete next[coupon.id]
          return next
        })
      } catch {
        setCouponDesignStatus((cur) => ({ ...cur, [coupon.id]: 'error' }))
      }
    },
    [couponDesignCache, couponDesignStatus]
  )

  // Drops this coupon's cached artwork (if any) so the next time its
  // preview is opened, ensureCouponDesign sees no cache entry and calls
  // GetCouponUi again instead of reusing the old one. Doesn't fetch
  // anything itself — fetching only happens on preview open.
  const handleRefreshDesign = useCallback((coupon) => {
    setCouponDesignCache((cur) => {
      if (!(coupon.id in cur)) return cur
      const next = { ...cur }
      delete next[coupon.id]
      return next
    })
    setCouponDesignStatus((cur) => {
      if (!(coupon.id in cur)) return cur
      const next = { ...cur }
      delete next[coupon.id]
      return next
    })
    showBanner('success', `Cleared cached artwork for "${coupon.name}".`)
  }, [])

  const [editCoupon, setEditCoupon] = useState(null)
  const [editForm, setEditForm] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState(null)

  const setBusy = (id, action) =>
    setRowBusy((cur) => ({ ...cur, [id]: action }))
  const clearBusy = (id) =>
    setRowBusy((cur) => {
      const next = { ...cur }
      delete next[id]
      return next
    })

  const showBanner = (type, text) => {
    setBanner({ type, text })
    setTimeout(() => setBanner((cur) => (cur?.text === text ? null : cur)), 3200)
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [couponsRes, discountRes, couponTypeRes] = await Promise.all([
        fetch(`${API_BASE}/api/Coupon/GetCoupons`),
        fetch(`${API_BASE}/api/Coupon/DiscountType`),
        fetch(`${API_BASE}/api/Coupon/CouponType`),
      ])

      if (!couponsRes.ok) throw new Error(`Could not load coupons (${couponsRes.status}).`)

      const couponsJson = unwrapEnvelope(await couponsRes.json())
      const discountJson = discountRes.ok ? unwrapEnvelope(await discountRes.json()) : []
      const couponTypeJson = couponTypeRes.ok ? unwrapEnvelope(await couponTypeRes.json()) : []

      setCoupons((couponsJson || []).map(normalizeCoupon))
      setDiscountTypes((discountJson || []).map(normalizeLookup))
      setCouponTypes((couponTypeJson || []).map(normalizeLookup))
    } catch (err) {
      setError(err.message || 'Something went wrong while loading coupons.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const couponTypeNameById = useMemo(() => {
    const map = new Map()
    couponTypes.forEach((t) => map.set(t.id, t.name))
    return map
  }, [couponTypes])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return coupons
    return coupons.filter((c) => (c.name || '').toLowerCase().includes(q))
  }, [coupons, query])

  // --- Preview ---------------------------------------------------------
  const openPreview = (coupon) => {
    setPreviewCoupon(coupon)
    ensureCouponDesign(coupon)
  }
  const closePreview = () => setPreviewCoupon(null)

  // --- Delete ------------------------------------------------------------
  const handleDelete = async (coupon) => {
    if (!window.confirm(`Delete "${coupon.name}"? This can't be undone.`)) return
    setBusy(coupon.id, 'delete')
    try {
      const res = await fetch(`${API_BASE}/api/Coupon/DeleteCoupon/${coupon.id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error(`Delete failed (${res.status}).`)
      setCoupons((cur) => cur.filter((c) => c.id !== coupon.id))
      showBanner('success', `Deleted "${coupon.name}".`)
    } catch (err) {
      showBanner('error', err.message || 'Could not delete this coupon.')
    } finally {
      clearBusy(coupon.id)
    }
  }

  // --- Duplicate (add a copy into the main coupon database) -------------
  const handleDuplicate = async (coupon) => {
    setBusy(coupon.id, 'duplicate')
    try {
      const res = await fetch(
        `${API_BASE}/api/Coupon/DuplicateCoupon/${coupon.id}`,
        { method: 'POST' }
      )
      if (!res.ok) throw new Error(`Could not add a copy (${res.status}).`)
      const json = unwrapEnvelope(await res.json())
      setCoupons((cur) => [normalizeCoupon(json), ...cur])
      showBanner('success', `Added a copy of "${coupon.name}".`)
    } catch (err) {
      showBanner('error', err.message || 'Could not add a copy of this coupon.')
    } finally {
      clearBusy(coupon.id)
    }
  }

  // --- Edit ---------------------------------------------------------------
  const openEdit = (coupon) => {
    setEditCoupon(coupon)
    setEditForm(couponToFormState(coupon))
    setEditError(null)
  }
  const closeEdit = () => {
    setEditCoupon(null)
    setEditForm(null)
    setEditError(null)
  }

  const updateEditField = (field, value) =>
    setEditForm((cur) => ({ ...cur, [field]: value }))

  const handleEditSave = async (e) => {
    e.preventDefault()
    if (!editCoupon || !editForm) return

    if (!editForm.name.trim()) {
      setEditError('Coupon name is required.')
      return
    }

    setEditSaving(true)
    setEditError(null)
    try {
      const payload = {
        id: editCoupon.id,
        name: editForm.name.trim(),
        discountTypeId: Number(editForm.discountTypeId),
        discountPercentage: Number(editForm.discountPercentage) || 0,
        discountAmount: Number(editForm.discountAmount) || 0,
        minSpendAmount: Number(editForm.minSpendAmount) || 0,
        issuingLastdate: editForm.issuingLastdate
          ? new Date(editForm.issuingLastdate).toISOString()
          : null,
        expiryDate: editForm.expiryDate ? new Date(editForm.expiryDate).toISOString() : null,
        couponType: Number(editForm.couponType),
        templateId: Number(editForm.templateId),
      }

      const res = await fetch(`${API_BASE}/api/Coupon/UpdateCoupon`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(text || `Update failed (${res.status}).`)
      }

      const json = unwrapEnvelope(await res.json())
      const updated = normalizeCoupon(json)
      setCoupons((cur) => cur.map((c) => (c.id === updated.id ? updated : c)))

      // The saved fields (name/expiry/etc.) may have changed, so any
      // cached GetCouponUi artwork for this coupon is now stale. Drop it
      // the same way the per-row refresh button does — next preview
      // refetches fresh.
      handleRefreshDesign(updated)

      showBanner('success', `Saved changes to "${updated.name}".`)
      closeEdit()
    } catch (err) {
      setEditError(err.message || 'Could not save changes.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="gc-wrap">
      {banner && (
        <div className={`gc-banner gc-banner--${banner.type}`}>
          <span>{banner.text}</span>
          <button type="button" onClick={() => setBanner(null)} aria-label="Dismiss">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      )}

      <div className="gc-toolbar">
        <div className="gc-search">
          <Search size={16} strokeWidth={2.25} color="#8A85A0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search coupons by name"
            aria-label="Search coupons by name"
          />
        </div>
        <button type="button" className="gc-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={16} strokeWidth={2.25} className={loading ? 'gc-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="gc-list">
          {[0, 1, 2].map((i) => (
            <div key={i} className="gc-skel" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="gc-empty">
          <TicketX size={28} strokeWidth={1.75} color="#B9762E" />
          <p className="gc-empty__title">Couldn't load coupons</p>
          <p className="gc-empty__sub">{error}</p>
          <button type="button" className="gc-retry" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="gc-empty">
          <TicketX size={28} strokeWidth={1.75} color="#B9762E" />
          <p className="gc-empty__title">{query ? 'No matches' : 'No coupons yet'}</p>
          <p className="gc-empty__sub">
            {query ? 'Try a different search term.' : 'Coupons you add will show up here.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <ul className="gc-list">
          {filtered.map((coupon) => {
            const discountLabel =
              coupon.discountPercentage > 0
                ? `${coupon.discountPercentage}%`
                : coupon.discountAmount > 0
                ? `₹${coupon.discountAmount}`
                : '—'
            const typeLabel =
              coupon.couponTypeName || couponTypeNameById.get(coupon.couponType) || 'Coupon'
            const busyAction = rowBusy[coupon.id]
            const hasCachedDesign = coupon.id in couponDesignCache

            return (
              <li key={coupon.id} className="gc-card">
                <span className="gc-card__notch gc-card__notch--top" />
                <span className="gc-card__notch gc-card__notch--bottom" />

                <div className="gc-card__value">
                  <span className="gc-card__amount">{discountLabel}</span>
                  <span className="gc-card__off">OFF</span>
                </div>

                <div className="gc-card__perf" />

                <div className="gc-card__body">
                  <div className="gc-card__top">
                    <span className="gc-card__name">{coupon.name}</span>
                  </div>
                  <span className="gc-card__type">{typeLabel}</span>
                  <div className="gc-card__meta">
                    {coupon.minSpendAmount > 0 && <span>Min spend ₹{coupon.minSpendAmount}</span>}
                    <span>Issue Till {formatDate(coupon.issuingLastdate)}</span>
                    <span>Valid till {formatDate(coupon.expiryDate)}</span>
                  </div>
                </div>

                <div className="gc-card__actions">
                  <button
                    type="button"
                    className="gc-card__action"
                    onClick={() => handleRefreshDesign(coupon)}
                    disabled={!hasCachedDesign}
                    aria-label={`Refresh cached artwork for ${coupon.name}`}
                    title={
                      hasCachedDesign
                        ? 'Clear cached artwork (refetches on next preview)'
                        : 'No cached artwork to clear yet'
                    }
                  >
                    <RefreshCw size={16} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="gc-card__action"
                    onClick={() => openPreview(coupon)}
                    aria-label={`Preview ${coupon.name}`}
                    title="Preview"
                  >
                    <Eye size={16} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="gc-card__action"
                    onClick={() => openEdit(coupon)}
                    aria-label={`Edit ${coupon.name}`}
                    title="Edit"
                  >
                    <Pencil size={16} strokeWidth={2.25} />
                  </button>
                  <button
                    type="button"
                    className="gc-card__action"
                    onClick={() => handleDuplicate(coupon)}
                    disabled={busyAction === 'duplicate'}
                    aria-label={`Add a copy of ${coupon.name} to the database`}
                    title="Add a copy to the database"
                  >
                    {busyAction === 'duplicate' ? (
                      <Loader2 size={16} strokeWidth={2.25} className="gc-spin" />
                    ) : (
                      <CopyPlus size={16} strokeWidth={2.25} />
                    )}
                  </button>
                  <button
                    type="button"
                    className="gc-card__action gc-card__action--danger"
                    onClick={() => handleDelete(coupon)}
                    disabled={busyAction === 'delete'}
                    aria-label={`Delete ${coupon.name}`}
                    title="Delete"
                  >
                    {busyAction === 'delete' ? (
                      <Loader2 size={16} strokeWidth={2.25} className="gc-spin" />
                    ) : (
                      <Trash2 size={16} strokeWidth={2.25} />
                    )}
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {previewCoupon && (
        <div className="gc-overlay" onClick={closePreview}>
          <div className="gc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gc-modal__head">
              <h3>{previewCoupon.name}</h3>
              <button type="button" className="gc-modal__close" onClick={closePreview} aria-label="Close preview">
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>
            {(() => {
              const status = couponDesignStatus[previewCoupon.id]
              const design = couponDesignCache[previewCoupon.id]
              if (status === 'loading') return <div className="gc-art-skel" />
              if (status === 'error') {
                return <div className="gc-art-error">Couldn't load the coupon artwork.</div>
              }
              if (!design) return null
              const merged = applyCouponOverrides(design, previewCoupon)
              return (
                <div className="gc-art">
                  <VoucherCanvas design={merged} />
                </div>
              )
            })()}

            
          </div>
        </div>
      )}

      {editCoupon && editForm && (
        <div className="gc-overlay" onClick={editSaving ? undefined : closeEdit}>
          <form className="gc-modal" onClick={(e) => e.stopPropagation()} onSubmit={handleEditSave}>
            <div className="gc-modal__head">
              <h3>Edit coupon</h3>
              <button
                type="button"
                className="gc-modal__close"
                onClick={closeEdit}
                disabled={editSaving}
                aria-label="Close edit form"
              >
                <X size={18} strokeWidth={2.25} />
              </button>
            </div>

            {editError && <div className="gc-form-error">{editError}</div>}

            <div className="gc-field">
              <label htmlFor="gc-edit-name">Name</label>
              <input
                id="gc-edit-name"
                type="text"
                value={editForm.name}
                onChange={(e) => updateEditField('name', e.target.value)}
                required
              />
            </div>

            <div className="gc-field-row">
              <div className="gc-field">
                <label htmlFor="gc-edit-discount-type">Discount type</label>
                <select
                  id="gc-edit-discount-type"
                  value={editForm.discountTypeId}
                  onChange={(e) => updateEditField('discountTypeId', e.target.value)}
                  required
                >
                  <option value="" disabled>Select…</option>
                  {discountTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
              <div className="gc-field">
                <label htmlFor="gc-edit-coupon-type">Coupon type</label>
                <select
                  id="gc-edit-coupon-type"
                  value={editForm.couponType}
                  onChange={(e) => updateEditField('couponType', e.target.value)}
                  required
                >
                  <option value="" disabled>Select…</option>
                  {couponTypes.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="gc-field-row">
              <div className="gc-field">
                <label htmlFor="gc-edit-percent">Discount %</label>
                <input
                  id="gc-edit-percent"
                  type="number"
                  min="0"
                  value={editForm.discountPercentage}
                  onChange={(e) => updateEditField('discountPercentage', e.target.value)}
                />
              </div>
              <div className="gc-field">
                <label htmlFor="gc-edit-amount">Discount ₹</label>
                <input
                  id="gc-edit-amount"
                  type="number"
                  min="0"
                  value={editForm.discountAmount}
                  onChange={(e) => updateEditField('discountAmount', e.target.value)}
                />
              </div>
              <div className="gc-field">
                <label htmlFor="gc-edit-min-spend">Min spend ₹</label>
                <input
                  id="gc-edit-min-spend"
                  type="number"
                  min="0"
                  value={editForm.minSpendAmount}
                  onChange={(e) => updateEditField('minSpendAmount', e.target.value)}
                />
              </div>
            </div>

            <div className="gc-field-row">
              <div className="gc-field">
                <label htmlFor="gc-edit-issuing">Available until</label>
                <input
                  id="gc-edit-issuing"
                  type="date"
                  value={editForm.issuingLastdate}
                  onChange={(e) => updateEditField('issuingLastdate', e.target.value)}
                  required
                />
              </div>
              <div className="gc-field">
                <label htmlFor="gc-edit-expiry">Expires</label>
                <input
                  id="gc-edit-expiry"
                  type="date"
                  value={editForm.expiryDate}
                  onChange={(e) => updateEditField('expiryDate', e.target.value)}
                  required
                />
              </div>
              <div className="gc-field">
                <label htmlFor="gc-edit-template">Template Id</label>
                <input
                  id="gc-edit-template"
                  type="number"
                  min="0"
                  value={editForm.templateId}
                  onChange={(e) => updateEditField('templateId', e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="gc-modal__foot">
              <button type="button" className="gc-btn gc-btn--ghost" onClick={closeEdit} disabled={editSaving}>
                Cancel
              </button>
              <button type="submit" className="gc-btn gc-btn--primary" disabled={editSaving}>
                {editSaving ? (
                  <>
                    <Loader2 size={15} strokeWidth={2.5} className="gc-spin" />
                    Saving…
                  </>
                ) : (
                  'Save changes'
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default GetCoupon