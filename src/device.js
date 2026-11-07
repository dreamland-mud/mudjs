/* What kind of device this is. A leaf module: it imports nothing, so anything
 * can use it without an import cycle. */

/* Phones and tablets: their screen readers read the page by touch. */
export const IS_PHONE =
  /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
