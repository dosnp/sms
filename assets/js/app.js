(() => {
  "use strict";

  const config = window.PPSM_CONFIG || {};
  const app = document.getElementById("app");
  const year = document.getElementById("year");
  const installButton = document.getElementById("installButton");
  const publicNav = document.getElementById("publicNav");
  const headerActions = document.getElementById("headerActions");
  const siteFooter = document.getElementById("siteFooter");
  const SESSION_KEY = "ppsm_admin_session_v1";

  if (!app) {
    console.error("PPSM application mount point #app was not found.");
    return;
  }

  if (year) year.textContent = String(new Date().getFullYear());

  const districts = [
    { id: "JAF", code: "JAF", name: "Jaffna", slug: "jaffna", status: "ACTIVE" },
    { id: "KIL", code: "KIL", name: "Kilinochchi", slug: "kilinochchi", status: "PENDING" },
    { id: "MAN", code: "MAN", name: "Mannar", slug: "mannar", status: "PENDING" },
    { id: "MUL", code: "MUL", name: "Mullaitivu", slug: "mullaitivu", status: "PENDING" },
    { id: "VAV", code: "VAV", name: "Vavuniya", slug: "vavuniya", status: "PENDING" }
  ];

  // Only the existing Point Pedro division is known to be registered in the supplied setup.
  const previewDivisions = {
    jaffna: [
      { id: "JAFFNA-POINT-PEDRO", code: "VAN", name: "Point Pedro", slug: "point-pedro", status: "ACTIVE" }
    ]
  };

  const ROLE_LABELS = {
    DEVELOPER: "System Developer",
    PROVINCIAL_OFFICER: "Provincial Officer",
    DEPARTMENT_SPORTS_OFFICER: "Department Sports Officer",
    DISTRICT_OFFICER: "District Sports Officer",
    DIVISION_SPORTS_OFFICER: "Divisional Sports Officer"
  };

  const ADMIN_NAV = {
    DEVELOPER: [
      ["overview", "Overview", "▦"],
      ["districts", "Districts", "▤"],
      ["divisions", "Divisions", "▥"],
      ["officers", "Officer Accounts", "♟"],
      ["assignments", "Assignments", "◎"],
      ["transfers", "Transfers", "⇄"],
      ["reports", "Reports", "▧"],
      ["audit", "Audit Log", "◷"],
      ["settings", "Settings", "⚙"]
    ],
    PROVINCIAL_OFFICER: [
      ["overview", "Overview", "▦"],
      ["districts", "Districts", "▤"],
      ["divisions", "Divisions", "▥"],
      ["assignments", "Assignments", "◎"],
      ["transfers", "Transfers", "⇄"],
      ["reports", "Reports", "▧"]
    ],
    DEPARTMENT_SPORTS_OFFICER: [
      ["overview", "Overview", "▦"],
      ["districts", "Districts", "▤"],
      ["divisions", "Divisions", "▥"],
      ["assignments", "Assignments", "◎"],
      ["transfers", "Transfers", "⇄"],
      ["reports", "Reports", "▧"]
    ],
    DISTRICT_OFFICER: [
      ["overview", "Overview", "▦"],
      ["divisions", "Divisions", "▥"],
      ["assignments", "Assignments", "◎"],
      ["transfers", "Transfers", "⇄"],
      ["reports", "Reports", "▧"]
    ],
    DIVISION_SPORTS_OFFICER: [
      ["overview", "Overview", "▦"],
      ["division-workspace", "Division Workspace", "▥"]
    ]
  };

  let deferredInstallPrompt = null;
  let renderSequence = 0;
  let provinceDataCache = null;
  let adminSession = readStoredSession();

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[character]));
  }

  function safeDecode(value) {
    try { return decodeURIComponent(value); }
    catch (_) { return ""; }
  }

  function slugify(value) {
    return String(value || "").toLowerCase().trim()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  }

  function route() {
    const raw = (location.hash || "#/province").replace(/^#\/?/, "").split("?")[0];
    const parts = raw.split("/").filter(Boolean).map(safeDecode);
    if (!parts.length || parts[0] === "province") return { page: "province" };
    if (parts[0] === "districts") return { page: "districts" };
    if (parts[0] === "district" && parts[1]) return { page: "district", districtSlug: parts[1] };
    if (parts[0] === "division" && parts[1] && parts[2]) {
      return { page: "division", districtSlug: parts[1], divisionSlug: parts[2] };
    }
    if (parts[0] === "about") return { page: "about" };
    if (parts[0] === "admin") {
      return { page: "admin", adminPage: parts[1] || "overview" };
    }
    return { page: "not-found" };
  }

  function prefixUrl(prefix, path) {
    const base = String(config.apiBaseUrl || "").replace(/\/+$/, "");
    const cleanPrefix = String(prefix || "").replace(/^\/+|\/+$/g, "");
    const cleanPath = String(path || "").replace(/^\/+/, "");
    return base + "/" + [cleanPrefix, cleanPath].filter(Boolean).join("/");
  }

  async function readResponse(response) {
    let payload;
    try { payload = await response.json(); }
    catch (_) { payload = null; }
    if (!response.ok) {
      const message = payload && (payload.message || payload.error)
        ? (payload.message || payload.error)
        : "The service returned HTTP " + response.status + ".";
      const error = new Error(message);
      error.status = response.status;
      throw error;
    }
    if (payload && payload.success === false) {
      throw new Error(payload.message || "The service returned an error.");
    }
    return payload && payload.data !== undefined ? payload.data : payload;
  }

  async function publicApiGet(path) {
    if (!config.apiEnabled) return null;
    const response = await fetch(prefixUrl(config.publicApiPrefix || "/api/public/v1", path), {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
      credentials: "omit"
    });
    return readResponse(response);
  }

  async function authRequest(path, method, body, token) {
    if (!config.apiEnabled) throw new Error("The secure authentication service is not connected yet.");
    const headers = { "Accept": "application/json", "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;
    const response = await fetch(prefixUrl(config.authApiPrefix || "/api/auth/v1", path), {
      method: method || "POST",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "omit"
    });
    return readResponse(response);
  }

  async function adminRequest(path, method, body) {
    if (!config.apiEnabled) throw new Error("Admin API is not connected. The interface is ready, but live sign-in and administration remain disabled until the secure backend is deployed.");
    if (!adminSession || !adminSession.token) throw new Error("Your session has expired. Please sign in again.");
    const headers = { "Accept": "application/json", "Content-Type": "application/json", Authorization: "Bearer " + adminSession.token };
    const response = await fetch(prefixUrl(config.adminApiPrefix || "/api/admin/v1", path), {
      method: method || "GET",
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      credentials: "omit"
    });
    try {
      return await readResponse(response);
    } catch (error) {
      if (error.status === 401) {
        clearSession();
        location.hash = "#/admin/login";
      }
      throw error;
    }
  }

  function readStoredSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const value = JSON.parse(raw);
      return value && value.token && value.context ? value : null;
    } catch (_) { return null; }
  }

  function storeSession(value) {
    adminSession = value;
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(value)); } catch (_) {}
  }

  function clearSession() {
    adminSession = null;
    try { sessionStorage.removeItem(SESSION_KEY); } catch (_) {}
  }

  function isAdminRole(role) {
    return Object.prototype.hasOwnProperty.call(ADMIN_NAV, String(role || "").toUpperCase());
  }

  async function validateStoredSession() {
    if (!adminSession) return false;
    if (!config.apiEnabled) {
      clearSession();
      return false;
    }
    try {
      const fresh = await authRequest("session", "GET", undefined, adminSession.token);
      const context = fresh && (fresh.context || fresh.user || fresh);
      if (!context || !isAdminRole(context.role)) {
        clearSession();
        return false;
      }
      storeSession({ token: adminSession.token, context });
      return true;
    } catch (_) {
      clearSession();
      return false;
    }
  }

  function setPublicHeader(isAdmin) {
    if (publicNav) publicNav.hidden = !!isAdmin;
    if (siteFooter) siteFooter.hidden = !!isAdmin;
    if (headerActions) {
      const installMarkup = `<button id="installButton" class="install-button" type="button" ${deferredInstallPrompt ? "" : "hidden"}>Install app</button>`;
      headerActions.innerHTML = isAdmin
        ? `<a class="admin-public-link" href="#/province">View public portal</a><span class="admin-header-tag">Secure administration</span>`
        : `<span class="public-pill"><span class="status-dot"></span> Public portal</span><a class="header-admin-link" href="#/admin/login">Officer login</a>${installMarkup}`;
      if (!isAdmin) {
        const replacement = document.getElementById("installButton");
        if (replacement) replacement.addEventListener("click", handleInstallClick);
      }
    }
  }

  function setActivePublicNav(page) {
    document.querySelectorAll("[data-nav]").forEach(link => {
      const key = link.getAttribute("data-nav");
      const active =
        (page === "province" && key === "province") ||
        (["districts", "district", "division"].includes(page) && key === "districts") ||
        (page === "about" && key === "about");
      link.classList.toggle("active", active);
      if (active) link.setAttribute("aria-current", "page");
      else link.removeAttribute("aria-current");
    });
  }

  function breadcrumbs(items) {
    return `<div class="breadcrumbs">${items.map((item, index) => {
      const separator = index ? "<span aria-hidden=\"true\">›</span>" : "";
      return separator + (item.href
        ? `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a>`
        : `<strong>${escapeHtml(item.label)}</strong>`);
    }).join("")}</div>`;
  }

  function districtCard(district) {
    const slug = district.slug || slugify(district.name);
    const id = district.code || district.id || slug.slice(0, 3).toUpperCase();
    return `
      <a class="district-card" href="#/district/${encodeURIComponent(slug)}">
        <div class="card-top"><span class="district-icon">${escapeHtml(String(id).slice(0, 1))}</span><span class="card-arrow" aria-hidden="true">↗</span></div>
        <h3>${escapeHtml(district.name)}</h3>
        <p>District sports information and registered divisions.</p>
        <div class="card-meta"><span>${escapeHtml(id)}</span><span class="pill">View district</span></div>
      </a>`;
  }

  function renderProvince(data) {
    const list = data && Array.isArray(data.districts) ? data.districts : districts;
    provinceDataCache = data || { districts: list };
    app.innerHTML = `
      <section class="hero">
        <p class="eyebrow">Department of Sports · Provincial Office</p>
        <h1>Northern Province Sports Management</h1>
        <p>Explore public sports information by district and division. Select a district to view its registered divisions and the information approved for public access by the Department of Sports.</p>
        <div class="hero-actions">
          <a class="button button-light" href="#/districts">Explore districts <span aria-hidden="true">&nbsp;→</span></a>
          <a class="button button-outline" href="#/about">About the portal</a>
        </div>
      </section>
      <section aria-labelledby="district-title">
        <div class="section-heading"><div><h2 id="district-title">Five districts of Northern Province</h2><p>Select a district to continue to its public information page.</p></div><a class="text-link" href="#/districts">View all districts →</a></div>
        <div class="district-grid">${list.map(districtCard).join("")}</div>
      </section>
      <div class="info-strip"><span class="info-icon" aria-hidden="true">i</span><span>${config.previewMode
        ? "Preview version: public navigation is ready. Live district and division records will appear after the read-only public API is deployed and connected."
        : "Public records are retrieved from the Department of Sports public information service."}</span></div>`;
  }

  function renderDistrictDirectory() {
    const list = provinceDataCache && Array.isArray(provinceDataCache.districts) ? provinceDataCache.districts : districts;
    app.innerHTML = `
      <section class="page-head">${breadcrumbs([{ label: "Provincial Office", href: "#/province" }, { label: "Districts" }])}<h1>District directory</h1><p>Choose one of the five administrative districts in Northern Province.</p></section>
      <div class="district-grid">${list.map(districtCard).join("")}</div>`;
  }

  async function renderDistrict(slug) {
    const fallback = districts.find(item => item.slug === slug);
    if (!fallback) return renderNotFound();
    let data = null;
    let apiError = null;
    try { data = await publicApiGet("/districts/" + encodeURIComponent(slug)); }
    catch (error) { apiError = error; }

    const district = data && data.district ? data.district : fallback;
    const divisions = data && Array.isArray(data.divisions) ? data.divisions : (previewDivisions[slug] || []);
    const divisionMarkup = divisions.length ? `<div class="division-list">${divisions.map(division => {
      const divisionSlug = division.slug || slugify(division.name);
      return `<a class="division-link" href="#/division/${encodeURIComponent(slug)}/${encodeURIComponent(divisionSlug)}"><span><strong>${escapeHtml(division.name)}</strong><small>${escapeHtml(division.status || "Registered division")}</small></span><span class="card-arrow" aria-hidden="true">→</span></a>`;
    }).join("")}</div>` : `<div class="empty-state">No public division records are available for this district yet. Division names will appear after they are registered and approved for public viewing.</div>`;

    app.innerHTML = `
      <section class="page-head">${breadcrumbs([{ label: "Provincial Office", href: "#/province" }, { label: "Districts", href: "#/districts" }, { label: district.name }])}<h1>${escapeHtml(district.name)} District</h1><p>Public sports information and registered divisional connections for ${escapeHtml(district.name)} District.</p></section>
      <section class="panel"><h2>Divisions</h2><p>Select a division to view its public sports information.</p>${divisionMarkup}${config.previewMode || apiError ? `<div class="status-banner">Preview information only. The live public information API is not connected yet.</div>` : ""}</section>`;
  }

  async function renderDivision(districtSlug, divisionSlug) {
    const districtFallback = districts.find(item => item.slug === districtSlug);
    if (!districtFallback) return renderNotFound();
    let data = null;
    let apiError = null;
    try {
      data = await publicApiGet("/divisions/" + encodeURIComponent(districtSlug) + "/" + encodeURIComponent(divisionSlug));
    } catch (error) { apiError = error; }

    const preview = (previewDivisions[districtSlug] || []).find(item => item.slug === divisionSlug);
    const district = data && data.district ? data.district : districtFallback;
    const division = data && data.division ? data.division : preview;
    if (!division) return renderNotFound();

    const sections = data && Array.isArray(data.publicSections) ? data.publicSections : [];
    const sectionsMarkup = sections.length ? sections.map(section => `
      <div class="about-item"><strong>${escapeHtml(section.title || "Public information")}</strong><span>${escapeHtml(section.description || "")}</span></div>`).join("")
      : `<div class="empty-state">The division page is prepared. Approved sports records, notices, events and other public information will appear after the secure public API is connected.</div>`;

    app.innerHTML = `
      <section class="page-head">${breadcrumbs([{ label: "Provincial Office", href: "#/province" }, { label: "Districts", href: "#/districts" }, { label: district.name, href: "#/district/" + districtSlug }, { label: division.name }])}<h1>${escapeHtml(division.name)} Division</h1><p>${escapeHtml(district.name)} District · Northern Province</p></section>
      <div class="detail-grid"><section class="panel"><h2>Public division information</h2><p>${escapeHtml(division.publicDescription || "This is the public information page for this division.")}</p>${sectionsMarkup}</section>
      <aside class="panel"><h2>Division details</h2><ul class="detail-list"><li><strong>Province:</strong> Northern Province</li><li><strong>District:</strong> ${escapeHtml(district.name)}</li><li><strong>Division:</strong> ${escapeHtml(division.name)}</li><li><strong>Access:</strong> Public view</li></ul></aside></div>
      ${config.previewMode || apiError ? `<div class="status-banner">Preview page only. Official live records have not yet been connected.</div>` : ""}`;
  }

  function renderAbout() {
    app.innerHTML = `
      <section class="page-head">${breadcrumbs([{ label: "Provincial Office", href: "#/province" }, { label: "About" }])}<h1>About this public portal</h1><p>A public-facing information layer for the Northern Province Department of Sports.</p></section>
      <section class="panel"><h2>Purpose</h2><p>This portal makes approved sports information easier to access by province, district and division. Public visitors do not need an officer account to view information deliberately published for public access.</p>
      <div class="about-grid"><div class="about-item"><strong>Provincial level</strong><span>Province-wide public information and district directory.</span></div><div class="about-item"><strong>District level</strong><span>District profile and registered divisional connections.</span></div><div class="about-item"><strong>Divisional level</strong><span>Only information approved for public release by the relevant division.</span></div></div>
      <div class="info-strip"><span class="info-icon" aria-hidden="true">i</span><span>Private officer accounts, passwords, payment details and non-public personal records are not part of this public portal.</span></div></section>`;
  }

  function renderNotFound() {
    app.innerHTML = `<section class="panel"><h2>Page not found</h2><p>The requested public page does not exist or is not published.</p><a class="button button-light" href="#/province">Return to home</a></section>`;
  }

  function adminScopeLabel(context) {
    const level = String(context.scopeLevel || "").toUpperCase();
    if (level === "PROVINCIAL" || context.role === "DEVELOPER") return "Northern Province · All districts";
    if (level === "DISTRICT") return (context.district || "Assigned district") + " District";
    if (level === "DIVISION") return [context.division || "Assigned division", context.district || ""].filter(Boolean).join(" · ");
    return "Assigned scope";
  }

  function adminNavMarkup(role, activePage) {
    const items = ADMIN_NAV[role] || [];
    return items.map(([key, label, icon]) => `<a class="admin-nav-link ${activePage === key ? "active" : ""}" href="#/admin/${key}" ${activePage === key ? 'aria-current="page"' : ""}><span class="admin-nav-icon">${icon}</span><span>${label}</span></a>`).join("");
  }

  function renderAdminShell(context, activePage, content) {
    const role = String(context.role || "").toUpperCase();
    const roleLabel = ROLE_LABELS[role] || role.replace(/_/g, " ");
    setPublicHeader(true);
    app.className = "admin-shell";
    app.innerHTML = `
      <aside class="admin-sidebar">
        <div class="admin-brand"><span class="brand-mark">NP</span><span><strong>SPORTS MANAGEMENT</strong><small>NORTHERN PROVINCE</small></span></div>
        <div class="admin-side-label">ADMINISTRATION</div>
        <nav class="admin-nav" aria-label="Administration navigation">${adminNavMarkup(role, activePage)}</nav>
        <div class="admin-sidebar-foot"><span class="admin-avatar">${escapeHtml((context.fullName || context.username || "U").slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(context.fullName || context.username || "Officer")}</strong><small>${escapeHtml(roleLabel)}</small></span></div>
      </aside>
      <section class="admin-main"><header class="admin-topbar"><div><span class="admin-breadcrumb">Provincial Office</span><span class="admin-breadcrumb-sep">/</span><strong>${escapeHtml(activePage.replace(/-/g, " ").replace(/\b\w/g, x => x.toUpperCase()))}</strong></div><div class="admin-top-actions"><span class="admin-scope-pill">${escapeHtml(adminScopeLabel(context))}</span><button type="button" class="button button-small button-quiet" id="adminSignOut">Sign out</button></div></header><div class="admin-content">${content}</div></section>`;
    app.classList.add("admin-shell");
    const signOut = document.getElementById("adminSignOut");
    if (signOut) signOut.addEventListener("click", handleSignOut);
  }

  function adminPageHeading(title, subtitle) {
    return `<div class="admin-page-heading"><div><p class="admin-eyebrow">DEPARTMENT OF SPORTS · NORTHERN PROVINCE</p><h1>${escapeHtml(title)}</h1><p>${escapeHtml(subtitle)}</p></div></div>`;
  }

  function adminError(message) {
    return `<div class="admin-alert admin-alert-warning" role="status">${escapeHtml(message)}</div>`;
  }

  function adminStats(stats) {
    const entries = [
      ["Registered districts", stats.districts],
      ["Connected divisions", stats.divisions],
      ["Current assignments", stats.currentAssignments],
      ["Future assignments", stats.futureAssignments]
    ];
    return `<div class="admin-stat-grid">${entries.map(([label, value]) => `<article class="admin-stat-card"><span>${escapeHtml(label)}</span><strong>${value === undefined || value === null ? "—" : escapeHtml(value)}</strong></article>`).join("")}</div>`;
  }

  async function renderAdminOverview(context) {
    let overview = null;
    let error = null;
    try { overview = await adminRequest("/overview", "GET"); }
    catch (err) { error = err; }
    const stats = overview && overview.stats ? overview.stats : {};
    const scope = overview && overview.scope ? overview.scope : adminScopeLabel(context);
    const role = String(context.role || "").toUpperCase();
    let info = "Your administration access is restricted to the scope assigned to your account.";
    if (role === "DEVELOPER") info = "Developer access covers the provincial platform. Operational records remain within their registered district and division databases.";
    if (role === "PROVINCIAL_OFFICER" || role === "DEPARTMENT_SPORTS_OFFICER") info = "Provincial access covers Northern Province coordination, district administration and authorised officer assignments.";
    if (role === "DISTRICT_OFFICER") info = "District access is limited to your active district assignment. The server must enforce this scope on every request.";
    if (role === "DIVISION_SPORTS_OFFICER") info = "Divisional access is limited to your active division assignment. The server must enforce this scope on every request.";

    const apiReady = !!overview && !error;
    const content = `${adminPageHeading("Administration overview", "Central coordination and accountable officer records")}${adminStats(stats)}
      <div class="admin-overview-grid"><section class="admin-panel"><div class="admin-panel-head"><h2>Account and access scope</h2><span class="admin-status-pill">Authenticated</span></div><div class="admin-detail-row"><span>Officer</span><strong>${escapeHtml(context.fullName || context.username || "—")}</strong></div><div class="admin-detail-row"><span>Role</span><strong>${escapeHtml(ROLE_LABELS[role] || role)}</strong></div><div class="admin-detail-row"><span>Access scope</span><strong>${escapeHtml(scope)}</strong></div><div class="admin-detail-row"><span>Assignment</span><strong>${escapeHtml(context.assignmentId || "Not applicable")}</strong></div><p class="admin-muted">${escapeHtml(info)}</p></section>
      <section class="admin-panel"><div class="admin-panel-head"><h2>System readiness</h2></div><div class="admin-readiness"><span class="readiness-dot ${apiReady ? "ready" : "pending"}"></span><div><strong>${apiReady ? "Admin API responding" : "Backend integration pending"}</strong><p>${apiReady ? "The overview endpoint responded. All other endpoints and role-scope controls still require verification." : "The Public and Admin interfaces are prepared. Live sign-in and records remain unavailable until the secure backend is connected."}</p></div></div><div class="admin-readiness-note">Public pages remain read-only. Admin actions must be authorised and validated by the server, not by browser-side role checks.</div></section></div>
      ${error ? adminError(error.message) : ""}`;
    renderAdminShell(context, "overview", content);
  }

  async function renderAdminDistricts(context) {
    let list = [];
    let error = null;
    try {
      const result = await adminRequest("/districts", "GET");
      list = Array.isArray(result) ? result : (result && result.districts) || [];
    } catch (err) { error = err; }
    const canCreate = ["DEVELOPER", "PROVINCIAL_OFFICER", "DEPARTMENT_SPORTS_OFFICER"].includes(String(context.role).toUpperCase());
    const rows = list.length ? list.map(item => `<tr><td><strong>${escapeHtml(item.name || item.districtName || "—")}</strong><small>${escapeHtml(item.districtId || item.id || "")}</small></td><td>${escapeHtml(item.code || item.districtCode || "—")}</td><td><span class="table-status">${escapeHtml(item.status || "—")}</span></td></tr>`).join("") : `<tr><td colspan="3" class="table-empty">${error ? "District records could not be loaded." : "No district records returned by the service."}</td></tr>`;
    const registeredCodes = new Set(list.map(item => String(item.code || item.districtCode || "").toUpperCase()));
    const unregisteredDistricts = districts.filter(item => !registeredCodes.has(item.code));
    const form = canCreate ? `<form class="admin-form" id="createDistrictForm"><h3>Register district</h3><label for="districtCode">Official district</label><select id="districtCode" name="districtCode" required ${unregisteredDistricts.length ? "" : "disabled"}><option value="">${unregisteredDistricts.length ? "Select an unregistered district" : "All five districts are registered"}</option>${unregisteredDistricts.map(item => `<option value="${item.code}">${item.name}</option>`).join("")}</select><button class="button button-primary" type="submit" ${unregisteredDistricts.length ? "" : "disabled"}>Create district</button><p class="admin-form-note">The server validates the official district catalogue and prevents duplicate registrations.</p></form>` : "";
    const content = `${adminPageHeading("District management", "Register and manage the five districts of Northern Province")}<section class="admin-panel"><div class="admin-panel-head"><h2>District registry</h2><span class="admin-count">${list.length} records</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>District</th><th>Code</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>${form}${error ? adminError(error.message) : ""}`;
    renderAdminShell(context, "districts", content);
    const formElement = document.getElementById("createDistrictForm");
    if (formElement) formElement.addEventListener("submit", async event => {
      event.preventDefault();
      const code = formElement.elements.districtCode.value;
      const district = districts.find(item => item.code === code);
      if (!district) return;
      const button = formElement.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "Creating…";
      try {
        await adminRequest("/districts", "POST", { districtCode: district.code, districtName: district.name });
        await renderAdminDistricts(context);
      } catch (err) {
        const notice = document.createElement("div");
        notice.className = "admin-alert admin-alert-warning";
        notice.textContent = err.message;
        formElement.appendChild(notice);
        button.disabled = false;
        button.textContent = "Create district";
      }
    });
  }

  async function renderAdminDivisions(context) {
    const role = String(context.role || "").toUpperCase();
    let districtList = [];
    let districtId = String(context.districtId || "");
    let list = [];
    let catalog = [];
    let error = null;
    const isProvincial = ["PROVINCIAL_OFFICER", "DEPARTMENT_SPORTS_OFFICER"].includes(role);
    if (role === "DEVELOPER") {
      try {
        const result = await adminRequest("/districts", "GET");
        districtList = Array.isArray(result) ? result : (result && result.districts) || [];
      } catch (err) { error = err; }
      const params = new URLSearchParams(location.hash.split("?")[1] || "");
      districtId = params.get("districtId") || districtId || (districtList[0] && (districtList[0].districtId || districtList[0].id)) || "";
    }
    if (isProvincial) {
      try {
        const result = await adminRequest("/divisions", "GET");
        list = Array.isArray(result) ? result : (result && result.divisions) || [];
      } catch (err) { error = err; }
    } else if (districtId) {
      try {
        const result = await adminRequest("/divisions?districtId=" + encodeURIComponent(districtId), "GET");
        list = Array.isArray(result) ? result : (result && result.divisions) || [];
      } catch (err) { error = err; }
      try {
        const result = await adminRequest("/division-catalog?districtId=" + encodeURIComponent(districtId), "GET");
        catalog = Array.isArray(result) ? result : (result && result.catalog) || [];
      } catch (_) { catalog = []; }
    }
    const districtOptions = districtList.map(item => `<option value="${escapeHtml(item.districtId || item.id)}" ${(item.districtId || item.id) === districtId ? "selected" : ""}>${escapeHtml(item.name || item.districtName)}</option>`).join("");
    const selector = role === "DEVELOPER" ? `<form class="admin-filter-form" id="divisionDistrictFilter"><label for="divisionDistrict">District</label><select id="divisionDistrict" name="districtId">${districtOptions}</select><button class="button button-small button-quiet" type="submit">Load divisions</button></form>` : isProvincial ? `<div class="admin-scope-line">Scope: <strong>All Northern Province districts</strong></div>` : `<div class="admin-scope-line">Assigned district: <strong>${escapeHtml(context.district || "—")}</strong></div>`;
    const rows = list.length ? list.map(item => `<tr><td><strong>${escapeHtml(item.name || item.divisionName || "—")}</strong><small>${escapeHtml(item.divisionId || item.id || "")}</small></td><td>${escapeHtml(item.code || item.divisionCode || "—")}</td><td>${escapeHtml(item.officialName || "—")}</td><td><span class="table-status">${escapeHtml(item.status || "—")}</span></td></tr>`).join("") : `<tr><td colspan="4" class="table-empty">${error ? "Division records could not be loaded." : "No registered divisions were returned for this district."}</td></tr>`;
    const catalogOptions = catalog.map(item => `<option value="${escapeHtml(item.code || item.divisionCode)}">${escapeHtml(item.name || item.divisionName)} (${escapeHtml(item.code || item.divisionCode)})</option>`).join("");
    const canCreate = ["DEVELOPER", "DISTRICT_OFFICER"].includes(role);
    const createForm = canCreate && districtId ? `<form class="admin-form" id="createDivisionForm"><h3>Register division</h3><label for="divisionCode">Official division catalogue</label><select id="divisionCode" name="divisionCode" required><option value="">Select a division</option>${catalogOptions}</select><button class="button button-primary" type="submit" ${catalog.length ? "" : "disabled"}>Create division</button><p class="admin-form-note">Only divisions already present in the official district catalogue can be registered. The backend must reuse the shared Divisional App URL.</p></form>` : "";
    const content = `${adminPageHeading("Divisional connections", "View registered divisions within the authorised district scope")}${selector}<section class="admin-panel"><div class="admin-panel-head"><h2>Division registry</h2><span class="admin-count">${list.length} records</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Division</th><th>Code</th><th>Official name</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div></section>${createForm}${error ? adminError(error.message) : ""}`;
    renderAdminShell(context, "divisions", content);
    const filter = document.getElementById("divisionDistrictFilter");
    if (filter) filter.addEventListener("submit", event => {
      event.preventDefault();
      location.hash = "#/admin/divisions?districtId=" + encodeURIComponent(filter.elements.districtId.value);
    });
    const create = document.getElementById("createDivisionForm");
    if (create) create.addEventListener("submit", async event => {
      event.preventDefault();
      const button = create.querySelector("button[type=submit]");
      button.disabled = true;
      button.textContent = "Creating…";
      try {
        await adminRequest("/divisions", "POST", { districtId, divisionCode: create.elements.divisionCode.value });
        await renderAdminDivisions(context);
      } catch (err) {
        const notice = document.createElement("div");
        notice.className = "admin-alert admin-alert-warning";
        notice.textContent = err.message;
        create.appendChild(notice);
        button.disabled = false;
        button.textContent = "Create division";
      }
    });
  }

  async function renderAdminOfficers(context) {
    let list = [];
    let districtList = [];
    let error = null;
    try {
      const result = await adminRequest("/officers", "GET");
      list = Array.isArray(result) ? result : (result && result.officers) || [];
    } catch (err) { error = err; }
    try {
      const result = await adminRequest("/districts", "GET");
      districtList = Array.isArray(result) ? result : (result && result.districts) || [];
    } catch (_) { districtList = []; }

    const rows = list.length ? list.map(item => `<tr><td><strong>${escapeHtml(item.fullName || "—")}</strong><small>${escapeHtml(item.userId || "")}</small></td><td>${escapeHtml(item.username || "—")}</td><td>${escapeHtml(ROLE_LABELS[item.role] || item.role || "—")}</td><td><span class="table-status ${item.isActive ? "" : "inactive"}">${item.isActive ? "Active" : "Inactive"}</span></td><td>${escapeHtml(item.lastLoginAt || "—")}</td></tr>`).join("") : `<tr><td colspan="5" class="table-empty">${error ? "Officer accounts could not be loaded." : "No officer accounts were returned."}</td></tr>`;
    const districtOptions = districtList.map(item => `<option value="${escapeHtml(item.name || item.districtName || "")}" data-id="${escapeHtml(item.districtId || item.id || "")}">${escapeHtml(item.name || item.districtName || "")}</option>`).join("");
    const form = `<form class="admin-form admin-form-wide" id="createOfficerForm"><h3>Create officer account</h3><div class="admin-form-grid"><div><label for="officerFullName">Full name</label><input id="officerFullName" name="fullName" required maxlength="100"></div><div><label for="officerUsername">Username</label><input id="officerUsername" name="username" required minlength="3" maxlength="40" autocomplete="off"></div><div><label for="officerRole">Account role</label><select id="officerRole" name="role" required><option value="">Select role</option><option value="PROVINCIAL_OFFICER">Provincial Officer</option><option value="DEPARTMENT_SPORTS_OFFICER">Department Sports Officer</option><option value="DISTRICT_OFFICER">District Officer</option><option value="DIVISION_SPORTS_OFFICER">Division Sports Officer</option><option value="CLUB_AUTHORIZED">Club Authorized</option></select></div><div id="officerDistrictWrap" hidden><label for="officerDistrict">District</label><select id="officerDistrict" name="district"><option value="">Select district</option>${districtOptions}</select></div><div id="officerDivisionWrap" hidden><label for="officerDivision">Division</label><select id="officerDivision" name="division" disabled><option value="">Select district first</option></select></div><div id="officerClubWrap" hidden><label for="officerClub">Club name</label><input id="officerClub" name="clubName" maxlength="120"></div><div><label for="officerPassword">Temporary password</label><input id="officerPassword" name="password" type="password" minlength="12" autocomplete="new-password" required></div><div><label for="officerConfirmPassword">Confirm password</label><input id="officerConfirmPassword" name="confirmPassword" type="password" minlength="12" autocomplete="new-password" required></div></div><button class="button button-primary" type="submit">Create account</button><p class="admin-form-note">Use a password of at least 12 characters with letters and numbers. Creating an account does not automatically create an effective-dated District or Division assignment; record the officer's real assignment separately.</p><div id="officerFormMessage" class="login-message" role="alert"></div></form>`;
    const content = `${adminPageHeading("Officer accounts", "Manage central login identities and authorised roles")}<section class="admin-panel"><div class="admin-panel-head"><h2>Registered accounts</h2><span class="admin-count">${list.length} accounts</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Officer</th><th>Username</th><th>Role</th><th>Status</th><th>Last login</th></tr></thead><tbody>${rows}</tbody></table></div><p class="admin-form-note table-note">Password values, salts and hashes are never displayed in this table.</p></section>${form}${error ? adminError(error.message) : ""}`;
    renderAdminShell(context, "officers", content);

    const formElement = document.getElementById("createOfficerForm");
    if (!formElement) return;
    const roleSelect = formElement.elements.role;
    const districtSelect = formElement.elements.district;
    const divisionSelect = formElement.elements.division;
    const districtWrap = document.getElementById("officerDistrictWrap");
    const divisionWrap = document.getElementById("officerDivisionWrap");
    const clubWrap = document.getElementById("officerClubWrap");

    async function loadOfficerDivisions() {
      const selected = districtSelect.options[districtSelect.selectedIndex];
      const districtId = selected ? selected.dataset.id : "";
      divisionSelect.innerHTML = `<option value="">Loading divisions…</option>`;
      divisionSelect.disabled = true;
      if (!districtId) {
        divisionSelect.innerHTML = `<option value="">Select district first</option>`;
        return;
      }
      try {
        const result = await adminRequest("/divisions?districtId=" + encodeURIComponent(districtId), "GET");
        const items = Array.isArray(result) ? result : (result && result.divisions) || [];
        divisionSelect.innerHTML = `<option value="">Select division</option>` + items.map(item => `<option value="${escapeHtml(item.name || item.divisionName || "")}">${escapeHtml(item.name || item.divisionName || "")}</option>`).join("");
        divisionSelect.disabled = !items.length;
      } catch (err) {
        divisionSelect.innerHTML = `<option value="">Unable to load divisions</option>`;
        const message = document.getElementById("officerFormMessage");
        if (message) message.textContent = err.message;
      }
    }

    function updateOfficerFields() {
      const role = roleSelect.value;
      const needsDistrict = ["DISTRICT_OFFICER", "DIVISION_SPORTS_OFFICER"].includes(role);
      districtWrap.hidden = !needsDistrict;
      divisionWrap.hidden = role !== "DIVISION_SPORTS_OFFICER";
      clubWrap.hidden = role !== "CLUB_AUTHORIZED";
      districtSelect.required = needsDistrict;
      divisionSelect.required = role === "DIVISION_SPORTS_OFFICER";
      formElement.elements.clubName.required = role === "CLUB_AUTHORIZED";
      if (role === "DIVISION_SPORTS_OFFICER" && districtSelect.value) loadOfficerDivisions();
    }

    roleSelect.addEventListener("change", updateOfficerFields);
    districtSelect.addEventListener("change", () => {
      if (roleSelect.value === "DIVISION_SPORTS_OFFICER") loadOfficerDivisions();
    });
    updateOfficerFields();

    formElement.addEventListener("submit", async event => {
      event.preventDefault();
      const button = formElement.querySelector("button[type=submit]");
      const message = document.getElementById("officerFormMessage");
      button.disabled = true;
      button.textContent = "Creating…";
      try {
        const payload = {
          username: formElement.elements.username.value.trim(),
          fullName: formElement.elements.fullName.value.trim(),
          role: roleSelect.value,
          district: formElement.elements.district.value,
          division: formElement.elements.division.value,
          clubName: formElement.elements.clubName.value.trim(),
          password: formElement.elements.password.value,
          confirmPassword: formElement.elements.confirmPassword.value
        };
        await adminRequest("/officers", "POST", payload);
        await renderAdminOfficers(context);
        const notice = document.createElement("div");
        notice.className = "admin-alert admin-alert-info";
        notice.textContent = "Officer account created. Record the officer's effective-dated assignment before granting district or division access.";
        app.querySelector(".admin-content").prepend(notice);
      } catch (err) {
        if (message) message.textContent = err.message;
        button.disabled = false;
        button.textContent = "Create account";
      }
    });
  }

  async function renderAdminAssignments(context) {
    const role = String(context.role || "").toUpperCase();
    const isProvincial = ["DEVELOPER", "PROVINCIAL_OFFICER", "DEPARTMENT_SPORTS_OFFICER"].includes(role);
    let rows = [];
    let districtList = [];
    let error = null;
    try {
      const result = await adminRequest("/assignments", "GET");
      rows = Array.isArray(result) ? result : (result && result.items) || [];
    } catch (err) { error = err; }
    if (isProvincial) {
      try {
        const result = await adminRequest("/districts", "GET");
        districtList = Array.isArray(result) ? result : (result && result.districts) || [];
      } catch (_) { districtList = []; }
    }
    const districtId = String(context.districtId || "");
    const districtOptions = districtList.map(item => `<option value="${escapeHtml(item.districtId || item.id)}">${escapeHtml(item.name || item.districtName)}</option>`).join("");
    const rowsMarkup = rows.length ? rows.map(item => `<tr><td><strong>${escapeHtml(item.officer || item.fullName || item.userId || "—")}</strong><small>${escapeHtml(item.userId || "")}</small></td><td>${escapeHtml(ROLE_LABELS[item.role] || item.role || "—")}</td><td>${escapeHtml(item.district || "—")}</td><td>${escapeHtml(item.division || "—")}</td><td>${escapeHtml(item.effectiveFrom || "—")}</td><td><span class="table-status">${escapeHtml(item.status || "—")}</span></td></tr>`).join("") : `<tr><td colspan="6" class="table-empty">${error ? "Assignment records could not be loaded." : "No assignment records were returned."}</td></tr>`;
    const scopeOptions = role === "DEVELOPER" ? `<option value="DISTRICT">District Officer</option><option value="DIVISION">Divisional Sports Officer</option>` : isProvincial ? `<option value="DISTRICT">District Officer</option>` : `<option value="DIVISION">Divisional Sports Officer</option>`;
    const form = `<form class="admin-form admin-form-wide" id="createAssignmentForm"><h3>Register an officer assignment</h3><div class="admin-form-grid"><div><label for="assignmentScope">Assignment type</label><select id="assignmentScope" name="scopeLevel">${scopeOptions}</select></div><div><label for="assignmentUserId">Permanent User ID</label><input id="assignmentUserId" name="userId" required placeholder="USR-…"></div><div id="assignmentDistrictWrap" ${isProvincial ? "" : "hidden"}><label for="assignmentDistrict">District</label><select id="assignmentDistrict" name="districtId" ${isProvincial ? "required" : ""}><option value="">Select district</option>${districtOptions}</select></div><div id="assignmentDivisionWrap" hidden><label for="assignmentDivision">Division</label><select id="assignmentDivision" name="divisionId" disabled><option value="">Select district first</option></select></div><div><label for="assignmentEffectiveFrom">Effective from</label><input id="assignmentEffectiveFrom" name="effectiveFrom" type="date" required></div><div><label for="assignmentReference">Appointment / reference</label><input id="assignmentReference" name="transferReference" maxlength="120"></div></div><label for="assignmentNotes">Notes</label><input id="assignmentNotes" name="notes" maxlength="500"><button class="button button-primary" type="submit">Save assignment</button><p class="admin-form-note">Enter the actual appointment / assumption-of-duties date. Do not estimate or backdate an effective date without the official record.</p><div id="assignmentFormMessage" class="login-message" role="alert"></div></form>`;
    const content = `${adminPageHeading("Officer assignments", "Create and review effective-dated responsibility records")}<section class="admin-panel"><div class="admin-panel-head"><h2>Assignment register</h2><span class="admin-count">${rows.length} records</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Officer</th><th>Role</th><th>District</th><th>Division</th><th>Effective from</th><th>Status</th></tr></thead><tbody>${rowsMarkup}</tbody></table></div></section>${form}${error ? adminError(error.message) : ""}`;
    renderAdminShell(context, "assignments", content);

    const formElement = document.getElementById("createAssignmentForm");
    const scopeSelect = formElement.elements.scopeLevel;
    const districtSelect = formElement.elements.districtId;
    const divisionSelect = formElement.elements.divisionId;
    const districtWrap = document.getElementById("assignmentDistrictWrap");
    const divisionWrap = document.getElementById("assignmentDivisionWrap");
    async function loadAssignmentDivisions() {
      const selected = districtSelect.options[districtSelect.selectedIndex];
      const selectedDistrictId = selected ? selected.value : districtId;
      divisionSelect.disabled = true;
      divisionSelect.innerHTML = `<option value="">Loading divisions…</option>`;
      if (!selectedDistrictId) { divisionSelect.innerHTML = `<option value="">Select district first</option>`; return; }
      try {
        const result = await adminRequest("/divisions?districtId=" + encodeURIComponent(selectedDistrictId), "GET");
        const items = Array.isArray(result) ? result : (result && result.divisions) || [];
        divisionSelect.innerHTML = `<option value="">Select division</option>` + items.map(item => `<option value="${escapeHtml(item.divisionId || item.id)}">${escapeHtml(item.name || item.divisionName)}</option>`).join("");
        divisionSelect.disabled = !items.length;
      } catch (err) {
        divisionSelect.innerHTML = `<option value="">Unable to load divisions</option>`;
        document.getElementById("assignmentFormMessage").textContent = err.message;
      }
    }
    function updateAssignmentFields() {
      const divisionAssignment = scopeSelect.value === "DIVISION";
      districtWrap.hidden = !isProvincial;
      divisionWrap.hidden = !divisionAssignment;
      if (!isProvincial) districtSelect.value = districtId;
      if (divisionAssignment) loadAssignmentDivisions();
    }
    scopeSelect.addEventListener("change", updateAssignmentFields);
    districtSelect.addEventListener("change", () => { if (scopeSelect.value === "DIVISION") loadAssignmentDivisions(); });
    updateAssignmentFields();
    formElement.addEventListener("submit", async event => {
      event.preventDefault();
      const button = formElement.querySelector("button[type=submit]");
      const message = document.getElementById("assignmentFormMessage");
      button.disabled = true; button.textContent = "Saving…";
      try {
        const selectedDistrict = districtSelect.options[districtSelect.selectedIndex];
        const payload = {
          scopeLevel: scopeSelect.value,
          userId: formElement.elements.userId.value.trim(),
          districtId: isProvincial ? districtSelect.value : districtId,
          divisionId: formElement.elements.divisionId.value,
          effectiveFrom: formElement.elements.effectiveFrom.value,
          transferReference: formElement.elements.transferReference.value.trim(),
          notes: formElement.elements.notes.value.trim()
        };
        if (payload.scopeLevel === "DISTRICT" && !payload.districtId) throw new Error("Select a District.");
        if (payload.scopeLevel === "DIVISION" && !payload.divisionId) throw new Error("Select a Division.");
        await adminRequest("/assignments", "POST", payload);
        await renderAdminAssignments(context);
        const notice = document.createElement("div"); notice.className = "admin-alert admin-alert-info"; notice.textContent = "Officer assignment saved."; app.querySelector(".admin-content").prepend(notice);
      } catch (err) { message.textContent = err.message; button.disabled = false; button.textContent = "Save assignment"; }
    });
  }

  async function renderAdminTransfers(context) {
    const role = String(context.role || "").toUpperCase();
    const isProvincial = ["DEVELOPER", "PROVINCIAL_OFFICER", "DEPARTMENT_SPORTS_OFFICER"].includes(role);
    let rows = [];
    let districtList = [];
    let error = null;
    try { const result = await adminRequest("/transfers", "GET"); rows = Array.isArray(result) ? result : (result && result.items) || []; }
    catch (err) { error = err; }
    if (isProvincial) {
      try { const result = await adminRequest("/districts", "GET"); districtList = Array.isArray(result) ? result : (result && result.districts) || []; }
      catch (_) { districtList = []; }
    }
    const districtId = String(context.districtId || "");
    const districtOptions = districtList.map(item => `<option value="${escapeHtml(item.districtId || item.id)}">${escapeHtml(item.name || item.districtName)}</option>`).join("");
    const rowsMarkup = rows.length ? rows.map(item => `<tr><td><strong>${escapeHtml(item.officer || item.userId || "—")}</strong><small>${escapeHtml(item.userId || "")}</small></td><td>${escapeHtml(item.from || item.fromScope || "—")}</td><td>${escapeHtml(item.to || item.toScope || "—")}</td><td>${escapeHtml(item.effectiveFrom || "—")}</td><td><span class="table-status">${escapeHtml(item.status || "—")}</span></td></tr>`).join("") : `<tr><td colspan="5" class="table-empty">${error ? "Transfer records could not be loaded." : "No transfer records were returned."}</td></tr>`;
    const transferOptions = role === "DISTRICT_OFFICER" ? `<option value="DIVISION_WITHIN_DISTRICT">Transfer between divisions in my district</option>` : `<option value="DISTRICT">Transfer District Officer</option><option value="DIVISION_CROSS_DISTRICT">Transfer Divisional Officer across districts</option>`;
    const form = `<form class="admin-form admin-form-wide" id="createTransferForm"><h3>Record officer transfer</h3><div class="admin-form-grid"><div><label for="transferType">Transfer type</label><select id="transferType" name="transferType">${transferOptions}</select></div><div><label for="transferUserId">Permanent User ID</label><input id="transferUserId" name="userId" required placeholder="USR-…"></div><div id="transferDistrictWrap" ${isProvincial ? "" : "hidden"}><label for="transferDistrict">Target district</label><select id="transferDistrict" name="targetDistrictId"><option value="">Select district</option>${districtOptions}</select></div><div id="transferDivisionWrap" hidden><label for="transferDivision">Target division</label><select id="transferDivision" name="targetDivisionId" disabled><option value="">Select district first</option></select></div><div><label for="transferEffectiveFrom">Effective from</label><input id="transferEffectiveFrom" name="effectiveFrom" type="date" required></div><div><label for="transferReference">Transfer reference</label><input id="transferReference" name="transferReference" maxlength="120"></div></div><label for="transferNotes">Notes</label><input id="transferNotes" name="notes" maxlength="500"><button class="button button-primary" type="submit">Save transfer</button><p class="admin-form-note">The server checks the officer's current assignment and prevents invalid or overlapping transfers. Cross-district transfers require Provincial authority.</p><div id="transferFormMessage" class="login-message" role="alert"></div></form>`;
    const content = `${adminPageHeading("Officer transfers", "Record effective-dated transfers without rewriting historical responsibility")}<section class="admin-panel"><div class="admin-panel-head"><h2>Transfer history</h2><span class="admin-count">${rows.length} records</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Officer</th><th>From</th><th>To</th><th>Effective date</th><th>Status</th></tr></thead><tbody>${rowsMarkup}</tbody></table></div></section>${form}${error ? adminError(error.message) : ""}`;
    renderAdminShell(context, "transfers", content);

    const formElement = document.getElementById("createTransferForm");
    const typeSelect = formElement.elements.transferType;
    const districtSelect = formElement.elements.targetDistrictId;
    const divisionSelect = formElement.elements.targetDivisionId;
    const districtWrap = document.getElementById("transferDistrictWrap");
    const divisionWrap = document.getElementById("transferDivisionWrap");
    async function loadTransferDivisions() {
      const selected = districtSelect.options[districtSelect.selectedIndex];
      const selectedDistrictId = selected ? selected.value : districtId;
      divisionSelect.disabled = true;
      divisionSelect.innerHTML = `<option value="">Loading divisions…</option>`;
      if (!selectedDistrictId) { divisionSelect.innerHTML = `<option value="">Select district first</option>`; return; }
      try {
        const result = await adminRequest("/divisions?districtId=" + encodeURIComponent(selectedDistrictId), "GET");
        const items = Array.isArray(result) ? result : (result && result.divisions) || [];
        divisionSelect.innerHTML = `<option value="">Select division</option>` + items.map(item => `<option value="${escapeHtml(item.divisionId || item.id)}">${escapeHtml(item.name || item.divisionName)}</option>`).join("");
        divisionSelect.disabled = !items.length;
      } catch (err) { divisionSelect.innerHTML = `<option value="">Unable to load divisions</option>`; document.getElementById("transferFormMessage").textContent = err.message; }
    }
    function updateTransferFields() {
      const type = typeSelect.value;
      const crossDivision = type === "DIVISION_CROSS_DISTRICT";
      const withinDivision = type === "DIVISION_WITHIN_DISTRICT";
      districtWrap.hidden = !isProvincial || withinDivision;
      divisionWrap.hidden = !(crossDivision || withinDivision);
      if (withinDivision) loadTransferDivisions();
      else if (crossDivision && districtSelect.value) loadTransferDivisions();
    }
    typeSelect.addEventListener("change", updateTransferFields);
    districtSelect.addEventListener("change", () => { if (typeSelect.value === "DIVISION_CROSS_DISTRICT") loadTransferDivisions(); });
    updateTransferFields();
    formElement.addEventListener("submit", async event => {
      event.preventDefault();
      const button = formElement.querySelector("button[type=submit]");
      const message = document.getElementById("transferFormMessage");
      button.disabled = true; button.textContent = "Saving…";
      try {
        const payload = {
          transferType: typeSelect.value,
          userId: formElement.elements.userId.value.trim(),
          targetDistrictId: isProvincial ? districtSelect.value : districtId,
          targetDivisionId: divisionSelect.value,
          effectiveFrom: formElement.elements.effectiveFrom.value,
          transferReference: formElement.elements.transferReference.value.trim(),
          notes: formElement.elements.notes.value.trim()
        };
        if (payload.transferType === "DISTRICT" && !payload.targetDistrictId) throw new Error("Select the target District.");
        if (payload.transferType !== "DISTRICT" && !payload.targetDivisionId) throw new Error("Select the target Division.");
        await adminRequest("/transfers", "POST", payload);
        await renderAdminTransfers(context);
        const notice = document.createElement("div"); notice.className = "admin-alert admin-alert-info"; notice.textContent = "Officer transfer saved."; app.querySelector(".admin-content").prepend(notice);
      } catch (err) { message.textContent = err.message; button.disabled = false; button.textContent = "Save transfer"; }
    });
  }

  async function renderAdminDataPage(context, page, title, subtitle, endpoint, columns) {
    let rows = [];
    let error = null;
    try {
      const result = await adminRequest(endpoint, "GET");
      rows = Array.isArray(result) ? result : (result && result.items) || [];
    } catch (err) { error = err; }
    const body = rows.length ? rows.map(row => `<tr>${columns.map(column => `<td>${escapeHtml(row[column.key] ?? "—")}</td>`).join("")}</tr>`).join("") : `<tr><td colspan="${columns.length}" class="table-empty">${error ? "This data service is not available." : "No records were returned."}</td></tr>`;
    const content = `${adminPageHeading(title, subtitle)}<section class="admin-panel"><div class="admin-panel-head"><h2>${escapeHtml(title)}</h2><span class="admin-count">${rows.length} records</span></div><div class="admin-table-wrap"><table class="admin-table"><thead><tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join("")}</tr></thead><tbody>${body}</tbody></table></div></section>${error ? adminError(error.message) : ""}`;
    renderAdminShell(context, page, content);
  }

  function renderDivisionWorkspace(context) {
    const content = `${adminPageHeading("Division workspace", "Your assigned divisional access")}
      <section class="admin-panel"><div class="admin-panel-head"><h2>Active division assignment</h2><span class="admin-status-pill">Scope restricted</span></div><div class="admin-detail-row"><span>District</span><strong>${escapeHtml(context.district || "—")}</strong></div><div class="admin-detail-row"><span>Division</span><strong>${escapeHtml(context.division || "—")}</strong></div><div class="admin-detail-row"><span>Assignment reference</span><strong>${escapeHtml(context.assignmentId || "—")}</strong></div><div class="admin-alert admin-alert-info">The divisional operational modules remain in the existing divisional application. This portal does not expose another division's records.</div></section>`;
    renderAdminShell(context, "division-workspace", content);
  }

  function renderAdminLogin() {
    setPublicHeader(false);
    app.className = "app-shell admin-login-shell";
    const connected = !!config.apiEnabled;
    app.innerHTML = `
      <section class="login-layout"><div class="login-intro"><p class="admin-eyebrow">DEPARTMENT OF SPORTS · NORTHERN PROVINCE</p><h1>Officer administration</h1><p>Secure access for authorised provincial, district and divisional officers. Public visitors can continue without signing in.</p><a class="login-public-link" href="#/province">← Return to public portal</a></div>
      <form class="login-card" id="adminLoginForm"><div class="login-card-mark">NP</div><h2>Sign in</h2><p>Use your Department Sports Management account.</p><label for="loginUsername">Username</label><input id="loginUsername" name="username" type="text" autocomplete="username" required ${connected ? "" : "disabled"}><label for="loginPassword">Password</label><input id="loginPassword" name="password" type="password" autocomplete="current-password" required ${connected ? "" : "disabled"}><button class="button button-primary button-full" type="submit" ${connected ? "" : "disabled"}>Sign in securely</button>
      ${connected ? `<div class="login-connection"><span class="status-dot"></span> Authentication service enabled</div>` : `<div class="admin-alert admin-alert-warning">Backend connection is not configured yet. This login screen is ready, but sign-in is disabled until the secure authentication API is deployed. There are no demo credentials.</div>`}<div id="loginMessage" class="login-message" role="alert"></div></form></section>`;
    const form = document.getElementById("adminLoginForm");
    if (form) form.addEventListener("submit", handleLogin);
  }

  async function handleLogin(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const message = document.getElementById("loginMessage");
    const button = form.querySelector("button[type=submit]");
    const username = String(form.elements.username.value || "").trim();
    const password = String(form.elements.password.value || "");
    button.disabled = true;
    button.textContent = "Signing in…";
    if (message) message.textContent = "";
    try {
      const result = await authRequest("login", "POST", { username, password });
      const token = result && (result.token || result.sessionToken);
      const context = result && (result.context || result.user);
      if (!token || !context) throw new Error("The authentication service returned an incomplete session.");
      if (!isAdminRole(context.role)) {
        try { await authRequest("logout", "POST", {}, token); } catch (_) {}
        throw new Error("This account does not have access to the central administration portal.");
      }
      storeSession({ token, context });
      location.hash = context.mustChangePassword ? "#/admin/change-password" : "#/admin/overview";
    } catch (error) {
      if (message) message.textContent = error.message || "Unable to sign in. Please try again.";
      button.disabled = !config.apiEnabled;
      button.textContent = "Sign in securely";
    }
  }

  async function handleSignOut() {
    const token = adminSession && adminSession.token;
    try { if (token && config.apiEnabled) await authRequest("logout", "POST", {}, token); }
    catch (_) {}
    clearSession();
    location.hash = "#/province";
  }

  function handleInstallClick() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.finally(() => {
      deferredInstallPrompt = null;
      const button = document.getElementById("installButton");
      if (button) button.hidden = true;
    });
  }

  async function renderAdmin(context, page) {
    const role = String(context.role || "").toUpperCase();
    const allowed = (ADMIN_NAV[role] || []).map(item => item[0]);
    if (page === "login") return renderAdminLogin();
    if (page === "change-password") {
      setPublicHeader(false);
      app.className = "app-shell admin-login-shell";
      app.innerHTML = `<section class="login-layout"><div class="login-intro"><p class="admin-eyebrow">ACCOUNT SECURITY</p><h1>Change your password</h1><p>Your account requires a password update before continuing.</p></div><form class="login-card" id="changePasswordForm"><h2>Update password</h2><label for="currentPassword">Current password</label><input id="currentPassword" name="currentPassword" type="password" autocomplete="current-password" required><label for="newPassword">New password</label><input id="newPassword" name="newPassword" type="password" autocomplete="new-password" minlength="12" required><label for="confirmPassword">Confirm new password</label><input id="confirmPassword" name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required><button class="button button-primary button-full" type="submit">Update password</button><div id="changePasswordMessage" class="login-message" role="alert"></div></form></section>`;
      document.getElementById("changePasswordForm").addEventListener("submit", async event => {
        event.preventDefault();
        const form = event.currentTarget;
        const button = form.querySelector("button");
        const message = document.getElementById("changePasswordMessage");
        button.disabled = true;
        try {
          const result = await authRequest("change-password", "POST", {
            currentPassword: form.elements.currentPassword.value,
            newPassword: form.elements.newPassword.value,
            confirmPassword: form.elements.confirmPassword.value
          }, adminSession.token);
          if (result && result.token) storeSession({ token: result.token, context: result.context || context });
          else if (result && result.context) storeSession({ token: adminSession.token, context: result.context });
          location.hash = "#/admin/overview";
        } catch (error) {
          message.textContent = error.message;
          button.disabled = false;
        }
      });
      return;
    }
    if (!allowed.includes(page)) {
      const first = allowed[0] || "overview";
      return renderAdminShell(context, first, `${adminPageHeading("Access restricted", "This section is not available for your assigned role")}<section class="admin-panel"><p>Your account cannot open this administration section. Access is restricted by your role and active assignment.</p></section>`);
    }
    if (page === "overview") return renderAdminOverview(context);
    if (page === "districts") return renderAdminDistricts(context);
    if (page === "divisions") return renderAdminDivisions(context);
    if (page === "officers") return renderAdminOfficers(context);
    if (page === "assignments") return renderAdminAssignments(context);
    if (page === "transfers") return renderAdminTransfers(context);
    if (page === "reports") return renderAdminDataPage(context, page, "Reports", "Authorised reports within your assigned scope", "/reports", [{ key: "name", label: "Report" }, { key: "period", label: "Period" }, { key: "status", label: "Status" }]);
    if (page === "audit") return renderAdminDataPage(context, page, "Audit log", "Recorded administrative actions", "/audit-log", [{ key: "createdAt", label: "Date and time" }, { key: "actor", label: "User" }, { key: "action", label: "Action" }, { key: "entity", label: "Record" }]);
    if (page === "settings") return renderAdminDataPage(context, page, "Application settings", "Protected application configuration", "/settings", [{ key: "setting", label: "Setting" }, { key: "value", label: "Value" }, { key: "updatedAt", label: "Updated" }]);
    if (page === "division-workspace") return renderDivisionWorkspace(context);
  }

  async function render() {
    const sequence = ++renderSequence;
    const current = route();
    app.className = "app-shell";

    if (current.page === "admin") {
      if (current.adminPage === "login" && !adminSession) {
        setActivePublicNav("");
        renderAdminLogin();
        return;
      }
      if (current.adminPage === "login" && adminSession) {
        location.hash = "#/admin/overview";
        return;
      }
      if (!adminSession) {
        renderAdminLogin();
        return;
      }
      if (!(await validateStoredSession())) {
        if (sequence !== renderSequence) return;
        renderAdminLogin();
        return;
      }
      if (sequence !== renderSequence) return;
      if (adminSession.context.mustChangePassword && current.adminPage !== "change-password") {
        location.hash = "#/admin/change-password";
        return;
      }
      await renderAdmin(adminSession.context, current.adminPage);
      return;
    }

    setPublicHeader(false);
    setActivePublicNav(current.page);
    try {
      if (current.page === "province") {
        let data = null;
        try { data = await publicApiGet("/province"); } catch (_) {}
        if (sequence !== renderSequence) return;
        renderProvince(data);
      } else if (current.page === "districts") {
        if (!provinceDataCache && config.apiEnabled) {
          try { provinceDataCache = await publicApiGet("/province"); } catch (_) {}
        }
        if (sequence !== renderSequence) return;
        renderDistrictDirectory();
      } else if (current.page === "district") {
        await renderDistrict(current.districtSlug);
      } else if (current.page === "division") {
        await renderDivision(current.districtSlug, current.divisionSlug);
      } else if (current.page === "about") {
        renderAbout();
      } else {
        renderNotFound();
      }
    } catch (error) {
      if (sequence !== renderSequence) return;
      app.innerHTML = `<section class="panel"><h2>Unable to load this page</h2><p>${escapeHtml(error.message || "Please try again later.")}</p><a class="button button-light" href="#/province">Return to home</a></section>`;
    }
  }

  window.addEventListener("hashchange", render);

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    const button = document.getElementById("installButton");
    if (button) button.hidden = false;
  });

  if (installButton) installButton.addEventListener("click", handleInstallClick);

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js")
        .catch(error => console.warn("Service worker registration failed:", error));
    });
  }

  render();
})();
