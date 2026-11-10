/*
 * Northern Province Sports Management PWA configuration.
 *
 * Set apiEnabled to true only after the secure server API has been deployed
 * and tested. An empty apiBaseUrl means same-origin API requests.
 * Never place passwords, tokens, password hashes, salts, pepper values,
 * private spreadsheet IDs, or internal Drive IDs in this file.
 */
window.PPSM_CONFIG = Object.freeze({
  appName: "Northern Province Sports Management",
  provinceName: "Northern Province",
  apiEnabled: false,
  apiBaseUrl: "",
  publicApiPrefix: "/api/public/v1",
  authApiPrefix: "/api/auth/v1",
  adminApiPrefix: "/api/admin/v1",
  previewMode: true,
  appVersion: "0.1.2"
});
