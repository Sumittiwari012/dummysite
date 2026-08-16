import React from 'react'
import { Field, NumberField, ColorField } from './FormFields'
import { DISPLAY_FONTS, BODY_FONTS } from '../lib/design'

// Each text-bearing element stores its own `font` — picking a font
// here only ever changes this one element. The picker lives inline
// with the element instead of a shared Canvas panel section.
function FontField({ label, value, options, onChange }) {
  return (
    <Field label={label}>
      <select className="vs-input" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((f) => (
          <option key={f.value} value={f.value}>{f.label}</option>
        ))}
      </select>
    </Field>
  )
}

export function ElementFields({ elKey, draft, updateDraft }) {
  const el = draft[elKey]
  const fallbackColor = draft.colors.accentDark

  if (elKey === 'qr') {
    return (
      <>
        <Field label="Redemption link / code">
          <input className="vs-input" type="text" value={el.value} onChange={(e) => updateDraft('qr.value', e.target.value)} />
        </Field>
        <div className="vs-field-row">
          <NumberField label="X" value={el.x} onChange={(v) => updateDraft('qr.x', v)} />
          <NumberField label="Y" value={el.y} onChange={(v) => updateDraft('qr.y', v)} />
        </div>
        <NumberField label="Size" value={el.size} min={6} onChange={(v) => updateDraft('qr.size', v)} />
        <ColorField label="Color" value={el.color} fallback={fallbackColor} onChange={(v) => updateDraft('qr.color', v)} onClear={() => updateDraft('qr.color', null)} />
      </>
    )
  }

  if (elKey === 'medallion') {
    return (
      <>
        <div className="vs-field-row">
          <NumberField label="Center X" value={el.cx} onChange={(v) => updateDraft('medallion.cx', v)} />
          <NumberField label="Center Y" value={el.cy} onChange={(v) => updateDraft('medallion.cy', v)} />
        </div>
        <NumberField label="Radius" value={el.r} min={5} onChange={(v) => updateDraft('medallion.r', v)} />
        <Field label="Value text">
          <input className="vs-input" type="text" value={el.value} onChange={(e) => updateDraft('medallion.value', e.target.value)} />
        </Field>
        <NumberField label="Value font size" value={el.valueFontSize} min={2} onChange={(v) => updateDraft('medallion.valueFontSize', v)} />
        <FontField label="Value font" value={el.valueFont} options={DISPLAY_FONTS} onChange={(v) => updateDraft('medallion.valueFont', v)} />
        <Field label="Label text">
          <input className="vs-input" type="text" value={el.label} onChange={(e) => updateDraft('medallion.label', e.target.value)} />
        </Field>
        <NumberField label="Label font size" value={el.labelFontSize} min={2} onChange={(v) => updateDraft('medallion.labelFontSize', v)} />
        <FontField label="Label font" value={el.labelFont} options={BODY_FONTS} onChange={(v) => updateDraft('medallion.labelFont', v)} />
        <ColorField label="Fill" value={el.fill} fallback={draft.colors.tint} onChange={(v) => updateDraft('medallion.fill', v)} onClear={() => updateDraft('medallion.fill', null)} />
        <ColorField label="Stroke / text" value={el.stroke} fallback={fallbackColor} onChange={(v) => updateDraft('medallion.stroke', v)} onClear={() => updateDraft('medallion.stroke', null)} />
      </>
    )
  }

  if (elKey === 'cornerFlag') {
    return (
      <>
        <Field label="Text">
          <input className="vs-input" type="text" value={el.text} onChange={(e) => updateDraft('cornerFlag.text', e.target.value)} />
        </Field>
        <div className="vs-field-row">
          <NumberField label="X" value={el.x} onChange={(v) => updateDraft('cornerFlag.x', v)} />
          <NumberField label="Y" value={el.y} onChange={(v) => updateDraft('cornerFlag.y', v)} />
        </div>
        <NumberField label="Flag width" value={el.width} min={20} onChange={(v) => updateDraft('cornerFlag.width', v)} />
        <FontField label="Font" value={el.font} options={BODY_FONTS} onChange={(v) => updateDraft('cornerFlag.font', v)} />
        <ColorField label="Text color" value={el.color} fallback={draft.colors.onDark} onChange={(v) => updateDraft('cornerFlag.color', v)} onClear={() => updateDraft('cornerFlag.color', null)} />
      </>
    )
  }

  if (elKey === 'qrLabel') {
    return (
      <>
        <Field label="Line 1">
          <input className="vs-input" type="text" value={el.line1} onChange={(e) => updateDraft('qrLabel.line1', e.target.value)} />
        </Field>
        <Field label="Line 2">
          <input className="vs-input" type="text" value={el.line2} onChange={(e) => updateDraft('qrLabel.line2', e.target.value)} />
        </Field>
        <div className="vs-field-row">
          <NumberField label="X" value={el.x} onChange={(v) => updateDraft('qrLabel.x', v)} />
          <NumberField label="Y" value={el.y} onChange={(v) => updateDraft('qrLabel.y', v)} />
        </div>
        <NumberField label="Font size" value={el.fontSize} min={2} onChange={(v) => updateDraft('qrLabel.fontSize', v)} />
        <FontField label="Font" value={el.font} options={BODY_FONTS} onChange={(v) => updateDraft('qrLabel.font', v)} />
        <ColorField label="Color" value={el.color} fallback={fallbackColor} onChange={(v) => updateDraft('qrLabel.color', v)} onClear={() => updateDraft('qrLabel.color', null)} />
      </>
    )
  }

  // headline, subtitle, expiry, terms share the same shape. Headline
  // defaults to a display-style font and the rest to a body-style font,
  // but each element's `font` is its own field — picking a font here
  // only ever changes this one element, never any other text on the voucher.
  const isDisplay = elKey === 'headline'
  return (
    <>
      <Field label="Text">
        <input className="vs-input" type="text" value={el.text} onChange={(e) => updateDraft(`${elKey}.text`, e.target.value)} />
      </Field>
      <div className="vs-field-row">
        <NumberField label="X" value={el.x} onChange={(v) => updateDraft(`${elKey}.x`, v)} />
        <NumberField label="Y" value={el.y} onChange={(v) => updateDraft(`${elKey}.y`, v)} />
      </div>
      <NumberField label="Font size" value={el.fontSize} min={2} onChange={(v) => updateDraft(`${elKey}.fontSize`, v)} />
      <FontField
        label="Font"
        value={el.font}
        options={isDisplay ? DISPLAY_FONTS : BODY_FONTS}
        onChange={(v) => updateDraft(`${elKey}.font`, v)}
      />
      <ColorField label="Color" value={el.color} fallback={fallbackColor} onChange={(v) => updateDraft(`${elKey}.color`, v)} onClear={() => updateDraft(`${elKey}.color`, null)} />
    </>
  )
}

export default ElementFields