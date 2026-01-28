// Spotify Now Playing Widget
(function() {
  const SPOTIFY_API = 'https://spotify-api-jw7r.vercel.app/api/recently-played';
  
  const spotifyBtn = document.querySelector('.ctrl.spotify');
  const popup = document.getElementById('spotifyPopup');
  const popupClose = document.getElementById('spotifyPopupClose');
  const contentEl = document.getElementById('spotifyContent');
  
  if (!spotifyBtn || !popup) return;

  let isOpen = false;
  let lastFetchTime = 0;
  const CACHE_DURATION = 30000; // 30 seconds
  let cachedData = null;

  function formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  }

  function renderTrack(data) {
    const statusText = data.isPlaying ? 'Now Playing' : `Played ${formatTimeAgo(data.playedAt)}`;
    const statusClass = data.isPlaying ? 'is-playing' : '';
    
    return `
      <div class="spotify-track">
        <img class="spotify-album-art" src="${data.albumImageUrl}" alt="${data.album} album art" />
        <div class="spotify-info">
          <div class="spotify-status ${statusClass}">
            <span class="spotify-status-dot"></span>
            ${statusText}
          </div>
          <p class="spotify-title">
            <a href="${data.songUrl}" target="_blank" rel="noreferrer" title="${data.title}">${data.title}</a>
          </p>
          <p class="spotify-artist">${data.artist}</p>
          <p class="spotify-album">${data.album}</p>
        </div>
      </div>
    `;
  }

  function renderLoading() {
    return '<div class="spotify-loading">Loading...</div>';
  }

  function renderError(msg) {
    return `<div class="spotify-error">${msg}</div>`;
  }

  async function fetchSpotifyData() {
    const now = Date.now();
    
    // Use cached data if fresh enough
    if (cachedData && (now - lastFetchTime) < CACHE_DURATION) {
      contentEl.innerHTML = renderTrack(cachedData);
      return;
    }

    contentEl.innerHTML = renderLoading();

    try {
      const response = await fetch(SPOTIFY_API);
      if (!response.ok) throw new Error('Failed to fetch');
      
      const data = await response.json();
      cachedData = data;
      lastFetchTime = now;
      
      contentEl.innerHTML = renderTrack(data);
    } catch (err) {
      contentEl.innerHTML = renderError('Could not load track data');
    }
  }

  function openPopup() {
    popup.classList.add('is-open');
    isOpen = true;
    fetchSpotifyData();
  }

  function closePopup() {
    popup.classList.remove('is-open');
    isOpen = false;
  }

  function togglePopup() {
    if (isOpen) {
      closePopup();
    } else {
      openPopup();
    }
  }

  // Event listeners
  spotifyBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    togglePopup();
  });

  popupClose.addEventListener('click', (e) => {
    e.stopPropagation();
    closePopup();
  });

  // Close popup when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !popup.contains(e.target) && !spotifyBtn.contains(e.target)) {
      closePopup();
    }
  });

  // Close popup on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOpen) {
      closePopup();
    }
  });
})();
