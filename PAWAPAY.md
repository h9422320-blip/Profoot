# PawaPay — encaissement mobile money

## Pourquoi cette seconde passerelle

Mesuré le 26 août 2026 sur 384 refus analysés un par un chez la passerelle
actuelle, la même offre ne se vend pas du tout selon le pays :

| Pays | Réussite | 1ʳᵉ cause de refus | Solde insuffisant |
|---|---|---|---|
| Côte d'Ivoire | 66,5 % | `INSUFFICIENT_BALANCE` | 85,6 % |
| Burkina Faso | 45,7 % | `GENERAL_ERROR` | **0 %** |
| Mali | 16,7 % | `GATEWAY_INTERNAL_ERROR` | **0 %** |
| Guinée | 16,4 % | `UNSPECIFIED_FAILURE` | **0 %** |

Dans quatre pays, **pas un seul refus pour solde insuffisant** : les clients
avaient l'argent, la passerelle les rejetait. En Guinée, Orange Money affiche
1 réussite sur 48 tentatives.

## Les variables d'environnement

À déclarer dans Vercel (Settings → Environment Variables) et, pour les essais
locaux, dans `.env.local`.

| Variable | Sandbox | Production |
|---|---|---|
| `PAWAPAY_API_TOKEN` | jeton sandbox | **jeton différent** |
| `PAWAPAY_BASE_URL` | `https://api.sandbox.pawapay.io` | `https://api.pawapay.io` |
| `PAWAPAY_CALLBACK_URL` | `https://profootai.com/api/pawapay/callback` | idem |

**Le bac à sable est le défaut.** Si `PAWAPAY_BASE_URL` est absente, le code
parle au sandbox — un oubli de réglage ne peut donc pas déclencher de vrais
paiements. C'est vérifié par un test.

Le jeton n'apparaît nulle part dans le code et n'est jamais journalisé, même en
cas d'erreur : un message d'erreur finit dans les journaux de l'hébergeur, qui
ne sont pas le bon endroit pour un secret. Deux tests le vérifient.

## Le parcours

```
1. Le client choisit une offre et saisit son numéro
        ↓
2. POST /api/pawapay/depot
        · l'identité vient de la SESSION, pas du corps de la requête
        · le montant est relu depuis les offres, JAMAIS reçu du navigateur
        · une intention est enregistrée (référence PAWA-…)
        · POST /v2/deposits chez PawaPay
        ↓
3. Réponse « ACCEPTED » → le client valide sur son téléphone
        ⚠ ACCEPTED N'EST PAS PAYÉ. Aucun accès n'est ouvert à ce stade.
        ↓
4. PawaPay appelle /api/pawapay/callback
        · l'empreinte du corps est contrôlée si elle est fournie
        · le statut annoncé n'est PAS cru
        ↓
5. GET /v2/deposits/{id} — relecture avec notre jeton
        · si COMPLETED → montant confronté à l'offre → accès ouvert
        · sinon → l'issue est notée, rien n'est ouvert
```

## La règle de sécurité qui tient tout le reste

**L'adresse de rappel est publique.** N'importe qui peut y envoyer un JSON
disant `COMPLETED`. Elle ne décide donc de rien : le message n'est qu'une
sonnette, et le statut est toujours relu chez PawaPay avec notre propre jeton.

PawaPay propose des signatures (RFC-9421, ECDSA P-256), facultatives. On
contrôle l'empreinte du corps quand elle est jointe, mais on ne rejette pas un
message non signé — la sécurité ne repose pas là-dessus. Même une signature
parfaite prouverait l'origine du message, pas l'état réel du paiement au moment
où l'on ouvre l'accès.

## Adresse IP fixe : non requise

Vérifié dans la documentation officielle : l'authentification se fait par jeton
Bearer, et **aucune liste blanche d'adresses IP n'est exigée**.

C'est décisif pour ProFoot : Vercel ne garantit aucune adresse de sortie fixe.
Si PawaPay imposait une liste blanche, il faudrait faire transiter les appels
par un relais à IP fixe — ce n'est pas nécessaire.

Le sens inverse est également libre : les rappels arrivent sur une adresse
publique en HTTPS, sans contrainte réseau.

## Les essais

```bash
node scripts/pawapay-sandbox.mjs
```

Le script **refuse de tourner** si l'adresse configurée n'est pas celle du bac à
sable. Il lit la configuration du compte, lance huit encaissements avec les
numéros de test officiels — cinq réussites, deux échecs, un resté en cours — et
relit chaque statut jusqu'à ce qu'il soit définitif.

Numéros de test PawaPay (la terminaison décide de l'issue) :

| Numéro | Issue |
|---|---|
| `254703456789` | `COMPLETED` |
| `254703456129` | reste `SUBMITTED` |
| `254703456049` | `FAILED` — `INSUFFICIENT_BALANCE` |
| `254703456019` | `FAILED` — `PAYER_LIMIT_REACHED` |

## Pour passer en production

1. Générer un **jeton de production** dans le tableau de bord PawaPay (il est
   différent du jeton sandbox).
2. Renseigner dans Vercel : `PAWAPAY_API_TOKEN` = jeton de production,
   `PAWAPAY_BASE_URL` = `https://api.pawapay.io`.
3. Déclarer l'adresse de rappel de production dans le tableau de bord PawaPay.
4. Obtenir le **feu vert de mise en service** auprès de PawaPay (validation du
   compte marchand, contrat, conformité).
5. Vérifier avec `GET /v2/active-conf` que les pays visés sont bien
   `OPERATIONAL` — Côte d'Ivoire, Guinée, Mali, Burkina, Togo, Bénin, Cameroun,
   Congo, RD Congo, Sénégal.
6. Faire **un premier encaissement réel de petit montant**, et vérifier que
   l'accès s'ouvre.

Aucun changement de code n'est nécessaire : tout tient dans les deux variables.
