// Runs before the first paint, so the saved look is applied without a flash. It is a separate
// file (not inline in index.html) so the Content-Security-Policy can forbid inline scripts.
// The picture check matches isSafeImage() in appearance.service.ts.
(function () {
  try {
    var root = document.documentElement;
    var read = function (key) {
      return JSON.parse(localStorage.getItem(key) || '{}') || {};
    };

    var settings = read('minesweeper.settings');
    if (settings.theme === 'light' || settings.theme === 'dark') {
      root.dataset.theme = settings.theme;
    }
    if ([1, 1.25, 1.5].indexOf(settings.cellScale) !== -1) {
      root.style.setProperty('--cell-scale', settings.cellScale);
    }

    var appearance = read('minesweeper.appearance');
    var themes = ['classic', 'ocean', 'forest', 'sunset', 'lavender', 'slate'];
    if (themes.indexOf(appearance.boardTheme) !== -1) {
      root.dataset.boardTheme = appearance.boardTheme;
    }

    var pageImage = localStorage.getItem('minesweeper.pageImage');
    if (/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(pageImage || '')) {
      root.style.setProperty('--page-image', 'url("' + pageImage + '")');
      root.dataset.pageImage = 'on';
    }
  } catch (error) {
    // Storage blocked or broken: the app starts with its default look.
  }
})();
