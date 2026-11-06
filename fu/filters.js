/* PDF kaynaklı reçete kataloğu — eski hazır efektler kaldırıldı. */
(() => {
  'use strict';
  const recipes = window.ForgeRecipe;
  const swatches = ['linear-gradient(145deg,#d9dcdc,#6f7679 45%,#20262a)','linear-gradient(145deg,#e5c17f,#9c694d 50%,#34483c)','linear-gradient(145deg,#ffd08a,#e77b58 52%,#4e4460)','linear-gradient(145deg,#f5f3ed,#777a7a 50%,#202327)','linear-gradient(145deg,#f3d8c3,#b88670 50%,#384c56)','linear-gradient(145deg,#eaf2f5,#9bb8cb 48%,#3c5268)','linear-gradient(145deg,#a8c495,#52775a 50%,#203c35)','linear-gradient(145deg,#eef0ec,#aab6b1 50%,#586b72)'];
  window.PhotoFilterLibrary = Object.freeze({
    categories: [{ id: 'all', label: 'Tüm reçeteler' }],
    filters: recipes.names.map((title, i) => ({ id: `recipe-${i + 1}`, title, category: 'all', description: recipes.purposes[i], swatch: swatches[i], values: { ...recipes.PRESETS[`recipe${i + 1}`] } })),
  });
})();
