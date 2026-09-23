/* Category glyphs. Inlined rather than shipped as ten files under assets/icons/
   so a pin costs no extra request and inherits its colour from currentColor.
   All drawn on a 24x24 grid, as solid silhouettes that stay legible at 14px
   inside a map pin. */
export const ICONS = {
  /* Shikhara over a plinth */
  temple: '<path d="M12 2.2 14.1 6h-1.3l1.9 3.4h-1.2L15.6 13H8.4l2.1-3.6H9.3L11.2 6H9.9zM6.6 14.2h10.8v1.9H6.6zM5.2 17.1h13.6V19H5.2zM3.6 20.1h16.8V22H3.6z"/>',
  /* Afargan urn with flame — Zoroastrian */
  'fire-temple': '<path d="M12 1.6c1.5 2.3 2.4 4 2.4 5.3a2.4 2.4 0 0 1-1 2c.2-.9-.2-1.8-1-2.5-.3 1.6-1 2.3-2 3.2-.8.7-1.2 1.5-1.2 2.4a3.8 3.8 0 0 0 2.8 3.5c-2.9-.2-5-2.2-5-4.9 0-3.4 3.4-4.8 5-9zM6.8 15.8h10.4v1.9H6.8zM8.4 18.6h7.2v1.1H8.4zM5.6 20.6h12.8V22H5.6z"/>',
  /* Stupa: dome, harmika, chattra spire */
  vihara: '<path d="M11.4 1.3h1.2v2.1h1.5v1.3h-1.5v1.4h2.2v1.3H9.2V6.1h2.2V4.7H9.9V3.4h1.5zM12 8.6c3.2 0 5.8 2.4 5.8 5.4v1.1H6.2v-1.1c0-3 2.6-5.4 5.8-5.4zM4.9 16.4h14.2v2.1H4.9zM3.4 19.4h17.2V22H3.4z"/>',
  /* Jain shikhara with kalash and a stepped base */
  'jain-temple': '<path d="M11.4 1.2h1.2v1.5h1.3V4h-1.3v1.2h-1.2V4h-1.3V2.7h1.3zM12 6.1c1.9 1.6 3 3.9 3.2 6.9H8.8c.2-3 1.3-5.3 3.2-6.9zM6.9 14.2h10.2v2H6.9zM5.5 17.1h13v2h-13zM3.9 20h16.2V22H3.9z"/>',
  /* Rock face cut back to a pillared facade with an arched opening */
  cave: '<path d="M2.4 20.1c0-6.5 1.9-11.4 4.6-14.6C9.1 3 11.2 1.9 12 1.9s2.9 1.1 5 3.6c2.7 3.2 4.6 8.1 4.6 14.6v1.6h-5.3v-7.4a4.3 4.3 0 0 0-8.6 0v7.4H2.4zM8.9 22v-7.3a3.1 3.1 0 0 1 6.2 0V22z" fill-rule="evenodd"/>',
  /* Dome and a single minaret — no crescent, kept architectural */
  mosque: '<path d="M18.6 3.1c.45 0 .8.36.8.8V9h-1.6V3.9c0-.44.36-.8.8-.8zM9.6 4.6c2.6 1.5 4.2 3.5 4.2 5.6v.5H5.4v-.5c0-2.1 1.6-4.1 4.2-5.6zM4.3 12h14v2.4h-14zM3.2 15.6h16.2v2.3H3.2zM2.4 19.1h17.8V22H2.4z"/>',
  /* Cross over a gabled nave */
  church: '<path d="M11.2 2h1.6v2.1h2v1.6h-2v2.6h-1.6V5.7h-2V4.1h2zM12 9.1l5.6 4.1v.8H6.4v-.8zM5.4 15.2h13.2v2.3H5.4zM4.2 18.7h15.6V22H4.2z"/>',
  /* Gabled hall beside a clock tower — Paradesi, not a generic emblem */
  synagogue: '<path d="M4.6 4.1h3.8v4.6H4.6zM5.9 2.2h1.2v1.5H5.9zM3.8 9.3h5.4v1.9H3.8zM4.6 11.8h3.8V22H4.6zM14.6 7.4l5.8 3.3v.8h-11.6v-.8zM10.2 12.4h8.8V22h-2.7v-3.6a1.7 1.7 0 0 0-3.4 0V22h-2.7zM2.6 20.3h18.8V22H2.6z"/>',
  /* Crenellated curtain wall with a gate */
  fort: '<path d="M3 7h2.6v1.9h2.1V7h2.6v1.9h2.1V7h2.6v1.9h2.1V7H21v4.1H3zM3 12.4h18V22h-6.1v-4.4a2.9 2.9 0 0 0-5.8 0V22H3z"/>',
  /* Tiered pavilion with a finial */
  palace: '<path d="M11.4 1.9h1.2v1.7h1.6v1.4H10V3.6h1.4zM12 6.2l5.4 3.3v.7H6.6v-.7zM4.6 11.3h14.8v2.2H4.6zM6 14.7h12V22h-4v-3.5a2 2 0 0 0-4 0V22H6zM3.1 19.9h17.8V22H3.1z"/>',
  /* Anchor */
  port: '<path d="M11.1 3.6a2 2 0 1 1 1.8 3.1v2h2.6v1.7h-2.6v7.3a6.3 6.3 0 0 0 4.5-4.4l-1.8.5 2.6-3.6 2.6 3.6-1.7-.5A8.1 8.1 0 0 1 12 21.2a8.1 8.1 0 0 1-7.1-7.9l-1.7.5 2.6-3.6L8.4 13l-1.8-.5a6.3 6.3 0 0 0 4.5 4.4V9.4H8.5V7.7h2.6v-2a2 2 0 0 1-.8-1.6z"/>',
  /* Obelisk on a stepped base */
  monument: '<path d="M10.6 2.4 12 1l1.4 1.4v12.1h-2.8zM8.9 16.1h6.2v2.2H8.9zM6.9 18.9h10.2V22H6.9z"/>',
  /* Fallen column and capital */
  archaeological: '<path d="M4.4 3.5h6.9v2.1H4.4zM5.8 6.4h4.1v9.4H5.8zM3.6 16.6h8.5v2.2H3.6zM2.6 19.6h10.5V22H2.6zM14.6 12.4l6.6 2-.6 2-6.6-2zM15.3 16.2l5.9 1.8-.6 2-5.9-1.8z"/>',
  /* Onion dome on a plinth, with a finial — mausoleum */
  tomb: '<path d="M11.5.9h1v1.9h-1zM12 2.7c.5 1 1 1.6 1.7 2.3 1.7 1.6 2.5 3 2.5 4.5 0 1-.3 1.9-.9 2.6h-6.6a4.4 4.4 0 0 1-.9-2.6c0-1.5.8-2.9 2.5-4.5.7-.7 1.2-1.3 1.7-2.3zM7.4 13.1h9.2v1.9H7.4zM6.1 15.8h11.8V22h-4.1v-3.3a1.8 1.8 0 0 0-3.6 0V22H6.1zM3.3 19.1h1.9V22H3.3zM18.8 19.1h1.9V22h-1.9z"/>',
  /* Skyline of an urban ensemble */
  urban: '<path d="M12.1 1.7l1.4 2.6h-2.8zM2.5 9.6h5.9V22H2.5zM9.9 5.5h4.4V22H9.9zM15.8 12.2h5.7V22h-5.7z"/>',
  /* Locomotive on a rail */
  railway: '<path d="M3.4 5.2h6.4v9H3.4zM10.6 8.2h4.6v6h-4.6zM15.8 6.2h2v8h-2zM2.2 14.6h19.4v2.2H2.2zM6.4 17.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM17 17.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zM1.6 20.6h20.8v1.4H1.6z"/>',
  /* Pedimented portico */
  museum: '<path d="M12 2.2 22 7.4v1.5H2V7.4zM4.8 10.4h2.4v8.2H4.8zM10.8 10.4h2.4v8.2h-2.4zM16.8 10.4h2.4v8.2h-2.4zM2.6 19.9h18.8V22H2.6z"/>',
  /* Headland above water */
  natural: '<path d="M2 13.6c1.6-4.1 3.7-6.6 6.3-7.3 2.9-.8 5.7.9 8.4 4.9l1.2 1.8H2zM2 16h3.3c.9 0 1.3.9 2.4.9S9.2 16 10.1 16s1.3.9 2.4.9S14 16 14.9 16s1.3.9 2.4.9 1.4-.9 2.3-.9H22v1.9h-2.4c-.9 0-1.3.9-2.4.9s-1.4-.9-2.3-.9-1.3.9-2.4.9-1.4-.9-2.3-.9-1.3.9-2.4.9-1.4-.9-2.3-.9H2z"/>'
};

/** Wrap a glyph in a 24x24 svg. */
export const iconSvg = (id) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[id] || ICONS.monument}</svg>`;

/** Teardrop map pin with the category glyph knocked into it. */
export function pinSvg(id, color) {
  return `<svg class="pin-svg" viewBox="0 0 32 42" aria-hidden="true">
    <path class="pin-body" d="M16 41.2C16 41.2 2.6 25.6 2.6 15.6a13.4 13.4 0 1 1 26.8 0c0 10-13.4 25.6-13.4 25.6z"
          fill="${color}" stroke="rgba(44,40,34,.55)" stroke-width="1.1"/>
    <circle cx="16" cy="15.3" r="9.6" fill="rgba(252,248,238,.93)"/>
    <g transform="translate(16 15.3) scale(.72) translate(-12 -12)" fill="${color}">${ICONS[id] || ICONS.monument}</g>
  </svg>`;
}
