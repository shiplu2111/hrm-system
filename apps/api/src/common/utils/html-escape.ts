/**
 * Escapes HTML special characters in untrusted user input before interpolation
 * into HTML email templates or markup strings.
 */
export function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Removes CR, LF, and NUL characters from single-line header fields (e.g. email Subject)
 * to prevent SMTP/MIME header injection.
 */
export function stripHeaderInjection(raw: string): string {
  return raw.replace(/[\r\n\0]+/g, ' ').trim();
}
