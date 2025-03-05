# 📌 API Documentation - Cantine Connect

## 🛠🖥 Technologies et Packages Utilisés

- Node.js avec Express.js
- PostgreSQL avec Prisma ORM
- JWT-Passport pour l’authentification
- Cloudinary pour stocker les images
- Cors pour bloquer les origines inconnues

## 🔐 Authentification

### Connexion Parent/Agent/Admin

#### Endpoint

```http
  POST /api/auth/login
```

#### Données attendues

```json
{
  "email": "parent@example.com",
  "password": "motdepasse",
  "role": "parent"
}
```

#### Réponses possibles

**200 OK : Connexion en tant que Parent/Agent/Admin réussie.**

```json
{
  "message": "Connexion réussie",
  "token": "jwt_token",
  "user": {
    "id": 12,
    "role": "parent",
    "name": "Jean Dupont"
  }
}
```

**403 Forbidden : Email ou mot de passe incorrect.**

```json
{
  "error": "Identifiants incorrects"
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

### Déconnexion

**Endpoint**:
`POST /api/auth/logout`

#### Réponses possibles

**200 OK : Déconnexion réussie.**

```json
{
  "message": "Déconnexion réussie"
}
```

**401 Unauthorized : Utilisateur non identifié/connecté.**

```json
{
  "error": "Vous n'êtes pas autorisé à effectuer cette tâche."
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

---

## 🎓 Gestion des Élèves

### Liste des élèves inscrits à la Cantine Connect (Admin)

#### Endpoint

```http
  GET /api/students?page=1&limit=10
```

| Paramètre | Type     | Description        | Défaut |
| --------- | -------- | ------------------ | ------ |
| `page`    | `String` | La page demandée   | 1      |
| `limit`   | `String` | La limite par page | 10     |

#### Réponses possibles

**200 OK: Liste des élèves.**

```json
[
  {
    "id": 1,
    "name": "Paul Mbuya",
    "class": "6ème B",
    "matriculeHashe": "cfgdhe-tydevhazedfvhj-vdgh67UIB-ejhb3hbbHD",
    "abonnement": {
      "status": "actif",
      "duration": 3, // 3 jours
      "expiration": "2025-03-10"
    },
    "historiqueRepas": [
      { "date": "2025-03-01", "status": true },
      { "date": "2025-03-02", "status": false }
    ]
  }
]
```

**401 Unauthorized : L’utilisateur n’a pas les permissions.**

```json
{
  "error": "Accès refusé"
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

### Détails d'un élève spécifique

**Endpoint**:
`GET /api/students/${id}`

| Paramètre | Type     | Description                 |
| :-------- | :------- | :-------------------------- |
| `id`      | `string` | **Required**. Id de l'élève |

#### Réponses possibles

**200 OK: Détail d'un l'élève.**

```json
{
  "id": 1,
  "name": "Paul Mbuya",
  "class": "6ème B",
  "matriculeHashe": "cfgdhe-tydevhazedfvhj-vdgh67UIB-ejhb3hbbHD",
  "abonnement": {}
}
```

**403 Forbidden : L’utilisateur n’a pas les permissions.**

```json
{
  "error": "Accès refusé"
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

## 🍽️ Gestion des Abonnements Cantine

### Achat d’un abonnement (Par le Parent)

**Endpoint**:
`POST /api/students/${matriculeHashe}/abonnements`

| Paramètre        | Type     | Description                             |
| :--------------- | :------- | :-------------------------------------- |
| `matriculeHashe` | `string` | **Required**. matriculeHashé de l'élève |

**Body attendu (JSON)**:

```json
{
  "duration": 3, //3 jours
  "price": 5000 //5000 fc
}
```

{
"error": "Un abonnement est déjà actif pour cet élève"
}
**_De préference faire une vérification au front pour voir si l'élève a déjà un abonnement actif et avertir le Parent._**

#### Réponses possibles

**200 OK: Achat réussi avec Succès.**

```json
{
  "message": "Abonnement activé pour 3 jours",
  "user": {
    "id": 1,
    "name": "Paul Mbuya",
    "class": "6ème B",
    "abonnement": {}
  }
}
```

**400 Bad Request : Durée absente ou invalide.**

```json
{
  "error": "Durée invalide"
}
```

**401 Unauthorized : L’utilisateur n’a pas les permissions.**

```json
{
  "error": "Accès refusé"
}
```

**404 Not Found : Aucun utilisateur trouvé.**

```json
{
  "error": "Aucun utilisateur trouvé"
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

## 🍽️ Gestion des Repas (Scan QR Code)

### L'Agent scanne un QRCode d’élève

#### Endpoint

`POST /api/students/scan`

**Body attendu (JSON)**:

```json
{
  "matriculeHashe": "cfgdhe-tydevhazedfvhj-vdgh67UIB-ejhb3hbbHD"
}
```

#### Réponses possibles

**200 OK: Repas validé avec Succès.**

```json
{
  "message": "Repas validé",
  "user": {
    "id": 1,
    "name": "Paul Mbuya",
    "class": "6ème B",
    "abonnement": {}
  }
}
```

**400 Bad Request : Pas d’abonnement actif.**

```json
{
  "error": "Pas d’abonnement actif"
}
```

**404 Not Found : Élève non inscrit à la Cantine.**

```json
{
  "error": "Élève non inscrit à la Cantine"
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

## 📊 Affichage de l’Historique

### Récupération de l’historique des repas

#### Endpoint

`GET /api/students/${id}/historique-repas`

| Paramètre | Type     | Description                 |
| :-------- | :------- | :-------------------------- |
| `id`      | `string` | **Required**. Id de l'élève |

Ajout possible : Ajout des filtres pour permettre aux parents de consulter l'historique sur une période spécifique.
Exemple : `GET /api/students/${id}/historique-repas?startDate=2025-03-01&endDate=2025-03-31`

#### Réponses possibles

**200 OK: Envoi de l'historique.**

```json
{
  "calendar": [
    { "date": "2025-03-01", "status": true },
    { "date": "2025-03-02", "status": false },
    { "date": "2025-03-03", "status": false },
    { "date": "2025-03-04", "status": null }
  ]
}
```

**Commentaires:**
📅 null → Week-end & absence à la Cantine (fond gris)
✅ true → A mangé (fond vert)
❌ false → N’a pas mangé car on l'a scanner et on a vu que l'élève n'avait pas d'abonnement (fond rouge)

**404 Not Found : Élève non inscrit à la Cantine.**

```json
{
  "error": "Élève non inscrit à la Cantine"
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

## 📢 Notifications Parents

### Récupérer toutes les notifications

#### Endpoint

`GET /api/students/${id}/notifications?page=1&limit=10`

| Paramètre | Type     | Description        | Défaut |
| --------- | -------- | ------------------ | ------ |
| `page`    | `String` | La page demandée   | 1      |
| `limit`   | `String` | La limite par page | 10     |

#### Réponses possibles

**200 OK: Envoi des notifications.**

**Notif type Repas:**

```json
[
  {
    "id": 1,
    "message": "Votre enfant a mangé aujourd'hui le 03/03/2025 à 15H34",
    "type": "repas",
    "details": {
      "date": "2025-03-03T15:34:00Z",
      "status": true
    },
    "read": false,
    "timestamp": "2025-03-03T15:34:00Z"
  }
]
```

**Notif type Achat d'Abonnement:**

```json
{
  "id": 1,
  "studentId": 1,
  "message": "Abonnement de 30 jours acheté pour 70000fc",
  "type": "abonnement",
  "details": {
    "duration": 30,
    "price": 70000,
    "endDate": "2025-03-31T00:00:00Z"
  },
  "read": false,
  "createdAt": "2025-03-01T12:00:00Z"
}
```

**Notif type Expiration d'Abonnement:**

```json
{
  "id": 2,
  "studentId": 1,
  "message": "Votre abonnement expire dans 12 heures",
  "type": "expiration",
  "details": { "endDate": "2025-03-31T00:00:00Z" },
  "read": false,
  "createdAt": "2025-03-30T12:00:00Z"
}
```

**401 Unauthorized : L’utilisateur n’a pas les permissions.**

```json
{
  "error": "Accès refusé"
}
```

**404 Not Found : Aucun utilisateur trouvé.**

```json
{
  "error": "Aucun utilisateur trouvé"
}
```

**500 Internal Server Error : Bug backend.**

```json
{
  "error": "Erreur serveur"
}
```

## 📚 Documentation Supplémentaire

### Erreurs Communes et Solutions

Cette section explique les erreurs courantes que vous pourriez rencontrer lors de l'utilisation de l'API **CantineConnect**, ainsi que des conseils pour les résoudre.

---

#### 400 Bad Request

- **Cause** : La requête est mal formulée ou contient des données invalides.
- **Exemples :**
  - Un champ obligatoire est manquant (par exemple, `email` ou `password`).
  - Une valeur est dans un format incorrect (par exemple, une date au lieu d'un nombre).
- **Solution :**

  - Vérifiez que tous les champs obligatoires sont présents dans la requête.

  - Assurez-vous que les données sont dans le bon format (par exemple, un email valide, un nombre pour un champ de prix, etc.).

  - Consultez la documentation pour connaître les formats attendus.

---

#### 401 Unauthorized

- **Cause** : L'utilisateur n'est pas autorisé à accéder à la ressource demandée.
- **Exemples :**
  - Le token JWT est manquant, expiré ou invalide.
  - L'utilisateur tente d'accéder à une ressource réservée à un autre rôle (par exemple, un parent essayant d'accéder à une fonctionnalité admin).
- **Solution :**
  - Vérifiez que vous êtes connecté et que votre token JWT est valide.
  - Assurez-vous que vous utilisez le bon rôle (parent, agent ou admin) pour accéder à la ressource.
  - Si le token est expiré, déconnectez-vous et reconnectez-vous pour en obtenir un nouveau.

---

#### 403 Forbidden

- **Cause** : L'utilisateur n'a pas les permissions nécessaires pour effectuer l'action demandée.
- **Exemples :**
  - Un parent tente de modifier les données d'un autre parent.
  - Un agent tente d'accéder à une fonctionnalité réservée à l'admin.
- **Solution :**
  - Vérifiez que vous avez les droits nécessaires pour effectuer cette action.
  - Contactez l'administrateur si vous pensez que c'est une erreur.

---

#### 404 Not Found

- **Cause** : La ressource demandée n'existe pas.
- **Exemples :**
  - L'ID d'un élève ou d'un abonnement est incorrect.
  - L'URL de l'endpoint est mal orthographiée.
- **Solution :**
  - Vérifiez que l'ID ou l'URL est correct.
  - Assurez-vous que la ressource existe dans la base de données.

---

#### 500 Internal Server Error

- **Cause** : Une erreur s'est produite côté serveur.
- **Exemples :**
  - Un bug dans le code backend.
  - Une panne de la base de données.
- **Solution :**
  - Contactez l'administrateur système pour signaler le problème.
  - Vérifiez les logs du serveur pour plus de détails sur l'erreur.

---

#### Conseils Généraux

- **Validation des Données :**
  - Avant d'envoyer une requête, assurez-vous que toutes les données sont valides et dans le bon format.
  - Utilisez des outils comme Postman pour tester vos requêtes avant de les intégrer dans votre application.
- **Gestion des Tokens :**
  - Stockez le token JWT de manière sécurisée dans les cookies.
  - Rafraîchissez le token avant son expiration pour éviter les interruptions de service.
- **Pagination :**
  - Pour les endpoints qui renvoient des listes (par exemple, la liste des élèves), utilisez les paramètres `page` et `limit` pour éviter de surcharger le serveur.

---

#### Exemple de Requête avec Postman

Voici un exemple de requête pour se connecter en tant que parent :

1. **Méthode :** `POST`
2. **URL :** `http://votre-domaine/api/auth/login`
3. **Headers :**
   - `Content-Type: application/json`
4. **Body :** (JSON)

```json
{
  "email": "parent@example.com",
  "password": "motdepasse",
  "role": "parent"
}
```

---

#### Support technique

Si vous rencontrez des problèmes persistants, contactez l'équipe technique à l'adresse suivante :

- **Email**: <support@cantineconnect.com>
- **Téléphone**: +243 977 873 421

---

## **Workflows de CantineConnect**

---

### **1. Workflow d'Enregistrement d'un Élève à la Cantine**

#### **Acteurs** : Admin, Parent

1. **Étape 1** : Le parent contacte l'Admin pour demander l'enregistrement de son enfant à la cantine.
2. **Étape 2** : L'Admin se connecte à son tableau de bord et sélectionne l'élève dans la liste des élèves de l'école (`SchoolStudent`).
3. **Étape 3** : L'Admin vérifie si l'élève est déjà inscrit à la cantine.
4. **Étape 4** : Si l'élève n'est pas encore inscrit :
   - L'Admin crée un enregistrement dans la table `Student`.
   - Un `matriculeHashe` est généré pour le QR Code.
   - Le QR Code est généré au format PDF pour impression.
5. **Étape 5** : L'Admin envoie le PDF au parent pour impression.

---

### **2. Workflow de Création d'un Compte Agent**

#### **Acteurs** : Admin

1. **Étape 1** : L'Admin se connecte à son tableau de bord.
2. **Étape 2** : L'Admin crée un nouveau compte agent en renseignant :
   - L'email de l'agent.
   - Un mot de passe temporaire.
3. **Étape 3** : Le système envoie un email à l'agent avec ses informations de connexion.
4. **Étape 4** : L'agent se connecte et change son mot de passe.

---

### **3. Workflow de Connexion du Parent**

#### **Acteurs** : Parent

1. **Étape 1** : Le parent se connecte avec son email et son mot de passe.
2. **Étape 2** : Le système récupère la liste des enfants associés à ce parent.
3. **Étape 3** : Le parent voit une interface avec :
   - Une liste de ses enfants.
   - Des options pour gérer les abonnements, consulter l'historique, etc.

---

### **4. Workflow d'Achat d'Abonnement**

#### **Acteurs** : Parent

1. **Étape 1** : Le parent sélectionne un enfant dans la liste.
2. **Étape 2** : Le parent choisit une durée d'abonnement (1, 3, 7 ou 30 jours).
3. **Étape 3** : Le système calcule le prix en fonction de la durée :
   - 1 jour = 2000fc
   - 3 jours = 7000fc
   - 7 jours = 15000fc
   - 30 jours = 70000fc
4. **Étape 4** : Un enregistrement est créé dans la table `Abonnement` avec :
   - La durée et le prix.
   - Les dates de début et de fin.
   - Le statut "actif".
5. **Étape 5** : Le parent reçoit une notification avec les détails de l'abonnement.

---

### **5. Workflow de Scan du QR Code**

#### **Acteurs** : Agent, Parent

1. **Étape 1** : L'agent scanne le QR Code de l'élève.
2. **Étape 2** : Le système vérifie :
   - Si l'élève a un abonnement actif.
   - Si l'élève n'a pas déjà été servi aujourd'hui.
3. **Étape 3** :
   - Si tout est valide, un enregistrement est créé dans la table `Repas` avec `status: true`.
   - Si l'abonnement est expiré, un enregistrement est créé avec `status: false`.
4. **Étape 4** : Le parent reçoit une notification indiquant si l'enfant a été servi ou non.

---

### **6. Workflow de Gestion des Notifications**

#### **Acteurs** : Parent

1. **Types de Notifications** :
   - **Achat d'abonnement** : Détails de l'opération (montant, durée, etc.).
   - **Scan du QR Code** : Confirmation du repas pris ou non.
   - **Expiration d'abonnement** : Rappel 12 heures avant la fin de l'abonnement.
2. **Marquage comme Lu** :
   - Lorsqu'un parent ouvre une notification, le champ `read` est mis à `true`.

---

### **7. Workflow de Récupération de l'Historique des Repas**

#### **Acteurs** : Parent

1. **Étape 1** : Le parent sélectionne un enfant dans la liste.
2. **Étape 2** : Le système renvoie un calendrier avec :
   - `true` : Repas pris (fond vert).
   - `false` : Repas non pris (fond rouge).
   - `null` : Week-end ou absence (fond gris).
3. **Filtres** :
   - Le parent peut filtrer par période (ex: du 01/03/2025 au 31/03/2025).

---

### **8. Workflow de Gestion des Utilisateurs (Admin)**

#### **Acteurs** : Admin

1. **Création de Comptes** :
   - L'Admin peut créer des comptes pour les parents, les agents et les autres admins.
2. **Gestion des Élèves** :
   - L'Admin peut consulter la liste de tous les élèves de l'école (`SchoolStudent`).
   - L'Admin peut enregistrer des élèves à la cantine (`Student`).
3. **Statistiques** :
   - L'Admin peut consulter des statistiques globales (nombre de repas servis, abonnements actifs, etc.).

---

### **9. Workflow de Notification d'Expiration d'Abonnement**

#### **Acteurs** : Système, Parent

1. **Étape 1** : Le système vérifie les abonnements actifs.
2. **Étape 2** : Si un abonnement expire dans 12 heures :
   - Le système envoie une notification au parent.
3. **Étape 3** : Le parent reçoit une notification :

```json
{
  "message": "Votre abonnement pour Paul Mbuya expire dans 12 heures",
  "type": "expiration",
  "details": { "endDate": "2025-03-31T00:00:00Z" }
}
```

---

### **10. Workflow de Consultation des Statistiques (Admin)**

#### **Acteurs** : Admin

1. **Étape 1** : L'Admin se connecte à son tableau de bord.
2. **Étape 2** : L'Admin consulte les statistiques globales :
   - Nombre de repas servis par jour/semaine/mois.
   - Nombre d'abonnements actifs.
   - Nombre d'élèves inscrits à la cantine.
3. **Étape 3** : L'Admin peut exporter ces données au format PDF ou Excel.

---

### **Résumé des Workflows**

| **Workflow**                     | **Acteurs**     | **Description**                                                                  |
| -------------------------------- | --------------- | -------------------------------------------------------------------------------- |
| Enregistrement d'un élève        | Admin, Parent   | L'Admin enregistre un élève à la cantine et génère un QR Code.                   |
| Création d'un compte agent       | Admin           | L'Admin crée un compte agent et envoie les informations de connexion.            |
| Connexion du parent              | Parent          | Le parent se connecte et voit la liste de ses enfants.                           |
| Achat d'abonnement               | Parent          | Le parent achète un abonnement pour un enfant.                                   |
| Scan du QR Code                  | Agent, Parent   | L'agent scanne le QR Code et valide le repas.                                    |
| Gestion des notifications        | Parent          | Le parent reçoit et consulte les notifications.                                  |
| Historique des repas             | Parent          | Le parent consulte l'historique des repas pour un enfant.                        |
| Gestion des utilisateurs (Admin) | Admin           | L'Admin crée et gère les comptes des parents, agents et admins.                  |
| Notification d'expiration        | Système, Parent | Le système envoie une notification 12 heures avant l'expiration d'un abonnement. |
| Consultation des statistiques    | Admin           | L'Admin consulte les statistiques globales de la cantine.                        |
