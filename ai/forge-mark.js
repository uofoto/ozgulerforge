// Oforge işareti: "Of" monogramı. Durumlar CSS ile sürülür (fm-loop, fm-once, fm-hot).
window.FORGE_MARK = '<svg class="fm" viewBox="0 0 32 32" fill="none" aria-hidden="true" focusable="false">' +
  '<defs>' +
    '<linearGradient id="ofGradMain" x1="3" y1="7" x2="17" y2="25" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0%" stop-color="#FBBF24"/>' +
      '<stop offset="52%" stop-color="#F97316"/>' +
      '<stop offset="100%" stop-color="#E11D48"/>' +
    '</linearGradient>' +
    '<linearGradient id="ofGradInner" x1="15" y1="8" x2="8" y2="24" gradientUnits="userSpaceOnUse">' +
      '<stop offset="0%" stop-color="#FB923C"/>' +
      '<stop offset="100%" stop-color="#EA580C" stop-opacity="0.85"/>' +
    '</linearGradient>' +
  '</defs>' +
  '<circle class="fm-heat" cx="13" cy="17" r="9.5" fill="#FB923C"/>' +
  '<g class="fm-of-mark">' +
    '<path d="M11.6 7.5C6.8 7.5 3.2 11.4 3.2 16.8C3.2 22.2 6.8 26 11.6 26C16.1 26 19.3 22.6 19.7 17.7H15.5C15.1 20.6 13.7 22.4 11.6 22.4C9.1 22.4 7.4 20.1 7.4 16.8C7.4 13.5 9.1 11.1 11.6 11.1C13.8 11.1 15.2 12.9 15.5 15.7H19.7C19.3 10.9 16.1 7.5 11.6 7.5Z" fill="url(#ofGradMain)"/>' +
    '<path d="M11.6 7.5C14.8 7.5 17.5 9.3 18.8 12.2C16.8 10.4 14.3 9.7 11.6 10.4C8.9 11.1 7.4 13.6 7.4 16.8C7.4 13.5 9.1 11.1 11.6 11.1Z" fill="url(#ofGradInner)"/>' +
    '<path d="M25.4 7.4C21.6 7.4 19.6 9.6 19.6 13.6V14.4H18.3C16.2 14.4 14.8 15.6 14.3 17.8C15.4 17.1 16.6 16.9 18.1 16.9H19.6V26H23.7V16.9H27.2V13.8H23.7V13.3C23.7 11.5 24.5 10.6 26.2 10.6C26.9 10.6 27.5 10.7 28 10.9L28.5 7.8C27.6 7.5 26.6 7.4 25.4 7.4Z" fill="#FFFFFF"/>' +
  '</g>' +
'</svg>';
window.hydrateForgeLogos = function (root) {
  (root || document).querySelectorAll('[data-forge-logo]:not([data-fm-ready])').forEach(function (el) {
    el.innerHTML = window.FORGE_MARK;
    el.setAttribute('data-fm-ready', '1');
    var m = el.getAttribute('data-fm');
    if (m) el.classList.add('fm-' + m);
  });
};
