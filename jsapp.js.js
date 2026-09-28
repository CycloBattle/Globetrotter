let collectionData = [];

// Charger les données depuis le fichier JSON
async function fetchData() {
  try {
    const response = await fetch('js/data.json');
    collectionData = await response.json();
  } catch (error) {
    console.error("Erreur de chargement des données :", error);
  }
}

// Carrousel des 10 derniers ajouts (Accueil)
async function loadCarousel() {
  await fetchData();
  const carousel = document.getElementById('carousel');
  
  // Trier par date d'ajout et prendre les 10 plus récents
  const latest = [...collectionData]
    .sort((a, b) => new Date(b.dateAjout) - new Date(a.dateAjout))
    .slice(0, 10);

  carousel.innerHTML = latest.map(item => `
    <div class="carousel-item">
      <img src="${item.image}" alt="${item.nom}">
      <h4>${item.nom}</h4>
      <p>⭐ ${item.note}/5</p>
    </div>
  `).join('');
}

// Charger la grille de collection et gérer les filtres
async function loadCollection() {
  await fetchData();
  renderGrid(collectionData);

  // Ajouter les écouteurs sur les filtres
  document.querySelectorAll('.filters select').forEach(select => {
    select.addEventListener('change', applyFilters);
  });

  // Modal
  document.getElementById('close-modal').onclick = () => {
    document.getElementById('modal').style.display = 'none';
  };
}

function renderGrid(items) {
  const grid = document.getElementById('collection-grid');
  grid.innerHTML = items.map(item => `
    <div class="card" onclick="openModal('${item.id}')">
      <img src="${item.image}" alt="${item.nom}">
      <h3>${item.nom}</h3>
      <div>
        <span class="tag">${item.volume}</span>
        <span class="tag">${item.theme}</span>
        <span class="tag">${item.pays}</span>
      </div>
    </div>
  `).join('');
}

function applyFilters() {
  const type = document.getElementById('filter-type').value;
  const volume = document.getElementById('filter-volume').value;
  const theme = document.getElementById('filter-theme').value;
  const pays = document.getElementById('filter-pays').value;

  const filtered = collectionData.filter(item => {
    return (!type || item.type === type) &&
           (!volume || item.volume === volume) &&
           (!theme || item.theme === theme) &&
           (!pays || item.pays === pays);
  });

  renderGrid(filtered);
}

function openModal(id) {
  const item = collectionData.find(i => i.id === id);
  if (!item) return;

  document.getElementById('modal-img').src = item.image;
  document.getElementById('modal-title').innerText = item.nom;
  document.getElementById('modal-desc').innerText = item.description;
  document.getElementById('modal-rating').innerText = `Note : ⭐ ${item.note} / 5`;
  
  document.getElementById('modal-tags').innerHTML = `
    <span class="tag">${item.type}</span>
    <span class="tag">${item.volume}</span>
    <span class="tag">${item.theme}</span>
    <span class="tag">${item.pays}</span>
  `;

  document.getElementById('modal').style.display = 'flex';
}