// Pestañas de /paquetes/ (Identidad de marca | Edición de video). La pestaña queda en la dirección (#video)
// para poder compartir el enlace directo. Sin JavaScript se ven las dos secciones, una tras otra.
(() => {
  const tabs = [...document.querySelectorAll('.pestanas__btn')];
  const paneles = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));
  if (!tabs.length) return;
  const elegir = (i, { foco = false, guardar = true } = {}) => {
    tabs.forEach((t, k) => {
      t.setAttribute('aria-selected', String(k === i));
      t.tabIndex = k === i ? 0 : -1;
      paneles[k].hidden = k !== i;
    });
    if (foco) tabs[i].focus();
    if (guardar) history.replaceState(null, '', `#${paneles[i].id}`);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', (e) => {
      e.preventDefault();
      elegir(i);
    });
    // flechas para moverse entre pestañas con el teclado
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      elegir((i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length, { foco: true });
    });
  });
  const inicial = Math.max(0, paneles.findIndex((p) => `#${p.id}` === location.hash));
  elegir(inicial, { guardar: false });
  // si llegó con #video, deja las pestañas a la vista (no el panel tapado por el menú)
  if (location.hash && inicial >= 0) {
    requestAnimationFrame(() => document.querySelector('.pestanas').scrollIntoView({ block: 'start', behavior: 'instant' }));
  }
})();
