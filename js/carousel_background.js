/**
 * MCGI Attendance Monitoring System - 3-Row Background Carousel
 * Row 1: MPRO (Right to Left infinite loop)
 * Row 2: GCOS (Left to Right infinite loop)
 * Row 3: TK (Right to Left infinite loop)
 * 70% opacity, filling background height divided into 3 equal rows.
 */

(function () {
  'use strict';

  function initCarouselBackground() {
    const container = document.getElementById('carouselBackground');
    if (!container) return;

    // Verify dataset exists
    const data = window.CAROUSEL_IMAGES;
    if (!data) {
      console.warn('Carousel images data not loaded');
      return;
    }

    const rowsConfig = [
      { id: 'carouselRowMpro', folder: 'MPRO', dir: 'rtl', label: 'MCGI Productions' },
      { id: 'carouselRowGcos', folder: 'GCOS', dir: 'ltr', label: 'MCGI Guest Coordinators' },
      { id: 'carouselRowTk',   folder: 'TK',   dir: 'rtl', label: 'MCGI Teatro Kristiano' }
    ];

    container.innerHTML = '';

    rowsConfig.forEach(config => {
      const images = data[config.folder] || [];
      if (!images.length) return;

      // Loop images so each group has plenty of photos (at least 50) to completely eliminate gaps on any screen width
      let imageList = [...images];
      while (imageList.length < 50) {
        imageList = imageList.concat(images);
      }

      const rowEl = document.createElement('div');
      rowEl.className = `carousel-bg-row carousel-row-${config.folder.toLowerCase()}`;
      rowEl.setAttribute('data-folder', config.folder);
      rowEl.setAttribute('data-direction', config.dir);

      const track = document.createElement('div');
      track.className = `carousel-track carousel-track-${config.dir}`;

      // Build group 1 & group 2 for seamless infinite looping
      const createGroup = (ariaHidden) => {
        const group = document.createElement('div');
        group.className = 'carousel-group';
        if (ariaHidden) group.setAttribute('aria-hidden', 'true');

        imageList.forEach(imgName => {
          const img = document.createElement('img');
          img.className = 'carousel-bg-image';
          img.src = encodeURI(`Carousel Images/${config.folder}/${imgName}`);
          img.alt = ''; // Empty alt prevents ugly broken placeholder text
          img.draggable = false;
          // Auto-remove any corrupt or unreadable image so no broken black box appears
          img.onerror = function () {
            this.remove();
          };
          group.appendChild(img);
        });

        return group;
      };

      const group1 = createGroup(false);
      const group2 = createGroup(true);

      track.appendChild(group1);
      track.appendChild(group2);
      rowEl.appendChild(track);
      container.appendChild(rowEl);
    });

    // Add subtle ambient overlay for visual depth and card contrast
    const overlay = document.createElement('div');
    overlay.className = 'carousel-bg-overlay';
    container.appendChild(overlay);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initCarouselBackground);
  } else {
    initCarouselBackground();
  }
})();
