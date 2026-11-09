import type { AtlasSource } from "@/lib/training/atlas-types";
import type { Localized } from "@/lib/training/catalogue";

/**
 * References cited by the Training Atlas. Citations are short bibliographic
 * lines; findings are LEBLOND's own summaries, never quoted text. Study links
 * point to PubMed or the open-access full text; coach and provider links
 * point to the author's own page.
 */
const loc = (fr: string, en: string): Localized => ({ fr, en });

export const SRC = {
  thomas2018: {
    kind: "review",
    citation: "Thomas E, Bianco A, Paoli A, Palma A (2018). The relation between stretching typology and stretching duration: the effects on range of motion. Int J Sports Med 39(4):243–254.",
    url: "https://doi.org/10.1055/s-0044-101146",
    finding: loc(
      "Revue systématique : l'amplitude progresse avec le temps total d'étirement par semaine (au moins ≈ 5 min par groupe musculaire) et avec des séances fréquentes, quel que soit le type d'étirement.",
      "Systematic review: range of motion improves with total weekly stretching time (at least ≈ 5 min per muscle group) and with frequent sessions, whatever the type of stretching.",
    ),
  },
  behm2016: {
    kind: "review",
    citation: "Behm DG, Blazevich AJ, Kay AD, McHugh M (2016). Acute effects of muscle stretching on physical performance, range of motion, and injury incidence in healthy active individuals: a systematic review. Appl Physiol Nutr Metab 41(1):1–11.",
    url: "https://doi.org/10.1139/apnm-2015-0235",
    finding: loc(
      "Des étirements statiques courts (moins de 60 s par muscle) dans un échauffement complet ont un effet négligeable sur la performance ; tenus longtemps juste avant un effort explosif, ils peuvent la réduire un peu. Effet sur les blessures : faible et incertain.",
      "Short static stretches (under 60 s per muscle) inside a full warm-up have a trivial effect on performance; held long right before an explosive effort they can reduce it slightly. Effect on injuries: small and uncertain.",
    ),
  },
  afonso2021: {
    kind: "review",
    citation: "Afonso J, Clemente FM, Nakamura FY, et al. (2021). The effectiveness of post-exercise stretching in short-term and delayed recovery of strength, range of motion and delayed onset muscle soreness: a systematic review and meta-analysis of randomized controlled trials. Front Physiol 12:677581.",
    url: "https://doi.org/10.3389/fphys.2021.677581",
    finding: loc(
      "Méta-analyse d'essais randomisés : s'étirer après l'effort n'accélère ni la récupération de la force ni la disparition des courbatures.",
      "Meta-analysis of randomised trials: stretching after exercise speeds up neither strength recovery nor the fading of soreness.",
    ),
  },
  mermier2000: {
    kind: "study",
    citation: "Mermier CM, Janot JM, Parker DL, Swan JG (2000). Physiological and anthropometric determinants of sport climbing performance. Br J Sports Med 34(5):359–366.",
    url: "https://doi.org/10.1136/bjsm.34.5.359",
    finding: loc(
      "44 grimpeurs : les qualités entraînables (force, endurance) expliquent l'essentiel des différences de niveau ; la souplesse mesurée n'en explique qu'une très petite part.",
      "44 climbers: trainable qualities (strength, endurance) explain most of the differences in grade; measured flexibility explains only a very small part.",
    ),
  },
  latticeFlexibility: {
    kind: "video",
    citation: "Lattice Training (YouTube). The Bare Minimum Flexibility Routine for Climbers.",
    url: "https://www.youtube.com/watch?v=mKUle2yBYq0",
    finding: loc(
      "Routine de souplesse minimale pour grimpeurs, à suivre en vidéo ; recommandée par l'équipe LEBLOND.",
      "A minimal flexibility routine for climbers to follow on video; recommended by the LEBLOND team.",
    ),
  },
  lopez2019: {
    kind: "study",
    citation: "López-Rivera E, González-Badillo JJ (2019). Comparison of the effects of three hangboard strength and endurance training programs on grip endurance in sport climbers. J Hum Kinet 66:183–195.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC6458579/",
    finding: loc(
      "Essai randomisé, 26 grimpeurs avancés (7c+/8a), 8 semaines : suspensions maximales lestées et suspensions intermittentes améliorent toutes deux l'endurance de préhension ; l'intermittent progresse plus vite (+45 % contre +34 %).",
      "Randomised trial, 26 advanced climbers (7c+/8a), 8 weeks: weighted maximal hangs and intermittent hangs both improved grip endurance; intermittent hangs improved faster (+45% vs +34%).",
    ),
  },
  lopezBlog2018: {
    kind: "coach",
    citation: "López E (2018). Maximal hangs, intermittent hangs (repeaters) or a combination — which 8-week program is more effective? (blog).",
    url: "https://en-eva-lopez.blogspot.com/2018/03/maximal-hangs-intermittent-hangs.html",
    finding: loc(
      "L'autrice du protocole MaxHangs détaille ses paramètres : 10 s en gardant ≈ 3 s de marge, 3 à 5 séries, 3 min de repos, et explique pourquoi un seul essai ne suffit pas à trancher.",
      "The author of the MaxHangs protocol details its parameters: 10 s keeping ≈ 3 s in reserve, 3–5 sets, 3 min rest, and explains why one trial cannot settle the question.",
    ),
  },
  devise2022: {
    kind: "study",
    citation: "Devise M, Lechaptois C, Berton E, Vigouroux L (2022). Effects of different hangboard training intensities on finger grip strength, stamina, and endurance. Front Sports Act Living 4:862782.",
    url: "https://pubmed.ncbi.nlm.nih.gov/35498522/",
    finding: loc(
      "54 grimpeurs, 4 semaines, 2 séances/semaine sur réglette de 12 mm : 100 % et 80 % de la force max augmentent la force ; 80 % et 60 % augmentent l'endurance. L'intensité choisie oriente l'adaptation.",
      "54 climbers, 4 weeks, 2 sessions/week on a 12 mm edge: 100% and 80% of max force increased strength; 80% and 60% increased endurance. The chosen intensity steers the adaptation.",
    ),
  },
  hermans2022: {
    kind: "study",
    citation: "Hermans E, Saeterbakken AH, Vereide V, Nord ISO, Stien N, Andersen V (2022). The effects of 10 weeks hangboard training on climbing specific maximal strength, explosive strength, and finger endurance. Front Sports Act Living 4:888158.",
    url: "https://pubmed.ncbi.nlm.nih.gov/35571743/",
    finding: loc(
      "Essai randomisé, 35 grimpeurs intermédiaires à avancés, 2 séances de 48 min/semaine pendant 10 semaines : +17 % de force maximale sur réglette de 23 mm, sans gain significatif d'endurance par rapport au groupe contrôle.",
      "Randomised trial, 35 intermediate-to-advanced climbers, two 48-min sessions/week for 10 weeks: +17% peak force on a 23 mm rung, with no significant endurance gain versus control.",
    ),
  },
  medernach2015: {
    kind: "study",
    citation: "Medernach JP, Kleinöder H, Lötzerich HH (2015). Fingerboard in competitive bouldering: training effects on grip strength and endurance. J Strength Cond Res 29(8):2286–2295.",
    url: "https://pubmed.ncbi.nlm.nih.gov/26203738/",
    finding: loc(
      "23 bloqueurs avancés (7b+ en moyenne), 4 semaines : la poutre améliore force de préhension et suspensions plus que le bloc seul.",
      "23 advanced boulderers (7b+ on average), 4 weeks: fingerboarding improved grip strength and hang times more than bouldering alone.",
    ),
  },
  levernier2019: {
    kind: "study",
    citation: "Levernier G, Laffaye G (2019). Four weeks of finger grip training increases the rate of force development and the maximal force in elite and top world-ranking climbers. J Strength Cond Res 33(9):2471–2480.",
    url: "https://pubmed.ncbi.nlm.nih.gov/28945641/",
    finding: loc(
      "14 grimpeurs de niveau national et international : 4 semaines de suspensions sur petites prises augmentent la force (+8 % en prise tendue) et surtout la vitesse de production de force (+27 à +32 %), signe d'une adaptation nerveuse.",
      "14 national and international climbers: 4 weeks of small-hold hangs raised force (+8% open grip) and above all rate of force development (+27–32%), suggesting a neural adaptation.",
    ),
  },
  lopez2022edges: {
    kind: "study",
    citation: "López-Rivera E, González-Badillo JJ, España-Romero V (2022). Which is the most reliable edge depth to measure maximum hanging time in sport climbers? Gait Posture 91:37–42.",
    url: "https://pubmed.ncbi.nlm.nih.gov/34649172/",
    finding: loc(
      "36 grimpeurs testés deux fois : la réglette de 8 mm est la plus fiable pour mesurer le temps de suspension ; 10 mm convient de 6b à 7c et 12 mm de 7c+ à 8c.",
      "36 climbers tested twice: the 8 mm edge was the most reliable for maximum hang time; 10 mm suits 6b–7c and 12 mm suits 7c+–8c.",
    ),
  },
  perezCordero2025: {
    kind: "review",
    citation: "Pérez-Cordero J, Jerez-Mayorga D, Rodríguez-Perea Á, Soto García D (2025). Reliability of finger strength assessment methods in climbing: a systematic review. Front Sports Act Living.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC12521219/",
    finding: loc(
      "Revue de 15 études (747 participants) : les tests de force isométrique maximale des doigts sont très fidèles (ICC médian 0,85–0,99), à condition de standardiser réglette et prise.",
      "Review of 15 studies (747 participants): maximal isometric finger-strength tests are highly reliable (median ICC 0.85–0.99) when edge and grip are standardised.",
    ),
  },
  stien2023: {
    kind: "review",
    citation: "Stien N, Riiser A, Shaw MP, Saeterbakken AH, Andersen V (2023). Effects of climbing- and resistance-training on climbing-specific performance: a systematic review and meta-analysis. Biol Sport 40(1):179–191.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9806751/",
    finding: loc(
      "Méta-analyse (11 essais contrôlés) : l'entraînement en résistance spécifique améliore davantage les tests d'escalade que la grimpe seule (différence standardisée 0,57) ; le bloc en intervalles peut aussi aider. Les auteurs soulignent le faible nombre d'études.",
      "Meta-analysis (11 controlled trials): specific resistance training improved climbing tests more than climbing alone (standardised difference 0.57); interval-style bouldering may also help. The authors stress how few studies exist.",
    ),
  },
  stien2021campus: {
    kind: "study",
    citation: "Stien N, Pedersen H, Vereide VA, et al. (2021). Effects of two vs. four weekly campus board training sessions on bouldering performance and climbing-specific tests in advanced and elite climbers. J Sports Sci Med 20(3):438–447.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8256519/",
    finding: loc(
      "16 grimpeurs avancés à élite, 5 semaines de campus en plus de la grimpe : gains de force, de vitesse de production de force, d'allonge et de performance en bloc par rapport au groupe contrôle.",
      "16 advanced-to-elite climbers, 5 weeks of campus board on top of climbing: gains in strength, rate of force development, reach and bouldering performance versus control.",
    ),
  },
  mcmullen2021: {
    kind: "study",
    citation: "McMullen CW, Mugleston BJ, Booker LN (2021). Coaches' attitudes toward campus board training in adolescent climbers in the United States. Wilderness Environ Med 32(2):166–171.",
    url: "https://pubmed.ncbi.nlm.nih.gov/33972161/",
    finding: loc(
      "Enquête auprès d'entraîneurs : le campus chez l'adolescent reste un sujet de prudence, faute de consensus sur l'âge et le dosage.",
      "Survey of coaches: campus training in adolescents remains a matter of caution, with no consensus on age or dose.",
    ),
  },
  jones2022: {
    kind: "review",
    citation: "Jones G, Johnson R, Schöffl V, et al. (2022). Primary periphyseal stress injuries of the fingers in adolescent climbers: a critical review. Curr Sports Med Rep 21(12):436–442.",
    url: "https://pubmed.ncbi.nlm.nih.gov/36508599/",
    finding: loc(
      "Les fractures de fatigue des cartilages de croissance des doigts chez l'adolescent résultent de micro-traumatismes répétés ; une douleur dorsale de l'articulation du milieu du doigt doit être examinée rapidement.",
      "Finger growth-plate stress injuries in adolescents result from repeated microtrauma; pain on the back of the middle finger joint should be checked promptly.",
    ),
  },
  giles2021: {
    kind: "study",
    citation: "Giles D, Hartley C, Maslen H, et al. (2021). An all-out test to determine finger flexor critical force in rock climbers. Int J Sports Physiol Perform 16(7):942–949.",
    url: "https://pubmed.ncbi.nlm.nih.gov/33647876/",
    finding: loc(
      "129 grimpeurs : la force critique des fléchisseurs (en % du poids) explique 61 % du niveau en voie et 26 % en bloc ; combinée à la réserve au-dessus de ce seuil, 66 % et 44 %.",
      "129 climbers: finger-flexor critical force (as % of body mass) explained 61% of sport and 26% of bouldering grade; combined with the impulse above it, 66% and 44%.",
    ),
  },
  mcclean2023: {
    kind: "study",
    citation: "McClean ZJ, MacDougall KB, Fletcher JR, Aboodarda SJ, MacIntosh BR (2023). Test–retest reliability of a 4-minute all-out critical force test in rock climbers. Int J Exerc Sci 16(2):1–13.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC10449326/",
    finding: loc(
      "13 grimpeurs, 24 tractions maximales de 7 s / 3 s de pause sur réglette de 20 mm : le pic de force est très reproductible, la force de fin de test l'est moins (variation ≈ 21 %).",
      "13 climbers, 24 maximal 7-s pulls / 3-s rests on a 20 mm edge: peak force is highly repeatable, end-test force less so (≈ 21% variation).",
    ),
  },
  balas2024: {
    kind: "study",
    citation: "Baláš J, Gajdošík J, Javorský T, Berta P, Feldmann A (2024). Measuring critical force in sport climbers: a validation study of the 4 min all-out test on finger flexors. Eur J Appl Physiol 124:2493–2504.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11365833/",
    finding: loc(
      "12 grimpeurs : la force calculée sur les 3 dernières contractions surestime l'intensité réellement tenable ; la force de fin de contraction est un meilleur repère. À utiliser avec prudence pour régler les charges.",
      "12 climbers: force averaged over the last 3 contractions overestimates the truly sustainable intensity; end-of-contraction force is a better marker. Use with care when setting loads.",
    ),
  },
  fryer2016: {
    kind: "study",
    citation: "Fryer S, Stoner L, Stone K, et al. (2016). Forearm muscle oxidative capacity index predicts sport rock-climbing performance. Eur J Appl Physiol 116(8):1479–1484.",
    url: "https://pubmed.ncbi.nlm.nih.gov/27255506/",
    finding: loc(
      "46 grimpeurs : plus l'avant-bras récupère vite son oxygénation, plus le niveau en voie est élevé. C'est l'argument physiologique en faveur du travail aérobie local.",
      "46 climbers: the faster the forearm re-oxygenates, the higher the sport-climbing grade. This is the physiological case for local aerobic work.",
    ),
  },
  faggian2025: {
    kind: "review",
    citation: "Faggian S, Borasio N, Vecchiato M, et al. (2025). Sport climbing performance determinants and functional testing methods: a systematic review. J Sport Health Sci 14:100974.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC11904605/",
    finding: loc(
      "Revue de 74 études : endurance cardio-respiratoire et force, endurance et puissance musculaires spécifiques distinguent les niveaux ; souplesse et équilibre pèsent moins.",
      "Review of 74 studies: climbing-specific cardiorespiratory endurance and muscular strength, endurance and power separate ability levels; flexibility and balance matter less.",
    ),
  },
  orth2016: {
    kind: "review",
    citation: "Orth D, Davids K, Seifert L (2016). Coordination in climbing: effect of skill, practice and constraints manipulation. Sports Med 46(2):255–268.",
    url: "https://pubmed.ncbi.nlm.nih.gov/26604101/",
    finding: loc(
      "Revue de 42 études : les grimpeurs experts perçoivent mieux les possibilités d'action, marquent moins de pauses et explorent moins ; les auteurs notent le manque de consignes d'entraînement validées.",
      "Review of 42 studies: expert climbers perceive action opportunities better, pause less and explore less; the authors note the lack of validated practice guidelines.",
    ),
  },
  seifert2017: {
    kind: "study",
    citation: "Seifert L, Cordier R, Orth D, Courtine Y, Croft JL (2017). Role of route previewing strategies on climbing fluency and exploratory movements. PLoS One 12(4):e0176306.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5404847/",
    finding: loc(
      "18 grimpeurs suivis par oculométrie : la façon de lire la voie depuis le sol influence la fluidité et les mouvements exploratoires pendant l'ascension.",
      "18 climbers with eye tracking: how a route is previewed from the ground affects fluency and exploratory movements during the climb.",
    ),
  },
  walker2020: {
    kind: "study",
    citation: "Walker SG, Mattson SL, Sellers TP (2020). Increasing accuracy of rock-climbing techniques in novice athletes using expert modeling and video feedback. J Appl Behav Anal 53(4):2260–2270.",
    url: "https://pubmed.ncbi.nlm.nih.gov/32130736/",
    finding: loc(
      "Étude à cas unique chez des débutants adultes : un modèle vidéo d'expert suivi d'un retour vidéo et verbal améliore la précision des trois techniques travaillées.",
      "Single-case study in novice adults: an expert video model followed by video and verbal feedback improved accuracy on all three targeted skills.",
    ),
  },
  hodgson2009: {
    kind: "study",
    citation: "Hodgson CI, Draper N, McMorris T, et al. (2009). Perceived anxiety and plasma cortisol concentrations following rock climbing with differing safety rope protocols. Br J Sports Med 43(7):531–536.",
    url: "https://pubmed.ncbi.nlm.nih.gov/18411238/",
    finding: loc(
      "12 grimpeurs : plus le protocole de corde est exposé (moulinette → tête), plus l'anxiété somatique et le cortisol montent et plus la confiance baisse.",
      "12 climbers: the more exposed the rope protocol (top rope → lead), the higher somatic anxiety and cortisol and the lower self-confidence.",
    ),
  },
  draper2012: {
    kind: "study",
    citation: "Draper N, Dickson T, Fryer S, et al. (2012). Plasma cortisol concentrations and perceived anxiety in response to on-sight rock climbing. Int J Sports Med 33(1):13–17.",
    url: "https://pubmed.ncbi.nlm.nih.gov/21984397/",
    finding: loc(
      "Grimper à vue en tête augmente l'anxiété perçue et le cortisol, ce qui justifie de préparer la tête comme le corps.",
      "On-sight lead climbing raises perceived anxiety and cortisol, which supports training the mind as well as the body.",
    ),
  },
  moesgaard2022: {
    kind: "review",
    citation: "Moesgaard L, Beck MM, Christiansen L, Aagaard P, Lundbye-Jensen J (2022). Effects of periodization on strength and muscle hypertrophy in volume-equated resistance training programs: a systematic review and meta-analysis. Sports Med 52(7):1647–1666.",
    url: "https://pubmed.ncbi.nlm.nih.gov/35044672/",
    finding: loc(
      "35 études en musculation (hors escalade) : à volume égal, la périodisation donne un petit avantage pour la force maximale (effet 0,31) et aucun pour l'hypertrophie.",
      "35 resistance-training studies (not climbing): at equal volume, periodisation gave a small advantage for maximal strength (effect 0.31) and none for hypertrophy.",
    ),
  },
  acsm2009: {
    kind: "review",
    citation: "American College of Sports Medicine (2009). Position stand: progression models in resistance training for healthy adults. Med Sci Sports Exerc 41(3):687–708.",
    url: "https://pubmed.ncbi.nlm.nih.gov/19204579/",
    finding: loc(
      "Recommandations de référence sur la progression en musculation : ordre des exercices, fourchettes de répétitions, repos et augmentation progressive des charges.",
      "Reference guidelines for resistance-training progression: exercise order, repetition ranges, rest and gradual load increases.",
    ),
  },
  saeterbakken2022: {
    kind: "review",
    citation: "Saeterbakken AH, Stien N, Andersen V, et al. (2022). The effects of trunk muscle training on physical fitness and sport-specific performance in young and adult athletes: a systematic review and meta-analysis. Sports Med 52(7):1599–1622.",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9213339/",
    finding: loc(
      "Méta-analyse multi-sports : le renforcement du tronc améliore la condition physique générale ; l'effet sur la performance propre à chaque sport est plus faible.",
      "Multi-sport meta-analysis: trunk training improves general physical fitness; the effect on sport-specific performance is smaller.",
    ),
  },
  horstProtocols: {
    kind: "coach",
    citation: "Hörst E (2016, mis à jour 2022). 4 fingerboard training protocols that work. Training For Climbing.",
    url: "https://trainingforclimbing.com/4-fingerboard-strength-protocols-that-work/",
    finding: loc(
      "Quatre protocoles détaillés (réglette minimale, 10 s lestées, 7-53, repeaters 7/3) avec prérequis : grimpeurs expérimentés, sans blessure récente, 2 séances par semaine.",
      "Four detailed protocols (minimum edge, 10-s weighted, 7-53, 7/3 repeaters) with prerequisites: experienced climbers, no recent injury, two sessions a week.",
    ),
  },
  horstLimit: {
    kind: "coach",
    citation: "Hanes L (2023). Limit bouldering for building max climbing strength and power. Training For Climbing (E. Hörst).",
    url: "https://trainingforclimbing.com/limit-bouldering-for-building-max-climbing-strength-and-power/",
    finding: loc(
      "Sections de 3 à 5 mouvements à effort maximal, repos complet de quelques minutes, jamais deux jours de suite et au plus deux fois par semaine.",
      "Sections of 3–5 moves at maximal effort, full rest of a few minutes, never on consecutive days and at most twice a week.",
    ),
  },
  rctmCampus: {
    kind: "coach",
    citation: "Anderson M (2012). Campus training part 2: frequency & exercise overview. The Rock Climber's Training Manual.",
    url: "https://rockclimberstrainingmanual.com/2012/12/11/campus-training-part-2-frequency-exercise-overview/",
    finding: loc(
      "Phase de puissance de 3–4 semaines, 2 jours complets de repos après chaque séance, exercices (échelles, rattrapés, touches, doubles) et mise en garde contre la désescalade en campus.",
      "3–4-week power phase, two full rest days after each session, exercises (ladders, bumps, touches, doubles) and a warning against campusing downwards.",
    ),
  },
  latticeMaxHangs: {
    kind: "coach",
    citation: "Lattice Training. Research discussion: Eva López-Rivera finger strength.",
    url: "https://latticetraining.com/blog/research-discussion-eva-lopez-rivera-finger-strength",
    finding: loc(
      "Analyse d'une étude de López-Rivera : les grimpeurs moins forts au départ progressent nettement, les plus forts beaucoup moins ; l'entraînement doit s'adapter au profil.",
      "Discussion of a López-Rivera study: climbers who started weaker improved clearly, the strongest far less; training should fit the profile.",
    ),
  },
  latticeEndurance: {
    kind: "coach",
    citation: "Lattice Training (2023). What is endurance training in climbing?",
    url: "https://latticetraining.com/blog/what-is-endurance-training-in-climbing",
    finding: loc(
      "Distingue le travail aérobie (continu, sans pompage) du travail anaérobie, et propose ARC de 10–30 min, intervalles 1 min/1 min et 5 min/3 min.",
      "Separates aerobic work (continuous, no pump) from anaerobic work, and describes 10–30-min ARC, 1-min/1-min and 5-min/3-min intervals.",
    ),
  },
  latticeFourByFour: {
    kind: "coach",
    citation: "Lattice Training. 4x4s — power endurance workout (Crimpd library).",
    url: "https://latticetraining.com/workout/3d29bf02-0431-4365-b779-b5665f2ba041/4x4s",
    finding: loc(
      "Fiche d'exercice : blocs enchaînés avec peu ou pas de repos, puis récupération avant de répéter ; chaque bloc doit devenir presque maximal à la 4e répétition.",
      "Workout card: problems linked with little or no rest, then recovery before repeating; each problem should feel near-maximal by the 4th repeat.",
    ),
  },
  latticeFear: {
    kind: "coach",
    citation: "Lattice Training. Fear of falling — with climbing psychologist Allegra Maguire.",
    url: "https://latticetraining.com/blog/fear-of-falling",
    finding: loc(
      "Progression de la chute en moulinette avec mou vers la chute en tête sous le point ; les séances doivent laisser une impression positive, pas d'épuisement.",
      "Progression from top-rope falls with slack to lead falls below the bolt; sessions should leave a positive feeling, not exhaustion.",
    ),
  },
  alpinistIlgner: {
    kind: "coach",
    citation: "Alpinist (2014). The Warrior's Way: Arno Ilgner discusses fear in climbing.",
    url: "https://alpinist.com/features/the-warriors-way-arno-ilgner-discusses-fear-in-climbing/",
    finding: loc(
      "Entretien avec l'auteur de The Warrior's Way : commencer les chutes en moulinette et augmenter le stress par petites étapes, puis le transformer en confort.",
      "Interview with the author of The Warrior's Way: start falling on top rope and add stress in small steps, then turn it into comfort.",
    ),
  },
  trainingBetaPeriodization: {
    kind: "coach",
    citation: "TrainingBeta. Periodized training for climbing.",
    url: "https://www.trainingbeta.com/periodized-training-for-climbing/",
    finding: loc(
      "Présentation des cycles d'entraînement en escalade (base, force, puissance, résistance, repos) et de leur logique d'enchaînement.",
      "Overview of climbing training cycles (base, strength, power, power endurance, rest) and why they are sequenced.",
    ),
  },
  latticeStructure: {
    kind: "coach",
    citation: "Lattice Training. How to structure your training.",
    url: "https://latticetraining.com/blog/how-to-structure-your-training",
    finding: loc(
      "Conseils pour organiser la semaine : priorités, ordre des séances, intensité avant volume.",
      "Advice on organising the week: priorities, session order, intensity before volume.",
    ),
  },
  latticeTesting: {
    kind: "provider",
    citation: "Lattice Training. LatticePlan — testing (documentation).",
    url: "https://www.latticetraining.com/docs/latticeplan-testing",
    finding: loc(
      "Les tests sont regroupés en 4 domaines (force des doigts, endurance des avant-bras, force, mobilité) ; le questionnaire de plan utilise les résultats des 12 derniers mois.",
      "Tests are grouped into 4 areas (finger strength, forearm endurance, strength, flexibility); the plan quiz uses results from the last 12 months.",
    ),
  },
  latticeVideo: {
    kind: "video",
    citation: "Lattice Training. 3 climbing movement tips (YouTube).",
    url: "https://www.youtube.com/watch?v=lgy1s9cWA00",
    finding: loc(
      "Démonstration filmée de corrections de placement.",
      "Filmed demonstration of positioning corrections.",
    ),
  },
  latticePortableVideo: {
    kind: "video",
    citation: "Lattice Training. Portable hangboard demonstration (YouTube).",
    url: "https://www.youtube.com/watch?v=wAe5uMjVKfw",
    finding: loc(
      "Démonstration d'un dispositif de traction portable avec mesure.",
      "Demonstration of a portable, measurable pulling setup.",
    ),
  },
  powerCompanyMetrics: {
    kind: "provider",
    citation: "Power Company Climbing. Metrics for climbers (blog).",
    url: "https://www.powercompanyclimbing.com/blog/metrics-for-climbers",
    finding: loc(
      "Les références chiffrées servent à repérer des besoins, pas à juger un grimpeur.",
      "Benchmarks are for spotting needs, not for judging a climber.",
    ),
  },
  crimpdPlan: {
    kind: "provider",
    citation: "Crimpd. Build a training plan (documentation).",
    url: "https://crimpd.com/docs/build-a-training-plan/",
    finding: loc(
      "Plans de 1 à 24 semaines (≤ 12 recommandé), semaines Base / Repos (≈ moitié du volume) / Pic, modèles « Skill » de 6 semaines en 2 blocs de 3.",
      "Plans of 1–24 weeks (≤ 12 recommended), Base / Rest (≈ half volume) / Peak weeks, 6-week Skill templates in two 3-week blocks.",
    ),
  },
  hoopersStrength: {
    kind: "provider",
    citation: "Hooper's Beta. How to train for climbing — full body guide.",
    url: "https://www.hoopersbeta.com/library/how-to-train-for-climbing-full-body-guide",
    finding: loc(
      "Guide de renforcement complet pour grimpeurs (tirage, poussée, tronc, jambes) rédigé par des praticiens.",
      "Practitioner-written full-body strength guide for climbers (pull, push, trunk, legs).",
    ),
  },
  moonboardUse: {
    kind: "provider",
    citation: "Moon Climbing. Using your MoonBoard (FAQ).",
    url: "https://moonclimbing.com/using-your-moonboard",
    finding: loc(
      "Les configurations MoonBoard se montent à 25° ou 40°, chaque angle ayant ses propres blocs ; les blocs « benchmark » sont sélectionnés par des modérateurs.",
      "MoonBoard setups can be installed at 25° or 40°, each angle with its own problems; benchmark problems are curated by moderators.",
    ),
  },
  tindeqProgressor: {
    kind: "provider",
    citation: "Tindeq. Progressor 200 (product page).",
    url: "https://tindeq.com/product/progressor/",
    finding: loc(
      "Exemple de capteur : charge nominale 200 kg, 80 mesures par seconde, liaison Bluetooth avec une application.",
      "Example sensor: 200 kg rated load, 80 samples per second, Bluetooth link to an app.",
    ),
  },
} as const satisfies Record<string, AtlasSource>;
