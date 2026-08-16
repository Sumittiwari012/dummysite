// -----------------------------------------------------------------------
// The single base voucher design. Every color, font, illustration layer,
// text position, QR position/size, and the physical print size (mm) live
// on this object and are editable in the studio. Nothing here is fixed.
// -----------------------------------------------------------------------
export function baseDesign() {
  return {
    name: 'Untitled voucher',
    widthMM: 152.4, // 6in
    heightMM: 76.2, // 3in
    colors: {
      accent: '#B9762E',
      accentDark: '#8F5720',
      tint: '#FBF3E8',
      onDark: '#FFFFFF',
    },
    fontDisplay: "'Space Grotesk', sans-serif",
    fontBody: "'Inter', sans-serif",
    layers: {
       backgroundPattern: 'texture',
       backgroundPatternColor: null,
       backgroundPatternOpacity: null,
      backgroundImage: null, // null = no image; otherwise an image URL
      backgroundImageOpacity: null, // null = fully opaque (1); 0–1 otherwise
       sidePanelPattern: 'none',
       sidePanelPatternColor: null,
       sidePanelPatternOpacity: null,
       sidePanel: true,
       dots: true,
       ribbonStyle: 'diagonal',
       ribbonColor: null,
       frame: true,
     },
    cornerFlag: { visible: true, text: 'LOREM IPSUM', x: 23, y: 10.5, width: 46, color: null },
    headline: { visible: true, text: 'SAVE', x: 10, y: 32, fontSize: 15, color: null },
    subtitle: { visible: true, text: 'VOUCHER', x: 10, y: 41, fontSize: 5.5, color: null },
    expiry: { visible: true, text: 'VALID THRU 12/31/26', x: 10, y: 51, fontSize: 5, color: null },
    qr: { visible: true, value: 'https://yourstore.com/redeem', x: 10, y: 57, size: 17, color: null },
    qrLabel: { visible: true, line1: 'SCAN TO', line2: 'REDEEM', x: 30, y: 64, fontSize: 4.3, color: null },
    terms: { visible: true, text: 'Terms & conditions apply. Not valid with other offers.', x: 10, y: 93, fontSize: 3.3, color: null },
    medallion: {
      visible: true, cx: 121, cy: 50, r: 22,
      value: '25%', valueFontSize: 10,
      label: 'OFF', labelFontSize: 5.5,
      fill: null, stroke: null,
    },
  }
}

export const ELEMENT_POS_KEYS = {
  cornerFlag: ['x', 'y'],
  headline: ['x', 'y'],
  subtitle: ['x', 'y'],
  expiry: ['x', 'y'],
  qr: ['x', 'y'],
  qrLabel: ['x', 'y'],
  terms: ['x', 'y'],
  medallion: ['cx', 'cy'],
}

export const ELEMENT_LABELS = {
  cornerFlag: 'Corner flag',
  headline: 'Headline word',
  subtitle: 'Subtitle label',
  expiry: 'Expiry date',
  qr: 'QR code',
  qrLabel: 'QR caption',
  terms: 'Terms text',
  medallion: 'Value medallion',
}

export const DISPLAY_FONTS = [
  { label: 'Space Grotesk', value: "'Space Grotesk', sans-serif" },
  { label: 'Fraunces', value: "'Fraunces', serif" },
  { label: 'Playfair Display', value: "'Playfair Display', serif" },
  { label: 'IBM Plex Mono', value: "'IBM Plex Mono', monospace" },
]

export const BODY_FONTS = [
  { label: 'Inter', value: "'Inter', sans-serif" },
  { label: 'Manrope', value: "'Manrope', sans-serif" },
  { label: 'IBM Plex Sans', value: "'IBM Plex Sans', sans-serif" },
  { label: 'Source Serif 4', value: "'Source Serif 4', serif" },
]

export const SIZE_PRESETS = [
  { label: '3" x 6"', widthMM: 152.4, heightMM: 76.2 },
  { label: 'Credit card', widthMM: 85.6, heightMM: 54 },
  { label: 'A6', widthMM: 148, heightMM: 105 },
  { label: 'Square', widthMM: 100, heightMM: 100 },
]

export function round1(n) {
  return Math.round(n * 10) / 10
}