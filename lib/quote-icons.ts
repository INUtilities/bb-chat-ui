// Lucide 0.300.0 icons/quote.svg (ISC), rotated and centered at 85% for an opening quote; see THIRD_PARTY_NOTICES.md.
const QUOTE_ICON = encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><g transform="translate(1.8 1.8) scale(.85) rotate(180 12 12)"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/><path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></g></svg>`,
);
export const QUOTE_MARK_MASK = `url("data:image/svg+xml,${QUOTE_ICON}") center / contain no-repeat`;

// Lucide SVG 경로를 공통 CSS 알파 마스크로 변환한다.
function quoteMask(paths: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}") center / contain no-repeat`;
}

// Lucide 0.300.0 icons/message-square.svg (ISC); see THIRD_PARTY_NOTICES.md.
export const QUOTE_MESSAGE_MASK = quoteMask('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>');
// Lucide 0.300.0 icons/code.svg (ISC), shared with code block headers; see THIRD_PARTY_NOTICES.md.
export const QUOTE_CODE_MASK = quoteMask('<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>');
// Lucide 0.300.0 icons/file.svg (ISC), shared by file mentions and attachment chips; see THIRD_PARTY_NOTICES.md.
export const REFERENCE_FILE_MASK = quoteMask('<g transform="translate(1.8 1.8) scale(.85)"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></g>');
