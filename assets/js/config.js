/*
 * Public frontend configuration.
 * Do not place passwords, tokens, password hashes, pepper values,
 * private spreadsheet IDs, or internal Drive IDs in this file.
 *
 * The API remains disconnected until the read-only public service is
 * implemented and security-tested on the server side.
 */
window.PPSM_CONFIG = Object.freeze({
  appName: "Northern Province Sports Management",
  provinceName: "Northern Province",
  apiBaseUrl: "",
  apiPrefix: "/api/public/v1",
  previewMode: true,
  appVersion: "0.1.1"
});
