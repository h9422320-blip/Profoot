/**
 * Les outils de données de l'Agent VIP.
 *
 * L'agent ne répond plus de mémoire : à chaque question, il décide lui-même
 * quelles données aller chercher et appelle les fonctions ci-dessous. Chaque
 * outil interroge API-Football et renvoie un résumé compact.
 *
 * Le résumé est essentiel : API-Football renvoie des réponses très volumineuses
 * (un effectif complet fait plusieurs dizaines de milliers de caractères).
 * Les transmettre telles quelles coûterait cher et ralentirait la réponse pour
 * une information que l'agent n'utilise pas. On ne garde donc que ce qui sert
 * réellement à l'analyse.
 */

import { apiFootball, CACHE_TTL, LEAGUE_IDS, getSeason, getClubSeason } from './api-football';

// ---------------------------------------------------------------------------
// Déclarations transmises au modèle
// ---------------------------------------------------------------------------
// Les descriptions disent QUAND appeler l'outil, pas seulement ce qu'il fait :
// c'est ce qui détermine si l'agent pense à s'en servir au bon moment.

export const OUTILS_FOOTBALL = [
  {
    name: 'chercher_equipe',
    description:
      "Trouve l'identifiant d'un club à partir de son nom. À APPELER EN PREMIER dès qu'une question porte sur un club précis : tous les autres outils ont besoin de cet identifiant. Renvoie plusieurs clubs quand le nom est ambigu (ex. « Manchester » renvoie United et City).",
    input_schema: {
      type: 'object' as const,
      properties: {
        nom: { type: 'string', description: "Nom du club, ex. « Real Madrid », « Arsenal », « Marseille »" },
      },
      required: ['nom'],
    },
  },
  {
    name: 'fiche_club',
    description:
      "L'entraîneur enregistré comme en poste, sa date de prise de fonction, le stade et le pays. ATTENTION : cette base enregistre les changements de banc avec du retard. Un entraîneur limogé ou nommé cette semaine peut ne pas y figurer. Sur une question d'entraîneur, croise toujours avec une recherche web récente, et fais confiance au web en cas de désaccord.",
    input_schema: {
      type: 'object' as const,
      properties: { equipe_id: { type: 'number', description: "Identifiant renvoyé par chercher_equipe" } },
      required: ['equipe_id'],
    },
  },
  {
    name: 'effectif_club',
    description:
      "L'effectif enregistré d'un club : joueurs, âges, postes, numéros. Utile pour juger la profondeur de banc. Comme le reste de cette base, il intègre les mouvements récents avec du retard : une recrue de la semaine peut manquer, un partant peut y figurer encore.",
    input_schema: {
      type: 'object' as const,
      properties: { equipe_id: { type: 'number' } },
      required: ['equipe_id'],
    },
  },
  {
    name: 'blessures_club',
    description:
      "Les joueurs blessés ou suspendus d'un club, avec le motif. À appeler systématiquement avant tout pronostic ou analyse d'un match à venir : une absence majeure change la lecture d'une rencontre.",
    input_schema: {
      type: 'object' as const,
      properties: { equipe_id: { type: 'number' } },
      required: ['equipe_id'],
    },
  },
  {
    name: 'transferts_club',
    description:
      "Les transferts déjà enregistrés pour un club, du plus récent au plus ancien. ATTENTION : cette base est SYSTÉMATIQUEMENT EN RETARD sur le mercato — un transfert conclu, annoncé et même un joueur qui s'entraîne déjà avec son nouveau club peuvent n'y apparaître que des jours ou des semaines plus tard. Ne conclus JAMAIS qu'un transfert n'est pas fait parce qu'il manque ici. Sur toute question de mercato, la recherche web fait foi ; cet outil ne sert qu'à récupérer les montants et les dates de ce qui y est déjà consigné.",
    input_schema: {
      type: 'object' as const,
      properties: {
        equipe_id: { type: 'number' },
        limite: { type: 'number', description: 'Nombre de transferts à renvoyer, 15 par défaut' },
      },
      required: ['equipe_id'],
    },
  },
  {
    name: 'matchs_club',
    description:
      "Les derniers matchs joués (avec les scores réels) ou les prochains matchs programmés d'un club. À appeler pour évaluer la forme d'une équipe, commenter un résultat, ou situer un match à venir.",
    input_schema: {
      type: 'object' as const,
      properties: {
        equipe_id: { type: 'number' },
        type: { type: 'string', enum: ['derniers', 'prochains'], description: "'derniers' pour les résultats, 'prochains' pour le calendrier" },
        nombre: { type: 'number', description: 'Entre 1 et 20, 8 par défaut' },
      },
      required: ['equipe_id', 'type'],
    },
  },
  {
    name: 'statistiques_club',
    description:
      "Les statistiques détaillées d'un club sur la saison en cours dans une compétition : forme, buts marqués et encaissés, moyennes, clean sheets, résultats à domicile et à l'extérieur. À appeler pour étayer une analyse avec des chiffres précis plutôt qu'avec des impressions.",
    input_schema: {
      type: 'object' as const,
      properties: {
        equipe_id: { type: 'number' },
        competition: {
          type: 'string',
          description: `Clé de compétition parmi : ${Object.keys(LEAGUE_IDS).join(', ')}`,
        },
      },
      required: ['equipe_id', 'competition'],
    },
  },
  {
    name: 'confrontations',
    description:
      "L'historique des confrontations directes entre deux clubs, avec les scores. À appeler avant tout pronostic sur une affiche : certaines équipes ont une emprise historique sur une autre.",
    input_schema: {
      type: 'object' as const,
      properties: {
        equipe1_id: { type: 'number' },
        equipe2_id: { type: 'number' },
      },
      required: ['equipe1_id', 'equipe2_id'],
    },
  },
  {
    name: 'classement',
    description:
      "Le classement réel et à jour d'un championnat : rang, points, différence de buts, forme récente de chaque équipe. À appeler dès qu'une question porte sur une position, un titre, une course à l'Europe ou au maintien.",
    input_schema: {
      type: 'object' as const,
      properties: {
        competition: {
          type: 'string',
          description: `Clé parmi : ${Object.keys(LEAGUE_IDS).join(', ')} (epl = Premier League, laliga = Liga, seriea = Serie A, ligue1 = Ligue 1, ucl = Ligue des Champions, can = CAN)`,
        },
      },
      required: ['competition'],
    },
  },
  {
    name: 'matchs_du_jour',
    description:
      "Les matchs d'une journée donnée, avec les scores en direct pour ceux qui se jouent en ce moment. À appeler pour « quels matchs aujourd'hui », « quel est le score », ou pour situer l'actualité immédiate.",
    input_schema: {
      type: 'object' as const,
      properties: {
        date: { type: 'string', description: "Date au format AAAA-MM-JJ. Omettre pour aujourd'hui." },
        en_direct_uniquement: { type: 'boolean', description: 'true pour ne garder que les matchs en cours' },
      },
      required: [],
    },
  },
  {
    name: 'chercher_joueur',
    description:
      "Retrouve un joueur : âge, nationalité, poste, et ses statistiques par compétition (matchs, buts, passes, cartons). Excellent pour les chiffres. En revanche le club rattaché peut être périmé si le joueur vient de changer d'air — sur un joueur récemment transféré, c'est la recherche web qui dit où il est vraiment.",
    input_schema: {
      type: 'object' as const,
      properties: { nom: { type: 'string', description: 'Nom du joueur, ex. « Mbappé », « Haaland »' } },
      required: ['nom'],
    },
  },
];

// ---------------------------------------------------------------------------
// Utilitaires de mise en forme
// ---------------------------------------------------------------------------

/** Résultat vide explicite : « aucune donnée » vaut mieux qu'un silence que l'agent comblerait de mémoire. */
function vide(message: string) {
  return { donnee_disponible: false, message };
}

function dateCourte(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function resumerMatch(f: any) {
  const termine = ['FT', 'AET', 'PEN'].includes(f.fixture?.status?.short);
  const enCours = ['1H', '2H', 'HT', 'ET', 'BT', 'P'].includes(f.fixture?.status?.short);
  return {
    date: dateCourte(f.fixture.date),
    competition: f.league?.name,
    domicile: f.teams?.home?.name,
    exterieur: f.teams?.away?.name,
    score: termine || enCours ? `${f.goals?.home ?? 0}-${f.goals?.away ?? 0}` : null,
    statut: enCours ? `EN DIRECT (${f.fixture.status.elapsed}')` : termine ? 'terminé' : 'à venir',
    heure: termine ? undefined : new Date(f.fixture.date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' }),
  };
}

// ---------------------------------------------------------------------------
// Exécution
// ---------------------------------------------------------------------------

type Entrees = Record<string, any>;

async function chercherEquipe({ nom }: Entrees) {
  const data = await apiFootball<any>(`/teams?search=${encodeURIComponent(String(nom))}`, CACHE_TTL.TEAM_INFO);
  const clubs = data?.response ?? [];
  if (!clubs.length) return vide(`Aucun club trouvé pour « ${nom} ». Essayer une autre orthographe.`);
  return {
    clubs: clubs.slice(0, 6).map((c: any) => ({
      equipe_id: c.team.id,
      nom: c.team.name,
      pays: c.team.country,
      fondation: c.team.founded,
      stade: c.venue?.name,
    })),
  };
}

async function ficheClub({ equipe_id }: Entrees) {
  const [coachs, equipe] = await Promise.all([
    apiFootball<any>(`/coachs?team=${equipe_id}`, CACHE_TTL.STANDINGS),
    apiFootball<any>(`/teams?id=${equipe_id}`, CACHE_TTL.TEAM_INFO),
  ]);

  // Un entraîneur peut avoir plusieurs passages dans un même club : le poste
  // actuel est celui dont la période de fonction n'a pas de date de fin.
  let enPoste: any = null;
  for (const c of coachs?.response ?? []) {
    const mandat = (c.career ?? []).find(
      (m: any) => m.team?.id === Number(equipe_id) && !m.end
    );
    if (mandat) {
      enPoste = { nom: c.name, nationalite: c.nationality, age: c.age, depuis: mandat.start };
      break;
    }
  }

  const info = equipe?.response?.[0];
  return {
    club: info?.team?.name,
    pays: info?.team?.country,
    stade: info?.venue?.name,
    capacite: info?.venue?.capacity,
    entraineur: enPoste ?? null,
    note_entraineur: enPoste
      ? "Entraîneur enregistré comme en poste. Cette base retarde sur les changements de banc : vérifier par une recherche web qu'il n'a pas été remplacé depuis."
      : "Aucun entraîneur enregistré en poste. Ne pas en déduire qu'il n'y en a pas : chercher sur le web.",
  };
}

async function effectifClub({ equipe_id }: Entrees) {
  const data = await apiFootball<any>(`/players/squads?team=${equipe_id}`, CACHE_TTL.TEAM_INFO);
  const bloc = data?.response?.[0];
  if (!bloc?.players?.length) return vide("Effectif indisponible pour ce club.");
  return {
    club: bloc.team?.name,
    effectif: bloc.players.map((j: any) => ({
      nom: j.name,
      age: j.age,
      numero: j.number,
      poste: j.position,
    })),
  };
}

async function blessuresClub({ equipe_id }: Entrees) {
  const saison = getClubSeason();
  const data = await apiFootball<any>(
    `/injuries?team=${equipe_id}&season=${saison}`,
    CACHE_TTL.FIXTURES_TODAY
  );
  let lignes = data?.response ?? [];

  // En début de saison, la requête par saison ne renvoie rien tant qu'aucun
  // match officiel n'a été disputé — vérifié en direct. Le relevé du jour,
  // lui, est alimenté en continu : on y cherche le club concerné.
  if (!lignes.length) {
    const aujourdhui = new Date().toISOString().split('T')[0];
    const duJour = await apiFootball<any>(`/injuries?date=${aujourdhui}`, CACHE_TTL.FIXTURES_TODAY);
    lignes = (duJour?.response ?? []).filter((l: any) => l.team?.id === Number(equipe_id));
  }

  if (!lignes.length) {
    return {
      absents: [],
      note: "Aucune absence enregistrée ici. Cette base retarde beaucoup sur l'infirmerie : vérifier par une recherche web avant d'affirmer que tout le monde est disponible.",
    };
  }

  // L'API renvoie une ligne par match concerné : un même joueur apparaît
  // plusieurs fois. On ne garde que son signalement le plus récent.
  const parJoueur = new Map<number, any>();
  for (const l of lignes) {
    const id = l.player?.id;
    if (!id) continue;
    const existant = parJoueur.get(id);
    if (!existant || new Date(l.fixture?.date) > new Date(existant.fixture?.date)) {
      parJoueur.set(id, l);
    }
  }

  return {
    absents: [...parJoueur.values()]
      .sort((a, b) => new Date(b.fixture?.date).getTime() - new Date(a.fixture?.date).getTime())
      .slice(0, 20)
      .map((l) => ({
        joueur: l.player?.name,
        type: l.player?.type,
        motif: l.player?.reason,
        signale_le: l.fixture?.date ? dateCourte(l.fixture.date) : undefined,
      })),
  };
}

async function transfertsClub({ equipe_id, limite }: Entrees) {
  const data = await apiFootball<any>(`/transfers?team=${equipe_id}`, CACHE_TTL.STANDINGS);
  const joueurs = data?.response ?? [];
  if (!joueurs.length) return vide("Aucun transfert enregistré pour ce club.");

  const tous: any[] = [];
  for (const bloc of joueurs) {
    for (const t of bloc.transfers ?? []) {
      tous.push({
        joueur: bloc.player?.name,
        date: t.date,
        de: t.teams?.out?.name,
        vers: t.teams?.in?.name,
        type: t.type || 'non précisé',
      });
    }
  }
  tous.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    note: "Transferts déjà consignés dans la base. Liste incomplète par nature : le mercato en cours y arrive avec du retard. L'absence d'un transfert ici ne veut pas dire qu'il n'a pas eu lieu.",
    transferts: tous.slice(0, Math.min(Number(limite) || 15, 30)).map((t) => ({
      ...t,
      date: dateCourte(t.date),
    })),
  };
}

async function matchsClub({ equipe_id, type, nombre }: Entrees) {
  const n = Math.min(Math.max(Number(nombre) || 8, 1), 20);
  const parametre = type === 'prochains' ? `next=${n}` : `last=${n}`;
  // Volontairement sans filtre de saison : en début de saison, filtrer ne
  // renvoie qu'une poignée de matchs amicaux et fausse la lecture de la forme.
  const data = await apiFootball<any>(
    `/fixtures?team=${equipe_id}&${parametre}`,
    type === 'prochains' ? CACHE_TTL.FIXTURES_UPCOMING : CACHE_TTL.FIXTURES_TODAY
  );
  const matchs = data?.response ?? [];
  if (!matchs.length) return vide("Aucun match trouvé pour ce club.");
  return { matchs: matchs.map(resumerMatch) };
}

async function statistiquesClub({ equipe_id, competition }: Entrees) {
  const ligue = LEAGUE_IDS[String(competition)];
  if (!ligue) return vide(`Compétition inconnue : « ${competition} ». Clés valides : ${Object.keys(LEAGUE_IDS).join(', ')}.`);

  const saison = getSeason(String(competition));
  const data = await apiFootball<any>(
    `/teams/statistics?team=${equipe_id}&season=${saison}&league=${ligue}`,
    CACHE_TTL.STANDINGS
  );
  const s = data?.response;
  if (!s?.fixtures) return vide("Statistiques indisponibles pour ce club dans cette compétition cette saison.");

  if (!s.fixtures.played?.total) {
    return {
      club: s.team?.name,
      competition: s.league?.name,
      saison,
      donnee_disponible: false,
      message:
        "Aucun match disputé dans cette compétition cette saison : les statistiques sont toutes à zéro et n'ont aucune valeur d'analyse. Le dire à l'utilisateur et se rabattre sur matchs_club, qui inclut la fin de saison précédente et la préparation.",
    };
  }

  return {
    club: s.team?.name,
    competition: s.league?.name,
    saison,
    forme: s.form,
    matchs_joues: s.fixtures.played?.total,
    victoires: s.fixtures.wins?.total,
    nuls: s.fixtures.draws?.total,
    defaites: s.fixtures.loses?.total,
    buts_marques: s.goals?.for?.total?.total,
    buts_encaisses: s.goals?.against?.total?.total,
    moyenne_marques: s.goals?.for?.average?.total,
    moyenne_encaisses: s.goals?.against?.average?.total,
    clean_sheets: s.clean_sheet?.total,
    domicile: {
      victoires: s.fixtures.wins?.home,
      buts_marques: s.goals?.for?.total?.home,
      buts_encaisses: s.goals?.against?.total?.home,
    },
    exterieur: {
      victoires: s.fixtures.wins?.away,
      buts_marques: s.goals?.for?.total?.away,
      buts_encaisses: s.goals?.against?.total?.away,
    },
  };
}

async function confrontations({ equipe1_id, equipe2_id }: Entrees) {
  const data = await apiFootball<any>(
    `/fixtures/headtohead?h2h=${equipe1_id}-${equipe2_id}&last=10`,
    CACHE_TTL.STANDINGS
  );
  const matchs = data?.response ?? [];
  if (!matchs.length) return vide("Aucune confrontation directe enregistrée entre ces deux clubs.");
  return { confrontations: matchs.map(resumerMatch) };
}

async function classement({ competition }: Entrees) {
  const ligue = LEAGUE_IDS[String(competition)];
  if (!ligue) return vide(`Compétition inconnue : « ${competition} ». Clés valides : ${Object.keys(LEAGUE_IDS).join(', ')}.`);

  const saison = getSeason(String(competition));
  const data = await apiFootball<any>(`/standings?league=${ligue}&season=${saison}`, CACHE_TTL.STANDINGS);
  const groupes = data?.response?.[0]?.league?.standings;
  if (!groupes?.length) return vide("Classement indisponible : la compétition n'a peut-être pas encore démarré cette saison.");

  const lignes = groupes.flat();
  // En intersaison, l'API renvoie le tableau de la nouvelle saison avec zéro
  // match joué. Sans avertissement, l'agent présenterait un classement
  // alphabétique comme s'il reflétait une hiérarchie sportive.
  const pasCommence = lignes.every((r: any) => !r.all?.played);

  return {
    competition: data.response[0].league.name,
    saison,
    ...(pasCommence
      ? {
          avertissement:
            "La saison n'a pas encore débuté : aucune équipe n'a joué, tout le monde est à 0 point et l'ordre affiché est purement alphabétique. Ne présente jamais ce tableau comme une hiérarchie ; explique-le à l'utilisateur et appuie-toi sur la saison passée ou sur les matchs récents.",
        }
      : {}),
    classement: lignes.map((r: any) => ({
      rang: r.rank,
      equipe: r.team?.name,
      points: r.points,
      joues: r.all?.played,
      v: r.all?.win,
      n: r.all?.draw,
      d: r.all?.lose,
      diff: r.goalsDiff,
      forme: r.form,
    })),
  };
}

async function matchsDuJour({ date, en_direct_uniquement }: Entrees) {
  if (en_direct_uniquement) {
    const live = await apiFootball<any>(`/fixtures?live=all`, CACHE_TTL.FIXTURES_LIVE);
    const matchs = live?.response ?? [];
    if (!matchs.length) return { matchs: [], note: 'Aucun match en cours en ce moment.' };
    return { matchs: matchs.slice(0, 40).map(resumerMatch) };
  }

  const jour = String(date || new Date().toISOString().split('T')[0]);
  const data = await apiFootball<any>(`/fixtures?date=${jour}`, CACHE_TTL.FIXTURES_TODAY);
  const matchs = data?.response ?? [];
  if (!matchs.length) return vide(`Aucun match programmé le ${jour}.`);

  // Une journée complète compte des centaines de matchs toutes divisions
  // confondues. On priorise les grandes compétitions, sinon la liste est
  // ingérable et noie l'information utile.
  const majeures = new Set(Object.values(LEAGUE_IDS));
  const prioritaires = matchs.filter((f: any) => majeures.has(f.league?.id));
  const retenus = prioritaires.length ? prioritaires : matchs;

  return {
    date: jour,
    total_toutes_competitions: matchs.length,
    matchs: retenus.slice(0, 40).map(resumerMatch),
  };
}

/** Lignes statistiques d'un joueur pour une saison, compétition par compétition. */
function statsParCompetition(bloc: any) {
  return (bloc?.statistics ?? [])
    .filter((s: any) => s.games?.appearences)
    .map((s: any) => ({
      equipe: s.team?.name,
      competition: s.league?.name,
      poste: s.games?.position,
      matchs: s.games?.appearences,
      titularisations: s.games?.lineups,
      buts: s.goals?.total ?? 0,
      passes: s.goals?.assists ?? 0,
      cartons_jaunes: s.cards?.yellow ?? 0,
      cartons_rouges: s.cards?.red ?? 0,
    }));
}

async function chercherJoueur({ nom }: Entrees) {
  // La recherche par nom passe obligatoirement par les profils : l'endpoint
  // statistique refuse une recherche textuelle sans club ni compétition
  // (« The League or Team field is required with the Search field »). On
  // résout donc l'identité d'abord, les statistiques ensuite.
  const profils = await apiFootball<any>(
    `/players/profiles?search=${encodeURIComponent(String(nom))}`,
    CACHE_TTL.TEAM_INFO
  );
  const trouves = profils?.response ?? [];
  if (!trouves.length) return vide(`Aucun joueur trouvé pour « ${nom} ».`);

  const principal = trouves[0].player;
  const saison = getClubSeason();

  const [enCours, precedente] = await Promise.all([
    apiFootball<any>(`/players?id=${principal.id}&season=${saison}`, CACHE_TTL.STANDINGS),
    apiFootball<any>(`/players?id=${principal.id}&season=${saison - 1}`, CACHE_TTL.STANDINGS),
  ]);

  const statsEnCours = statsParCompetition(enCours?.response?.[0]);
  const statsPrecedente = statsParCompetition(precedente?.response?.[0]);

  return {
    joueur: {
      nom: principal.name,
      nom_complet: [principal.firstname, principal.lastname].filter(Boolean).join(' '),
      age: principal.age,
      nationalite: principal.nationality,
      poste: principal.position,
      taille: principal.height,
    },
    saison_en_cours: saison,
    statistiques_saison_en_cours: statsEnCours,
    statistiques_saison_precedente: statsPrecedente,
    note: statsEnCours.length
      ? "Les équipes citées dans les statistiques de la saison en cours incluent la sélection nationale : distinguer club et sélection avant de conclure."
      : "Aucune statistique pour la saison en cours (elle vient de débuter) : s'appuyer sur la saison précédente pour situer le club, en le précisant à l'utilisateur.",
    autres_joueurs_du_meme_nom: trouves
      .slice(1, 4)
      .map((p: any) => ({ nom: p.player?.name, nationalite: p.player?.nationality, age: p.player?.age })),
  };
}

const EXECUTEURS: Record<string, (e: Entrees) => Promise<any>> = {
  chercher_equipe: chercherEquipe,
  fiche_club: ficheClub,
  effectif_club: effectifClub,
  blessures_club: blessuresClub,
  transferts_club: transfertsClub,
  matchs_club: matchsClub,
  statistiques_club: statistiquesClub,
  confrontations,
  classement,
  matchs_du_jour: matchsDuJour,
  chercher_joueur: chercherJoueur,
};

/**
 * Exécute un outil demandé par l'agent.
 *
 * Une panne d'API-Football ne doit jamais interrompre la conversation : on
 * renvoie l'erreur à l'agent sous forme de résultat pour qu'il l'annonce
 * honnêtement, plutôt que de laisser remonter une exception qui couperait
 * la réponse entière.
 */
export async function executerOutil(nom: string, entrees: Entrees): Promise<string> {
  const executeur = EXECUTEURS[nom];
  if (!executeur) {
    return JSON.stringify({ erreur: `Outil inconnu : ${nom}` });
  }
  try {
    const resultat = await executeur(entrees ?? {});
    return JSON.stringify(resultat);
  } catch (erreur: any) {
    console.error(`[OUTIL ${nom}] échec :`, erreur?.message);
    return JSON.stringify({
      erreur: "Donnée momentanément inaccessible.",
      consigne: "Le dire à l'utilisateur et poursuivre avec ce qui est disponible. Ne rien inventer.",
    });
  }
}
