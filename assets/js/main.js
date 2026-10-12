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

// Carruseles del inicio (uno por sección): las flechas avanzan de a una tarjeta y los puntos marcan la posición
document.querySelectorAll('[data-carrusel-caja]').forEach((caja) => {
  const carrusel = caja.querySelector('.carrusel');
  const flechas = caja.querySelectorAll('[data-carrusel]');
  const puntos = caja.querySelector('.puntos');
  const paso = () => {
    const tarjeta = carrusel.querySelector('.card');
    return tarjeta.offsetWidth + parseFloat(getComputedStyle(carrusel).columnGap || 0);
  };
  const fin = () => carrusel.scrollWidth - carrusel.clientWidth;
  // Un punto por cada posición a la que se puede deslizar (no por tarjeta: varias caben a la vez)
  const crearPuntos = () => {
    const total = fin() > 2 ? Math.ceil((fin() - 2) / paso()) + 1 : 0;
    puntos.replaceChildren(
      ...Array.from({ length: total }, (_, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.tabIndex = -1;
        b.addEventListener('click', () => carrusel.scrollTo({ left: i * paso(), behavior: 'smooth' }));
        return b;
      })
    );
    // Si todo cabe en pantalla no hay nada que deslizar: se ocultan las flechas
    flechas.forEach((f) => (f.hidden = total === 0));
  };
  const actualizar = () => {
    const x = carrusel.scrollLeft;
    flechas.forEach((f) => (f.disabled = f.dataset.carrusel < 0 ? x <= 2 : x >= fin() - 2));
    const activo = x >= fin() - 2 ? puntos.children.length - 1 : Math.round(x / paso());
    [...puntos.children].forEach((b, i) => b.classList.toggle('activo', i === activo));
  };
  flechas.forEach((f) =>
    f.addEventListener('click', () => carrusel.scrollBy({ left: paso() * f.dataset.carrusel, behavior: 'smooth' }))
  );
  carrusel.addEventListener('scroll', actualizar, { passive: true });
  window.addEventListener('resize', () => {
    crearPuntos();
    actualizar();
  });
  crearPuntos();
  actualizar();
});

// Secciones del inicio: la banda (número, título, flecha y barra) aparece al entrar en pantalla
const categorias = document.querySelectorAll('.categoria');
if (categorias.length && 'IntersectionObserver' in window) {
  const alEntrar = new IntersectionObserver(
    (entradas) =>
      entradas.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add('visible');
        alEntrar.unobserve(e.target);
      }),
    { rootMargin: '0px 0px -18% 0px' }
  );
  categorias.forEach((c) => alEntrar.observe(c));
} else {
  categorias.forEach((c) => c.classList.add('visible'));
}

// Escenario de marcas: una a la vez. Aparece el nombre al centro, se separa y entran sus diseños;
// tras unos segundos sale y sigue la marca siguiente. Solo corre mientras está en pantalla.
document.querySelectorAll('.collage-escena').forEach((escena) => {
  const marcas = [...escena.querySelectorAll('.collage')];
  const puntos = escena.nextElementSibling;
  if (!marcas.length) return;

  const NOMBRE = 700; // el nombre solo, al centro
  const ABIERTA = 2400; // nombre arriba + diseños a la vista
  const SALIDA = 400; // desvanecido antes de la siguiente
  const quieto = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let actual = 0;
  let relojes = [];
  let enPantalla = false;

  const botones = marcas.map((_, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-label', `Ver marca ${i + 1} de ${marcas.length}`);
    b.addEventListener('click', () => mostrar(i));
    return b;
  });
  if (marcas.length > 1) puntos.append(...botones);

  const limpiar = () => {
    relojes.forEach(clearTimeout);
    relojes = [];
  };
  const despues = (ms, fn) => relojes.push(setTimeout(fn, ms));

  function mostrar(i) {
    limpiar();
    actual = i;
    marcas.forEach((m, k) => m.classList.toggle('activa', k === i));
    marcas.forEach((m) => m.classList.remove('abierta'));
    botones.forEach((b, k) => b.classList.toggle('activo', k === i));
    if (quieto) return marcas[i].classList.add('abierta');
    despues(NOMBRE, () => marcas[i].classList.add('abierta'));
    if (marcas.length < 2) return;
    despues(NOMBRE + ABIERTA, () => marcas[i].classList.remove('activa', 'abierta'));
    despues(NOMBRE + ABIERTA + SALIDA, () => mostrar((i + 1) % marcas.length));
  }

  if (!('IntersectionObserver' in window)) return mostrar(0);
  new IntersectionObserver(
    ([e]) => {
      if (e.isIntersecting === enPantalla) return;
      enPantalla = e.isIntersecting;
      if (enPantalla) mostrar(actual);
      else limpiar();
    },
    { threshold: 0.3 }
  ).observe(escena);
});

// Visor: al hacer clic en una imagen del proyecto se amplía; flechas o teclado para pasar, Esc para cerrar
const fuente = (img) => new URL(img.dataset.full || img.currentSrc || img.src, location.href).href;
const conZoom = [...document.querySelectorAll('img[data-zoom]')];
const ampliables = conZoom.filter((img, i) => conZoom.findIndex((otra) => fuente(otra) === fuente(img)) === i);
if (ampliables.length) {
  const visor = document.createElement('div');
  visor.className = 'visor';
  visor.hidden = true;
  visor.innerHTML =
    '<button class="flecha visor__cerrar" type="button" aria-label="Cerrar">✕</button><img alt="">' +
    '<div class="visor__barra"><button class="flecha" type="button" data-paso="-1" aria-label="Imagen anterior">←</button>' +
    '<span></span><button class="flecha" type="button" data-paso="1" aria-label="Imagen siguiente">→</button></div>';
  document.body.append(visor);
  const grande = visor.querySelector('img');
  const contador = visor.querySelector('span');
  let actual = 0;
  const mostrar = (i) => {
    actual = (i + ampliables.length) % ampliables.length;
    grande.src = fuente(ampliables[actual]);
    grande.alt = ampliables[actual].alt;
    contador.textContent = `${actual + 1} / ${ampliables.length}`;
  };
  const cerrar = () => {
    visor.hidden = true;
    document.documentElement.style.overflow = '';
  };
  const abrir = (i) => {
    mostrar(i);
    visor.hidden = false;
    document.documentElement.style.overflow = 'hidden';
  };
  conZoom.forEach((img) =>
    img.addEventListener('click', () => abrir(ampliables.findIndex((unica) => fuente(unica) === fuente(img))))
  );
  document.querySelectorAll('[data-visor]').forEach((b) => b.addEventListener('click', () => abrir(0)));
  visor.addEventListener('click', (e) => {
    const paso = e.target.closest('[data-paso]');
    if (paso) mostrar(actual + Number(paso.dataset.paso));
    else if (e.target !== grande) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (visor.hidden) return;
    if (e.key === 'Escape') cerrar();
    if (e.key === 'ArrowRight') mostrar(actual + 1);
    if (e.key === 'ArrowLeft') mostrar(actual - 1);
  });
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
