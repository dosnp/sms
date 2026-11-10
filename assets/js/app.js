(() => {
  "use strict";

  const config = window.PPSM_CONFIG || {};
  const app = document.getElementById("app");
  const year = document.getElementById("year");
  const installButton = document.getElementById("installButton");

  if (year) year.textContent = String(new Date().getFullYear());

  const districts = [
    { id: "JAF", name: "Jaffna", slug: "jaffna" },
    { id: "KIL", name: "Kilinochchi", slug: "kilinochchi" },
    { id: "MAN", name: "Mannar", slug: "mannar" },
    { id: "MUL", name: "Mullaitivu", slug: "mullaitivu" },
    { id: "VAV", name: "Vavuniya", slug: "vavuniya" }
  ];

  // This is the only division explicitly known from the current setup.
  // Do not invent the names of the remaining divisions.
  const previewDivisions = {
    jaffna: [
      { id: "POINT-PEDRO", name: "Point Pedro", slug: "point-pedro", status: "Registered" }
    ]
  };

  let deferredInstallPrompt = null;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[character]));
  }

  function safeDecode(value) {
    try { return decodeURIComponent(value); }
    catch (_) { return ""; }
  }

  function slugify(value) {
    return String(value || "")
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function route() {
    const raw = (location.hash || "#/province").replace(/^#\/?/, "");
    const parts = raw.split("/").filter(Boolean).map(safeDecode);

    if (!parts.length || parts[0] === "province") return { page: "province" };
    if (parts[0] === "districts") return { page: "districts" };
    if (parts[0] === "district" && parts[1]) return { page: "district", districtSlug: parts[1] };
    if (parts[0] === "division" && parts[1] && parts[2]) {
      return { page: "division", districtSlug: parts[1], divisionSlug: parts[2] };
    }
    if (parts[0] === "about") return { page: "about" };
    return { page: "not-found" };
  }

  function setActiveNav(page) {
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

  function getApiUrl(path) {
    const base = String(config.apiBaseUrl || "").replace(/\/+$/, "");
    const prefix = String(config.apiPrefix || "/api/public/v1");
    const normalizedPrefix = prefix.startsWith("/") ? prefix : "/" + prefix;
    return base + normalizedPrefix + path;
  }

  async function apiGet(path) {
    if (!config.apiBaseUrl) return null;

    const response = await fetch(getApiUrl(path), {
      method: "GET",
      headers: { "Accept": "application/json" },
      cache: "no-store",
      credentials: "omit"
    });

    if (!response.ok) {
      throw new Error("Public information service returned HTTP " + response.status);
    }

    const payload = await response.json();
    if (payload && payload.success === false) {
      throw new Error(payload.message || "The public information service returned an error.");
    }
    return payload && payload.data !== undefined ? payload.data : payload;
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
    const id = district.id || district.code || slug.slice(0, 3).toUpperCase();

    return `
      <a class="district-card" href="#/district/${encodeURIComponent(slug)}">
        <div class="card-top">
          <span class="district-icon">${escapeHtml(String(id).slice(0, 1))}</span>
          <span class="card-arrow" aria-hidden="true">↗</span>
        </div>
        <h3>${escapeHtml(district.name)}</h3>
        <p>District sports information and registered divisions.</p>
        <div class="card-meta">
          <span>${escapeHtml(id)}</span>
          <span class="pill">View district</span>
        </div>
      </a>`;
  }

  function renderProvince(data) {
    const list = data && Array.isArray(data.districts) ? data.districts : districts;

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
        <div class="section-heading">
          <div>
            <h2 id="district-title">Five districts of Northern Province</h2>
            <p>Select a district to continue to its public information page.</p>
          </div>
          <a class="text-link" href="#/districts">View all districts →</a>
        </div>
        <div class="district-grid">${list.map(districtCard).join("")}</div>
      </section>

      <div class="info-strip">
        <span class="info-icon" aria-hidden="true">i</span>
        <span>${config.previewMode
          ? "Preview version: the public navigation is ready. Live district and division records will appear after the Central Registry public API is implemented and connected."
          : "Public records are retrieved from the Department of Sports Central Registry."}</span>
      </div>`;
  }

  function renderDistrictDirectory() {
    app.innerHTML = `
      <section class="page-head">
        ${breadcrumbs([{ label: "Provincial Office", href: "#/province" }, { label: "Districts" }])}
        <h1>District directory</h1>
        <p>Choose one of the five administrative districts in Northern Province.</p>
      </section>
      <div class="district-grid">${districts.map(districtCard).join("")}
      </div>`;
  }

  async function renderDistrict(slug) {
    const fallback = districts.find(district => district.slug === slug);
    if (!fallback) return renderNotFound();

    let data = null;
    let apiError = null;

    try {
      data = await apiGet("/districts/" + encodeURIComponent(slug));
    } catch (error) {
      apiError = error;
    }

    const district = data && data.district ? data.district : fallback;
    const divisions = data && Array.isArray(data.divisions)
      ? data.divisions
      : (previewDivisions[slug] || []);

    const divisionMarkup = divisions.length
      ? `<div class="division-list">${divisions.map(division => {
          const divisionSlug = division.slug || slugify(division.name);
          return `
            <a class="division-link" href="#/division/${encodeURIComponent(slug)}/${encodeURIComponent(divisionSlug)}">
              <span>
                <strong>${escapeHtml(division.name)}</strong>
                <small>${escapeHtml(division.status || "Registered division")}</small>
              </span>
              <span class="card-arrow" aria-hidden="true">→</span>
            </a>`;
        }).join("")}</div>`
      : `<div class="empty-state">No public division records are available for this district yet. Division names will be displayed after they are registered and approved for public viewing in the Central Registry.</div>`;

    app.innerHTML = `
      <section class="page-head">
        ${breadcrumbs([
          { label: "Provincial Office", href: "#/province" },
          { label: "Districts", href: "#/districts" },
          { label: district.name }
        ])}
        <h1>${escapeHtml(district.name)} District</h1>
        <p>Public sports information and registered divisional connections for ${escapeHtml(district.name)} District.</p>
      </section>

      <section class="panel">
        <h2>Divisions</h2>
        <p>Select a division to view its public sports information.</p>
        ${divisionMarkup}
        ${config.previewMode || apiError
          ? `<div class="status-banner">Preview information only. The live Central Registry public API is not connected yet.</div>`
          : ""}
      </section>`;
  }

  async function renderDivision(districtSlug, divisionSlug) {
    const districtFallback = districts.find(district => district.slug === districtSlug);
    if (!districtFallback) return renderNotFound();

    let data = null;
    let apiError = null;

    try {
      data = await apiGet(
        "/divisions/" +
        encodeURIComponent(districtSlug) + "/" +
        encodeURIComponent(divisionSlug)
      );
    } catch (error) {
      apiError = error;
    }

    const preview = (previewDivisions[districtSlug] || [])
      .find(division => division.slug === divisionSlug);

    const district = data && data.district ? data.district : districtFallback;
    const division = data && data.division ? data.division : preview;

    if (!division) return renderNotFound();

    const publicSections = data && Array.isArray(data.publicSections)
      ? data.publicSections
      : [];

    const sectionsMarkup = publicSections.length
      ? publicSections.map(section => `
          <div class="about-item">
            <strong>${escapeHtml(section.title || "Public information")}</strong>
            <span>${escapeHtml(section.description || "")}</span>
          </div>`).join("")
      : `<div class="empty-state">The division page is prepared. Approved sports records, notices, events and other public information will appear after the secure public API is connected.</div>`;

    app.innerHTML = `
      <section class="page-head">
        ${breadcrumbs([
          { label: "Provincial Office", href: "#/province" },
          { label: "Districts", href: "#/districts" },
          { label: district.name, href: "#/district/" + districtSlug },
          { label: division.name }
        ])}
        <h1>${escapeHtml(division.name)} Division</h1>
        <p>${escapeHtml(district.name)} District · Northern Province</p>
      </section>

      <div class="detail-grid">
        <section class="panel">
          <h2>Public division information</h2>
          <p>${escapeHtml(division.publicDescription || "This is the public information page for this division.")}</p>
          ${sectionsMarkup}
        </section>

        <aside class="panel">
          <h2>Division details</h2>
          <ul class="detail-list">
            <li><strong>Province:</strong> Northern Province</li>
            <li><strong>District:</strong> ${escapeHtml(district.name)}</li>
            <li><strong>Division:</strong> ${escapeHtml(division.name)}</li>
            <li><strong>Access:</strong> Public view</li>
          </ul>
        </aside>
      </div>

      ${config.previewMode || apiError
        ? `<div class="status-banner">Preview page only. Official live records have not yet been connected.</div>`
        : ""}`;
  }

  function renderAbout() {
    app.innerHTML = `
      <section class="page-head">
        ${breadcrumbs([{ label: "Provincial Office", href: "#/province" }, { label: "About" }])}
        <h1>About this public portal</h1>
        <p>A public-facing information layer for the Northern Province Department of Sports.</p>
      </section>

      <section class="panel">
        <h2>Purpose</h2>
        <p>This portal is intended to make approved sports information easier to access by province, district and division. Public visitors do not need an officer account to view information deliberately published for public access.</p>
        <div class="about-grid">
          <div class="about-item">
            <strong>Provincial level</strong>
            <span>Province-wide public information and district directory.</span>
          </div>
          <div class="about-item">
            <strong>District level</strong>
            <span>District profile and registered divisional connections.</span>
          </div>
          <div class="about-item">
            <strong>Divisional level</strong>
            <span>Only information approved for public release by the relevant division.</span>
          </div>
        </div>
        <div class="info-strip">
          <span class="info-icon" aria-hidden="true">i</span>
          <span>Private officer accounts, passwords, payment details and non-public personal records are not part of this public portal.</span>
        </div>
      </section>`;
  }

  function renderNotFound() {
    app.innerHTML = `
      <section class="panel">
        <h2>Page not found</h2>
        <p>The requested public page does not exist or is not published.</p>
        <a class="button button-light" href="#/province">Return to home</a>
      </section>`;
  }

  async function render() {
    const current = route();
    setActiveNav(current.page);

    try {
      if (current.page === "province") {
        let data = null;
        try { data = await apiGet("/province"); } catch (_) {}
        renderProvince(data);
      } else if (current.page === "districts") {
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
      app.innerHTML = `
        <section class="panel">
          <h2>Unable to load this page</h2>
          <p>${escapeHtml(error.message || "Please try again later.")}</p>
          <a class="button button-light" href="#/province">Return to home</a>
        </section>`;
    }
  }

  window.addEventListener("hashchange", render);
  render();

  window.addEventListener("beforeinstallprompt", event => {
    event.preventDefault();
    deferredInstallPrompt = event;
    if (installButton) installButton.hidden = false;
  });

  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      await deferredInstallPrompt.userChoice;
      deferredInstallPrompt = null;
      installButton.hidden = true;
    });
  }

  if ("serviceWorker" in navigator && location.protocol === "https:") {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("./service-worker.js")
        .catch(error => console.warn("Service worker registration failed:", error));
    });
  }
})();
