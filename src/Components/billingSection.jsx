import React, { useState, useRef, useEffect } from 'react';
import './billingSection.css';
import AddCustomer from './addCustomer';
import Quotation from './quotation';
import Payment from './payment';
import InvoiceBill from './invoiceBill';

const API_BASE_URL = 'https://dummypossetup.runasp.net';
const WA_SERVICE_URL = 'http://localhost:4001'; // change to your Baileys service URL once deployed
const WA_API_KEY = 'your-long-random-secret';

// Builds a plain-text invoice summary to send over WhatsApp instead of a URL.
const buildInvoiceMessageText = ({
  invoiceNumber,
  customerName,
  items = [],
  totalAmount = 0,
  discount = 0,
  taxAmount = 0,
  payableAmount = 0
}) => {
  const itemLines = items
    .map((item) => `- ${item.name} x${item.quantity} - Rs.${(item.price * item.quantity).toFixed(2)}`)
    .join('\n');

  return [
    `Invoice: ${invoiceNumber}`,
    customerName ? `Customer: ${customerName}` : null,
    '',
    itemLines,
    '',
    `Total: Rs.${totalAmount.toFixed(2)}`,
    discount > 0 ? `Discount: Rs.${discount.toFixed(2)}` : null,
    `Tax: Rs.${taxAmount.toFixed(2)}`,
    `Payable: Rs.${payableAmount.toFixed(2)}`,
    '',
    'Thank you for your business!'
  ]
    .filter(Boolean)
    .join('\n');
};

const sendInvoiceViaWhatsApp = async ({ phoneNumber, invoiceNumber, customerName, message }) => {
  if (!phoneNumber || !message) {
    console.warn('Skipping WhatsApp send: missing phone number or message');
    return;
  }
  try {
    const res = await fetch(`${WA_SERVICE_URL}/send-text`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': WA_API_KEY
      },
      body: JSON.stringify({ phoneNumber, invoiceNumber, customerName, message })
    });
    const data = await res.json();
    if (!data.success) {
      console.error('WhatsApp send failed:', data.message);
    } else {
      console.log('✅ Invoice sent via WhatsApp');
    }
  } catch (err) {
    console.error('WhatsApp send error (non-blocking):', err);
  }
};

// ── Invoice numbering ──────────────────────────────────────────────────
// Format: GSC{counterId}-{ddMMyyyy}/{serial padded to 4 digits}
// e.g. GSC1-29072026/0078
//
// The serial's source of truth is now the backend's CounterInvoice table
// (per-counter), not localStorage. This is a read-only "peek" — it fetches
// the counter's last-used serial and shows what the NEXT one would be,
// without spending anything. The backend (addTransaction) is responsible
// for actually advancing CounterInvoice once a sale is confirmed saved, so
// there's no separate "commit" step needed here anymore.
const peekInvoiceNumber = async () => {
  const counterId = localStorage.getItem('counterId') || '0';

  let lastSerial = 0;
  try {
    const res = await fetch(`${API_BASE_URL}/GetCounterInvoiceNumber?counterId=${counterId}`);
    if (res.ok) {
      // Endpoint returns the raw numeric LastInvoiceNumber (e.g. 78).
      lastSerial = await res.json();
    }
    // 404 (no row yet for this counter) → lastSerial stays 0, first invoice starts at 0001.
  } catch (err) {
    console.error('Failed to fetch last invoice number:', err);
  }

  const nextSerial = (Number(lastSerial) || 0);

  const today = new Date();
  const dd = String(today.getDate()).padStart(2, '0');
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const yyyy = today.getFullYear();
  const dateStr = `${dd}${mm}${yyyy}`;
  const serialStr = String(nextSerial).padStart(4, '0');

  return `GSC${counterId}-${dateStr}/${serialStr}`;
};

function BillingSection({ products = [], cart = [], setCart }) {
  const [isCustomerWindowOpen, setIsCustomerWindowOpen] = useState(false);
  const [isQuotationListOpen, setIsQuotationListOpen] = useState(false);
  const [isPaymentWindowOpen, setIsPaymentWindowOpen] = useState(false);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  const [invoiceNumber, setInvoiceNumber] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [discountByInvoice, setDiscountByInvoice] = useState({});
  const [paymentsByInvoice, setPaymentsByInvoice] = useState({});

  // ── Coupon code (scoped to the current invoice, mirrors discount/payments) ──
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null); // { code, discountAmount }
  const [couponError, setCouponError] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const [completedInvoice, setCompletedInvoice] = useState(null); // holds data for the receipt modal
  const [isSubmittingTransaction, setIsSubmittingTransaction] = useState(false);
  const [transactionError, setTransactionError] = useState('');

  const searchInputRef = useRef(null);

  const focusSearchInput = () => {
    // small delay lets any closing modal/DOM update finish first
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 50);
  };

  // Keep the search box focused on initial load
  useEffect(() => {
    focusSearchInput();
  }, []);

  // ── Re-focus the search box whenever a new line item lands in the cart ──
  // Covers additions made from this component's own search dropdown (which
  // already calls focusSearchInput directly) AND additions made from the
  // product grid in the parent component, which has no direct handle on
  // this component's input. Only fires when the cart actually grows (a
  // brand-new line, not a quantity +/- on an existing one), so it doesn't
  // yank focus away while someone's adjusting quantities elsewhere.
  const prevCartLengthRef = useRef(cart.length);
  useEffect(() => {
    if (cart.length > prevCartLengthRef.current) {
      focusSearchInput();
    }
    prevCartLengthRef.current = cart.length;
  }, [cart]);

  const discount = discountByInvoice[invoiceNumber] ?? 0;

  const handleDiscountChange = (value) => {
    setDiscountByInvoice((prev) => ({ ...prev, [invoiceNumber]: value }));
  };

  // ── Coupon apply/remove ──
  // NOTE: /ValidateCoupon is a placeholder endpoint — point this at your
  // real coupon-validation route. Expected response shape:
  // { valid: boolean, discountAmount: number, message?: string }
  const handleApplyCoupon = async () => {
    const code = couponCode.trim();
    if (!code) {
      setCouponError('Enter a coupon code.');
      return;
    }
    setIsApplyingCoupon(true);
    setCouponError('');
    try {
      const res = await fetch(
        `${API_BASE_URL}/ValidateCoupon?code=${encodeURIComponent(code)}&amount=${totalAmount}`
      );
      const result = await res.json();
      if (!res.ok || !result?.valid) {
        throw new Error(result?.message || 'Invalid or expired coupon code.');
      }
      setAppliedCoupon({ code, discountAmount: Number(result.discountAmount) || 0 });
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(err.message || 'Could not apply coupon.');
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  };

  // Display-only — peeks the next number from the backend, doesn't spend it.
  // If the sale is never completed, the counter is never touched.
  const handleCustomerAdded = async (customer) => {
    setSelectedCustomer(customer);
    const nextInvoiceNumber = await peekInvoiceNumber();
    setInvoiceNumber(nextInvoiceNumber);
    setIsCustomerWindowOpen(false);
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError('');
    focusSearchInput();
  };

  const handleSaveQuotation = () => {
    const quotation = {
      invoiceNumber,
      customer: selectedCustomer,
      cart,
      discount,
      coupon: appliedCoupon,
      payments: paymentsByInvoice[invoiceNumber] ?? [],
      savedAt: new Date().toISOString()
    };

    const existing = JSON.parse(localStorage.getItem('savedQuotations') || '[]');
    const updated = [
      ...existing.filter((q) => q.invoiceNumber !== invoiceNumber),
      quotation
    ];
    localStorage.setItem('savedQuotations', JSON.stringify(updated));
    alert(`Quotation ${invoiceNumber} saved.`);
  };

  // Re-peek a fresh number rather than trusting the one stored on the
  // quotation — other sales may have completed since it was saved.
  const handleLoadQuotation = async (quotation) => {
    const freshInvoiceNumber = await peekInvoiceNumber();
    setInvoiceNumber(freshInvoiceNumber);
    setSelectedCustomer(quotation.customer ?? null);
    setCart(quotation.cart ?? []);
    if (quotation.discount !== undefined) {
      setDiscountByInvoice((prev) => ({ ...prev, [freshInvoiceNumber]: quotation.discount }));
    }
    if (quotation.payments?.length) {
      setPaymentsByInvoice((prev) => ({ ...prev, [freshInvoiceNumber]: quotation.payments }));
    }
    setAppliedCoupon(quotation.coupon ?? null);
    setCouponCode('');
    setCouponError('');
    setIsQuotationListOpen(false);
    focusSearchInput();
  };

  const handleAddFromSearch = (product) => {
    if (!invoiceNumber) {
      alert('Please add a customer before adding items.');
      return;
    }
    const salePrice = Number(product.retailSalePrice) || 0;
    const mrp = Number(product.mrp) || 0;
    const cgst = Number(product.cgst) || 0;
    const sgst = Number(product.sgst) || 0;
    // Normalize HSN field: product master may send it as HSNCode or hsnCode.
    const hsn = product.HSNCode ?? product.hsnCode ?? '-';

    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prevCart,
        { id: product.id, name: product.productName, price: salePrice, mrp, cgst, sgst, barcode: product.barcode, hsn, quantity: 1 }
      ];
    });
    setItemSearchTerm('');
    focusSearchInput();
  };

  const increaseCount = (id) => {
    setCart(cart.map(item => item.id === id ? { ...item, quantity: item.quantity + 1 } : item));
  };

  const decreaseCount = (id) => {
    setCart((prevCart) => {
      const item = prevCart.find((i) => i.id === id);
      if (item && item.quantity <= 1) return prevCart.filter((i) => i.id !== id);
      return prevCart.map((i) => i.id === id ? { ...i, quantity: i.quantity - 1 } : i);
    });
  };

  const searchResults = itemSearchTerm.trim() === ''
    ? []
    : products.filter(p => {
        const term = itemSearchTerm.toLowerCase();
        return (p.productName ?? '').toLowerCase().includes(term) || (p.barcode ?? '').toLowerCase().includes(term);
      });

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter' && searchResults.length > 0) handleAddFromSearch(searchResults[0]);
  };

  // ── Amounts ──
  const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const taxableAmount = cart.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    return sum + (itemTotal / (100 + 2 * item.cgst) * 100);
  }, 0);
  const taxAmount = cart.reduce((sum, item) => {
    const itemTotal = item.price * item.quantity;
    const itemTaxable = itemTotal / (100 + 2 * item.cgst) * 100;
    return sum + (itemTaxable * (item.cgst / 100) * 2);
  }, 0);

  const safeDiscount = Math.min(Math.max(Number(discount) || 0, 0), totalAmount);
  // Coupon discount is capped so it can't push the payable amount below zero
  // even after the manual discount above has already been applied.
  const safeCouponDiscount = Math.min(
    appliedCoupon?.discountAmount ?? 0,
    Math.max(totalAmount - safeDiscount, 0)
  );
  const payableAmount = totalAmount - safeDiscount - safeCouponDiscount;

  const currentPayments = paymentsByInvoice[invoiceNumber] ?? [];
  const amountPaid = currentPayments.reduce((sum, p) => sum + p.amount, 0);

  const handleUpdatePayments = (newPayments) => {
    setPaymentsByInvoice((prev) => ({ ...prev, [invoiceNumber]: newPayments }));
  };

  // ── Finalize sale: call API, then show receipt, then reset everything ──
  const handlePaymentComplete = async () => {

    setIsSubmittingTransaction(true);
    setTransactionError('');

    // ── Pull the logged-in counter's ID from localStorage (set at login) ──
    const counterId = localStorage.getItem('counterId');

    if (!counterId) {
      setTransactionError('Counter ID missing — please log in again before completing the sale.');
      setIsSubmittingTransaction(false);
      return;
    }

    // Peek a fresh number right before submitting, so we use the true next
    // number even if some time has passed since the customer/cart was set up.
    const finalInvoiceNumber = await peekInvoiceNumber();

    const payload = {
      phoneNumber: selectedCustomer?.mobileNumber ?? selectedCustomer?.phoneNumber,
      invoiceNumber: finalInvoiceNumber,
      totalAmount,
      // Combined manual + coupon discount, since the backend only tracks a
      // single discount figure per transaction.
      discount: safeDiscount + safeCouponDiscount,
      couponCode: appliedCoupon?.code ?? null,
      payableAmount,
      counterId: Number(counterId),
      items: cart.map((item) => {
        const mrp = Number(item.mrp) || item.price;
        // Same per-line discount convention used everywhere else in the UI
        // (product cards, cart rows, invoice receipt): the gap between MRP
        // and the actual sale price, scaled by quantity. Sent explicitly so
        // the backend stores exactly what the customer was shown at
        // checkout, rather than falling back to its own derivation.
        const itemDiscount = Math.max(mrp - item.price, 0) * item.quantity;
        return {
          productId: item.id,
          quantity: item.quantity,
          salePrice: item.price,
          mrp,
          discount: itemDiscount,
          afterTaxation: item.price * item.quantity,
          hsnCode: item.hsn
        };
      }),
      payments: currentPayments.map((p) => ({
        paymentMethod: p.method,
        bankAccountNumber: p.bankAccountNumber ?? null,
        amountPaid: p.amount
      }))
    };

    try {
      const response = await fetch(`${API_BASE_URL}/addTransaction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result?.message || `Request failed with status ${response.status}`);
      }

      // Note: no client-side "commit" step needed anymore — the backend
      // (addTransaction) parses result.invoiceNumber and syncs
      // CounterInvoice.LastInvoiceNumber for this counter as part of the
      // same DB transaction as the sale itself.

      const finalizedInvoiceNumber = result?.invoiceNumber || finalInvoiceNumber;

      const customerName = selectedCustomer?.customerName ?? selectedCustomer?.name;
      const invoiceMessage = buildInvoiceMessageText({
        invoiceNumber: finalizedInvoiceNumber,
        customerName,
        items: cart,
        totalAmount,
        discount: safeDiscount + safeCouponDiscount,
        taxAmount,
        payableAmount
      });
      sendInvoiceViaWhatsApp({
        phoneNumber: payload.phoneNumber,
        invoiceNumber: finalizedInvoiceNumber,
        customerName,
        message: invoiceMessage
      });
      // ── Success: prepare receipt data before clearing state ──
      console.log("Cart before printing:", cart);
      setCompletedInvoice({
        invoiceNumber: finalizedInvoiceNumber,
        customer: selectedCustomer,
        cart,
        totalAmount,
        discount: safeDiscount,
        couponDiscount: safeCouponDiscount,
        couponCode: appliedCoupon?.code ?? null,
        taxAmount,
        payableAmount,
        payments: currentPayments,
        completedAt: new Date().toISOString()
      });

      // ── Clear quotation memory (localStorage) for this invoice ──
      const existingQuotations = JSON.parse(localStorage.getItem('savedQuotations') || '[]');
      const updatedQuotations = existingQuotations.filter((q) => q.invoiceNumber !== invoiceNumber);
      localStorage.setItem('savedQuotations', JSON.stringify(updatedQuotations));

      // ── Clear payment memory (in-memory state) for this invoice ──
      setPaymentsByInvoice((prev) => {
        const updated = { ...prev };
        delete updated[invoiceNumber];
        return updated;
      });
      setDiscountByInvoice((prev) => {
        const updated = { ...prev };
        delete updated[invoiceNumber];
        return updated;
      });

      setIsPaymentWindowOpen(false);
      focusSearchInput();
    } catch (err) {
      console.error('Transaction failed:', err);
      setTransactionError(err.message || 'Transaction failed. Please try again.');
      // Nothing to roll back on the frontend — since the number was only
      // ever peeked (never spent client-side), the next retry will simply
      // peek the same next serial again from CounterInvoice.
    } finally {
      setIsSubmittingTransaction(false);
    }
  };

  // ── Called when the receipt modal is closed — reset for a brand new sale ──
  const handleCloseReceipt = () => {
    setCompletedInvoice(null);
    setCart([]);
    setSelectedCustomer(null);
    setInvoiceNumber(null);
    setCouponCode('');
    setAppliedCoupon(null);
    setCouponError('');
    focusSearchInput();
  };

  return (
    <aside className="billing-sidebar bs-sidebar">

      <div className="bs-top-actions">
        <button className="bs-secondary-button" onClick={() => setIsCustomerWindowOpen(true)}>
          Add Customer
        </button>
        {isCustomerWindowOpen && (
          <AddCustomer onClose={() => setIsCustomerWindowOpen(false)} onCustomerAdded={handleCustomerAdded} />
        )}
        <button className="bs-secondary-button" onClick={() => setIsQuotationListOpen(true)}>
          Quotations
        </button>
        {isQuotationListOpen && (
          <Quotation onClose={() => setIsQuotationListOpen(false)} onLoadQuotation={handleLoadQuotation} />
        )}
      </div>

      {selectedCustomer && (
        <div className="bs-customer-info">
          <span className="bs-customer-name">{selectedCustomer.customerName ?? selectedCustomer.name}</span>
          <span className="bs-customer-number">{selectedCustomer.mobileNumber ?? selectedCustomer.phoneNumber}</span>
          <span className="bs-customer-wallet">
            Wallet: ₹{Number(selectedCustomer.currentBalance ?? selectedCustomer.walletValue ?? 0).toFixed(2)}
          </span>
        </div>
      )}

      <div className="bs-search-wrapper">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Search to add item..."
          value={itemSearchTerm}
          onChange={(e) => setItemSearchTerm(e.target.value)}
          onKeyDown={handleSearchKeyDown}
          className="bs-search-input"
        />
        {searchResults.length > 0 && (
          <ul className="bs-dropdown">
            {searchResults.map(product => (
              <li key={product.id} onClick={() => handleAddFromSearch(product)} className="bs-dropdown-item">
                <div className="bs-dropdown-item-info">
                  <span>{product.productName}</span>
                  <span className="bs-dropdown-barcode">Barcode: {product.barcode}</span>
                </div>
                <strong>₹{Number(product.retailSalePrice).toFixed(2)}</strong>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="bs-products-container">
        <h3 className="bs-section-title">
          {invoiceNumber ? `Invoice #${invoiceNumber}` : 'No customer added yet'}
        </h3>
        {cart.length === 0 && <p className="bs-empty-text">Cart is empty.</p>}
        {cart.map((product, index) => {
          const mrp = Number(product.mrp) || product.price;
          const unitDiscount = Math.max(mrp - product.price, 0);
          const itemDiscount = unitDiscount * product.quantity;
          const saleValue = product.price * product.quantity;
          const isLatest = index === cart.length - 1;
          return (
            <div
              key={product.id}
              className={`bs-product-row${isLatest ? ' bs-product-row--latest' : ''}`}
            >
              <div className="bs-product-main">
                <span className="bs-product-name">{product.name}</span>
                <span className="bs-product-barcode">Barcode: {product.barcode}</span>
              </div>
              <div className="bs-product-columns">
                <div className="bs-product-col">
                  <span className="bs-col-label">Qty</span>
                  <div className="bs-quantity-controls">
                    <button onClick={() => decreaseCount(product.id)} className="bs-icon-button">-</button>
                    <span className="bs-quantity-text">{product.quantity}</span>
                    <button onClick={() => increaseCount(product.id)} className="bs-icon-button">+</button>
                  </div>
                </div>
                <div className="bs-product-col">
                  <span className="bs-col-label">MRP</span>
                  <span className="bs-col-value">₹{mrp.toFixed(2)}</span>
                </div>
                <div className="bs-product-col">
                  <span className="bs-col-label">Discount</span>
                  <span className="bs-col-value">₹{itemDiscount.toFixed(2)}</span>
                </div>
                <div className="bs-product-col">
                  <span className="bs-col-label">Sale Value</span>
                  <span className="bs-col-value bs-col-value--strong">₹{saleValue.toFixed(2)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bs-coupon-summary-row">
        <div className="bs-coupon-container">
          <h3 className="bs-section-title">Coupon Code</h3>
          {appliedCoupon ? (
            <div className="bs-coupon-applied-row">
              <span className="bs-coupon-applied-text">
                "{appliedCoupon.code}" applied — ₹{appliedCoupon.discountAmount.toFixed(2)} off
              </span>
              <button className="bs-coupon-remove-button" onClick={handleRemoveCoupon}>
                Remove
              </button>
            </div>
          ) : (
            <div className="bs-coupon-row">
              <input
                type="text"
                placeholder="Enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                className="bs-coupon-input"
                disabled={isApplyingCoupon}
              />
              <button
                className="bs-coupon-apply-button"
                onClick={handleApplyCoupon}
                disabled={isApplyingCoupon || !invoiceNumber}
              >
                {isApplyingCoupon ? 'Applying...' : 'Apply'}
              </button>
            </div>
          )}
          {couponError && <p className="bs-error-text">{couponError}</p>}
        </div>

        <div className="bs-summary-container">
          <h3 className="bs-section-title">Bill Summary</h3>
          <div className="bs-summary-row">
            <span>Taxable Amount:</span>
            <span>₹{taxableAmount.toFixed(2)}</span>
          </div>

          <div className="bs-summary-row">
            <span>Discount:</span>
            <input
              type="number"
              min="0"
              max={totalAmount}
              value={discount}
              onChange={(e) => handleDiscountChange(e.target.value)}
              className="bs-discount-input"
            />
          </div>

          {safeCouponDiscount > 0 && (
            <div className="bs-summary-row">
              <span>Coupon Discount:</span>
              <span>-₹{safeCouponDiscount.toFixed(2)}</span>
            </div>
          )}

          <div className="bs-summary-row">
            <span>Tax Amount:</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>

          <div className="bs-summary-total">
            <span>Payable Amount:</span>
            <span>₹{payableAmount.toFixed(2)}</span>
          </div>

          {amountPaid > 0 && (
            <div className="bs-summary-row">
              <span>Paid So Far:</span>
              <span>₹{amountPaid.toFixed(2)} / ₹{payableAmount.toFixed(2)}</span>
            </div>
          )}

          {transactionError && <p className="bs-error-text">{transactionError}</p>}
        </div>
      </div>

      <div className="bs-bottom-actions">
        <button
          className="bs-primary-button bs-primary-button--payment"
          onClick={() => setIsPaymentWindowOpen(true)}
          disabled={!invoiceNumber || cart.length === 0}
        >
          Payment
        </button>
        <button
          className="bs-primary-button bs-primary-button--quotation"
          onClick={handleSaveQuotation}
          disabled={!invoiceNumber}
        >
          Quotation
        </button>
      </div>

      {isPaymentWindowOpen && (
        <Payment
          invoiceNumber={invoiceNumber}
          payableAmount={payableAmount}
          walletBalance={Number(selectedCustomer?.currentBalance ?? selectedCustomer?.walletValue ?? 0)}
          customerPhone={selectedCustomer?.mobileNumber ?? selectedCustomer?.phoneNumber}
          existingPayments={currentPayments}
          onUpdatePayments={handleUpdatePayments}
          onComplete={handlePaymentComplete}
          onClose={() => {
            setIsPaymentWindowOpen(false);
            focusSearchInput();
          }}
          isSubmitting={isSubmittingTransaction}
        />
      )}

      {completedInvoice && (
        <InvoiceBill invoice={completedInvoice} onClose={handleCloseReceipt} />
      )}

    </aside>
  );
}

export default BillingSection;