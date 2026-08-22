// Place this file in the same folder as GetCoupon.jsx (e.g.
// src/.../GetCoupon/CheckCoupon.jsx) so the './GetCoupon.css' import below
// resolves and the toolbar/search styling matches the rest of the Coupon
// Voucher flow.
import '../GetCoupon/GetCoupon.css'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { RefreshCw, Search, TicketX, Loader2 } from 'lucide-react'

// Adjust if your API is mounted elsewhere / behind a different host.
const API_BASE = 'https://dummypossetup.runasp.net'

// Tolerates either a bare array or a { success, data } envelope, same as
// the rest of the coupon endpoints.
function unwrapEnvelope(json) {
  if (json && typeof json === 'object' && 'data' in json) return json.data
  return json
}

// Turns a backend field name into a readable header — "CouponExpiryDate" ->
// "Coupon Expiry Date", "contactNumberAssigned" -> "Contact Number Assigned".
// Purely cosmetic; the underlying key (and therefore the column's position
// and content) always comes straight from the response.
function humanizeKey(key) {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/^./, (c) => c.toUpperCase())
    .trim()
}

// Loose ISO-date sniff (yyyy-MM-dd, optionally with a time part) so date
// fields render as "12 Aug 2026" instead of a raw timestamp string, without
// having to know the field's name in advance.
function isDateLike(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(new Date(value).getTime())
}

function formatDate(value) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return String(value)
  return d.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCellValue(value) {
  if (value === null || value === undefined || value === '') return '—'
  if (isDateLike(value)) return formatDate(value)
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

function CheckCoupon({ onCancel }) {
  // Rows are kept exactly as the backend sends them — no per-field
  // normalization — so the table always reflects whatever shape
  // GetCouponAssignment happens to return.
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/CouponAssignment/GetCouponAssignment`)
      if (!res.ok) throw new Error(`Could not load created coupons (${res.status}).`)
      const json = unwrapEnvelope(await res.json())
      const list = Array.isArray(json) ? json : []
      setRows(list)
      // Column order follows the key order of the first row, which — for a
      // JSON array of same-shaped objects — matches the order the backend
      // declared them in its projection.
      setColumns(list.length > 0 ? Object.keys(list[0]) : [])
    } catch (err) {
      setError(err.message || 'Something went wrong while loading created coupons.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) =>
      columns.some((col) => String(row[col] ?? '').toLowerCase().includes(q))
    )
  }, [rows, columns, query])

  return (
    <div className="gc-wrap">
      <div className="gc-toolbar">
        <div className="gc-search">
          <Search size={16} strokeWidth={2.25} color="#8A85A0" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search created coupons"
            aria-label="Search created coupons"
          />
        </div>
        <button type="button" className="gc-refresh" onClick={load} disabled={loading}>
          <RefreshCw size={16} strokeWidth={2.25} className={loading ? 'gc-spin' : ''} />
          Refresh
        </button>
      </div>

      {loading && (
        <div className="cc-loading">
          <Loader2 size={20} strokeWidth={2.25} className="gc-spin" />
          <span>Loading created coupons…</span>
        </div>
      )}

      {!loading && error && (
        <div className="gc-empty">
          <TicketX size={28} strokeWidth={1.75} color="#B9762E" />
          <p className="gc-empty__title">Couldn't load created coupons</p>
          <p className="gc-empty__sub">{error}</p>
          <button type="button" className="gc-retry" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="gc-empty">
          <TicketX size={28} strokeWidth={1.75} color="#B9762E" />
          <p className="gc-empty__title">{query ? 'No matches' : 'No coupons created yet'}</p>
          <p className="gc-empty__sub">
            {query ? 'Try a different search term.' : 'Coupons you add or assign will show up here.'}
          </p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="cc-table-wrap">
          <table className="cc-table">
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col}>{humanizeKey(col)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, idx) => (
                <tr key={idx}>
                  {columns.map((col) => (
                    <td key={col}>{formatCellValue(row[col])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <style>{`
        .cc-loading {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 24px 4px;
          color: #6B667F;
          font-size: 14px;
          font-weight: 500;
        }

        .cc-table-wrap {
          overflow-x: auto;
          border: 1px solid #E4E1EE;
          border-radius: 12px;
          background: #FFFFFF;
        }

        .cc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
          white-space: nowrap;
        }

        .cc-table thead th {
          text-align: left;
          padding: 10px 14px;
          background: #F6F5FA;
          color: #6B667F;
          font-weight: 600;
          font-size: 11px;
          letter-spacing: 0.04em;
          text-transform: uppercase;
          border-bottom: 1px solid #E4E1EE;
          position: sticky;
          top: 0;
        }

        .cc-table tbody td {
          padding: 10px 14px;
          color: #1C1A24;
          border-bottom: 1px solid #F0EEF6;
        }

        .cc-table tbody tr:last-child td {
          border-bottom: none;
        }

        .cc-table tbody tr:hover {
          background: #FAF9FD;
        }

        @media (min-width: 780px) {
          .cc-table-wrap {
            border-radius: 14px;
          }

          .cc-table {
            font-size: 14px;
            white-space: normal;
          }

          .cc-table thead th {
            padding: 14px 20px;
            font-size: 12px;
          }

          .cc-table tbody td {
            padding: 14px 20px;
          }
        }
      `}</style>
    </div>
  )
}

export default CheckCoupon