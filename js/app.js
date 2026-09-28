// ==========================================================================
// BARRE DE RECHERCHE EN TEMPS RÉEL
// ==========================================================================
function filterCollection() {
    const input = document.getElementById('searchInput').value.toLowerCase();
    const cards = document.querySelectorAll('.card');

    cards.forEach(card => {
        const title = card.querySelector('.card-title')?.textContent.toLowerCase() || '';
        if (title.includes(input)) {
            card.style.display = "block";
        } else {
            card.style.display = "none";
        }
    });
}

// ==========================================================================
// GESTION DE LA POP-UP / MODALE
// ==========================================================================
function openModal(title, imgSrc, type, volume, style, country, rating, description) {
    document.getElementById('modalTitle').textContent = title || '';
    document.getElementById('modalImg').src = imgSrc || '';
    document.getElementById('modalType').textContent = type || '';
    document.getElementById('modalVolume').textContent = volume || '';
    document.getElementById('modalStyle').textContent = style || '';
    document.getElementById('modalCountry').textContent = country || '';
    document.getElementById('modalRating').textContent = rating ? 'Note : ⭐ ' + rating : '';
    document.getElementById('modalDescription').textContent = description || '';

    const modal = document.getElementById('itemModal');
    if (modal) modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    if (modal) modal.style.display = 'none';
}

window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// ==========================================================================
// CHARGEMENT AUTOMATIQUE DEPURIS DATA.JSON (SI PRÉSENT)
// ==========================================================================
document.addEventListener("DOMContentLoaded", () => {
    fetch('js/data.json')
        .then(response => {
            if (!response.ok) throw new Error("Fichier data.json non trouvé");
            return response.json();
        })
        .then(data => {
            const grid = document.getElementById('collectionGrid');
            if (!grid || !data || data.length === 0) return;

            grid.innerHTML = ''; // Vide les éléments de secours

            data.forEach(item => {
                const card = document.createElement('div');
                card.className = 'card';
                
                // Préparation de la fonction au clic
                card.onclick = () => openModal(
                    item.nom, 
                    item.image, 
                    item.type, 
                    item.contenance, 
                    item.style, 
                    item.pays, 
                    item.note, 
                    item.description
                );

                card.innerHTML = `
                    <img src="${item.image}" alt="${item.nom}" onerror="this.src='https://via.placeholder.com/300x300?text=Image+Indisponible'">
                    <div class="card-info">
                        <div class="card-title">${item.nom}</div>
                        <div class="card-rating">⭐ ${item.note}</div>
                    </div>
                `;
                grid.appendChild(card);
            });
        })
        .catch(error => {
            console.log("Lecture directe du HTML (data.json non utilisé ou introuvable):", error);
        });
});
