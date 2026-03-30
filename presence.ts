// @ts-nocheck

/**
 * On déclare la classe Presence globalement pour éviter l'erreur de résolution de module
 * PreMid injectera la classe réelle lors de l'exécution dans le navigateur.
 */
declare const Presence: any;

const presence = new Presence({
  clientId: '1407771794470862922',
});

presence.on('update', async (presenceData: any) => {
  // Sélection des éléments dans le DOM de Movix (Tailwind classes)
  const video = document.querySelector('video') as HTMLVideoElement;
  const titleH3 = document.querySelector('h3.line-clamp-1');
  const posterImg = document.querySelector('img[alt="Poster"]') as HTMLImageElement;

  // Si on n'est pas sur une page avec une vidéo et un titre, on vide la présence
  if (!video || !titleH3) {
    return presenceData.clear();
  }

  // Récupération des infos
  const movieTitle = titleH3.textContent?.trim() || 'Film inconnu';
  const posterUrl = posterImg?.src || 'https://movix.rodeo/logo.png';
  const isPaused = video.paused;

  // Configuration des textes sur Discord
  presenceData.details = movieTitle;
  presenceData.state = isPaused ? 'En pause ⏸️' : 'En lecture 🎬';

  // Gestion du temps (Timestamp Discord dynamique)
  if (!isPaused && !video.ended && video.duration > 0) {
    // Calcule le début et la fin pour afficher "05:00 restant" sur Discord
    presenceData.startTimestamp = Math.floor(Date.now() / 1000 - video.currentTime);
    presenceData.endTimestamp = Math.floor(Date.now() / 1000 + (video.duration - video.currentTime));
  } else {
    // Si en pause, on fige le temps
    delete presenceData.startTimestamp;
    delete presenceData.endTimestamp;
  }

  // Configuration des images
  presenceData.largeImageKey = posterUrl;
  presenceData.largeImageText = movieTitle;

  // On utilise des icônes d'état simples
  presenceData.smallImageKey = isPaused ? 'pause-symbol' : 'play-symbol';
  presenceData.smallImageText = isPaused ? 'En pause' : 'En lecture';

  return presenceData;
});