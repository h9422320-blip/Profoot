# Échecs de paiement en Guinée, Burkina Faso, Mali et Togo

**Boutique :** Profoot
**Date :** 26 août 2026
**Gravité :** élevée — pertes en cours, dernier échec constaté aujourd'hui à 18h38 UTC

---

## Résumé

Depuis deux semaines, les paiements mobile money venant de **Guinée, du Burkina Faso, du Mali et du Togo** échouent dans des proportions que le comportement des clients n'explique pas.

Dans ces quatre pays, **aucun échec n'est dû à un solde insuffisant. Pas un seul.** Les clients ont l'argent sur leur compte : c'est la passerelle qui les refuse.

À l'inverse, en Côte d'Ivoire et au Cameroun, la même boutique convertit normalement, et les échecs y sont massivement des `INSUFFICIENT_BALANCE` — ce qui est attendu et ne relève pas de vous.

Nous avons analysé **384 ventes refusées et 337 ventes abouties**, une par une, via votre API.

---

## Les faits, pays par pays

### Guinée — Orange Money : 1 réussite sur 48 tentatives

| | |
|---|---|
| Tentatives avec Orange Money | 48 |
| Réussies | **1** |
| Refusées | **47** |
| Erreur dominante | `UNSPECIFIED_FAILURE` — **46 sur 47** |
| Solde insuffisant | **0** |

Identifiants de vente (toutes Orange Money, toutes `UNSPECIFIED_FAILURE`) :

```
SALE12M22PUF63H8UXI   2026-08-26 17:42   5 000 FCFA
SALEPDLUZLHP751DP8B   2026-08-25 06:43   5 000 FCFA
SALEIUIPPVVCXIM5XLF   2026-08-25 06:39   5 000 FCFA
SALEGIDFHZ61MOWDZL9   2026-08-24 23:31   2 000 FCFA
SALE3808E7UWT9EQXWV   2026-08-24 20:42   5 000 FCFA
SALE4S6XMOHKF0KUF13   2026-08-24 17:14   2 000 FCFA
```

`UNSPECIFIED_FAILURE` ne donne au client aucune raison. Le message qu'il voit est
« The payment could not be completed. Please choose another payment method or try again. »
Or Orange Money est le portefeuille dominant en Guinée : il n'a pas d'autre moyen à choisir.

### Burkina Faso — Orange Money : 0 réussite sur 30 tentatives

| | |
|---|---|
| Tentatives avec Orange Money | 30 |
| Réussies | **0** |
| Erreur dominante | `GENERAL_ERROR` — **29 sur 30** |
| Solde insuffisant | **0** |

```
SALEO7ZR1ZWAI57PUKO   2026-08-26 15:15   GENERAL_ERROR    2 000 FCFA
SALEYIOCT7UZ30Q2TTG   2026-08-26 10:51   GENERAL_ERROR    2 000 FCFA
SALE6Z3AUGVSBKPGNTR   2026-08-26 10:41   GENERAL_ERROR    2 000 FCFA
SALENTCSBLRBEERUDCG   2026-08-25 23:52   GENERAL_ERROR   15 000 FCFA
```

La dernière est un abonnement annuel à 15 000 FCFA, perdu sur une erreur générique.

### Mali — Amanata et Orange Money : `GATEWAY_INTERNAL_ERROR`

| | |
|---|---|
| Tentatives | 44 |
| Refusées | 10 |
| Erreur dominante | `GATEWAY_INTERNAL_ERROR` — **8 sur 10** |
| Solde insuffisant | **0** |

```
SALER825J4IWDAL6761   2026-08-26 17:17   Amanata        GATEWAY_INTERNAL_ERROR   2 000 FCFA
SALE15TNF21TOWLBTML   2026-08-26 17:11   Amanata        GATEWAY_INTERNAL_ERROR   5 000 FCFA
SALECUUNRN6BPKC72RD   2026-08-26 15:55   Orange Money   GATEWAY_INTERNAL_ERROR   2 000 FCFA
SALEZL9PP5VIT4CHQXD   2026-08-26 15:45   Orange Money   GATEWAY_INTERNAL_ERROR   2 000 FCFA
SALES6K5347DFW6U5RC   2026-08-26 14:49   Amanata        GATEWAY_INTERNAL_ERROR   5 000 FCFA
```

Un client a tenté **neuf fois** avant de renoncer.
`GATEWAY_INTERNAL_ERROR` est par définition une défaillance de votre côté, pas du client.

### Togo — Mixx by Yas : `GENERAL_ERROR`

| | |
|---|---|
| Tentatives Mixx by Yas observées | 13 |
| Refusées | 10 |
| Erreur dominante | `GENERAL_ERROR` — 8 |
| Solde insuffisant | **0** |

```
SALEAQVDX8VTNMC5M99   2026-08-26 10:52   Mixx by Yas   GENERAL_ERROR   15 000 FCFA
SALEYVQNYN2CFGREXU8   2026-08-25 12:42   Mixx by Yas   GENERAL_ERROR    5 000 FCFA
SALE4F2CZY9V1T45YQJ   2026-08-24 22:30   Mixx by Yas   GENERAL_ERROR    2 000 FCFA
```

---

## Pourquoi il ne s'agit pas du comportement des clients

La comparaison avec les pays où la boutique fonctionne normalement est sans ambiguïté :

| Pays | Taux de réussite | 1ʳᵉ cause d'échec | Part du solde insuffisant |
|---|---|---|---|
| Côte d'Ivoire | 66,5 % | `INSUFFICIENT_BALANCE` | **85,6 %** |
| Cameroun | 45,5 % | `INSUFFICIENT_BALANCE` | **88,9 %** |
| Bénin | 52,9 % | `INSUFFICIENT_BALANCE` | 68,8 % |
| **Burkina Faso** | 45,7 % | `GENERAL_ERROR` (92 %) | **0 %** |
| **Togo** | 39 % | `GENERAL_ERROR` (52 %) | **0 %** |
| **Mali** | **16,7 %** | `GATEWAY_INTERNAL_ERROR` (80 %) | **0 %** |
| **Guinée** | **16,4 %** | `UNSPECIFIED_FAILURE` (96 %) | **0 %** |

Même boutique, mêmes produits, mêmes prix, même période, même tunnel de paiement.
Là où la passerelle fonctionne, les clients échouent faute d'argent. Là où elle ne fonctionne pas, ils échouent pour des raisons sur lesquelles personne ne peut agir.

---

## Ce que nous vous demandons

1. **Vérifier l'intégration Orange Money pour la Guinée et le Burkina Faso.** Une réussite sur 48, et zéro sur 30, sur le portefeuille principal de ces pays, ne relève pas du client.
2. **Vérifier l'intégration Amanata et Orange Money pour le Mali** — `GATEWAY_INTERNAL_ERROR` est un code de défaillance interne.
3. **Nous dire ce que signifient réellement `UNSPECIFIED_FAILURE` et `GENERAL_ERROR`.** Avec 118 et 50 occurrences, ces deux codes couvrent 44 % de nos échecs et ne donnent ni à nous ni au client la moindre piste d'action.
4. **Confirmer si ces transactions ont seulement été présentées à l'opérateur**, ou si elles ont été rejetées avant de l'atteindre.

## Impact commercial

Environ **129 paiements refusés** dans ces quatre pays sur la période, de clients disposant des fonds — soit **300 000 à 500 000 FCFA** d'abonnements perdus, sans compter ceux qui ont renoncé sans réessayer.

Notre taux de conversion est de **6,7 % en Guinée** contre **17 %** dans les pays où la passerelle fonctionne. Cet écart mesure exactement le problème.

---

**Boutique Profoot — profootai.com**
Nous tenons à votre disposition le détail complet des 384 échecs analysés.
