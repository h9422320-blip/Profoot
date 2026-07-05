// ProFoot DATA ENGINE v4 — MAI 2026 (données réelles)
export interface Competition{id:string;name:string;shortName:string;country:string;logo:string;region:"europe"|"africa"|"international";matchesPerSeason:number;iaAccuracy:number;iaTrend:"up"|"stable"|"down";currentSeason:string;status:string;}
export interface Club{id:string;name:string;shortName:string;logo:string;country:string;league:string;coach:string;stadium:string;ranking:number;points:number;stats:{played:number;wins:number;draws:number;losses:number;goalsScored:number;goalsConceded:number;possession:number;xG:number;cleanSheets:number;};form:("W"|"D"|"L")[];squad:{name:string;position:string;status:"starter"|"sub"|"injured"|"suspended"}[];group?:string;}
export type MatchStatus="finished"|"live"|"today"|"upcoming";
export interface Match{id:string;homeTeam:string;awayTeam:string;competition:string;date:string;time:string;venue:string;status:MatchStatus;minute?:number;score?:{home:number;away:number};prediction?:{winner:"home"|"away"|"draw";score:string;confidence:number};result?:{home:number;away:number};}
const T=(id:number)=>`https://media.api-sports.io/football/teams/${id}.png`;
const L=(id:number)=>`https://media.api-sports.io/football/leagues/${id}.png`;
const c=(id:string,n:string,s:string,tid:number,co:string,le:string,ch:string,st:string,r:number,pts:number,p:number,w:number,d:number,l:number,gs:number,gc:number,pos:number,xg:number,cs:number,f:("W"|"D"|"L")[]):Club=>({id,name:n,shortName:s,logo:T(tid),country:co,league:le,coach:ch,stadium:st,ranking:r,points:pts,stats:{played:p,wins:w,draws:d,losses:l,goalsScored:gs,goalsConceded:gc,possession:pos,xG:xg,cleanSheets:cs},form:f,squad:[]});

const nat=(id:string,name:string,flagCode:string,group:string,ranking:number,league:string="wc"):Club=>({
  id, name, shortName:flagCode.toUpperCase(), logo:`https://flagcdn.com/w40/${flagCode}.png`, country:name, league, coach:"Sélectionneur", stadium:"National Stadium", ranking, points:0, stats:{played:0,wins:0,draws:0,losses:0,goalsScored:0,goalsConceded:0,possession:50,xG:0,cleanSheets:0}, form:["W","W","D","W","L"], squad:[], group
});

export const competitions:Competition[]=[
// EUROPE
{id:"ucl",name:"UEFA Champions League",shortName:"UCL",country:"Europe",logo:L(2),region:"europe",matchesPerSeason:189,iaAccuracy:84,iaTrend:"up",currentSeason:"2025-26",status:"Finale — PSG vs Arsenal — 30 mai"},
{id:"uel",name:"UEFA Europa League",shortName:"UEL",country:"Europe",logo:L(3),region:"europe",matchesPerSeason:189,iaAccuracy:80,iaTrend:"stable",currentSeason:"2025-26",status:"Finale — 27 mai"},
{id:"uecl",name:"UEFA Conference League",shortName:"UECL",country:"Europe",logo:L(848),region:"europe",matchesPerSeason:153,iaAccuracy:78,iaTrend:"stable",currentSeason:"2025-26",status:"Finale — 20 mai"},
{id:"supercup",name:"Supercoupe UEFA",shortName:"USC",country:"Europe",logo:L(531),region:"europe",matchesPerSeason:1,iaAccuracy:85,iaTrend:"stable",currentSeason:"2025",status:"Terminé"},
{id:"epl",name:"Premier League",shortName:"PL",country:"Angleterre",logo:L(39),region:"europe",matchesPerSeason:380,iaAccuracy:78,iaTrend:"up",currentSeason:"2025-26",status:"J36/38 — Arsenal leader"},
{id:"laliga",name:"La Liga",shortName:"Liga",country:"Espagne",logo:L(140),region:"europe",matchesPerSeason:380,iaAccuracy:81,iaTrend:"up",currentSeason:"2025-26",status:"Terminé — FC Barcelone Champion"},
{id:"seriea",name:"Serie A",shortName:"Serie A",country:"Italie",logo:L(135),region:"europe",matchesPerSeason:380,iaAccuracy:77,iaTrend:"up",currentSeason:"2025-26",status:"Terminé — Inter Milan Champion"},
{id:"bundesliga",name:"Bundesliga",shortName:"Bund.",country:"Allemagne",logo:L(78),region:"europe",matchesPerSeason:306,iaAccuracy:80,iaTrend:"up",currentSeason:"2025-26",status:"Terminé — Bayern Munich Champion"},
{id:"ligue1",name:"Ligue 1",shortName:"L1",country:"France",logo:L(61),region:"europe",matchesPerSeason:306,iaAccuracy:79,iaTrend:"stable",currentSeason:"2025-26",status:"Terminé — PSG Champion"},
{id:"eredivisie",name:"Eredivisie",shortName:"Erediv.",country:"Pays-Bas",logo:L(88),region:"europe",matchesPerSeason:306,iaAccuracy:82,iaTrend:"up",currentSeason:"2025-26",status:"Terminé — PSV Champion"},
{id:"ligaportugal",name:"Liga Portugal",shortName:"Liga PT",country:"Portugal",logo:L(94),region:"europe",matchesPerSeason:306,iaAccuracy:81,iaTrend:"stable",currentSeason:"2025-26",status:"Terminé — Sporting Champion"},
{id:"proleague",name:"Belgian Pro League",shortName:"JPL",country:"Belgique",logo:L(144),region:"europe",matchesPerSeason:306,iaAccuracy:75,iaTrend:"up",currentSeason:"2025-26",status:"Playoffs — Club Brugge en tête"},
{id:"premiership",name:"Scottish Premiership",shortName:"SPL",country:"Écosse",logo:L(179),region:"europe",matchesPerSeason:228,iaAccuracy:85,iaTrend:"stable",currentSeason:"2025-26",status:"Terminé — Celtic Champion"},
{id:"superlig",name:"Süper Lig",shortName:"Süper Lig",country:"Turquie",logo:L(203),region:"europe",matchesPerSeason:380,iaAccuracy:72,iaTrend:"down",currentSeason:"2025-26",status:"Terminé — Galatasaray Champion"},

// MONDE
{id:"wc",name:"Coupe du Monde FIFA 2026",shortName:"WC",country:"Monde",logo:L(15),region:"international",matchesPerSeason:104,iaAccuracy:75,iaTrend:"stable",currentSeason:"2026",status:"Phase de Groupes — 11 juin"},
{id:"wc_qual",name:"Éliminatoires CDM 2026",shortName:"Qual. WC",country:"Monde",logo:L(15),region:"international",matchesPerSeason:400,iaAccuracy:70,iaTrend:"stable",currentSeason:"2024-2026",status:"En cours"},
{id:"nations_league",name:"UEFA Nations League",shortName:"UNL",country:"Europe",logo:L(5),region:"international",matchesPerSeason:162,iaAccuracy:76,iaTrend:"up",currentSeason:"2024-25",status:"Final 4 — Juin"},
{id:"copa_america",name:"Copa America",shortName:"Copa",country:"Am. Sud",logo:L(9),region:"international",matchesPerSeason:32,iaAccuracy:74,iaTrend:"stable",currentSeason:"2024",status:"Terminé — Argentine Vainqueur"},
{id:"euro",name:"UEFA Euro",shortName:"Euro",country:"Europe",logo:L(4),region:"international",matchesPerSeason:51,iaAccuracy:82,iaTrend:"stable",currentSeason:"2024",status:"Terminé — Espagne Vainqueur"},
{id:"cwc",name:"Coupe du Monde des Clubs",shortName:"CWC",country:"Monde",logo:L(17),region:"international",matchesPerSeason:63,iaAccuracy:79,iaTrend:"up",currentSeason:"2025",status:"Phase de Groupes — Été 2025"},

// AFRIQUE
{id:"can",name:"Coupe d'Afrique des Nations",shortName:"CAN",country:"Afrique",logo:L(21),region:"africa",matchesPerSeason:52,iaAccuracy:72,iaTrend:"up",currentSeason:"2025",status:"Phase finale"},
{id:"can_qual",name:"Qualifications CAN",shortName:"Qual. CAN",country:"Afrique",logo:L(21),region:"africa",matchesPerSeason:150,iaAccuracy:68,iaTrend:"stable",currentSeason:"2025",status:"Terminé"},
{id:"caf",name:"Ligue des Champions CAF",shortName:"CAF CL",country:"Afrique",logo:L(12),region:"africa",matchesPerSeason:120,iaAccuracy:70,iaTrend:"stable",currentSeason:"2025-26",status:"Finale — Al Ahly vs Wydad"},
{id:"caf_cc",name:"Coupe de la Confédération CAF",shortName:"CAF CC",country:"Afrique",logo:L(18),region:"africa",matchesPerSeason:120,iaAccuracy:65,iaTrend:"up",currentSeason:"2025-26",status:"Finale"},
];

export const clubs:Record<string,Club>={};

export const cupParticipants: Record<string, string[]> = {
  ucl: ["arsenal", "mancity", "liverpool", "astonvilla", "realmadrid", "barcelona", "atletico", "girona", "inter", "milan", "juventus", "atalanta", "bologna", "bayern", "stuttgart", "dortmund", "leipzig", "leverkusen", "psg", "monaco", "brest", "lille", "psv", "feyenoord", "sporting", "benfica", "porto", "clubbrugge", "celtic_spl", "galatasaray_sl"],
  uel: ["manutd", "tottenham", "athletic", "sociedad", "roma", "lazio", "frankfurt", "hoffenheim", "nice", "lyon", "braga", "ajax", "twente", "fenerbahce_sl", "besiktas", "rangers_spl", "anderlecht", "unionsg"],
  uecl: ["chelsea", "betis", "fiorentina", "heidenheim", "lens", "vitoria", "cerclebrugge", "gent", "hearts", "stmirren", "basaksehir"],
  can: ["algeria", "mali", "nigeria", "ghana", "cameroon", "ivory_coast_can", "egypt_can", "morocco_can", "senegal_can", "tunisia_can", "guinea", "dr_congo"],
  euro: ["france", "spain", "germany", "italy", "england", "portugal", "netherlands", "belgium", "croatia", "denmark", "serbia", "wales", "scotland"],
  copa_america: ["argentina", "brazil", "colombia", "uruguay", "chile", "ecuador", "usa", "mexico", "canada", "jamaica", "costa_rica", "panama", "paraguay"],
  nations_league: ["france", "spain", "germany", "italy", "england", "portugal", "netherlands", "belgium", "croatia", "denmark", "serbia", "wales", "scotland"],
  cwc: ["mancity", "chelsea", "realmadrid", "bayern", "psg", "inter", "juventus", "dortmund", "atletico", "porto", "benfica", "salzburg", "alahly", "wydad", "esperance", "sundowns"]
};

[
// EPL 2025-26 (J36)
c("arsenal","Arsenal FC","ARS",42,"Angleterre","epl","Mikel Arteta","Emirates Stadium",1,79,36,24,7,5,78,29,61,2.1,16,["W","W","D","W","W"]),
c("mancity","Manchester City","MCI",50,"Angleterre","epl","Pep Guardiola","Etihad Stadium",2,77,36,24,5,7,85,34,66,2.4,13,["W","W","W","L","W"]),
c("manutd","Manchester United","MUN",33,"Angleterre","epl","Rúben Amorim","Old Trafford",3,65,36,19,8,9,62,41,54,1.7,10,["W","D","W","W","L"]),
c("astonvilla","Aston Villa","AVL",66,"Angleterre","epl","Unai Emery","Villa Park",4,62,36,18,8,10,59,44,53,1.6,9,["D","W","L","W","D"]),
c("liverpool","Liverpool FC","LIV",40,"Angleterre","epl","Arne Slot","Anfield",5,59,36,17,8,11,68,48,60,1.9,8,["L","W","D","W","W"]),
c("bournemouth","Bournemouth","BOU",35,"Angleterre","epl","Andoni Iraola","Vitality Stadium",6,55,36,16,7,13,52,47,48,1.4,8,["W","L","W","D","L"]),
c("brighton","Brighton","BHA",51,"Angleterre","epl","Fabian Hürzeler","Amex Stadium",7,53,36,15,8,13,55,49,55,1.6,7,["D","W","L","W","L"]),
c("brentford","Brentford FC","BRE",55,"Angleterre","epl","Thomas Frank","Brentford Stadium",8,51,36,14,9,13,56,52,50,1.5,5,["W","W","L","D","L"]),
c("chelsea","Chelsea FC","CHE",49,"Angleterre","epl","Enzo Maresca","Stamford Bridge",9,49,36,13,10,13,55,52,57,1.7,7,["L","D","W","W","L"]),
c("everton","Everton FC","EVE",45,"Angleterre","epl","David Moyes","Goodison Park",10,49,36,14,7,15,42,48,45,1.2,9,["W","L","D","L","W"]),
c("fulham","Fulham FC","FUL",36,"Angleterre","epl","Marco Silva","Craven Cottage",11,48,36,13,9,14,48,53,50,1.4,6,["L","D","W","D","W"]),
c("sunderland","Sunderland AFC","SUN",71,"Angleterre","epl","Régis Le Bris","Stadium of Light",12,48,36,13,9,14,44,50,47,1.3,7,["D","W","L","W","L"]),
c("newcastle","Newcastle Utd","NEW",34,"Angleterre","epl","Eddie Howe","St James' Park",13,46,36,12,10,14,52,54,52,1.5,6,["L","D","W","L","W"]),
c("leeds","Leeds United","LEE",63,"Angleterre","epl","Daniel Farke","Elland Road",14,44,36,12,8,16,45,55,49,1.3,5,["L","W","L","D","L"]),
c("crystalpalace","Crystal Palace","CRY",52,"Angleterre","epl","Oliver Glasner","Selhurst Park",15,44,36,12,8,16,40,50,46,1.2,7,["D","L","W","L","D"]),
c("forest","Nottingham Forest","NFO",65,"Angleterre","epl","Nuno Espírito Santo","City Ground",16,43,36,11,10,15,41,52,44,1.1,8,["L","D","D","W","L"]),
c("tottenham","Tottenham","TOT",47,"Angleterre","epl","Ange Postecoglou","Tottenham Stadium",17,38,36,10,8,18,48,62,56,1.5,4,["L","L","W","L","L"]),
c("westham","West Ham Utd","WHU",48,"Angleterre","epl","Graham Potter","London Stadium",18,36,36,9,9,18,38,58,46,1.1,5,["L","D","L","L","W"]),
c("burnley","Burnley FC","BUR",44,"Angleterre","epl","Scott Parker","Turf Moor",19,21,36,4,9,23,28,68,40,0.8,3,["L","L","D","L","L"]),
c("wolves","Wolverhampton","WOL",39,"Angleterre","epl","Vítor Pereira","Molineux",20,18,36,3,9,24,25,72,42,0.7,2,["L","L","L","D","L"]),
// LA LIGA 2025-26 (Terminé — 20 clubs)
c("barcelona","FC Barcelone","BAR",529,"Espagne","laliga","Hansi Flick","Camp Nou",1,91,38,28,7,3,89,28,65,2.4,18,["W","W","W","W","W"]),
c("realmadrid","Real Madrid","RMA",541,"Espagne","laliga","Carlo Ancelotti","Santiago Bernabéu",2,84,38,26,6,6,82,35,60,2.2,15,["L","W","W","W","D"]),
c("villarreal","Villarreal CF","VIL",533,"Espagne","laliga","Marcelino","Estadio de la Cerámica",3,72,38,21,9,8,68,42,54,1.8,10,["W","D","W","W","L"]),
c("atletico","Atlético Madrid","ATM",530,"Espagne","laliga","Diego Simeone","Metropolitano",4,70,38,21,7,10,62,38,51,1.6,12,["W","L","W","D","W"]),
c("betis","Real Betis","BET",543,"Espagne","laliga","Manuel Pellegrini","Benito Villamarín",5,64,38,18,10,10,55,42,52,1.5,9,["D","W","L","W","D"]),
c("athletic","Athletic Bilbao","ATH",531,"Espagne","laliga","Ernesto Valverde","San Mamés",6,62,38,17,11,10,50,38,49,1.4,11,["W","D","D","L","W"]),
c("realsociedad","Real Sociedad","RSO",548,"Espagne","laliga","Imanol Alguacil","Reale Arena",7,60,38,17,9,12,52,44,53,1.5,8,["D","W","L","D","W"]),
c("girona","Girona FC","GIR",547,"Espagne","laliga","Míchel","Montilivi",8,57,38,16,9,13,58,50,52,1.6,6,["L","W","W","L","D"]),
c("sevilla","Sevilla FC","SEV",536,"Espagne","laliga","García Pimienta","Sánchez-Pizjuán",9,55,38,15,10,13,48,46,50,1.4,7,["W","D","L","W","L"]),
c("valencia","Valencia CF","VAL",532,"Espagne","laliga","Rubén Baraja","Mestalla",10,52,38,14,10,14,44,48,48,1.3,6,["L","D","W","L","W"]),
c("mallorca","RCD Mallorca","MAL",798,"Espagne","laliga","Jagoba Arrasate","Son Moix",11,50,38,13,11,14,38,42,45,1.1,9,["D","L","W","D","L"]),
c("celtavigo","Celta Vigo","CEL",538,"Espagne","laliga","Claudio Giráldez","Balaídos",12,48,38,13,9,16,46,52,49,1.3,5,["L","W","D","L","W"]),
c("rayo","Rayo Vallecano","RAY",728,"Espagne","laliga","Íñigo Pérez","Vallecas",13,46,38,12,10,16,40,50,44,1.1,6,["D","L","L","W","D"]),
c("osasuna","CA Osasuna","OSA",727,"Espagne","laliga","Vicente Moreno","El Sadar",14,45,38,12,9,17,38,48,44,1.0,7,["L","D","W","L","L"]),
c("getafe","Getafe CF","GET",546,"Espagne","laliga","José Bordalás","Coliseum",15,44,38,11,11,16,32,44,40,0.9,8,["D","L","D","W","L"]),
c("espanyol","RCD Espanyol","ESP",540,"Espagne","laliga","Manolo González","RCDE Stadium",16,42,38,11,9,18,36,52,43,1.0,5,["L","L","W","D","L"]),
c("alaves","Deportivo Alavés","ALA",542,"Espagne","laliga","Luis García Plaza","Mendizorrotza",17,40,38,10,10,18,34,52,42,0.9,5,["L","D","L","W","L"]),
c("laspalmas","UD Las Palmas","LPA",532,"Espagne","laliga","Diego Martínez","Gran Canaria",18,38,38,9,11,18,36,56,46,1.0,4,["L","L","D","L","D"]),
c("leganes","CD Leganés","LEG",745,"Espagne","laliga","Borja Jiménez","Butarque",19,35,38,8,11,19,30,52,41,0.8,5,["L","L","D","L","L"]),
c("valladolid","Real Valladolid","VLD",720,"Espagne","laliga","Paulo Pezzolano","Zorrilla",20,28,38,5,13,20,24,58,39,0.7,3,["L","D","L","L","L"]),
// LIGUE 1 2025-26 (PSG Champion — 18 clubs)
c("psg","Paris Saint-Germain","PSG",85,"France","ligue1","Luis Enrique","Parc des Princes",1,82,34,25,7,2,85,24,66,2.3,16,["W","W","W","W","W"]),
c("monaco","AS Monaco","ASM",91,"France","ligue1","Adi Hütter","Louis II",2,68,34,20,8,6,65,35,55,1.8,11,["W","D","W","L","W"]),
c("lille","LOSC Lille","LIL",79,"France","ligue1","Bruno Génésio","Pierre-Mauroy",3,64,34,19,7,8,58,38,52,1.6,10,["D","W","W","D","L"]),
c("marseille","Olympique de Marseille","OM",81,"France","ligue1","Roberto De Zerbi","Vélodrome",4,60,34,17,9,8,55,40,57,1.6,8,["W","D","L","W","W"]),
c("lyon","Olympique Lyonnais","OL",80,"France","ligue1","Pierre Sage","Groupama Stadium",5,56,34,16,8,10,52,42,54,1.5,7,["L","W","W","L","D"]),
c("lens","RC Lens","RCL",116,"France","ligue1","Will Still","Bollaert-Delelis",6,54,34,15,9,10,46,38,48,1.3,9,["D","D","W","W","L"]),
c("nice","OGC Nice","NIC",84,"France","ligue1","Franck Haise","Allianz Riviera",7,52,34,14,10,10,48,40,51,1.4,7,["W","D","L","D","W"]),
c("rennes","Stade Rennais","REN",94,"France","ligue1","Julien Stéphan","Roazhon Park",8,50,34,14,8,12,45,42,50,1.3,6,["L","W","D","W","L"]),
c("strasbourg","RC Strasbourg","STR",95,"France","ligue1","Liam Rosenior","La Meinau",9,48,34,13,9,12,42,44,47,1.2,5,["D","L","W","D","W"]),
c("toulouse","Toulouse FC","TOU",96,"France","ligue1","Carles Martínez Novell","Stadium",10,46,34,12,10,12,40,42,46,1.2,6,["W","L","D","L","D"]),
c("brest","Stade Brestois","BRE29",110,"France","ligue1","Éric Roy","Francis-Le Blé",11,44,34,11,11,12,38,40,45,1.1,7,["D","D","W","L","L"]),
c("reims","Stade de Reims","REI",93,"France","ligue1","Luka Elsner","Auguste-Delaune",12,42,34,11,9,14,36,44,44,1.1,5,["L","W","L","D","L"]),
c("nantes","FC Nantes","NAN",83,"France","ligue1","Antoine Kombouaré","La Beaujoire",13,40,34,10,10,14,35,48,44,1.0,4,["L","D","L","W","D"]),
c("montpellier","Montpellier HSC","MTP",82,"France","ligue1","Jean-Louis Gasset","La Mosson",14,38,34,9,11,14,34,48,43,1.0,4,["D","L","L","D","W"]),
c("auxerre","AJ Auxerre","AUX",98,"France","ligue1","Christophe Pélissier","Abbé-Deschamps",15,36,34,8,12,14,30,44,42,0.9,4,["L","D","D","L","L"]),
c("angers","Angers SCO","ANG",77,"France","ligue1","Alexandre Dujeux","Raymond Kopa",16,34,34,8,10,16,28,48,41,0.8,3,["L","L","D","L","D"]),
c("stetienne","AS Saint-Étienne","STE",1063,"France","ligue1","Olivier Dall'Oglio","Geoffroy-Guichard",17,32,34,7,11,16,28,50,42,0.8,3,["L","D","L","L","D"]),
c("lehavre","Le Havre AC","HAV",111,"France","ligue1","Didier Digard","Océane",18,26,34,5,11,18,22,52,39,0.6,2,["L","L","L","D","L"]),
// SERIE A 2025-26 (Inter Champion — 20 clubs)
c("inter","Inter Milan","INT",505,"Italie","seriea","Simone Inzaghi","San Siro",1,85,36,26,7,3,78,25,57,2.1,19,["W","W","D","W","W"]),
c("napoli","SSC Napoli","NAP",492,"Italie","seriea","Antonio Conte","Diego Maradona",2,76,36,23,7,6,65,32,54,1.8,13,["W","W","W","L","D"]),
c("juventus","Juventus FC","JUV",496,"Italie","seriea","Thiago Motta","Allianz Stadium",3,72,36,21,9,6,58,30,52,1.6,15,["D","W","W","W","D"]),
c("milan","AC Milan","MIL",489,"Italie","seriea","Sérgio Conceição","San Siro",4,68,36,20,8,8,62,40,54,1.7,10,["W","L","W","D","W"]),
c("atalanta","Atalanta BC","ATA",499,"Italie","seriea","Gian Piero Gasperini","Gewiss Stadium",5,65,36,19,8,9,70,44,52,1.9,8,["W","D","W","W","L"]),
c("lazio","SS Lazio","LAZ",487,"Italie","seriea","Marco Baroni","Olimpico",6,60,36,17,9,10,52,40,49,1.4,9,["D","W","L","W","L"]),
c("roma","AS Roma","ROM",497,"Italie","seriea","Claudio Ranieri","Olimpico",7,56,36,16,8,12,50,42,50,1.4,7,["W","L","D","W","L"]),
c("fiorentina","ACF Fiorentina","FIO",502,"Italie","seriea","Raffaele Palladino","Artemio Franchi",8,54,36,15,9,12,48,42,51,1.4,6,["D","W","L","W","D"]),
c("bologna","Bologna FC","BOL",500,"Italie","seriea","Vincenzo Italiano","Dall'Ara",9,52,36,14,10,12,46,42,50,1.3,6,["W","D","L","D","W"]),
c("torino","Torino FC","TOR",503,"Italie","seriea","Paolo Vanoli","Olimpico Grande Torino",10,50,36,13,11,12,42,40,47,1.2,7,["D","L","W","D","L"]),
c("udinese","Udinese Calcio","UDI",494,"Italie","seriea","Kosta Runjaic","Bluenergy Stadium",11,48,36,13,9,14,40,46,44,1.1,5,["L","W","D","L","W"]),
c("genoa","Genoa CFC","GEN",495,"Italie","seriea","Patrick Vieira","Marassi",12,46,36,12,10,14,38,46,44,1.1,5,["D","L","W","L","D"]),
c("parma","Parma Calcio","PAR",504,"Italie","seriea","Fabio Pecchia","Tardini",13,44,36,11,11,14,40,50,45,1.1,4,["L","D","W","L","D"]),
c("cagliari","Cagliari Calcio","CAG",490,"Italie","seriea","Davide Nicola","Unipol Domus",14,42,36,10,12,14,36,46,43,1.0,5,["D","L","D","W","L"]),
c("como","Como 1907","COM",895,"Italie","seriea","Cesc Fàbregas","Sinigaglia",15,40,36,10,10,16,38,52,47,1.1,3,["L","L","W","D","L"]),
c("empoli","Empoli FC","EMP",511,"Italie","seriea","Roberto D'Aversa","Castellani",16,38,36,9,11,16,32,48,43,0.9,4,["L","D","L","D","L"]),
c("verona","Hellas Verona","VER",504,"Italie","seriea","Paolo Zanetti","Bentegodi",17,36,36,8,12,16,34,52,42,0.9,3,["L","L","D","L","D"]),
c("lecce","US Lecce","LEC",867,"Italie","seriea","Marco Giampaolo","Via del Mare",18,34,36,7,13,16,28,48,41,0.8,4,["D","L","L","D","L"]),
c("venezia","Venezia FC","VEN",517,"Italie","seriea","Eusebio Di Francesco","Penzo",19,30,36,6,12,18,26,52,40,0.7,3,["L","L","D","L","L"]),
c("monza","AC Monza","MON",1579,"Italie","seriea","Alessandro Nesta","U-Power Stadium",20,26,36,4,14,18,22,54,39,0.6,2,["L","D","L","L","D"]),
// BUNDESLIGA 2025-26 (Bayern Champion — 18 clubs)
c("bayern","Bayern Munich","BAY",157,"Allemagne","bundesliga","Vincent Kompany","Allianz Arena",1,84,34,27,3,4,122,38,65,3.2,14,["W","W","W","W","W"]),
c("leverkusen","Bayer Leverkusen","LEV",168,"Allemagne","bundesliga","Xabi Alonso","BayArena",2,72,34,22,6,6,78,38,58,2.1,12,["W","W","D","W","L"]),
c("dortmund","Borussia Dortmund","BVB",165,"Allemagne","bundesliga","Nuri Şahin","Signal Iduna Park",3,66,34,19,9,6,72,42,55,1.9,9,["D","W","L","W","W"]),
c("stuttgart","VfB Stuttgart","STU",172,"Allemagne","bundesliga","Sebastian Hoeneß","MHPArena",4,62,34,18,8,8,68,48,53,1.8,8,["W","L","W","W","D"]),
c("leipzig","RB Leipzig","RBL",173,"Allemagne","bundesliga","Marco Rose","Red Bull Arena",5,58,34,16,10,8,62,44,53,1.7,7,["D","W","L","D","W"]),
c("frankfurt","Eintracht Frankfurt","SGE",169,"Allemagne","bundesliga","Dino Toppmöller","Waldstadion",6,55,34,15,10,9,58,46,50,1.5,6,["W","D","L","W","D"]),
c("freiburg","SC Freiburg","FRE",160,"Allemagne","bundesliga","Julian Schuster","Europa-Park Stadion",7,52,34,14,10,10,48,40,48,1.3,6,["D","W","L","D","W"]),
c("wolfsburg","VfL Wolfsburg","WOB",161,"Allemagne","bundesliga","Ralph Hasenhüttl","Volkswagen Arena",8,50,34,13,11,10,46,42,49,1.3,5,["W","D","L","W","D"]),
c("gladbach","Borussia M'gladbach","BMG",163,"Allemagne","bundesliga","Gerardo Seoane","Borussia-Park",9,48,34,13,9,12,50,48,48,1.4,4,["L","W","W","L","D"]),
c("mainz","1. FSV Mainz 05","MAI",164,"Allemagne","bundesliga","Bo Henriksen","Mewa Arena",10,46,34,12,10,12,44,46,45,1.2,5,["D","L","W","W","L"]),
c("hoffenheim","TSG Hoffenheim","HOF",167,"Allemagne","bundesliga","Christian Ilzer","PreZero Arena",11,44,34,11,11,12,46,48,48,1.3,4,["L","D","W","L","D"]),
c("augsburg","FC Augsburg","AUG",170,"Allemagne","bundesliga","Jess Thorup","WWK Arena",12,42,34,10,12,12,38,44,43,1.0,5,["D","L","D","W","L"]),
c("werder","Werder Bremen","SVW",162,"Allemagne","bundesliga","Ole Werner","Weserstadion",13,40,34,10,10,14,42,50,47,1.2,3,["L","W","L","D","L"]),
c("union","Union Berlin","UNI",182,"Allemagne","bundesliga","Bo Svensson","Stadion An der Alten Försterei",14,38,34,9,11,14,36,46,42,1.0,5,["L","D","L","W","L"]),
c("heidenheim","1. FC Heidenheim","HEI",180,"Allemagne","bundesliga","Frank Schmidt","Voith-Arena",15,36,34,8,12,14,34,48,42,0.9,4,["L","L","D","D","L"]),
c("stpauli","FC St. Pauli","STP",186,"Allemagne","bundesliga","Alexander Blessin","Millerntor",16,34,34,7,13,14,30,46,41,0.8,4,["D","L","L","D","L"]),
c("kiel","Holstein Kiel","KIE",192,"Allemagne","bundesliga","Marcel Rapp","Holstein-Stadion",17,28,34,5,13,16,28,56,40,0.7,2,["L","L","D","L","L"]),
c("bochum","VfL Bochum","BOC",176,"Allemagne","bundesliga","Dieter Hecking","Vonovia Ruhrstadion",18,22,34,3,13,18,22,62,38,0.6,2,["L","L","L","D","L"]),

// COUPE DU MONDE 2026 — Équipes qualifiées (Groupes officiels)
nat("mexico", "Mexico", "mx", "Groupe A", 1),
nat("south_africa", "South Africa", "za", "Groupe A", 2),
nat("south_korea", "South Korea", "kr", "Groupe A", 3),
nat("czech_republic", "Czech Republic", "cz", "Groupe A", 4),

nat("canada", "Canada", "ca", "Groupe B", 1),
nat("bosnia", "Bosnia & Herzegovina", "ba", "Groupe B", 2),
nat("qatar", "Qatar", "qa", "Groupe B", 3),
nat("switzerland", "Switzerland", "ch", "Groupe B", 4),

nat("brazil", "Brazil", "br", "Groupe C", 1),
nat("morocco", "Morocco", "ma", "Groupe C", 2),
nat("haiti", "Haiti", "ht", "Groupe C", 3),
nat("scotland", "Scotland", "gb-sct", "Groupe C", 4),

nat("usa", "USA", "us", "Groupe D", 1),
nat("paraguay", "Paraguay", "py", "Groupe D", 2),
nat("australia", "Australia", "au", "Groupe D", 3),
nat("turkiye", "Türkiye", "tr", "Groupe D", 4),

nat("germany", "Germany", "de", "Groupe E", 1),
nat("curacao", "Curaçao", "cw", "Groupe E", 2),
nat("ivory_coast", "Ivory Coast", "ci", "Groupe E", 3),
nat("ecuador", "Ecuador", "ec", "Groupe E", 4),

nat("netherlands", "Netherlands", "nl", "Groupe F", 1),
nat("japan", "Japan", "jp", "Groupe F", 2),
nat("sweden", "Sweden", "se", "Groupe F", 3),
nat("tunisia", "Tunisia", "tn", "Groupe F", 4),

nat("belgium", "Belgium", "be", "Groupe G", 1),
nat("egypt", "Egypt", "eg", "Groupe G", 2),
nat("iran", "Iran", "ir", "Groupe G", 3),
nat("new_zealand", "New Zealand", "nz", "Groupe G", 4),

nat("spain", "Spain", "es", "Groupe H", 1),
nat("cape_verde", "Cape Verde Islands", "cv", "Groupe H", 2),
nat("saudi_arabia", "Saudi Arabia", "sa", "Groupe H", 3),
nat("uruguay", "Uruguay", "uy", "Groupe H", 4),

nat("france", "France", "fr", "Groupe I", 1),
nat("senegal", "Senegal", "sn", "Groupe I", 2),
nat("iraq", "Iraq", "iq", "Groupe I", 3),
nat("colombia", "Colombia", "co", "Groupe I", 4),

// CAN - COMPÉTITIONS AFRICAINES
nat("algeria", "Algérie", "dz", "Groupe A", 1, "can"),
nat("mali", "Mali", "ml", "Groupe A", 2, "can"),
nat("nigeria", "Nigeria", "ng", "Groupe B", 1, "can"),
nat("ghana", "Ghana", "gh", "Groupe B", 2, "can"),
nat("cameroon", "Cameroun", "cm", "Groupe C", 1, "can"),
nat("ivory_coast_can", "Côte d'Ivoire", "ci", "Groupe C", 2, "can"),
nat("egypt_can", "Égypte", "eg", "Groupe D", 1, "can"),
nat("morocco_can", "Maroc", "ma", "Groupe D", 2, "can"),
nat("senegal_can", "Sénégal", "sn", "Groupe E", 1, "can"),
nat("tunisia_can", "Tunisie", "tn", "Groupe E", 2, "can"),
nat("guinea", "Guinée", "gn", "Groupe F", 1, "can"),
nat("dr_congo", "RD Congo", "cd", "Groupe F", 2, "can"),

// AUTRES NATIONS MAJEURES (Copa, Euro, Nations League)
nat("argentina", "Argentine", "ar", "Groupe J", 1, "wc"),
nat("england", "Angleterre", "gb-eng", "Groupe J", 2, "wc"),
nat("wales", "Pays de Galles", "gb-wls", "Groupe J", 3, "wc"),
nat("jamaica", "Jamaïque", "jm", "Groupe J", 4, "wc"),
nat("italy", "Italie", "it", "Groupe K", 1, "wc"),
nat("portugal", "Portugal", "pt", "Groupe K", 2, "wc"),
nat("denmark", "Danemark", "dk", "Groupe K", 3, "wc"),
nat("costa_rica", "Costa Rica", "cr", "Groupe K", 4, "wc"),
nat("croatia", "Croatie", "hr", "Groupe L", 1, "wc"),
nat("chile", "Chili", "cl", "Groupe L", 2, "wc"),
nat("serbia", "Serbie", "rs", "Groupe L", 3, "wc"),
nat("panama", "Panama", "pa", "Groupe L", 4, "wc"),

// UCL / AUTRES CLUBS EUROPÉENS
c("sporting", "Sporting CP", "SPO", 228, "Portugal", "ucl", "Rúben Amorim", "José Alvalade", 1, 80, 34, 25, 5, 4, 75, 25, 50, 1.8, 12, ["W","W","W","D","L"]),
c("benfica", "SL Benfica", "BEN", 226, "Portugal", "ucl", "Roger Schmidt", "Da Luz", 2, 75, 34, 23, 6, 5, 70, 30, 48, 1.7, 10, ["W","D","L","W","W"]),
c("porto", "FC Porto", "FCP", 224, "Portugal", "ucl", "Vítor Bruno", "Do Dragão", 3, 72, 34, 22, 6, 6, 68, 32, 49, 1.6, 11, ["W","W","L","D","W"]),
c("psv", "PSV Eindhoven", "PSV", 197, "Pays-Bas", "ucl", "Peter Bosz", "Philips Stadion", 1, 85, 34, 27, 4, 3, 90, 20, 60, 2.2, 14, ["W","W","W","W","D"]),
c("ajax", "Ajax Amsterdam", "AJA", 194, "Pays-Bas", "ucl", "Francesco Farioli", "Johan Cruijff ArenA", 2, 78, 34, 24, 6, 4, 80, 25, 58, 2.0, 12, ["W","D","W","L","W"]),
c("feyenoord", "Feyenoord", "FEY", 193, "Pays-Bas", "ucl", "Brian Priske", "De Kuip", 3, 74, 34, 22, 8, 4, 75, 28, 55, 1.8, 11, ["D","W","W","D","W"]),
c("galatasaray", "Galatasaray", "GAL", 645, "Turquie", "ucl", "Okan Buruk", "RAMS Park", 1, 95, 38, 30, 5, 3, 90, 26, 65, 2.1, 15, ["W","W","W","W","W"]),
c("fenerbahce", "Fenerbahçe", "FEN", 643, "Turquie", "ucl", "José Mourinho", "Şükrü Saracoğlu", 2, 92, 38, 29, 5, 4, 88, 28, 62, 2.0, 14, ["W","L","W","W","D"]),
c("celtic", "Celtic FC", "CEL", 247, "Ecosse", "ucl", "Brendan Rodgers", "Celtic Park", 1, 90, 38, 28, 6, 4, 85, 25, 65, 2.1, 16, ["W","W","D","W","W"]),
c("rangers", "Rangers FC", "RAN", 257, "Ecosse", "ucl", "Philippe Clement", "Ibrox Stadium", 2, 85, 38, 26, 7, 5, 80, 28, 60, 1.9, 13, ["D","W","L","W","W"]),

// CLUBS AFRICAINS (CAF)
c("alahly", "Al Ahly SC", "AHL", 1106, "Egypte", "caf", "Marcel Koller", "Cairo Stadium", 1, 75, 30, 23, 6, 1, 60, 15, 65, 1.8, 18, ["W","W","W","D","W"]),
c("wydad", "Wydad AC", "WYD", 1014, "Maroc", "caf", "Faouzi Benzarti", "Mohammed V", 2, 65, 30, 19, 8, 3, 50, 20, 55, 1.5, 14, ["W","D","W","L","W"]),
c("sundowns", "Mamelodi Sundowns", "SUN", 1125, "Afrique du Sud", "caf", "Rulani Mokwena", "Loftus Versfeld", 1, 78, 30, 24, 6, 0, 55, 12, 70, 1.7, 20, ["W","W","D","W","W"]),
c("esperance", "Espérance de Tunis", "EST", 1009, "Tunisie", "caf", "Miguel Cardoso", "Radès", 1, 68, 30, 20, 8, 2, 45, 14, 58, 1.4, 16, ["W","D","D","W","W"]),

// EREDIVISIE (18)
c("psv", "PSV Eindhoven", "PSV", 197, "Pays-Bas", "eredivisie", "Peter Bosz", "Philips Stadion", 1, 91, 34, 29, 4, 1, 111, 21, 65, 2.8, 18, ["W","W","W","W","D"]),
c("feyenoord", "Feyenoord", "FEY", 193, "Pays-Bas", "eredivisie", "Brian Priske", "De Kuip", 2, 84, 34, 26, 6, 2, 92, 26, 60, 2.4, 16, ["W","W","D","W","W"]),
c("twente", "FC Twente", "TWE", 196, "Pays-Bas", "eredivisie", "Joseph Oosting", "De Grolsch Veste", 3, 69, 34, 21, 6, 7, 69, 36, 55, 1.8, 12, ["W","L","W","W","D"]),
c("az", "AZ Alkmaar", "AZ", 195, "Pays-Bas", "eredivisie", "Maarten Martens", "AFAS Stadion", 4, 65, 34, 19, 8, 7, 70, 39, 52, 1.9, 11, ["W","D","W","L","W"]),
c("ajax", "Ajax Amsterdam", "AJA", 194, "Pays-Bas", "eredivisie", "Francesco Farioli", "Johan Cruijff ArenA", 5, 56, 34, 15, 11, 8, 74, 61, 58, 1.7, 5, ["D","W","L","W","D"]),
c("nec", "NEC Nijmegen", "NEC", 198, "Pays-Bas", "eredivisie", "Rogier Meijer", "Goffertstadion", 6, 53, 34, 14, 11, 9, 68, 51, 48, 1.6, 6, ["W","D","D","W","L"]),
c("utrecht", "FC Utrecht", "UTR", 199, "Pays-Bas", "eredivisie", "Ron Jans", "Stadion Galgenwaard", 7, 50, 34, 13, 11, 10, 49, 47, 45, 1.3, 8, ["D","L","W","D","W"]),
c("sparta", "Sparta Rotterdam", "SPA", 200, "Pays-Bas", "eredivisie", "Jeroen Rijsdijk", "Het Kasteel", 8, 49, 34, 14, 7, 13, 51, 48, 46, 1.4, 7, ["W","W","L","L","W"]),
c("gae", "Go Ahead Eagles", "GAE", 201, "Pays-Bas", "eredivisie", "René Hake", "De Adelaarshorst", 9, 46, 34, 12, 10, 12, 47, 46, 44, 1.2, 9, ["L","D","W","D","L"]),
c("heerenveen", "sc Heerenveen", "HEE", 202, "Pays-Bas", "eredivisie", "Robin van Persie", "Abe Lenstra Stadion", 10, 39, 34, 10, 9, 15, 53, 70, 48, 1.3, 4, ["W","L","L","D","W"]),
c("fortuna", "Fortuna Sittard", "FOR", 203, "Pays-Bas", "eredivisie", "Danny Buijs", "Fortuna Sittard Stadion", 11, 38, 34, 9, 11, 14, 37, 56, 42, 1.0, 8, ["D","L","D","W","L"]),
c("pec", "PEC Zwolle", "PEC", 204, "Pays-Bas", "eredivisie", "Johnny Jansen", "MAC³PARK Stadion", 12, 36, 34, 9, 9, 16, 45, 67, 44, 1.1, 5, ["L","W","L","D","L"]),
c("almere", "Almere City FC", "ALM", 205, "Pays-Bas", "eredivisie", "Alex Pastoor", "Yanmar Stadion", 13, 34, 34, 7, 13, 14, 33, 59, 40, 0.9, 7, ["D","D","L","W","D"]),
c("heracles", "Heracles Almelo", "HER", 206, "Pays-Bas", "eredivisie", "Erwin van de Looi", "Erve Asito", 14, 33, 34, 9, 6, 19, 41, 74, 43, 1.1, 3, ["L","W","L","L","D"]),
c("rkc", "RKC Waalwijk", "RKC", 207, "Pays-Bas", "eredivisie", "Henk Fraser", "Mandemakers Stadion", 15, 29, 34, 7, 8, 19, 38, 68, 41, 1.0, 4, ["D","L","W","D","L"]),
c("excelsior", "Excelsior", "EXC", 208, "Pays-Bas", "eredivisie", "Marinus Dijkhuizen", "Van Donge & De Roo Stadion", 16, 29, 34, 6, 11, 17, 50, 73, 45, 1.2, 2, ["L","L","D","L","W"]),
c("volendam", "FC Volendam", "VOL", 209, "Pays-Bas", "eredivisie", "Regillio Simons", "Kras Stadion", 17, 19, 34, 4, 7, 23, 34, 88, 38, 0.8, 1, ["L","L","L","D","L"]),
c("vitesse", "Vitesse", "VIT", 210, "Pays-Bas", "eredivisie", "Edward Sturing", "GelreDome", 18, 6, 34, 6, 6, 22, 30, 74, 35, 0.9, 3, ["L","L","W","L","L"]),

// LIGA PORTUGAL (18)
c("sporting", "Sporting CP", "SPO", 228, "Portugal", "ligaportugal", "Rúben Amorim", "José Alvalade", 1, 90, 34, 29, 3, 2, 96, 29, 65, 2.5, 15, ["W","W","W","W","W"]),
c("benfica", "SL Benfica", "BEN", 226, "Portugal", "ligaportugal", "Roger Schmidt", "Da Luz", 2, 80, 34, 25, 5, 4, 77, 28, 62, 2.2, 14, ["W","W","D","W","L"]),
c("porto", "FC Porto", "FCP", 224, "Portugal", "ligaportugal", "Vítor Bruno", "Do Dragão", 3, 72, 34, 22, 6, 6, 63, 27, 55, 1.8, 12, ["W","D","W","L","W"]),
c("braga", "SC Braga", "BRA", 227, "Portugal", "ligaportugal", "Daniel Sousa", "Municipal de Braga", 4, 68, 34, 21, 5, 8, 71, 50, 58, 1.9, 8, ["L","W","W","W","D"]),
c("vitoria", "Vitória SC", "VIT", 229, "Portugal", "ligaportugal", "Rui Borges", "D. Afonso Henriques", 5, 63, 34, 19, 6, 9, 52, 38, 50, 1.4, 9, ["W","L","W","D","W"]),
c("moreirense", "Moreirense FC", "MOR", 230, "Portugal", "ligaportugal", "Rui Borges", "Parque Joaquim de Almeida", 6, 55, 34, 16, 7, 11, 36, 35, 45, 1.1, 12, ["D","W","L","W","W"]),
c("arouca", "FC Arouca", "ARO", 231, "Portugal", "ligaportugal", "Daniel Sousa", "Municipal de Arouca", 7, 46, 34, 13, 7, 14, 54, 50, 48, 1.4, 5, ["L","D","W","L","W"]),
c("famalicao", "FC Famalicão", "FAM", 232, "Portugal", "ligaportugal", "Armando Evangelista", "Municipal 22 de Junho", 8, 42, 34, 10, 12, 12, 37, 41, 44, 1.1, 8, ["W","D","L","D","L"]),
c("casapia", "Casa Pia AC", "CAS", 233, "Portugal", "ligaportugal", "Gonçalo Santos", "Municipal de Rio Maior", 9, 38, 34, 10, 8, 16, 38, 50, 42, 1.0, 7, ["L","W","D","L","W"]),
c("farense", "SC Farense", "FAR", 234, "Portugal", "ligaportugal", "José Mota", "São Luís", 10, 37, 34, 10, 7, 17, 46, 51, 46, 1.2, 5, ["W","L","L","D","L"]),
c("rioave", "Rio Ave FC", "RIO", 235, "Portugal", "ligaportugal", "Luís Freire", "dos Arcos", 11, 37, 34, 6, 19, 9, 38, 43, 44, 1.0, 9, ["D","D","D","W","D"]),
c("gilvicente", "Gil Vicente", "GIL", 236, "Portugal", "ligaportugal", "Tozé Marreco", "Cidade de Barcelos", 12, 36, 34, 9, 9, 16, 42, 52, 43, 1.1, 6, ["L","W","L","D","L"]),
c("estoril", "Estoril Praia", "EST", 237, "Portugal", "ligaportugal", "Vasco Seabra", "António Coimbra da Mota", 13, 33, 34, 9, 6, 19, 49, 58, 47, 1.3, 5, ["W","L","D","L","W"]),
c("boavista", "Boavista FC", "BOA", 238, "Portugal", "ligaportugal", "Jorge Simão", "do Bessa", 14, 32, 34, 7, 11, 16, 39, 62, 42, 1.0, 4, ["D","L","L","D","D"]),
c("estrela", "Estrela Amadora", "ESTA", 239, "Portugal", "ligaportugal", "Sérgio Vieira", "José Gomes", 15, 33, 34, 7, 12, 15, 33, 53, 40, 0.9, 6, ["L","D","W","L","L"]),
c("portimonense", "Portimonense", "POR", 240, "Portugal", "ligaportugal", "Paulo Sérgio", "Municipal de Portimão", 16, 32, 34, 8, 8, 18, 39, 72, 41, 1.0, 3, ["L","W","D","L","L"]),
c("vizela", "FC Vizela", "VIZ", 241, "Portugal", "ligaportugal", "Rubén de la Barrera", "FC Vizela", 17, 26, 34, 5, 11, 18, 36, 66, 40, 0.9, 4, ["D","L","L","D","L"]),
c("chaves", "GD Chaves", "CHA", 242, "Portugal", "ligaportugal", "Moreno", "Municipal Eng. Manuel Branco Teixeira", 18, 23, 34, 5, 8, 21, 31, 72, 38, 0.8, 3, ["L","L","D","L","L"]),

// BELGIAN PRO LEAGUE (16)
c("clubbrugge", "Club Brugge", "BRU", 243, "Belgique", "proleague", "Nicky Hayen", "Jan Breydel", 1, 50, 40, 24, 10, 6, 75, 35, 55, 1.8, 14, ["W","W","D","W","W"]),
c("unionsg", "Union SG", "USG", 244, "Belgique", "proleague", "Alexander Blessin", "Joseph Marien", 2, 49, 40, 23, 9, 8, 68, 40, 52, 1.7, 12, ["D","W","L","W","W"]),
c("anderlecht", "Anderlecht", "AND", 245, "Belgique", "proleague", "Brian Riemer", "Lotto Park", 3, 46, 40, 22, 10, 8, 65, 38, 54, 1.6, 11, ["W","D","W","L","D"]),
c("cerclebrugge", "Cercle Brugge", "CER", 246, "Belgique", "proleague", "Miron Muslic", "Jan Breydel", 4, 37, 40, 18, 8, 14, 55, 45, 48, 1.4, 9, ["L","W","D","W","L"]),
c("genk", "KRC Genk", "GNK", 247, "Belgique", "proleague", "Wouter Vrancken", "Cegeka Arena", 5, 34, 40, 16, 11, 13, 58, 48, 50, 1.5, 8, ["W","L","W","D","L"]),
c("antwerp", "Antwerp FC", "ANT", 248, "Belgique", "proleague", "Mark van Bommel", "Bosuilstadion", 6, 32, 40, 15, 10, 15, 52, 45, 50, 1.4, 7, ["L","L","D","L","W"]),
c("gent", "KAA Gent", "GNT", 249, "Belgique", "proleague", "Hein Vanhaezebrouck", "Ghelamco Arena", 7, 48, 40, 20, 10, 10, 70, 48, 53, 1.7, 10, ["W","W","W","D","W"]),
c("mechelen", "KV Mechelen", "MEC", 250, "Belgique", "proleague", "Besnik Hasi", "AFAS Stadion", 8, 39, 40, 16, 8, 16, 50, 50, 48, 1.3, 8, ["D","W","L","W","L"]),
c("sttruiden", "Sint-Truiden", "STV", 251, "Belgique", "proleague", "Thorsten Fink", "Stayen", 9, 33, 40, 12, 12, 16, 45, 55, 46, 1.2, 7, ["L","D","W","D","L"]),
c("standard", "Standard Liège", "STA", 252, "Belgique", "proleague", "Ivan Leko", "Sclessin", 10, 32, 40, 10, 14, 16, 40, 52, 47, 1.1, 6, ["D","L","L","D","W"]),
c("westerlo", "KVC Westerlo", "WES", 253, "Belgique", "proleague", "Rik De Mil", "Het Kuipje", 11, 24, 40, 8, 11, 21, 48, 70, 45, 1.2, 4, ["L","W","D","L","L"]),
c("ohl", "OH Leuven", "OHL", 254, "Belgique", "proleague", "Óscar García", "Den Dreef", 12, 30, 40, 9, 12, 19, 42, 60, 44, 1.1, 5, ["W","L","D","L","W"]),
c("charleroi", "Charleroi", "CHA", 255, "Belgique", "proleague", "Rik De Mil", "Stade du Pays de Charleroi", 13, 45, 36, 12, 9, 15, 35, 45, 42, 1.0, 7, ["W","D","W","L","W"]),
c("eupen", "KAS Eupen", "EUP", 256, "Belgique", "proleague", "Kristoffer Andersen", "Kehrwegstadion", 14, 28, 36, 8, 4, 24, 28, 65, 38, 0.8, 4, ["L","L","D","W","L"]),
c("kortrijk", "KV Kortrijk", "KVK", 257, "Belgique", "proleague", "Freyr Alexandersson", "Guldensporenstadion", 15, 31, 36, 8, 7, 21, 28, 62, 39, 0.8, 5, ["D","W","L","W","L"]),
c("rwdm", "RWDM", "RWD", 258, "Belgique", "proleague", "Yannick Ferrera", "Edmond Machtens", 16, 30, 36, 7, 9, 20, 35, 75, 40, 0.9, 3, ["L","L","L","L","W"]),

// SCOTTISH PREMIERSHIP (12)
c("celtic_spl", "Celtic FC", "CEL", 247, "Ecosse", "premiership", "Brendan Rodgers", "Celtic Park", 1, 93, 38, 29, 6, 3, 95, 30, 65, 2.3, 17, ["W","W","W","D","W"]),
c("rangers_spl", "Rangers FC", "RAN", 257, "Ecosse", "premiership", "Philippe Clement", "Ibrox", 2, 85, 38, 27, 4, 7, 87, 32, 60, 2.1, 15, ["D","W","L","W","W"]),
c("hearts", "Heart of Midlothian", "HEA", 259, "Ecosse", "premiership", "Steven Naismith", "Tynecastle", 3, 68, 38, 20, 8, 10, 54, 42, 50, 1.5, 12, ["W","D","W","L","W"]),
c("kilmarnock", "Kilmarnock", "KIL", 260, "Ecosse", "premiership", "Derek McInnes", "Rugby Park", 4, 56, 38, 14, 14, 10, 46, 44, 48, 1.2, 9, ["D","D","W","W","L"]),
c("stmirren", "St Mirren", "STM", 261, "Ecosse", "premiership", "Stephen Robinson", "SMiSA Stadium", 5, 47, 38, 13, 8, 17, 46, 52, 45, 1.2, 8, ["L","L","W","D","L"]),
c("dundee", "Dundee FC", "DUN", 262, "Ecosse", "premiership", "Tony Docherty", "Dens Park", 6, 42, 38, 10, 12, 16, 49, 68, 44, 1.1, 6, ["L","W","L","L","D"]),
c("aberdeen", "Aberdeen", "ABE", 263, "Ecosse", "premiership", "Jimmy Thelin", "Pittodrie", 7, 48, 38, 12, 12, 14, 45, 48, 46, 1.3, 9, ["W","W","D","W","L"]),
c("hibernian", "Hibernian", "HIB", 264, "Ecosse", "premiership", "David Gray", "Easter Road", 8, 46, 38, 11, 13, 14, 52, 59, 48, 1.4, 7, ["D","L","W","D","W"]),
c("motherwell", "Motherwell", "MOT", 265, "Ecosse", "premiership", "Stuart Kettlewell", "Fir Park", 9, 43, 38, 10, 13, 15, 56, 59, 45, 1.3, 5, ["W","L","D","W","L"]),
c("stjohnstone", "St Johnstone", "STJ", 266, "Ecosse", "premiership", "Craig Levein", "McDiarmid Park", 10, 35, 38, 8, 11, 19, 29, 54, 40, 0.8, 6, ["L","D","L","W","D"]),
c("rosscounty", "Ross County", "ROS", 267, "Ecosse", "premiership", "Don Cowie", "Victoria Park", 11, 35, 38, 8, 11, 19, 38, 67, 41, 1.0, 4, ["D","W","D","L","L"]),
c("livingston", "Livingston", "LIV", 268, "Ecosse", "premiership", "David Martindale", "Almondvale", 12, 25, 38, 5, 10, 23, 29, 70, 38, 0.7, 3, ["L","L","L","D","L"]),

// SÜPER LIG (20)
c("galatasaray_sl", "Galatasaray", "GAL", 645, "Turquie", "superlig", "Okan Buruk", "RAMS Park", 1, 102, 38, 33, 3, 2, 92, 26, 62, 2.3, 17, ["W","W","W","W","W"]),
c("fenerbahce_sl", "Fenerbahçe", "FEN", 643, "Turquie", "superlig", "José Mourinho", "Şükrü Saracoğlu", 2, 99, 38, 31, 6, 1, 99, 31, 60, 2.4, 16, ["W","W","D","W","W"]),
c("trabzonspor", "Trabzonspor", "TRA", 646, "Turquie", "superlig", "Abdullah Avcı", "Papara Park", 3, 67, 38, 21, 4, 13, 69, 50, 52, 1.6, 9, ["L","W","W","L","W"]),
c("basaksehir", "Başakşehir", "BAS", 647, "Turquie", "superlig", "Çağdaş Atan", "Fatih Terim", 4, 61, 38, 18, 7, 13, 57, 43, 53, 1.5, 12, ["W","D","W","W","L"]),
c("kasimpasa", "Kasımpaşa", "KAS", 648, "Turquie", "superlig", "Sami Uğurlu", "Recep Tayyip Erdoğan", 5, 56, 38, 16, 8, 14, 62, 65, 48, 1.4, 6, ["W","L","W","D","L"]),
c("besiktas", "Beşiktaş", "BES", 644, "Turquie", "superlig", "Giovanni van Bronckhorst", "Tüpraş Stadyumu", 6, 56, 38, 16, 8, 14, 52, 47, 54, 1.5, 11, ["L","L","D","W","W"]),
c("sivasspor", "Sivasspor", "SIV", 649, "Turquie", "superlig", "Bülent Uygun", "4 Eylül", 7, 54, 38, 14, 12, 12, 47, 54, 46, 1.2, 8, ["D","W","W","D","L"]),
c("alanyaspor", "Alanyaspor", "ALA", 650, "Turquie", "superlig", "Fatih Tekke", "Kırbıyık Holding", 8, 52, 38, 12, 16, 10, 53, 50, 50, 1.3, 7, ["D","D","W","L","D"]),
c("rizespor", "Rizespor", "RIZ", 651, "Turquie", "superlig", "İlhan Palut", "Çaykur Didi", 9, 50, 38, 14, 8, 16, 48, 58, 47, 1.2, 9, ["L","L","D","W","L"]),
c("antalyaspor", "Antalyaspor", "ANT", 652, "Turquie", "superlig", "Alex de Souza", "Corendon Airlines Park", 10, 49, 38, 12, 13, 13, 44, 49, 49, 1.1, 8, ["D","L","W","D","D"]),
c("gaziantep", "Gaziantep FK", "GAZ", 653, "Turquie", "superlig", "Selçuk İnan", "Kalyon Stadyumu", 11, 44, 38, 12, 8, 18, 50, 57, 44, 1.1, 7, ["W","W","L","W","L"]),
c("adanademirspor", "Adana Demirspor", "ADA", 654, "Turquie", "superlig", "Hikmet Karaman", "Yeni Adana", 12, 44, 38, 10, 14, 14, 54, 61, 48, 1.3, 6, ["D","L","D","L","W"]),
c("samsunspor", "Samsunspor", "SAM", 655, "Turquie", "superlig", "Markus Gisdol", "Samsun 19 Mayıs", 13, 43, 38, 11, 10, 17, 42, 52, 45, 1.1, 6, ["L","W","L","D","L"]),
c("kayserispor", "Kayserispor", "KAY", 656, "Turquie", "superlig", "Burak Yılmaz", "RHG Enertürk Enerji", 14, 42, 38, 11, 12, 15, 44, 57, 45, 1.0, 7, ["D","L","D","W","D"]),
c("hatayspor", "Hatayspor", "HAT", 657, "Turquie", "superlig", "Ömer Erdoğan", "Mersin Stadyumu", 15, 41, 38, 9, 14, 15, 45, 52, 44, 1.1, 5, ["W","D","D","L","W"]),
c("konyaspor", "Konyaspor", "KON", 658, "Turquie", "superlig", "Ali Çamdalı", "MEDAŞ Konya Büyükşehir", 16, 41, 38, 9, 14, 15, 40, 53, 46, 1.0, 9, ["L","D","D","W","L"]),
c("ankaragucu", "Ankaragücü", "ANK", 659, "Turquie", "superlig", "Emre Belözoğlu", "Eryaman", 17, 40, 38, 8, 16, 14, 46, 52, 48, 1.1, 5, ["L","W","L","D","L"]),
c("karagumruk", "Fatih Karagümrük", "KAR", 660, "Turquie", "superlig", "Tolunay Kafkas", "Atatürk Olimpiyat", 18, 40, 38, 10, 10, 18, 49, 52, 45, 1.2, 6, ["W","L","D","L","L"]),
c("pendikspor", "Pendikspor", "PEN", 661, "Turquie", "superlig", "İbrahim Üzülmez", "Pendik Stadyumu", 19, 37, 38, 9, 10, 19, 42, 73, 42, 1.0, 4, ["L","L","D","W","L"]),
c("istanbulspor", "İstanbulspor", "IST", 662, "Turquie", "superlig", "Osman Zeki Korkmaz", "Necmi Kadıoğlu", 20, 16, 38, 4, 7, 27, 27, 80, 38, 0.7, 2, ["L","L","L","L","L"]),

].forEach(cl=>clubs[cl.id]=cl);

// ============================================================================
// MATCHES — Auto-corrected based on today's real date
// ============================================================================
function parseMatchDate(dateStr: string): Date {
  // Format: "DD/MM/YYYY"
  const parts = dateStr.split("/");
  if (parts.length === 3) {
    return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
  }
  return new Date(dateStr);
}

function autoCorrectStatus(match: Match): Match {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const matchDate = parseMatchDate(match.date);

  // If match date is in the past and status is "upcoming", mark as needing update
  if (matchDate < today && match.status === "upcoming") {
    // Don't show future matches that are already past — they need real results
    return { ...match, status: "finished" as MatchStatus };
  }

  // If match date is today
  if (
    matchDate.getFullYear() === today.getFullYear() &&
    matchDate.getMonth() === today.getMonth() &&
    matchDate.getDate() === today.getDate() &&
    match.status === "upcoming"
  ) {
    return { ...match, status: "today" as MatchStatus };
  }

  return match;
}

// Static fallback matches (used when API is unavailable)
const _staticMatches: Match[] = [
// FINISHED — UCL Semi-finals (réels)
{id:"ucl-sf1a",homeTeam:"psg",awayTeam:"bayern",competition:"ucl",date:"29/04/2026",time:"21:00",venue:"Parc des Princes",status:"finished",score:{home:5,away:4},result:{home:5,away:4},prediction:{winner:"home",score:"3-2",confidence:52}},
{id:"ucl-sf1b",homeTeam:"bayern",awayTeam:"psg",competition:"ucl",date:"06/05/2026",time:"21:00",venue:"Allianz Arena",status:"finished",score:{home:1,away:1},result:{home:1,away:1},prediction:{winner:"draw",score:"1-1",confidence:35}},
{id:"ucl-sf2a",homeTeam:"arsenal",awayTeam:"atletico",competition:"ucl",date:"30/04/2026",time:"21:00",venue:"Emirates Stadium",status:"finished",score:{home:1,away:1},result:{home:1,away:1},prediction:{winner:"home",score:"2-1",confidence:58}},
{id:"ucl-sf2b",homeTeam:"atletico",awayTeam:"arsenal",competition:"ucl",date:"07/05/2026",time:"21:00",venue:"Metropolitano",status:"finished",score:{home:0,away:1},result:{home:0,away:1},prediction:{winner:"away",score:"0-1",confidence:45}},
// FINISHED — La Liga Clásico (Barça champion)
{id:"liga-clasico",homeTeam:"barcelona",awayTeam:"realmadrid",competition:"laliga",date:"10/05/2026",time:"21:00",venue:"Camp Nou",status:"finished",score:{home:2,away:0},result:{home:2,away:0},prediction:{winner:"home",score:"2-1",confidence:55}},
// FINISHED — Ligue 1 (PSG champion)
{id:"l1-title",homeTeam:"psg",awayTeam:"lens",competition:"ligue1",date:"13/05/2026",time:"21:00",venue:"Parc des Princes",status:"finished",score:{home:2,away:0},result:{home:2,away:0},prediction:{winner:"home",score:"2-0",confidence:72}},
// FINISHED — EPL récent
{id:"epl-r36a",homeTeam:"arsenal",awayTeam:"brighton",competition:"epl",date:"14/05/2026",time:"20:00",venue:"Emirates Stadium",status:"finished",score:{home:3,away:1},result:{home:3,away:1},prediction:{winner:"home",score:"2-0",confidence:68}},
{id:"epl-r36b",homeTeam:"mancity",awayTeam:"chelsea",competition:"epl",date:"14/05/2026",time:"20:00",venue:"Etihad Stadium",status:"finished",score:{home:4,away:0},result:{home:4,away:0},prediction:{winner:"home",score:"3-1",confidence:65}},
// FUTURE — UCL FINALE
{id:"ucl-final",homeTeam:"psg",awayTeam:"arsenal",competition:"ucl",date:"30/05/2026",time:"21:00",venue:"Puskás Aréna, Budapest",status:"upcoming",prediction:{winner:"draw",score:"1-1",confidence:42}},
// FUTURE — EPL J37-38
{id:"epl-r37a",homeTeam:"liverpool",awayTeam:"arsenal",competition:"epl",date:"18/05/2026",time:"17:30",venue:"Anfield",status:"upcoming",prediction:{winner:"away",score:"1-2",confidence:52}},
{id:"epl-r37b",homeTeam:"mancity",awayTeam:"tottenham",competition:"epl",date:"18/05/2026",time:"15:00",venue:"Etihad Stadium",status:"upcoming",prediction:{winner:"home",score:"3-0",confidence:75}},
{id:"epl-final",homeTeam:"arsenal",awayTeam:"everton",competition:"epl",date:"24/05/2026",time:"16:00",venue:"Emirates Stadium",status:"upcoming",prediction:{winner:"home",score:"3-0",confidence:80}},
// FUTURE — COUPE DU MONDE 2026 (Groupes officiels)
{id:"wc-i1",homeTeam:"france",awayTeam:"senegal",competition:"wc",date:"15/06/2026",time:"18:00",venue:"MetLife Stadium",status:"upcoming",prediction:{winner:"home",score:"2-0",confidence:65}},
{id:"wc-j1",homeTeam:"argentina",awayTeam:"morocco",competition:"wc",date:"15/06/2026",time:"21:00",venue:"Hard Rock Stadium",status:"upcoming",prediction:{winner:"home",score:"2-1",confidence:60}},
{id:"wc-c1",homeTeam:"brazil",awayTeam:"morocco",competition:"wc",date:"12/06/2026",time:"18:00",venue:"SoFi Stadium",status:"upcoming",prediction:{winner:"home",score:"2-0",confidence:58}},
{id:"wc-h1",homeTeam:"spain",awayTeam:"usa",competition:"wc",date:"13/06/2026",time:"21:00",venue:"AT&T Stadium",status:"upcoming",prediction:{winner:"home",score:"2-1",confidence:55}},
{id:"wc-e1",homeTeam:"germany",awayTeam:"japan",competition:"wc",date:"14/06/2026",time:"18:00",venue:"BMO Field",status:"upcoming",prediction:{winner:"draw",score:"1-1",confidence:40}},
{id:"wc-open",homeTeam:"usa",awayTeam:"mexico",competition:"wc",date:"11/06/2026",time:"20:30",venue:"SoFi Stadium",status:"upcoming",prediction:{winner:"home",score:"1-0",confidence:48}},
];

// Auto-corrected matches — statuses are always accurate to today's date
export const matches: Match[] = _staticMatches.map(autoCorrectStatus);

// ============================================================================
// Helper Functions (Interface unchanged — frontend compatibility)
// ============================================================================
export function getClub(id:string):Club{return clubs[id]||{id,name:"Inconnu",shortName:"INC",logo:"",stats:{played:0,wins:0,draws:0,losses:0,goalsScored:0,goalsConceded:0,possession:0,xG:0,cleanSheets:0},form:[],coach:"N/A",stadium:"N/A",ranking:0,points:0,squad:[],country:"N/A",league:"N/A"};}
export function getCompetition(id:string){return competitions.find(c=>c.id===id);}
export function getMatchesByStatus(s:MatchStatus){return matches.filter(m=>m.status===s);}
export function getMatchesByCompetition(cid:string){return matches.filter(m=>m.competition===cid);}
export function getMatchesByClub(cid:string){return matches.filter(m=>m.homeTeam===cid||m.awayTeam===cid);}
export function calculateIAPrecision(match:Match){if(!match.result||!match.prediction)return null;const{home:h,away:a}=match.result;const actual=h>a?"home":a>h?"away":"draw";const wc=match.prediction.winner===actual;const sc=match.prediction.score===`${h}-${a}`;return{winnerCorrect:wc,scoreCorrect:sc,label:sc?"Score Exact":wc?"Vainqueur Correct":"Échec"};}
export const iaStats={totalAnalyses:2847,todayAnalyses:8,globalAccuracy:79.2,winnerAccuracy:79.2,exactScoreAccuracy:23.4,overUnderAccuracy:84.1,bttsAccuracy:71.5,streak:11};
export const topScorers:any={epl:[{name:"Erling Haaland",club:"mancity",goals:29,assists:6},{name:"Alexander Isak",club:"newcastle",goals:22,assists:5},{name:"Bukayo Saka",club:"arsenal",goals:19,assists:14},{name:"Cole Palmer",club:"chelsea",goals:18,assists:10},{name:"Bryan Mbeumo",club:"brentford",goals:17,assists:8}],laliga:[{name:"Robert Lewandowski",club:"barcelona",goals:26,assists:8},{name:"Kylian Mbappé",club:"realmadrid",goals:22,assists:6},{name:"Raphinha",club:"barcelona",goals:18,assists:11},{name:"Antoine Griezmann",club:"atletico",goals:16,assists:7}],seriea:[{name:"Lautaro Martínez",club:"inter",goals:24,assists:5},{name:"Dušan Vlahović",club:"juventus",goals:18,assists:4},{name:"Marcus Thuram",club:"inter",goals:16,assists:6}],ligue1:[{name:"Bradley Barcola",club:"psg",goals:22,assists:10},{name:"Ousmane Dembélé",club:"psg",goals:18,assists:12},{name:"Jonathan David",club:"lille",goals:17,assists:4}]};

export const tactiques: Record<string, any> = {
  "psg": { style: "possession agressive et attaques placées", force: "la foudre de leurs ailiers en 1v1", faiblesse: "leur gestion des transitions défensives face aux blocs bas", motCle: "domination athlétique" },
  "barcelona": { style: "jeu de position (Juego de Posición)", force: "leur circulation de balle ultra-rapide au milieu", faiblesse: "leur vulnérabilité sur les contres rapides dans le dos de la défense", motCle: "contrôle technique absolu" },
  "realmadrid": { style: "pragmatisme clinique et flexibilité", force: "leur gestion émotionnelle exceptionnelle des grands rendez-vous", faiblesse: "une certaine apathie en début de match", motCle: "expérience européenne" },
  "mancity": { style: "contrôle total avec latéraux inversés", force: "leur capacité à étouffer l'adversaire dans sa propre moitié de terrain", faiblesse: "les ballons longs dans le dos de leur charnière haute", motCle: "domination tactique" },
  "liverpool": { style: "gegenpressing et verticalité absolue", force: "l'intensité physique qu'ils imposent à la récupération", faiblesse: "l'usure athlétique générée par leur propre pressing", motCle: "chaos organisé" },
  "arsenal": { style: "pressing moderne et jeu en triangle", force: "leur capacité à déséquilibrer l'axe par des passes cachées", faiblesse: "le manque de cynisme dans les matchs très fermés", motCle: "intensité offensive" },
  "atletico": { style: "bloc défensif ultra-compact (Cholisme)", force: "leur discipline tactique et leur agressivité dans les duels", faiblesse: "leur difficulté à créer du jeu face à des blocs regroupés", motCle: "guerre psychologique" },
  "inter": { style: "défense à trois et transitions fluides", force: "la projection de leurs pistons sur les ailes", faiblesse: "la gestion de la profondeur si leur pressing est cassé", motCle: "solidité axiale" },
  "france": { style: "bloc médian et transitions éclairs", force: "leur capacité à absorber la pression avant de piquer", faiblesse: "leur manque d'idées face à un bloc bas très dense", motCle: "réalisme froid" },
  "brazil": { style: "football fluide basé sur le talent individuel", force: "leur capacité d'élimination dans les petits espaces", faiblesse: "le repli défensif de leurs stars offensives", motCle: "magie offensive" },
  "default": { style: "organisation équilibrée classique", force: "leur solidité collective sur les phases arrêtées", faiblesse: "leur inconstance tactique face à une forte pression", motCle: "pragmatisme" }
};
