# CAN & BOTTLE COLLEC

Site statique pour exposer une collection de cannettes et bouteilles de bière, hébergé sur GitHub Pages, avec les données gérées entièrement depuis un Google Sheet.

## Arborescence du projet

```
can-bottle-collec/
├── index.html
├── collection.html
├── css/
│   └── style.css
├── js/
│   └── app.js
└── README.md
```

## 1. Structure du Google Sheet

Crée un Google Sheet avec exactement ces colonnes, dans cet ordre, sur la première ligne (feuille nommée par exemple "Collection") :

| Colonne     | Exemple de contenu           | Remarques                                   |
|-------------|-------------------------------|----------------------------------------------|
| ID          | 1                              | Identifiant unique, obligatoire              |
| Nom         | Punk IPA                       | Nom de la pièce                               |
| Type        | Cannette                       | "Cannette" ou "Bouteille"                     |
| Contenance  | 33cl                           | Texte libre, sert de filtre (33cl, 44cl, ...) |
| Brasserie   | BrewDog                        |                                                |
| Style       | IPA                            | Style de bière, affiché dans la fiche détail  |
| Pays        | Ecosse                         | Sert au filtre pays et à la carte             |
| Latitude    | 56.4907                        | Coordonnée du pays/de la brasserie            |
| Longitude   | -4.2026                        | Coordonnée du pays/de la brasserie            |
| Note        | 4.5                            | Sur 5, décimales autorisées                   |
| Description | Houblonnée, notes d'agrumes... | Texte libre affiché dans la modale            |
| ImageURL    | https://.../image.jpg          | Lien direct vers une image publique           |
| DateAjout   | 2026-03-14                     | Format AAAA-MM-JJ recommandé                  |

Notes importantes :
- La ligne d'en-tête doit reprendre ces noms exacts (`ID`, `Nom`, `Type`, etc.) car `js/app.js` s'appuie dessus.
- Pour `Latitude`/`Longitude`, tu peux utiliser les coordonnées du pays (suffisant pour la carte) ou d'une ville précise si tu veux plus de finesse.
- `ImageURL` doit être un lien d'image accessible publiquement (par exemple une image hébergée sur Google Drive avec partage "public", Imgur, ou tout autre hébergeur d'images). Un lien de partage Drive classique ne fonctionne pas tel quel : il faut un lien d'affichage direct de l'image.
- Si `ImageURL` est vide, une image de remplacement s'affiche automatiquement, le site ne casse jamais.

## 2. Publier le Google Sheet et connecter le site

Deux méthodes possibles. La méthode A est recommandée (mise à jour quasi instantanée).

### Méthode A — Lien d'export CSV direct (recommandée)

1. Ouvre ton Google Sheet.
2. Clique sur "Partager" (en haut à droite) puis choisis "Toute personne disposant du lien" avec le rôle "Lecteur".
3. Récupère l'ID du document dans l'URL du navigateur, qui ressemble à :
   `https://docs.google.com/spreadsheets/d/VOTRE_ID_ICI/edit#gid=0`
4. Construis l'URL CSV suivante en remplaçant `VOTRE_ID_ICI` :
   `https://docs.google.com/spreadsheets/d/VOTRE_ID_ICI/export?format=csv&gid=0`
   (`gid=0` correspond à la première feuille ; change-le si tes données sont sur un autre onglet.)
5. Colle cette URL dans la constante `SHEET_CSV_URL` en haut du fichier `js/app.js`.

Avec cette méthode, chaque modification enregistrée dans le Sheet est visible sur le site dès le rechargement de la page (pas de délai de cache).

### Méthode B — Publication sur le web (Fichier > Publier sur le web)

1. Dans le Sheet, va dans `Fichier` > `Partager` > `Publier sur le web`.
2. Choisis la feuille concernée, sélectionne le format "Valeurs séparées par des virgules (.csv)", puis clique sur "Publier".
3. Copie l'URL générée (elle ressemble à `https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv`).
4. Colle cette URL dans la constante `SHEET_CSV_URL` en haut du fichier `js/app.js`.

Cette méthode met environ quelques minutes à répercuter les changements (cache de Google), mais fonctionne même si tu préfères ne pas activer le partage "Lecteur" du document lui-même.

## 3. Déploiement sur GitHub Pages

1. Crée un dépôt GitHub (public ou privé selon ton offre) et pousse-y l'intégralité du contenu de ce dossier (`index.html`, `collection.html`, `css/`, `js/`).
2. Dans le dépôt, va dans `Settings` > `Pages`.
3. Dans "Source", choisis la branche principale (`main`) et le dossier racine `/ (root)`.
4. Enregistre. Le site sera disponible après quelques minutes à une adresse du type :
   `https://TON-NOM-UTILISATEUR.github.io/NOM-DU-DEPOT/`

## 4. Ajouter ou modifier une pièce

Il suffit d'ajouter une ligne (ou de modifier une ligne existante) dans le Google Sheet. Aucune intervention sur le code n'est nécessaire : le site relit le CSV à chaque chargement de page.
