// ==========================================================================
// FONCTION DE FILTRAGE PAR RECHERCHE
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
// GESTION DE LA FENÊTRE MODALE (POP-UP DÉTAILS)
// ==========================================================================
function openModal(title, imgSrc, type, volume, style, country, rating, description) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalImg').src = imgSrc;
    document.getElementById('modalType').textContent = type;
    document.getElementById('modalVolume').textContent = volume;
    document.getElementById('modalStyle').textContent = style;
    document.getElementById('modalCountry').textContent = country;
    document.getElementById('modalRating').textContent = 'Note : ⭐ ' + rating;
    document.getElementById('modalDescription').textContent = description;

    const modal = document.getElementById('itemModal');
    modal.style.display = 'flex';
}

function closeModal() {
    const modal = document.getElementById('itemModal');
    modal.style.display = 'none';
}

// Fermer la modale en cliquant à l'extérieur
window.onclick = function(event) {
    const modal = document.getElementById('itemModal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};
