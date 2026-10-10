// Tema claro / oscuro
const botonTema = document.querySelector('.tema');
if (botonTema) {
  botonTema.addEventListener('click', () => {
    const raiz = document.documentElement;
    const nuevo = raiz.dataset.theme === 'light' ? 'dark' : 'light';
    raiz.dataset.theme = nuevo;
    try {
      localStorage.setItem('tema', nuevo);
    } catch (e) {}
  });
}

// Filtro de la galería de trabajos (también responde a /trabajos/#video)
const filtros = document.querySelectorAll('[data-filtro]');
if (filtros.length) {
  const tarjetas = document.querySelectorAll('#galeria .card');
  const aplicar = (cat) => {
    filtros.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === cat)));
    tarjetas.forEach((t) => (t.hidden = cat !== 'todos' && t.dataset.cat !== cat));
  };
  const desdeHash = () => {
    const cat = location.hash.slice(1);
    aplicar([...filtros].some((b) => b.dataset.filtro === cat) ? cat : 'todos');
  };
  filtros.forEach((b) =>
    b.addEventListener('click', () => {
      const cat = b.dataset.filtro;
      history.replaceState(null, '', cat === 'todos' ? location.pathname : `#${cat}`);
      aplicar(cat);
    })
  );
  window.addEventListener('hashchange', desdeHash);
  desdeHash();
}

// Reels: se reproducen en loop y sin sonido solo mientras están en pantalla
const videos = document.querySelectorAll('video[data-autoplay]');
const ahorro = navigator.connection && navigator.connection.saveData;
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (videos.length) {
  if (ahorro || sinMovimiento || !('IntersectionObserver' in window)) {
    videos.forEach((v) => {
      if (v.closest('.card')) v.remove();
      else v.controls = true;
    });
  } else {
    const obs = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (e.isIntersecting) e.target.play().catch(() => {});
          else e.target.pause();
        }),
      { rootMargin: '100px', threshold: 0.2 }
    );
    videos.forEach((v) => {
      v.addEventListener('playing', () => v.classList.add('activo'), { once: true });
      obs.observe(v);
    });
  }
}

// Carrusel de destacados: las flechas avanzan de a una tarjeta
const carrusel = document.getElementById('destacados');
const flechas = document.querySelectorAll('[data-carrusel]');
if (carrusel && flechas.length) {
  const paso = () => {
    const tarjeta = carrusel.querySelector('.card');
    return tarjeta.offsetWidth + parseFloat(getComputedStyle(carrusel).columnGap || 0);
  };
  const actualizar = () => {
    const fin = carrusel.scrollWidth - carrusel.clientWidth - 2;
    flechas.forEach((f) => (f.disabled = f.dataset.carrusel < 0 ? carrusel.scrollLeft <= 2 : carrusel.scrollLeft >= fin));
  };
  flechas.forEach((f) =>
    f.addEventListener('click', () => carrusel.scrollBy({ left: paso() * f.dataset.carrusel, behavior: 'smooth' }))
  );
  carrusel.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', actualizar);
  actualizar();
}

// YouTube: el reproductor se carga recién al hacer clic (página más rápida y sin cookies)
document.querySelectorAll('.yt[data-yt]').forEach((caja) => {
  caja.querySelector('button').addEventListener('click', () => {
    const params = 'autoplay=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&color=white';
    const iframe = document.createElement('iframe');
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(caja.dataset.yt)}?${params}`;
    iframe.title = 'Reproductor de video';
    iframe.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    iframe.allowFullscreen = true;
    caja.replaceChildren(iframe);
  });
});
