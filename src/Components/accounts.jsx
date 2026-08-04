import React, { useState } from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";

const API_BASE_URL = "https://dummypossetup.runasp.net";

const TABS = [
  { id: "invoices", label: "Invoices" },
  { id: "returns", label: "Returns" },
  { id: "wallet", label: "Wallet" }
];

const formatCurrency = (value) =>
  typeof value === "number"
    ? value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
};

export default function Accounts() {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [activeTab, setActiveTab] = useState("invoices");

  const [invoices, setInvoices] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState("");
  const [expandedInvoice, setExpandedInvoice] = useState(null); // invoiceNumber currently expanded

  const canSearch = fromDate && toDate;

  const fetchInvoices = async () => {
    if (!canSearch) {
      setInvoicesError("Select both a from and to date.");
      return;
    }

    setInvoicesLoading(true);
    setInvoicesError("");
    setExpandedInvoice(null);

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/Accounts/InvoiceAndInvoiceDetails?StartDate=${encodeURIComponent(fromDate)}&EndDate=${encodeURIComponent(toDate)}`
      );
      const data = await res.json().catch(() => ([]));

      if (!res.ok) {
        throw new Error(data.message || "Could not load invoices.");
      }

      setInvoices(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch invoices error:", err);
      setInvoicesError(err.message || "Could not load invoices. Please try again.");
    } finally {
      setInvoicesLoading(false);
    }
  };

  const handleSearch = () => {
    if (activeTab === "invoices") {
      fetchInvoices();
    }
    // Returns / Wallet: no backend endpoint yet — nothing to fetch.
  };

  // ── Build a two-sheet workbook from the invoices already in state.
  //     Sheet 1: one row per invoice (overview totals).
  //     Sheet 2: one row per line item, flattened out of each
  //     invoice's `details` array, with invoice no./date repeated
  //     on each row so it's still identifiable once flattened. ──
  const handleDownloadExcel = () => {
    if (!invoices.length) return;

    const overviewRows = invoices.map((inv) => ({
      "Invoice No.": inv.invoiceNumber,
      "Date": formatDate(inv.invoiceDate),
      "Mobile": inv.customerMobileNumber || "",
      "Taxable": inv.totalTaxable,
      "CGST": inv.totalCgst,
      "SGST": inv.totalSgst,
      "IGST": inv.totalIgst,
      "Tax": inv.totalTax,
      "Discount": inv.discount,
      "Total (Incl. GST)": inv.totalInclusive
    }));

    const detailRows = invoices.flatMap((inv) =>
      (inv.details || []).map((d) => ({
        "Invoice No.": inv.invoiceNumber,
        "Date": formatDate(inv.invoiceDate),
        "Product": d.productName,
        "Qty": d.quantity,
        "Price/Unit": d.salePricePerUnit,
        "Taxable": d.taxableAmount,
        "CGST %": d.cgstPercent,
        "CGST ₹": d.cgstValue,
        "SGST %": d.sgstPercent,
        "SGST ₹": d.sgstValue,
        "IGST %": d.igstPercent,
        "IGST ₹": d.igstValue,
        "Total": d.inclusiveTotal
      }))
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overviewRows), "Invoices");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detailRows), "Invoice Details");

    const fileName = `Invoices_${fromDate || "start"}_to_${toDate || "end"}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  return (
    <div
      style={{
        padding: "24px",
        background: "#f5f5f5",
        minHeight: "100vh",
        fontFamily: "Arial, sans-serif"
      }}
    >
      <h2 style={{ marginBottom: "20px" }}>Accounts</h2>

      {/* Date Range — applies across all three tabs */}
      <div
        style={{
          display: "flex",
          gap: "16px",
          alignItems: "end",
          marginBottom: "16px",
          background: "#fff",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}
      >
        <div>
          <label style={{ display: "block", marginBottom: "6px" }}>
            From Date
          </label>
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px"
            }}
          />
        </div>

        <div>
          <label style={{ display: "block", marginBottom: "6px" }}>
            To Date
          </label>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={{
              padding: "8px 12px",
              border: "1px solid #ccc",
              borderRadius: "4px"
            }}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={!canSearch || invoicesLoading}
          style={{
            padding: "10px 20px",
            background: !canSearch || invoicesLoading ? "#90b8e0" : "#1976d2",
            color: "#fff",
            border: "none",
            borderRadius: "4px",
            cursor: !canSearch || invoicesLoading ? "not-allowed" : "pointer"
          }}
        >
          {invoicesLoading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Tab buttons */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "10px 20px",
              borderRadius: "6px",
              border: activeTab === tab.id ? "1px solid #1976d2" : "1px solid #ccc",
              background: activeTab === tab.id ? "#1976d2" : "#fff",
              color: activeTab === tab.id ? "#fff" : "#333",
              cursor: "pointer",
              fontWeight: activeTab === tab.id ? 600 : 400
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div
        style={{
          background: "#fff",
          borderRadius: "8px",
          padding: "16px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)"
        }}
      >
        {activeTab === "invoices" && (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ marginTop: 0, marginBottom: 0 }}>Invoices</h3>
              {invoices.length > 0 && (
                <button
                  onClick={handleDownloadExcel}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 16px",
                    background: "#2e7d32",
                    color: "#fff",
                    border: "none",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "0.9em"
                  }}
                >
                  <Download size={16} />
                  Download Excel
                </button>
              )}
            </div>

            {!canSearch ? (
              <p style={{ color: "#777" }}>Select a date range and tap Search.</p>
            ) : invoicesLoading ? (
              <p style={{ color: "#777" }}>Loading invoices...</p>
            ) : invoicesError ? (
              <div>
                <p style={{ color: "#c62828" }}>{invoicesError}</p>
                <button
                  onClick={fetchInvoices}
                  style={{ color: "#1976d2", background: "none", border: "none", cursor: "pointer", textDecoration: "underline", padding: 0 }}
                >
                  Retry
                </button>
              </div>
            ) : invoices.length === 0 ? (
              <p style={{ color: "#777" }}>No invoices found for this date range.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse", marginTop: "12px" }}>
                <thead>
                  <tr>
                    <th style={thStyle}></th>
                    <th style={thStyle}>Invoice No.</th>
                    <th style={thStyle}>Date</th>
                    <th style={thStyle}>Mobile</th>
                    <th style={thStyle}>Taxable</th>
                    <th style={thStyle}>Tax</th>
                    <th style={thStyle}>Discount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((inv) => {
                    const isExpanded = expandedInvoice === inv.invoiceNumber;
                    return (
                      <React.Fragment key={inv.invoiceNumber}>
                        <tr
                          onClick={() =>
                            setExpandedInvoice(isExpanded ? null : inv.invoiceNumber)
                          }
                          style={{ cursor: "pointer" }}
                        >
                          <td style={{ ...tdStyle, width: "28px" }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </td>
                          <td style={tdStyle}>{inv.invoiceNumber}</td>
                          <td style={tdStyle}>{formatDate(inv.invoiceDate)}</td>
                          <td style={tdStyle}>{inv.customerMobileNumber || "—"}</td>
                          <td style={tdStyle}>{formatCurrency(inv.totalTaxable)}</td>
                          <td style={tdStyle}>{formatCurrency(inv.totalTax)}</td>
                          <td style={tdStyle}>{formatCurrency(inv.discount)}</td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td style={{ ...tdStyle, background: "#fafafa" }} colSpan={7}>
                              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                                <thead>
                                  <tr>
                                    <th style={thStyleSmall}>Product</th>
                                    <th style={thStyleSmall}>Qty</th>
                                    <th style={thStyleSmall}>Price/Unit</th>
                                    <th style={thStyleSmall}>Taxable</th>
                                    <th style={thStyleSmall}>CGST %</th>
                                    <th style={thStyleSmall}>CGST ₹</th>
                                    <th style={thStyleSmall}>SGST %</th>
                                    <th style={thStyleSmall}>SGST ₹</th>
                                    <th style={thStyleSmall}>IGST %</th>
                                    <th style={thStyleSmall}>IGST ₹</th>
                                    <th style={thStyleSmall}>Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {inv.details.map((d) => (
                                    <tr key={d.detailId}>
                                      <td style={tdStyleSmall}>{d.productName}</td>
                                      <td style={tdStyleSmall}>{d.quantity}</td>
                                      <td style={tdStyleSmall}>{formatCurrency(d.salePricePerUnit)}</td>
                                      <td style={tdStyleSmall}>{formatCurrency(d.taxableAmount)}</td>
                                      <td style={tdStyleSmall}>{d.cgstPercent}%</td>
                                      <td style={tdStyleSmall}>{formatCurrency(d.cgstValue)}</td>
                                      <td style={tdStyleSmall}>{d.sgstPercent}%</td>
                                      <td style={tdStyleSmall}>{formatCurrency(d.sgstValue)}</td>
                                      <td style={tdStyleSmall}>{d.igstPercent}%</td>
                                      <td style={tdStyleSmall}>{formatCurrency(d.igstValue)}</td>
                                      <td style={tdStyleSmall}>{formatCurrency(d.inclusiveTotal)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            )}
          </>
        )}

        {activeTab === "returns" && (
          <>
            <h3 style={{ marginTop: 0 }}>Returns</h3>
            <p style={{ color: "#777" }}>
              Returns aren't wired up to a backend endpoint yet — let me know when one's ready and I'll connect this tab the same way as Invoices.
            </p>
          </>
        )}

        {activeTab === "wallet" && (
          <>
            <h3 style={{ marginTop: 0 }}>Wallet</h3>
            <p style={{ color: "#777" }}>
              Wallet isn't wired up to a backend endpoint yet — let me know when one's ready and I'll connect this tab the same way as Invoices.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

const thStyle = {
  border: "1px solid #ddd",
  padding: "10px",
  background: "#f0f0f0",
  textAlign: "left"
};

const tdStyle = {
  border: "1px solid #ddd",
  padding: "10px"
};

const thStyleSmall = {
  border: "1px solid #eee",
  padding: "6px 8px",
  background: "#f5f5f5",
  textAlign: "left",
  fontSize: "0.85em"
};

const tdStyleSmall = {
  border: "1px solid #eee",
  padding: "6px 8px",
  fontSize: "0.85em"
};