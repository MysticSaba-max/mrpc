type ActivityTypeValue = 0 | 2 | 3 | 5;

interface PresenceButton {
  label: string;
  url: string;
}

interface PresenceDataLike {
  name?: string;
  type?: ActivityTypeValue;
  details?: string;
  state?: string;
  startTimestamp?: number;
  endTimestamp?: number;
  largeImageKey?: string;
  largeImageText?: string;
  buttons?: PresenceButton[];
}

interface PresenceInstance {
  on(event: 'UpdateData', callback: () => void | Promise<void>): void;
  setActivity(data: PresenceDataLike): void;
  clearActivity(): void;
  getSetting<T extends string | boolean | number>(settingId: string): Promise<T>;
}

declare const Presence: new (options: { clientId: string }) => PresenceInstance;

const presence = new Presence({
  clientId: '1407771794470862922',
});

const ActivityType = {
  Playing: 0,
  Listening: 2,
  Watching: 3,
  Competing: 5,
} as const;

const SITE_NAME = 'Movix';
const FALLBACK_SITE_URL = 'https://movix.rodeo';
const FALLBACK_LOGO = `${FALLBACK_SITE_URL}/logo.png`;

const PROVIDER_NAMES: Record<string, string> = {
  '8': 'Netflix',
  '119': 'Prime Video',
  '337': 'Disney+',
  '338': 'Marvel Studios',
  '350': 'Apple TV+',
  '355': 'Warner Bros',
  '356': 'DC Comics',
  '384': 'HBO MAX',
  '531': 'Paramount+',
};

const SAFE_BUTTON_PATTERNS = [
  /^\/collection\/[^/]+$/i,
  /^\/movie\/[^/]+$/i,
  /^\/tv\/[^/]+$/i,
  /^\/download\/[^/]+\/[^/]+$/i,
  /^\/genre\/[^/]+\/[^/]+$/i,
  /^\/provider\/[^/]+\/[^/]+(?:\/[^/]+)?$/i,
  /^\/person\/[^/]+$/i,
  /^\/watchparty\/room\/[^/]+$/i,
  /^\/list\/[^/]+$/i,
  /^\/vip\/invoice\/[^/]+$/i,
  /^\/vip\/cadeau\/[^/]+$/i,
  /^\/ftv\/info\/[^/]+$/i,
  /^\/wrapped(?:\/[^/]+)?$/i,
];

let lastRouteKey = '';
let lastRouteStartedAt = Date.now();

function normalizeText(value: unknown): string {
  return String(value ?? '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: unknown, max = 128): string {
  const text = normalizeText(value);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trim()}...`;
}

function stripSiteName(value: unknown): string {
  return normalizeText(value).replace(/\s*(?:[-|:]\s*)?Movix$/i, '').trim();
}

function firstNonEmpty<T>(...values: T[]): T | '' {
  for (const value of values) {
    if (normalizeText(value)) {
      return value;
    }
  }

  return '';
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function shortenId(value: string, size = 6): string {
  const text = normalizeText(value);
  return text ? text.slice(0, size).toUpperCase() : '';
}

function toAbsoluteUrl(value: string): string {
  const text = normalizeText(value);
  if (!text) return '';

  try {
    return new URL(text, document.location.origin).toString();
  } catch {
    return '';
  }
}

function isImageUrlAllowed(value: string): boolean {
  return /^https:\/\//i.test(value) || value.startsWith('data:') || value.startsWith('blob:');
}

function isButtonUrlAllowed(value: string): boolean {
  return /^https:\/\//i.test(value);
}

function getMetaContent(selector: string): string {
  const element = document.querySelector(selector) as HTMLMetaElement | null;
  return normalizeText(element?.content);
}

function getAttribute(selector: string, attribute: string): string {
  const elements = Array.from(document.querySelectorAll(selector));

  for (const element of elements) {
    const value = normalizeText(element.getAttribute(attribute));
    if (value) {
      return value;
    }
  }

  return '';
}

function getText(selector: string): string {
  const elements = Array.from(document.querySelectorAll(selector));

  for (const element of elements) {
    const text = normalizeText((element as HTMLElement).innerText || element.textContent);
    if (text) {
      return text;
    }
  }

  return '';
}

function findTitleAttribute(predicate: (title: string) => boolean): string {
  const elements = Array.from(document.querySelectorAll('[title]'));

  for (const element of elements) {
    const title = normalizeText(element.getAttribute('title'));
    if (title && predicate(title)) {
      return title;
    }
  }

  return '';
}

function getSearchParam(name: string): string {
  return normalizeText(new URLSearchParams(document.location.search).get(name));
}

function getRouteStartedAt(): number {
  const key = `${document.location.pathname}${document.location.search}`;

  if (key !== lastRouteKey) {
    lastRouteKey = key;
    lastRouteStartedAt = Date.now();
  }

  return lastRouteStartedAt;
}

function getPageTitle(): string {
  const title = firstNonEmpty(
    getMetaContent('meta[property="og:title"]'),
    getText('main h1'),
    getText('h1'),
    getText('main h2'),
    getText('h2'),
    document.title
  );

  return stripSiteName(title);
}

function getPageImage(): string {
  const candidates = [
    getMetaContent('meta[property="og:image"]'),
    getAttribute('img[alt="Poster"]', 'src'),
    getAttribute('img[alt*="poster" i]', 'src'),
    getAttribute('img[src*="tmdb.org"]', 'src'),
    getAttribute('img[src*="movix"]', 'src'),
    FALLBACK_LOGO,
  ];

  for (const candidate of candidates) {
    const absolute = toAbsoluteUrl(candidate);
    if (absolute && isImageUrlAllowed(absolute)) {
      return absolute;
    }
  }

  return FALLBACK_LOGO;
}

function getSafeButtons(pathname: string, enabled: boolean): Array<{ label: string; url: string }> | undefined {
  if (!enabled || !SAFE_BUTTON_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return undefined;
  }

  const url = document.location.href;
  if (!isButtonUrlAllowed(url)) {
    return undefined;
  }

  return [
    {
      label: 'Voir la page',
      url,
    },
  ];
}

function buildBasePresence(image?: string): PresenceDataLike {
  return {
    name: SITE_NAME,
    largeImageKey: image || getPageImage() || FALLBACK_LOGO,
  };
}

function finalizePresence(
  presenceData: PresenceDataLike | null,
  options: { showTimestamp: boolean; showButtons: boolean; pathname: string; allowPageTimestamp?: boolean }
) {
  if (!presenceData) {
    return null;
  }

  presenceData.details = truncate(presenceData.details);
  presenceData.state = truncate(presenceData.state);

  if (!presenceData.details || !presenceData.state) {
    return null;
  }

  if (!presenceData.buttons) {
    const buttons = getSafeButtons(options.pathname, options.showButtons);
    if (buttons?.length) {
      presenceData.buttons = buttons;
    }
  }

  if (options.showTimestamp && options.allowPageTimestamp !== false && !presenceData.startTimestamp && !presenceData.endTimestamp) {
    presenceData.startTimestamp = getRouteStartedAt();
  }

  if (!presenceData.largeImageKey) {
    presenceData.largeImageKey = FALLBACK_LOGO;
  }

  return presenceData;
}

function createPagePresence(details: string, state: string, image?: string) {
  const presenceData = buildBasePresence(image);
  presenceData.details = details;
  presenceData.state = state;
  return presenceData;
}

function createWatchingPresence(options: {
  title: string;
  playingText: string;
  pausedText: string;
  waitingText: string;
  endedText?: string;
  season?: string;
  episode?: string;
  image?: string;
}) {
  const presenceData = buildBasePresence(options.image);
  const video = document.querySelector('video') as HTMLVideoElement | null;
  const season = normalizeText(options.season);
  const episode = normalizeText(options.episode);
  const prefix = season && episode ? `S${season}E${episode} - ` : '';

  presenceData.type = ActivityType.Watching;
  presenceData.details = options.title;
  presenceData.state = `${prefix}${options.waitingText}`;

  if (season && episode) {
    presenceData.largeImageText = `Season ${season}, Episode ${episode}`;
  } else {
    presenceData.largeImageText = 'Lecture en cours';
  }

  if (video && Number.isFinite(video.duration) && video.duration > 0) {
    if (video.ended) {
      presenceData.state = `${prefix}${options.endedText || 'Le generique approche, personne ne bouge'}`;
    } else if (video.paused) {
      presenceData.state = `${prefix}${options.pausedText}`;
    } else {
      presenceData.state = `${prefix}${options.playingText}`;
      presenceData.startTimestamp = Date.now() - Math.floor(video.currentTime * 1000);
      presenceData.endTimestamp = Date.now() + Math.max(0, Math.floor((video.duration - video.currentTime) * 1000));
    }
  }

  return presenceData;
}

function getWatchTitle(fallback: string): string {
  const titleFromAttributes = findTitleAttribute((title) => {
    if (title.length < 4) return false;
    if (/ouvrir dans une nouvelle page/i.test(title)) return false;
    if (/trailer background/i.test(title)) return false;
    if (/^[-+]\d+s$/i.test(title)) return false;
    if (/^zoom [+-]$/i.test(title)) return false;
    return true;
  });

  const title = firstNonEmpty(
    getMetaContent('meta[property="og:title"]'),
    titleFromAttributes,
    getText('h3.text-lg'),
    getText('h3'),
    getText('h1'),
    document.title,
    fallback
  );

  return stripSiteName(title) || fallback;
}

function getProviderName(providerId: string): string {
  return PROVIDER_NAMES[providerId] || `Provider ${providerId}`;
}

function buildRoutePresence(showTimestamp: boolean, showButtons: boolean) {
  const { pathname } = document.location;
  const pageTitle = getPageTitle();
  const pageImage = getPageImage();

  let match: RegExpMatchArray | null = null;

  if (pathname === '/') {
    return finalizePresence(
      createPagePresence(
        "Farfouille l'accueil comme un critique sous cafeine",
        'Accueil Movix',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/search') {
    const query = getSearchParam('q');

    return finalizePresence(
      createPagePresence(
        'Traque la perle rare avec un calme tres relatif',
        query ? `Recherche : ${query}` : 'Recherche globale',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/movies') {
    return finalizePresence(
      createPagePresence(
        'Passe le catalogue films au rayon X',
        'Catalogue films',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/tv-shows') {
    return finalizePresence(
      createPagePresence(
        'Collectionne les series sans finir les precedentes',
        'Catalogue series',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/collections') {
    return finalizePresence(
      createPagePresence(
        'Fouille les collections comme un conservateur insomniaque',
        pageTitle || 'Collections Movix',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/collection\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Inspecte une collection avec un serieux disproportionne',
        pageTitle || `Collection ${shortenId(match[1])}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/movie\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Epluche une fiche film avant le grand clic',
        pageTitle || `Film ${shortenId(match[1])}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/tv\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Analyse une serie comme un comite de binge-watching',
        pageTitle || `Serie ${shortenId(match[1])}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/download\/(movie|tv)\/([^/]+)$/i))) {
    const typeLabel = match[1] === 'movie' ? 'Film' : 'Serie';
    const title = firstNonEmpty(getText('h2'), pageTitle, `${typeLabel} a telecharger`);

    return finalizePresence(
      createPagePresence(
        'Prepare un plan B avec une assurance tres theatrale',
        String(title),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/debrid') {
    const provider = getSearchParam('provider');
    const state = provider ? `Debrid via ${provider}` : 'Atelier anti-liens capricieux';

    return finalizePresence(
      createPagePresence(
        'Dompte des liens recalcitrants a mains nues',
        state,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/genre\/([^/]+)\/([^/]+)$/i))) {
    const mediaLabel = match[1] === 'movie' ? 'Films' : 'Series';

    return finalizePresence(
      createPagePresence(
        'Trie le chaos par genre parce qu il le peut',
        pageTitle || `${mediaLabel} par genre`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/roulette') {
    return finalizePresence(
      createPagePresence(
        'Laisse le destin choisir quelle idee brillante',
        pageTitle || 'Roulette Movix',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/provider\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/i))) {
    const providerName = getProviderName(match[1]);
    const mediaLabel = match[2] === 'movies' ? 'Films' : 'Series';

    return finalizePresence(
      createPagePresence(
        "Retourne un catalogue provider dans tous les sens",
        pageTitle || `${providerName} - ${mediaLabel}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/provider\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Espionne un provider avec une curiosite tres assumee',
        getProviderName(match[1]),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/auth' || pathname === '/auth/google') {
    return finalizePresence(
      createPagePresence(
        "Negocie avec l authentification sans perdre la face",
        'Connexion en cours',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/create-account' || pathname === '/link-bip39/create') {
    return finalizePresence(
      createPagePresence(
        'Forge un compte comme un druide numerique',
        'Creation de compte',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/login-bip39' || pathname === '/link-bip39') {
    return finalizePresence(
      createPagePresence(
        'Recite sa phrase magique sans cligner des yeux',
        'Connexion BIP39',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/person\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Epluche une filmo comme un detective du generique',
        pageTitle || `Personne ${shortenId(match[1])}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/profile') {
    return finalizePresence(
      createPagePresence(
        'Range son profil puis derange tout a nouveau',
        'Profil utilisateur',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/alerts') {
    return finalizePresence(
      createPagePresence(
        'Surveille ses alertes comme une tour de controle du binge',
        pageTitle || 'Mes alertes',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/live-tv') {
    const liveTitle = firstNonEmpty(getText('h1'), getText('h2'), pageTitle, 'Live TV');

    return finalizePresence(
      createPagePresence(
        'Zappe plus vite que la telecommande ne l accepte',
        String(liveTitle),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/watch\/movie\/([^/]+)$/i))) {
    const title = getWatchTitle('Film mystere');

    return finalizePresence(
      createWatchingPresence({
        title,
        playingText: 'lecture en cours, canape en surchauffe',
        pausedText: 'pause strategique, le drame attend',
        waitingText: 'cherche la bonne source sans paniquer',
        image: pageImage,
      }),
      { showTimestamp, showButtons, pathname, allowPageTimestamp: false }
    );
  }

  if ((match = pathname.match(/^\/watch\/tv\/([^/]+)\/s\/([^/]+)\/e\/([^/]+)$/i))) {
    const rawTitle = getWatchTitle('Serie mystere');
    const title = rawTitle.replace(/\s*-\s*S\d+E\d+$/i, '').trim() || 'Serie mystere';

    return finalizePresence(
      createWatchingPresence({
        title,
        season: match[2],
        episode: match[3],
        playingText: 'binge hors de controle',
        pausedText: 'pause tres dramatique',
        waitingText: 'selectionne une source avec panique elegante',
        image: pageImage,
      }),
      { showTimestamp, showButtons, pathname, allowPageTimestamp: false }
    );
  }

  if ((match = pathname.match(/^\/watch\/anime\/([^/]+)\/season\/([^/]+)\/episode\/([^/]+)$/i))) {
    const rawTitle = getWatchTitle('Anime mystere');
    const title = rawTitle.replace(/\s*-\s*S\d+E\d+$/i, '').trim() || 'Anime mystere';

    return finalizePresence(
      createWatchingPresence({
        title,
        season: match[2],
        episode: match[3],
        playingText: 'anime en cours, theorie du fanclub activee',
        pausedText: 'pause technique, hype toujours intacte',
        waitingText: 'cherche son episode comme un heros secondaire',
        image: pageImage,
      }),
      { showTimestamp, showButtons, pathname, allowPageTimestamp: false }
    );
  }

  if (pathname === '/watchparty/create') {
    const title = firstNonEmpty(getText('h2'), getText('h1'), 'Creation de WatchParty');

    return finalizePresence(
      createPagePresence(
        'Prepare une WatchParty comme un maitre de ceremonie chaotique',
        String(title),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/watchparty\/room\/([^/]+)$/i))) {
    const roomTitle = firstNonEmpty(
      getAttribute('h1[title]', 'title'),
      getText('h1'),
      getText('h2'),
      `Salon ${shortenId(match[1])}`
    );

    return finalizePresence(
      createPagePresence(
        'Coordonne une WatchParty pendant que le chat derape',
        String(roomTitle),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/watchparty\/join(?:\/([^/]+))?$/i))) {
    const state = match[1]
      ? `Code ${safeDecode(match[1]).toUpperCase()}`
      : String(firstNonEmpty(getText('h2'), getText('h1'), 'Rejoindre une WatchParty'));

    return finalizePresence(
      createPagePresence(
        "Essaie d entrer dans une WatchParty sans rater le code",
        state,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/watchparty/list') {
    return finalizePresence(
      createPagePresence(
        'Fouille les salons WatchParty comme un videur curieux',
        String(firstNonEmpty(getText('h1'), 'Liste des salons WatchParty')),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/suggestion') {
    return finalizePresence(
      createPagePresence(
        'Demande au site de choisir a sa place aveu touchant',
        pageTitle || 'Suggestions personnalisees',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/extension') {
    return finalizePresence(
      createPagePresence(
        'Equipe son navigateur pour boxer les hosters relous',
        pageTitle || 'Extension Movix',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/list\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Explore une liste partagee avec un jugement silencieux',
        pageTitle || `Liste ${shortenId(match[1])}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/list-catalog') {
    return finalizePresence(
      createPagePresence(
        'Parcourt les listes publiques comme un brocanteur du streaming',
        pageTitle || 'Catalogue des listes publiques',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/dmca') {
    return finalizePresence(
      createPagePresence(
        'Lit la DMCA oui ca arrive vraiment',
        'Section juridique',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/admin') {
    return finalizePresence(
      createPagePresence(
        'Traine dans l admin avec beaucoup trop de boutons',
        'Console admin',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/profile-selection') {
    return finalizePresence(
      createPagePresence(
        'Choisit un profil comme si Netflix observait',
        'Selection de profil',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/profile-management') {
    return finalizePresence(
      createPagePresence(
        'Bidouille les profils avec une autorite discutable',
        'Gestion des profils',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/wishboard') {
    return finalizePresence(
      createPagePresence(
        'Vote sur le Wishboard comme un ministre du catalogue',
        pageTitle || 'Wishboard',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/wishboard/new') {
    return finalizePresence(
      createPagePresence(
        "Depose une requete avec l espoir d etre exauce",
        String(firstNonEmpty(getText('h1'), 'Nouvelle demande Wishboard')),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/wishboard/my-requests') {
    return finalizePresence(
      createPagePresence(
        'Surveille ses requetes comme des actions en bourse',
        String(firstNonEmpty(getText('h1'), 'Mes demandes Wishboard')),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/wishboard/submit-link') {
    return finalizePresence(
      createPagePresence(
        'Soumet un lien pour sauver le catalogue a mains nues',
        String(firstNonEmpty(getText('h2'), getText('h1'), 'Soumission de lien')),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/vip') {
    return finalizePresence(
      createPagePresence(
        'Examine le VIP avec un regard de mecene strategique',
        'Espace VIP',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/vip/don') {
    return finalizePresence(
      createPagePresence(
        'Sort la carte bleue avec un panache douteux',
        'Don VIP',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/vip\/invoice\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Contemple une facture VIP romance moderne',
        `Facture ${shortenId(match[1])}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/vip\/cadeau\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Deballe un cadeau VIP sans papier brillant',
        `Cadeau ${shortenId(match[1])}`,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/about') {
    return finalizePresence(
      createPagePresence(
        'Raconte l histoire de Movix comme une legende locale',
        pageTitle || 'A propos de Movix',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/privacy') {
    return finalizePresence(
      createPagePresence(
        'Lit la politique de confidentialite avec un courage rare',
        'Politique de confidentialite',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/terms-of-service' || pathname === '/terms') {
    return finalizePresence(
      createPagePresence(
        'Traverse les CGU arme d un cafe tres serre',
        "Conditions d utilisation",
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/cinegraph') {
    const graphFocus = firstNonEmpty(getText('h2.cinegraph-detail-title'), pageTitle, 'CineGraph');

    return finalizePresence(
      createPagePresence(
        'Cartographie ses obsessions cine comme un savant fou',
        String(graphFocus),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/settings') {
    return finalizePresence(
      createPagePresence(
        'Tripatouille les reglages jusqu a friser la perfection',
        'Reglages Movix',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/top10') {
    return finalizePresence(
      createPagePresence(
        'Scrute le top 10 comme un analyste de canape',
        pageTitle || 'Top 10 Movix',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '/ftv') {
    return finalizePresence(
      createPagePresence(
        'Fouille France.tv sans telecommande et sans honte',
        String(firstNonEmpty(getText('h2'), pageTitle, 'France.tv')),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/ftv\/info\/([^/]+)$/i))) {
    return finalizePresence(
      createPagePresence(
        'Inspecte une fiche France.tv avant le clic fatal',
        String(firstNonEmpty(getText('h1'), pageTitle, `Programme ${shortenId(match[1])}`)),
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if ((match = pathname.match(/^\/ftv\/watch\/([^/]+)$/i))) {
    const title = getWatchTitle('Programme France.tv');

    return finalizePresence(
      createWatchingPresence({
        title,
        playingText: 'programme en cours, telecommande officiellement au chomage',
        pausedText: 'pause strategique du direct',
        waitingText: 'cherche le bon flux avec dignite',
        image: pageImage,
      }),
      { showTimestamp, showButtons, pathname, allowPageTimestamp: false }
    );
  }

  if ((match = pathname.match(/^\/wrapped(?:\/([^/]+))?$/i))) {
    const wrappedYear = normalizeText(match[1]);
    const state = wrappedYear ? `Wrapped ${wrappedYear}` : String(firstNonEmpty(getText('h1'), 'Wrapped Movix'));

    return finalizePresence(
      createPagePresence(
        'Relit son annee cine comme un bilan existentiel',
        state,
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  if (pathname === '*' || pathname === '/404') {
    return finalizePresence(
      createPagePresence(
        'S est perdu dans Movix ce qui etait statistiquement evitable',
        '404 - page introuvable',
        pageImage
      ),
      { showTimestamp, showButtons, pathname }
    );
  }

  return finalizePresence(
    createPagePresence(
      'Explore Movix sans carte ni boussole',
      pageTitle || 'Exploration en cours',
      pageImage
    ),
    { showTimestamp, showButtons, pathname }
  );
}

async function getBooleanSetting(settingId: string, fallback: boolean): Promise<boolean> {
  try {
    const value = await presence.getSetting<boolean>(settingId);
    return typeof value === 'boolean' ? value : fallback;
  } catch {
    return fallback;
  }
}

presence.on('UpdateData', async () => {
  const [showTimestamp, showButtons] = await Promise.all([
    getBooleanSetting('showTimestamp', true),
    getBooleanSetting('showButtons', false),
  ]);

  const presenceData = buildRoutePresence(showTimestamp, showButtons);

  if (presenceData) {
    presence.setActivity(presenceData);
  } else {
    presence.clearActivity();
  }
});
