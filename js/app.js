/* ==========================================================================
   CAN & BOTTLE COLLEC — app.js
   Toute la logique du site : récupération du Google Sheet (CSV), rendu des
   cartes, recherche, filtres de la page collection, modale de détail et
   carte Leaflet.
   ========================================================================== */

/*
 * ETAPE OBLIGATOIRE : remplace l'URL ci-dessous par l'URL CSV de TON
 * Google Sheet publié. Voir le README.md du projet pour la procédure
 * complète (deux méthodes possibles y sont expliquées).
 */
const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/1eWpclz7beYMajhqBP2ntZ4KWYr4f-bk12UZ7g02cKEo/edit?gid=2016268470#gid=2016268470";

/* Colonnes attendues dans le Google Sheet (voir README.md) */
const COLUMNS = {
  id: "ID",
  nom: "Nom",
  type: "Type",
  contenance: "Contenance",
  brasserie: "Brasserie",
  style: "Style",
  pays: "Pays",
  latitude: "Latitude",
  longitude: "Longitude",
  note: "Note",
  description: "Description",
  image: "ImageURL",
  date: "DateAjout",
};

/* Image affichée quand ImageURL est vide ou invalide (SVG encodé, pas de
   fichier externe requis) */
const FALLBACK_IMAGE =
  "data:image/svg+xml;charset=UTF-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400">' +
      '<rect width="400" height="400" fill="#1b1714"/>' +
      '<text x="50%" y="50%" fill="#5a4d3f" font-family="sans-serif" ' +
      'font-size="18" text-anchor="middle" dominant-baseline="middle">' +
      "Image indisponible</text></svg>"
  );

/* --------------------------------------------------------------------------
   Chargement et normalisation des données
   -------------------------------------------------------------------------- */

/**
 * Récupère le CSV publié du Google Sheet et le convertit en tableau
 * d'objets JavaScript normalisés.
 */
async function loadCollection() {
  if (!window.Papa) {
    throw new Error("La librairie PapaParse n'a pas pu être chargée.");
  }

  const response = await fetch(SHEET_CSV_URL, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(
      "Impossible de récupérer le Google Sheet (code " + response.status + ")."
    );
  }
  const csvText = await response.text();

  const parsed = Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  return parsed.data
    .map(normalizeRow)
    .filter((row) => row.nom && row.nom.trim().length > 0);
}

function normalizeRow(row) {
  const get = (key) => (row[COLUMNS[key]] || "").toString().trim();

  const noteRaw = get("note").replace(",", ".").replace(/\/\s*5$/, "");
  const note = parseFloat(noteRaw);

  const lat = parseFloat(get("latitude").replace(",", "."));
  const lng = parseFloat(get("longitude").replace(",", "."));

  return {
    id: get("id") || get("nom"),
    nom: get("nom"),
    type: get("type"),
    contenance: get("contenance"),
    brasserie: get("brasserie"),
    style: get("style"),
    pays: get("pays"),
    latitude: isNaN(lat) ? null : lat,
    longitude: isNaN(lng) ? null : lng,
    note: isNaN(note) ? null : Math.max(0, Math.min(5, note)),
    description: get("description"),
    image: get("image"),
    date: get("date"),
    dateValue: parseDateSafe(get("date")),
  };
}

function parseDateSafe(value) {
  if (!value) return null;
  // Formats acceptés : AAAA-MM-JJ, JJ/MM/AAAA, JJ-MM-AAAA
  let d = new Date(value);
  if (!isNaN(d.getTime())) return d;

  const parts = value.split(/[\/\-]/);
  if (parts.length === 3) {
    const [a, b, c] = parts;
    if (a.length === 4) {
      d = new Date(Number(a), Number(b) - 1, Number(c));
    } else {
      d = new Date(Number(c), Number(b) - 1, Number(a));
    }
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

/* --------------------------------------------------------------------------
   Utilitaires de rendu
   -------------------------------------------------------------------------- */

function ratingToPercent(note) {
  if (note === null) return 0;
  return Math.round((note / 5) * 100);
}

function formatNote(note) {
  return note === null ? "N/A" : note.toFixed(1) + " / 5";
}

function escapeHtml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildCard(piece) {
  const img = piece.image || FALLBACK_IMAGE;
  return (
    '<button type="button" class="piece-card" data-id="' +
    escapeHtml(piece.id) +
    '">' +
    '<div class="card-image">' +
    '<img src="' +
    escapeHtml(img) +
    '" alt="' +
    escapeHtml(piece.nom) +
    '" loading="lazy" onerror="this.onerror=null;this.src=\'' +
    FALLBACK_IMAGE +
    '\';">' +
    "</div>" +
    '<div class="card-body">' +
    '<div class="card-type">' +
    escapeHtml(piece.type || "") +
    "</div>" +
    '<h3 class="card-name">' +
    escapeHtml(piece.nom) +
    "</h3>" +
    '<div class="card-meta">' +
    escapeHtml(piece.brasserie || "") +
    (piece.pays ? " — " + escapeHtml(piece.pays) : "") +
    "</div>" +
    '<div class="card-footer">' +
    '<span class="rating-pill"><span class="rating-track">' +
    '<span class="rating-fill" style="width:' +
    ratingToPercent(piece.note) +
    '%"></span></span>' +
    escapeHtml(formatNote(piece.note)) +
    "</span>" +
    '<span class="contenance-tag">' +
    escapeHtml(piece.contenance || "") +
    "</span>" +
    "</div>" +
    "</div>" +
    "</button>"
  );
}

function renderGrid(container, pieces) {
  if (!container) return;
  if (pieces.length === 0) {
    container.innerHTML = '<p class="empty-state">Aucune pièce ne correspond à ta recherche.</p>';
    return;
  }
  container.innerHTML = pieces.map(buildCard).join("");
}

/* --------------------------------------------------------------------------
   Modale de détail
   -------------------------------------------------------------------------- */

let modalOverlay, modalPanel;

function ensureModal() {
  if (modalOverlay) return;

  modalOverlay = document.createElement("div");
  modalOverlay.className = "modal-overlay";
  modalOverlay.innerHTML =
    '<div class="modal-panel" role="dialog" aria-modal="true">' +
    '<button type="button" class="modal-close" aria-label="Fermer">' +
    '<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round">' +
    '<line x1="5" y1="5" x2="19" y2="19"></line>' +
    '<line x1="19" y1="5" x2="5" y2="19"></line>' +
    "</svg>" +
    "</button>" +
    '<div class="modal-image"><img alt=""></div>' +
    '<div class="modal-details"></div>' +
    "</div>";
  document.body.appendChild(modalOverlay);
  modalPanel = modalOverlay.querySelector(".modal-panel");

  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });
  modalOverlay.querySelector(".modal-close").addEventListener("click", closeModal);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
}

function openModal(piece) {
  ensureModal();

  const img = modalOverlay.querySelector(".modal-image img");
  img.src = piece.image || FALLBACK_IMAGE;
  img.alt = piece.nom;
  img.onerror = function () {
    this.onerror = null;
    this.src = FALLBACK_IMAGE;
  };

  const details = modalOverlay.querySelector(".modal-details");
  details.innerHTML =
    '<div class="modal-type">' +
    escapeHtml(piece.type || "") +
    "</div>" +
    "<h2>" +
    escapeHtml(piece.nom) +
    "</h2>" +
    '<div class="modal-rating">' +
    '<span class="rating-track"><span class="rating-fill" style="width:' +
    ratingToPercent(piece.note) +
    '%"></span></span>' +
    '<span class="rating-value">' +
    escapeHtml(formatNote(piece.note)) +
    "</span>" +
    "</div>" +
    '<dl class="modal-facts">' +
    '<div><dt>Contenance</dt><dd>' + escapeHtml(piece.contenance || "—") + "</dd></div>" +
    '<div><dt>Pays</dt><dd>' + escapeHtml(piece.pays || "—") + "</dd></div>" +
    '<div><dt>Brasserie</dt><dd>' + escapeHtml(piece.brasserie || "—") + "</dd></div>" +
    '<div><dt>Style</dt><dd>' + escapeHtml(piece.style || "—") + "</dd></div>" +
    "</dl>" +
    '<p class="modal-description">' +
    escapeHtml(piece.description || "Pas de description pour cette pièce.") +
    "</p>";

  modalOverlay.classList.add("is-open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove("is-open");
  document.body.style.overflow = "";
}

function attachCardClickHandlers(container, pieces) {
  if (!container) return;
  container.addEventListener("click", (e) => {
    const card = e.target.closest(".piece-card");
    if (!card) return;
    const piece = pieces.find((p) => p.id === card.dataset.id);
    if (piece) openModal(piece);
  });
}

/* --------------------------------------------------------------------------
   Page d'accueil
   -------------------------------------------------------------------------- */

async function initHomePage() {
  const latestGrid = document.getElementById("latest-grid");
  const statusEl = document.getElementById("load-status");
  const searchInput = document.getElementById("quick-search");
  const searchStatus = document.getElementById("search-status");
  const footerCount = document.getElementById("total-count");

  try {
    const data = await loadCollection();
    if (statusEl) statusEl.remove();

    if (footerCount) {
      footerCount.textContent = data.length + " pièce" + (data.length > 1 ? "s" : "") + " dans la collection";
    }

    const sorted = [...data].sort((a, b) => {
      if (a.dateValue && b.dateValue) return b.dateValue - a.dateValue;
      if (a.dateValue) return -1;
      if (b.dateValue) return 1;
      return String(b.id).localeCompare(String(a.id));
    });
    const latest = sorted.slice(0, 10);

    renderGrid(latestGrid, latest);
    attachCardClickHandlers(latestGrid, data);

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        const term = searchInput.value.trim().toLowerCase();
        if (!term) {
          renderGrid(latestGrid, latest);
          if (searchStatus) searchStatus.textContent = "";
          return;
        }
        const matches = data.filter((p) =>
          p.nom.toLowerCase().includes(term) ||
          (p.brasserie || "").toLowerCase().includes(term) ||
          (p.pays || "").toLowerCase().includes(term)
        );
        renderGrid(latestGrid, matches);
        if (searchStatus) {
          searchStatus.textContent =
            matches.length + " résultat" + (matches.length !== 1 ? "s" : "") + ' pour "' + searchInput.value.trim() + '"';
        }
      });
    }
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.classList.add("is-error");
      statusEl.textContent =
        "Erreur de chargement du Google Sheet : " + err.message;
    }
  }
}

/* --------------------------------------------------------------------------
   Page collection : filtres, recherche, grille, carte
   -------------------------------------------------------------------------- */

const activeFilters = {
  type: null,
  contenance: null,
  pays: "",
  brasserie: "",
  search: "",
};

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, "fr")
  );
}

function buildTagOptions(container, values, filterKey, onChange) {
  if (!container) return;
  container.innerHTML = values
    .map(
      (v) =>
        '<button type="button" class="tag-option" data-value="' +
        escapeHtml(v) +
        '">' +
        escapeHtml(v) +
        "</button>"
    )
    .join("");

  container.addEventListener("click", (e) => {
    const btn = e.target.closest(".tag-option");
    if (!btn) return;
    const value = btn.dataset.value;
    activeFilters[filterKey] = activeFilters[filterKey] === value ? null : value;
    container.querySelectorAll(".tag-option").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.value === activeFilters[filterKey]);
    });
    onChange();
  });
}

function buildSelectOptions(selectEl, values, filterKey, onChange) {
  if (!selectEl) return;
  selectEl.innerHTML =
    '<option value="">Tous</option>' +
    values.map((v) => '<option value="' + escapeHtml(v) + '">' + escapeHtml(v) + "</option>").join("");

  selectEl.addEventListener("change", () => {
    activeFilters[filterKey] = selectEl.value;
    onChange();
  });
}

function applyFilters(data) {
  return data.filter((p) => {
    if (activeFilters.type && p.type !== activeFilters.type) return false;
    if (activeFilters.contenance && p.contenance !== activeFilters.contenance) return false;
    if (activeFilters.pays && p.pays !== activeFilters.pays) return false;
    if (activeFilters.brasserie && p.brasserie !== activeFilters.brasserie) return false;
    if (activeFilters.search) {
      const term = activeFilters.search.toLowerCase();
      const haystack = (p.nom + " " + p.brasserie + " " + p.pays + " " + p.style).toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

let collectionMap = null;
let mapMarkers = [];

function initMap() {
  if (!window.L || collectionMap) return;
  collectionMap = L.map("collection-map", {
    worldCopyJump: true,
  }).setView([20, 10], 2);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
    maxZoom: 18,
  }).addTo(collectionMap);
}

function updateMapMarkers(pieces) {
  if (!collectionMap) return;

  mapMarkers.forEach((m) => collectionMap.removeLayer(m));
  mapMarkers = [];

  const byCountry = {};
  pieces.forEach((p) => {
    if (p.latitude === null || p.longitude === null || !p.pays) return;
    if (!byCountry[p.pays]) {
      byCountry[p.pays] = { lat: p.latitude, lng: p.longitude, items: [] };
    }
    byCountry[p.pays].items.push(p);
  });

  Object.entries(byCountry).forEach(([pays, info]) => {
    const marker = L.marker([info.lat, info.lng]).addTo(collectionMap);
    const names = info.items
      .slice(0, 6)
      .map((p) => escapeHtml(p.nom))
      .join(", ");
    marker.bindPopup(
      "<h4>" +
        escapeHtml(pays) +
        "</h4><p>" +
        info.items.length +
        " pièce" + (info.items.length > 1 ? "s" : "") + " — " +
        names +
        (info.items.length > 6 ? "…" : "") +
        "</p>"
    );
    mapMarkers.push(marker);
  });
}

async function initCollectionPage() {
  const grid = document.getElementById("collection-grid");
  const statusEl = document.getElementById("load-status");
  const resultsCount = document.getElementById("results-count");
  const searchInput = document.getElementById("collection-search");
  const footerCount = document.getElementById("total-count");
  const resetBtn = document.getElementById("reset-filters");

  const typeContainer = document.getElementById("filter-type");
  const contenanceContainer = document.getElementById("filter-contenance");
  const paysSelect = document.getElementById("filter-pays");
  const brasserieSelect = document.getElementById("filter-brasserie");

  initMap();

  try {
    const data = await loadCollection();
    if (statusEl) statusEl.remove();

    if (footerCount) {
      footerCount.textContent = data.length + " pièce" + (data.length > 1 ? "s" : "") + " dans la collection";
    }

    attachCardClickHandlers(grid, data);

    function refresh() {
      const filtered = applyFilters(data);
      renderGrid(grid, filtered);
      updateMapMarkers(filtered);
      if (resultsCount) {
        resultsCount.textContent =
          filtered.length + " pièce" + (filtered.length !== 1 ? "s" : "") + " affichée" + (filtered.length !== 1 ? "s" : "");
      }
    }

    buildTagOptions(typeContainer, uniqueSorted(data.map((p) => p.type)), "type", refresh);
    buildTagOptions(
      contenanceContainer,
      uniqueSorted(data.map((p) => p.contenance)),
      "contenance",
      refresh
    );
    buildSelectOptions(paysSelect, uniqueSorted(data.map((p) => p.pays)), "pays", refresh);
    buildSelectOptions(
      brasserieSelect,
      uniqueSorted(data.map((p) => p.brasserie)),
      "brasserie",
      refresh
    );

    if (searchInput) {
      searchInput.addEventListener("input", () => {
        activeFilters.search = searchInput.value.trim();
        refresh();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener("click", () => {
        activeFilters.type = null;
        activeFilters.contenance = null;
        activeFilters.pays = "";
        activeFilters.brasserie = "";
        activeFilters.search = "";
        if (searchInput) searchInput.value = "";
        if (paysSelect) paysSelect.value = "";
        if (brasserieSelect) brasserieSelect.value = "";
        [typeContainer, contenanceContainer].forEach((c) => {
          if (c) c.querySelectorAll(".tag-option").forEach((b) => b.classList.remove("is-active"));
        });
        refresh();
      });
    }

    refresh();
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.classList.add("is-error");
      statusEl.textContent =
        "Erreur de chargement du Google Sheet : " + err.message;
    }
  }
}

/* --------------------------------------------------------------------------
   Point d'entrée
   -------------------------------------------------------------------------- */

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("latest-grid")) {
    initHomePage();
  }
  if (document.getElementById("collection-grid")) {
    initCollectionPage();
  }
});
