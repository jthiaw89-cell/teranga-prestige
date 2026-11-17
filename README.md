<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/ba351f0b-458a-4e53-9e70-2e093214b09f

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Module de comptabilité

Le module comptable utilise une API Express distincte et une base PostgreSQL. Il n'est pas activé par le seul démarrage de Vite.

1. Ajouter les variables de [platform.env.example](./platform.env.example) au fichier `.env` local existant, sans écraser ses autres clés, puis renseigner les paramètres PostgreSQL. En production, définir également `APP_ORIGIN` sur l'origine exacte de l'application et activer TLS selon les exigences du fournisseur.
2. Créer la base et exécuter `npm run accounting:migrate`.
3. Renseigner les variables `ACCOUNTING_ORGANIZATION_*` et `ACCOUNTING_ADMIN_*`, puis exécuter une seule fois `npm run accounting:bootstrap`. Le mot de passe propriétaire doit être unique et comporter au moins 14 caractères.
4. Démarrer l'API avec `npm run accounting:api`, puis l'application avec `npm run dev`. Le proxy Vite transmet `/api` à l'API locale.
5. Se connecter au module, créer l'exercice et les journaux, puis importer un plan comptable vérifié pour l'entreprise avant toute saisie.

Le module impose une authentification comptable séparée et des écritures équilibrées en partie double. Les règles SYSCOHADA, le plan de comptes, les taux et traitements fiscaux, les états réglementaires et la clôture doivent être vérifiés par un professionnel sénégalais avant tout usage légal ou en production. La mise en service nécessite une base PostgreSQL réellement configurée et sécurisée.

## Commandes et documents CRM

Dans l'onglet « Commandes & documents », ajoutez d'abord les clients et fournisseurs dans « Contacts », puis créez devis, commandes clients, bons de livraison, factures clients, bons de commande fournisseurs et factures fournisseurs. Les statuts guident le cycle de validation; les livraisons peuvent être partielles, et les paiements suivis en plusieurs règlements. Chaque document peut être imprimé/enregistré en PDF ou exporté en CSV.

Ces documents et leurs paiements sont enregistrés dans le stockage local du navigateur pour l'organisation sélectionnée. Ils ne sont pas synchronisés entre utilisateurs ou avec le module de comptabilité PostgreSQL. Vérifiez les règles de TVA et les mentions légales avant d'utiliser un document comme pièce réglementaire.

## Intranet du personnel

L'intranet s'appuie sur le même serveur Express et PostgreSQL, mais possède ses propres comptes employés et sessions HttpOnly. Les rôles simulés de l'interface ne donnent aucun accès aux canaux ou fichiers.

1. Configurer `DATABASE_URL`, puis exécuter `npm run accounting:migrate` afin de créer également les tables de l'intranet.
2. Définir les variables `INTRANET_ORGANIZATION_*` et `INTRANET_ADMIN_*` de [platform.env.example](./platform.env.example), puis lancer une seule fois `npm run intranet:bootstrap`. Cela crée le premier compte administrateur intranet et les canaux Général, Direction, Managers et Équipe employés.
3. Démarrer `npm run accounting:api` et `npm run dev`. L'administrateur se connecte au module et crée les comptes personnels des employés, managers et membres de la direction; chaque personne reçoit un identifiant professionnel et un mot de passe temporaire d'au moins 14 caractères.

Les utilisateurs ne peuvent voir que les canaux auxquels ils sont inscrits. Les messages privés sont réservés aux deux participants; les canaux personnalisés sont privés à leurs membres. Les forums acceptent des sujets et des réponses; le chat se rafraîchit automatiquement. Les pièces jointes autorisées (PDF, Office, TXT, CSV, PNG, JPG, WEBP) sont stockées dans PostgreSQL, limitées à 5 Mo et téléchargeables uniquement par un membre du canal.

Aucun fournisseur SSO/OIDC n'étant configuré dans le projet, l'accès utilise des identifiants individuels plutôt qu'un SSO simulé. Le chat se met à jour par interrogation périodique; un service WebSocket et l'analyse antivirus des pièces jointes nécessitent une infrastructure supplémentaire avant une mise en production à grande échelle.

### Profils de démonstration locaux

Après `npm run accounting:migrate`, lancez `npm run profiles:test -- --confirm-local-test-database` pour créer les comptes de démonstration dans les organisations isolées `tpd-demo-accounting` et `tpd-demo-intranet`. Le script refuse les bases PostgreSQL non locales et l'environnement `NODE_ENV=production`. Il génère les mots de passe aléatoirement et les affiche dans le terminal uniquement après la création; copiez-les, car ils ne sont pas enregistrés en clair.

Les profils intranet couvrent propriétaire, direction, manager et employé. Les profils comptables couvrent propriétaire, comptable et lecture seule. Pour la connexion intranet, utilisez l'identifiant d'organisation `tpd-demo-intranet`; la connexion comptable se fait avec l'adresse e-mail seule. Une nouvelle exécution renouvelle les mots de passe de ces comptes de test.
