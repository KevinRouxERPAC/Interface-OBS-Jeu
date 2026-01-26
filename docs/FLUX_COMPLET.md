# 🎮 Flux Complet du Quiz Interactif OBS

## Vue d'ensemble
Le quiz fonctionne en deux interfaces synchronisées :
- **Overlay** : Affiché au public dans OBS (lecture seule, aucun clic du public)
- **Admin** : Interface de contrôle du streamer (contrôle total du flux)

---

## 🔄 Étapes du Flux

### **Étape 1 : Démarrage**

#### Overlay (Public)
```
┌─────────────────────────────────┐
│  🎯 Quiz Interactif             │
│                                 │
│  En attente de sélection...     │
│                                 │
│  Bienvenue dans le jeu !        │
└─────────────────────────────────┘
```
- Affiche un écran d'attente
- Aucun choix visible
- Statut : "En attente"

#### Admin (Contrôle)
```
┌──────────────────────────────┐
│ État : ATTENTE               │
│                              │
│ [Nouvelle sélection]         │
│ [Nouvelle question]          │ (désactivé)
│ [Révéler réponse]            │ (désactivé)
└──────────────────────────────┘
```
- Bouton "Nouvelle sélection" : **ACTIF**
- Autres boutons : **DÉSACTIVÉS**
- Réinitialise l'état interne

---

### **Étape 2 : Clic sur "Nouvelle sélection"**

#### Overlay (Public)
```
┌─────────────────────────────────┐
│  🎯 Choisissez la difficulté    │
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌──────┐
│  │  A  │ │  B  │ │  C  │ │  D   │
│  │Coll.│ │Lycée│ │Lic. │ │Master│
│  └─────┘ └─────┘ └─────┘ └──────┘
└─────────────────────────────────┘
```
- Affiche les 4 difficultés comme des propositions
- Format : A/B/C/D + Nom
- Aucune sélection mise en surbrillance

#### Admin (Contrôle)
```
┌──────────────────────────────┐
│ État : SÉLECTION_DIFFICULTÉ  │
│                              │
│ [Collège]   [Lycée]          │
│ [Licence]   [Master]         │
│                              │
│ (Les autres boutons restent  │
│  désactivés)                 │
└──────────────────────────────┘
```
- Affiche 4 boutons de difficulté
- Admin clique pour choisir la difficulté
- Les autres boutons restent désactivés

---

### **Étape 3 : Sélection de la Difficulté**

#### Overlay (Public)
```
┌─────────────────────────────────┐
│  🎯 Difficulté sélectionnée     │
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌──────┐
│  │  A  │ │  B  │ │  C  │ │  D   │
│  │Coll.│ │Lycée│ │Lic. │ │Master│
│  └─────┘ └─────┘ └─────┘ └──────┘
│          ↑ Surligné (violé)
│
│  → La difficulté reste visible pendant 3 secondes
└─────────────────────────────────┘
```
- Met en surbrillance la difficulté choisie (style réponse sélectionnée)
- Affiche : "Difficulté sélectionnée : X"
- Durée : 3 secondes

#### Admin (Contrôle)
```
┌──────────────────────────────┐
│ État : SÉLECTION_CATÉGORIE   │
│                              │
│ Difficulté : Lycée ✓         │
│                              │
│ Catégories :                 │
│ [Ancienne] [Médiévale]       │
│ [Moderne] [Contemporaine]    │
│                              │
│ État : ATTENTE_CATÉGORIE     │
└──────────────────────────────┘
```
- Stocke la difficulté choisie
- Affiche les catégories correspondantes
- Admin clique pour choisir la catégorie

---

### **Étape 4 : Sélection de la Catégorie**

#### Overlay (Public)
```
┌─────────────────────────────────┐
│  📂 Choisissez la catégorie     │
│                                 │
│  ┌───────┐ ┌───────┐            │
│  │   A   │ │   B   │            │
│  │Ancienne│ │Méd.   │            │
│  └───────┘ └───────┘            │
│  ┌───────┐ ┌───────┐            │
│  │   C   │ │   D   │            │
│  │Moderne│ │Contemp.            │
│  └───────┘ └───────┘            │
└─────────────────────────────────┘
```
- Affiche les catégories comme des propositions
- Aucune sélection mise en surbrillance (attente du choix)

#### Admin (Contrôle)
- Clique sur une catégorie pour la choisir

#### Overlay (Après sélection)
```
┌─────────────────────────────────┐
│  📂 Catégorie sélectionnée      │
│                                 │
│  ┌───────┐ ┌───────┐            │
│  │   A   │ │   B   │            │
│  │Ancienne│ │Méd.   │            │
│  └───────┘ └───────┘            │
│  ┌───────┐ ┌───────┐            │
│  │   C   │ │   D   │            │
│  │Moderne│ │Contemp.            │
│  └───────┘ └───────┘            │
│          ↑ Surligné (violé)
│
│  → La catégorie reste visible pendant 3 secondes
└─────────────────────────────────┘
```

#### Admin (Après sélection)
```
┌──────────────────────────────┐
│ État : SÉLECTION_THÈME       │
│                              │
│ Difficulté : Lycée ✓         │
│ Catégorie : Moderne ✓        │
│                              │
│ [🎲 Tirer un thème]          │
│                              │
│ (Nouveau bouton actif)       │
└──────────────────────────────┘
```
- Stocke la catégorie choisie
- Active le bouton "Tirer un thème"

---

### **Étape 5 : Sélection Aléatoire du Thème**

#### Admin (Contrôle)
- Clique sur "Tirer un thème"
- Sélectionne un thème aléatoire parmi ceux de la catégorie

#### Overlay (Public) - Animation
```
┌─────────────────────────────────┐
│  🎲 Sélection du thème...       │
│                                 │
│  ⏳ Tirage en cours...          │
│                                 │
│  (Animation de chargement)      │
└─────────────────────────────────┘
```
- Affiche une animation pendant 2-3 secondes

#### Overlay (Après sélection)
```
┌─────────────────────────────────┐
│  🎨 Thème sélectionné           │
│                                 │
│  Lycée | Moderne                │
│                                 │
│  La Révolution Française        │
│                                 │
│  (Peut afficher une description)│
└─────────────────────────────────┘
```
- Affiche le thème sélectionné
- Affiche la catégorie et la difficulté en petit
- Peut afficher une description

#### Admin (Après sélection)
```
┌──────────────────────────────┐
│ État : ATTENTE_QUESTION      │
│                              │
│ Difficulté : Lycée ✓         │
│ Catégorie : Moderne ✓        │
│ Thème : Rév. Française ✓     │
│                              │
│ [🚀 Lancer la question]      │
│                              │
│ (Nouveau bouton actif)       │
└──────────────────────────────┘
```
- Stocke le thème sélectionné
- Active le bouton "Lancer la question"

---

### **Étape 6 : Lancement de la Question**

#### Admin (Contrôle)
- Clique sur "Lancer la question"
- Charge une question aléatoire du thème
- Envoie la question à l'overlay

#### Overlay (Public)
```
┌─────────────────────────────────┐
│  Lycée | Moderne | Rév. Fr.     │
│                                 │
│  En quel année la Révolution    │
│  Française a-t-elle débuté ?    │
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌──────┐
│  │  A  │ │  B  │ │  C  │ │  D   │
│  │1780 │ │1789 │ │1799 │ │1815  │
│  └─────┘ └─────┘ └─────┘ └──────┘
│                                 │
│  ⏱️ 30s                         │
│  ████████████████░░░░░░░░░░░░  │
└─────────────────────────────────┘
```
- Affiche la difficulté, catégorie, thème en petit
- Affiche la question
- Affiche les 4 propositions (A/B/C/D)
- Lance un timer animé (30 secondes par défaut)
- La bonne réponse n'est pas révélée

#### Admin (Après lancement)
```
┌──────────────────────────────┐
│ État : QUESTION_EN_COURS      │
│                              │
│ Question : "En quel année..." │
│                              │
│ [✓ Réponse correcte : B]     │
│                              │
│ ┌─────────────────────────┐  │
│ │ [Révéler réponse]       │  │
│ │ [Nouvelle question]     │  │
│ │ [Nouvelle sélection]    │  │
│ └─────────────────────────┘  │
│                              │
│ (Tous les boutons sont actifs)
└──────────────────────────────┘
```
- Affiche la question et les propositions
- Affiche quelle est la bonne réponse (seul l'admin la voit)
- Active les 3 boutons :
  - "Révéler réponse"
  - "Nouvelle question"
  - "Nouvelle sélection"

---

### **Étape 7 : Révélation de la Réponse**

#### Admin (Contrôle)
- Clique sur "Révéler réponse"
- Envoie la commande à l'overlay

#### Overlay (Public)
```
┌─────────────────────────────────┐
│  Lycée | Moderne | Rév. Fr.     │
│                                 │
│  En quel année la Révolution    │
│  Française a-t-elle débuté ?    │
│                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌──────┐
│  │  A  │ │  B  │ │  C  │ │  D   │
│  │1780 │ │1789 │ │1799 │ │1815  │
│  └─────┘ └─────┘ └─────┘ └──────┘
│          ↑ VERTE (correcte)
│          ✅
│
│  💡 Explication: La Révolution a
│  commencé en 1789 avec la prise
│  de la Bastille.
└─────────────────────────────────┘
```
- La bonne réponse devient **VERTE** ✅
- Les autres réponses deviennent **GRISES**
- Affiche l'explication de la réponse
- Timer s'arrête

---

### **Étape 8 : Après Révélation**

#### Admin (Contrôle)

**Option 1 : Nouvelle Question**
```
Clique sur [Nouvelle question]
↓
Étape 6 : Lancer une nouvelle question du même thème
```

**Option 2 : Nouvelle Sélection**
```
Clique sur [Nouvelle sélection]
↓
Étape 1 : Écran d'attente
↓
Étape 2 : Recommencer le flux
```

---

## 📊 Diagramme d'État

```
┌─────────┐
│ ATTENTE │ ← État initial
└────┬────┘
     │ Clic "Nouvelle sélection"
     ↓
┌──────────────────┐
│ SÉLECTION_DIFF   │ ← Affiche difficultés
└────┬─────────────┘
     │ Choix difficulté
     ↓
┌──────────────────┐
│ SÉLECTION_CAT    │ ← Affiche catégories
└────┬─────────────┘
     │ Choix catégorie
     ↓
┌──────────────────┐
│ SÉLECTION_THÈME  │ ← Tire thème aléatoire
└────┬─────────────┘
     │ Confirmation thème
     ↓
┌──────────────────┐
│ QUESTION_EN_COURS│ ← Affiche question
└────┬─────────────┘
     │ Révéler réponse
     ↓
┌──────────────────┐
│ RÉPONSE_RÉVÉLÉE  │ ← Affiche bonne réponse
└────┬─────────────┘
     │
     ├─→ Nouvelle question → QUESTION_EN_COURS
     │
     └─→ Nouvelle sélection → ATTENTE
```

---

## 💾 Structures de Données

### État Global (Admin)
```javascript
{
  state: 'ATTENTE', // État actuel du flux
  selectedDifficulty: { id: '2', name: 'Lycée' },
  selectedCategory: { id: 'MOD', name: 'Moderne' },
  selectedTheme: { id: 'RF', name: 'Révolution Française' },
  currentQuestion: {
    id: 1,
    question: 'En quel année...',
    propositions: ['1780', '1789', '1799', '1815'],
    bonneReponse: 1, // Index de la bonne réponse
    explication: 'La Révolution a commencé en 1789...'
  }
}
```

### Commandes Admin → Overlay
```javascript
// Lancer une sélection
{ type: 'START_SELECTION' }

// Afficher une liste de difficultés
{ type: 'SHOW_LEVELS_LIST', levels: [...], selectedId: '2' }

// Afficher une liste de catégories
{ type: 'SHOW_CATEGORIES_LIST', categories: [...], selectedId: 'MOD' }

// Afficher un thème sélectionné
{ type: 'SHOW_THEME', theme: { ... } }

// Lancer une question
{ type: 'LOAD_QUESTION', question: { ... } }

// Révéler la réponse
{ type: 'REVEAL_ANSWER' }

// Relancer le timer
{ type: 'RESTART_TIMER', duration: 30 }
```

---

## 🎨 Zones Visuelles Overlay

```
┌─────────────────────────────────────────────┐
│ Statut connexion (haut droit)               │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│                                             │
│              CONTENU PRINCIPAL              │
│                                             │
│  • Écran d'attente                          │
│  • Sélection (difficultés/catégories)       │
│  • Thème sélectionné                        │
│  • Question + Propositions                  │
│                                             │
│              Infos sélection (tags)         │
│         🎯 Lycée | 📂 Moderne | 🎨 Rev.Fr.│
│                                             │
└─────────────────────────────────────────────┘
```

---

## 🔌 Communication Overlay ↔ Admin

- **Protocole** : BroadcastChannel (onglets navigateur) ou API serveur
- **Direction** : Admin → Overlay (unilatérale)
- **Fréquence** : À chaque action admin (clic bouton)
- **Synchronisation** : Immédiate (200-500ms)

---

## 📝 Résumé des Boutons Admin

| État | Boutons Actifs |
|------|---|
| **ATTENTE** | Nouvelle sélection |
| **SÉLECTION_DIFF** | (Grid de difficultés) |
| **SÉLECTION_CAT** | (Grid de catégories) |
| **SÉLECTION_THÈME** | Tirer un thème |
| **ATTENTE_QUESTION** | Lancer la question |
| **QUESTION_EN_COURS** | Révéler réponse, Nouvelle question, Nouvelle sélection |
| **RÉPONSE_RÉVÉLÉE** | Nouvelle question, Nouvelle sélection |

---

**Fin du flux documenté.** ✅
