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
  "https://docs.google.com/spreadsheets/d/1eWpclz7beYMajhqBP2ntZ4KWYr4f-bk12UZ7g02cKEo/export?format=csv&gid=2016268470";

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
  illustrationFemme: "IllustrationFemme",
  adresse: "AdresseBrasserie",
  latBrasserie: "LatitudeBrasserie",
  lngBrasserie: "LongitudeBrasserie",
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

  const illustrationRaw = get("illustrationFemme").toLowerCase();
  const illustrationFemme = ["oui", "yes", "true", "1", "x"].includes(illustrationRaw);

  const latB = parseFloat(get("latBrasserie").replace(",", "."));
  const lngB = parseFloat(get("lngBrasserie").replace(",", "."));

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
    illustrationFemme: illustrationFemme,
    adresse: get("adresse"),
    latBrasserie: isNaN(latB) ? null : latB,
    lngBrasserie: isNaN(lngB) ? null : lngB,
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
    (piece.adresse
      ? '<div><dt>Adresse</dt><dd>' + escapeHtml(piece.adresse) + "</dd></div>"
      : "") +
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
  illustrationFemme: false,
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
    if (activeFilters.illustrationFemme && !p.illustrationFemme) return false;
    if (activeFilters.search) {
      const term = activeFilters.search.toLowerCase();
      const haystack = (p.nom + " " + p.brasserie + " " + p.pays + " " + p.style).toLowerCase();
      if (!haystack.includes(term)) return false;
    }
    return true;
  });
}

/* --------------------------------------------------------------------------
   Geocodage automatique d'une adresse texte (API gratuite Nominatim /
   OpenStreetMap). Resultat mis en cache (memoire + localStorage) pour ne
   jamais re-interroger deux fois la meme adresse, et les appels reseau sont
   espaces d'un peu plus d'une seconde pour respecter l'usage equitable de
   ce service gratuit (adapte a une collection personnelle, pas a un trafic
   important).
   -------------------------------------------------------------------------- */

const geocodeMemCache = new Map();
let geocodeQueue = Promise.resolve();

function geocodeAddress(address) {
  const key = address.trim().toLowerCase();
  if (!key) return Promise.resolve(null);

  if (geocodeMemCache.has(key)) {
    return Promise.resolve(geocodeMemCache.get(key));
  }

  try {
    const stored = localStorage.getItem("geocode:" + key);
    if (stored) {
      const coords = JSON.parse(stored);
      geocodeMemCache.set(key, coords);
      return Promise.resolve(coords);
    }
  } catch (e) {
    /* localStorage indisponible : on ignore simplement le cache persistant */
  }

  const task = geocodeQueue.then(() =>
    fetch(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" +
        encodeURIComponent(address)
    )
      .then((r) => (r.ok ? r.json() : []))
      .then((results) => {
        let coords = null;
        if (results && results[0]) {
          coords = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
        }
        geocodeMemCache.set(key, coords);
        try {
          localStorage.setItem("geocode:" + key, JSON.stringify(coords));
        } catch (e) {
          /* pas grave si le cache persistant echoue */
        }
        return coords;
      })
      .catch(() => {
        geocodeMemCache.set(key, null);
        return null;
      })
  );

  /* La prochaine adresse en file d'attente attend que celle-ci soit
     terminee ET qu'un petit delai supplementaire se soit ecoule. */
  geocodeQueue = task.then(
    (coords) => new Promise((resolve) => setTimeout(() => resolve(coords), 1100))
  );

  return task;
}

let collectionMap = null;
let mapMarkers = [];
let mapUpdateVersion = 0;

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

async function updateMapMarkers(pieces) {
  if (!collectionMap) return;

  /* Permet d'abandonner proprement une mise a jour devenue obsolete si les
     filtres changent pendant qu'un geocodage est encore en cours. */
  const myVersion = ++mapUpdateVersion;

  mapMarkers.forEach((m) => collectionMap.removeLayer(m));
  mapMarkers = [];

  const hasOwnAddress = (p) => p.adresse || (p.latBrasserie !== null && p.lngBrasserie !== null);

  const withAddress = pieces.filter(hasOwnAddress);
  const withoutAddress = pieces.filter((p) => !hasOwnAddress(p));

  /* Marqueur groupe par pays pour toutes les pieces sans adresse propre
     (affiche immediatement, aucun geocodage necessaire). */
  const byCountry = {};
  withoutAddress.forEach((p) => {
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

  /* Marqueur individuel pour chaque piece qui a sa propre adresse : d'abord
     les coordonnees precises si elles sont renseignees (immediat), sinon
     geocodage automatique de l'adresse texte (un peu plus lent, un marqueur
     a la fois pour respecter le service gratuit utilise). */
  for (const p of withAddress) {
    let coords = null;

    if (p.latBrasserie !== null && p.lngBrasserie !== null) {
      coords = { lat: p.latBrasserie, lng: p.lngBrasserie };
    } else if (p.adresse) {
      coords = await geocodeAddress(p.adresse);
    }

    /* Si les filtres ont change entre-temps, on arrete cette mise a jour
       devenue obsolete plutot que d'afficher des marqueurs perimes. */
    if (myVersion !== mapUpdateVersion) return;

    if (!coords) continue;

    const marker = L.marker([coords.lat, coords.lng]).addTo(collectionMap);
    marker.bindPopup(
      "<h4>" +
        escapeHtml(p.brasserie || p.nom) +
        "</h4><p>" +
        escapeHtml(p.nom) +
        (p.adresse ? "<br>" + escapeHtml(p.adresse) : "") +
        "</p>"
    );
    mapMarkers.push(marker);
  }
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
  const illustrationBtn = document.getElementById("filter-illustration-femme");

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

    if (illustrationBtn) {
      illustrationBtn.addEventListener("click", () => {
        activeFilters.illustrationFemme = !activeFilters.illustrationFemme;
        illustrationBtn.classList.toggle("is-active", activeFilters.illustrationFemme);
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
        activeFilters.illustrationFemme = false;
        if (searchInput) searchInput.value = "";
        if (paysSelect) paysSelect.value = "";
        if (brasserieSelect) brasserieSelect.value = "";
        if (illustrationBtn) illustrationBtn.classList.remove("is-active");
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
