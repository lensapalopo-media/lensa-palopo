/* ==========================================================================
   Lensa Palopo & Portal Profil Kota Palopo Combined JavaScript Logic
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  // Initialize Lucide icons if available
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  }

  // Audio Ambiance simulation toggle
  const audioToggleBtn = document.getElementById('audio-toggle-btn');
  if (audioToggleBtn) {
    let isPlaying = false;
    audioToggleBtn.addEventListener('click', () => {
      isPlaying = !isPlaying;
      const icon = audioToggleBtn.querySelector('i');
      const text = audioToggleBtn.querySelector('span');
      if (isPlaying) {
        if (icon) icon.setAttribute('data-lucide', 'volume-2');
        if (text) text.textContent = 'Ambiance: ON';
        audioToggleBtn.classList.add('text-gold');
      } else {
        if (icon) icon.setAttribute('data-lucide', 'volume-x');
        if (text) text.textContent = 'Ambiance: Mute';
        audioToggleBtn.classList.remove('text-gold');
      }
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
      }
    });
  }

  // Scroll to section helper
  window.scrollToSection = function(sectionId) {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };
});
