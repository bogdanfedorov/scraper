window.SCRAPER_ADAPTERS = window.SCRAPER_ADAPTERS || [];

/**
 * @typedef {Object} Adapter
 * @property {string} label
 * @property {function(): boolean} match
 * @property {function(): boolean} isListingPage
 * @property {function(): string} title
 * @property {function(): string} company
 * @property {function(): string} description
 * @property {function(): string[]} [socialLinks]
 */

/**
 * Registers a new adapter for the scraper extension.
 * @param {Adapter} adapter - The adapter to register.
 * @returns {void}
 */
function registerAdapter(adapter) {
  window.SCRAPER_ADAPTERS.push(adapter);
}
