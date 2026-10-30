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

// Trabajos: cada categoría tiene su vista (láminas). El filtro muestra una a la vez y responde a /trabajos/#video.
const filtros = document.querySelectorAll('[data-filtro]');
if (filtros.length) {
  const vistas = document.querySelectorAll('[data-vista]');
  const cuenta = document.querySelector('[data-cuenta]');
  const conVista = (cat) => [...vistas].some((v) => v.dataset.vista === cat);
  // Sin categoría en la dirección se abre la primera
  const inicial = [...filtros].map((b) => b.dataset.filtro).find(conVista);
  const aplicar = (cat) => {
    filtros.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filtro === cat)));
    vistas.forEach((v) => (v.hidden = v.dataset.vista !== cat));
    // Arriba a la derecha: nombre y cantidad de proyectos de la categoría que se está viendo
    const activo = [...filtros].find((b) => b.dataset.filtro === cat);
    if (cuenta && activo) {
      const n = Number(activo.dataset.total);
      cuenta.textContent = `${activo.dataset.nombre} · ${n} ${n === 1 ? 'proyecto' : 'proyectos'}`;
    }
  };
  const desdeHash = () => {
    const cat = location.hash.slice(1);
    const valido = conVista(cat);
    aplicar(valido ? cat : inicial);
    // Si se llega desde una sección del inicio, la página queda posicionada en los filtros
    if (valido) {
      const ir = () => filtros[0].parentElement.scrollIntoView({ block: 'start', behavior: 'instant' });
      ir();
      // al terminar de cargar (fuentes, imágenes) la página puede haberse movido: se vuelve a posicionar
      if (document.readyState !== 'complete') window.addEventListener('load', ir, { once: true });
      if (document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(ir);
    }
  };
  filtros.forEach((b) =>
    b.addEventListener('click', () => {
      // Categoría con un solo proyecto: el botón abre ese proyecto
      if (b.dataset.ir) {
        location.href = b.dataset.ir;
        return;
      }
      history.replaceState(null, '', `#${b.dataset.filtro}`);
      aplicar(b.dataset.filtro);
    })
  );
  window.addEventListener('hashchange', desdeHash);
  desdeHash();
}

// Pie de página: el nombre grande se ajusta para ir exactamente de un margen al otro del contenido.
// Se mide el dibujo real de las letras (no su caja) y se corrige el tamaño y el pequeño aire lateral de la fuente.
const marca = document.querySelector('.footer__marca');
if (marca) {
  const lienzo = document.createElement('canvas').getContext('2d');
  const ajustar = () => {
    marca.style.fontSize = '';
    marca.style.translate = '';
    const caja = marca.parentElement.querySelector('.footer__fila').getBoundingClientRect();
    const estilo = getComputedStyle(marca);
    const base = parseFloat(estilo.fontSize);
    lienzo.font = `${estilo.fontWeight} ${base}px ${estilo.fontFamily}`;
    const m = lienzo.measureText(marca.textContent);
    const tinta = m.actualBoundingBoxLeft + m.actualBoundingBoxRight;
    if (!tinta || !caja.width) return;
    const escala = caja.width / tinta;
    marca.style.fontSize = `${base * escala}px`;
    // el texto va alineado a la izquierda: se corre lo que la primera letra deja de aire a su lado
    const relleno = parseFloat(getComputedStyle(marca).paddingLeft) || 0;
    marca.style.translate = `${caja.left - marca.getBoundingClientRect().left - relleno + m.actualBoundingBoxLeft * escala}px 0`;
  };
  ajustar();
  if (document.fonts) document.fonts.ready.then(ajustar);
  window.addEventListener('resize', ajustar);
}

// Servicios en móvil: el texto va recortado a dos líneas y "Ver más" lo despliega hacia abajo
document.querySelectorAll('.servicios__mas').forEach((boton) => {
  const li = boton.closest('li');
  const texto = li.querySelector('p');
  // el botón solo aparece si de verdad hay texto escondido (en escritorio se ve completo)
  const revisar = () => {
    if (!li.classList.contains('abierto')) boton.hidden = texto.scrollHeight <= texto.clientHeight + 1;
  };
  boton.addEventListener('click', () => {
    const abierto = li.classList.toggle('abierto');
    boton.setAttribute('aria-expanded', String(abierto));
    boton.textContent = abierto ? 'Ver menos' : 'Ver más';
  });
  window.addEventListener('resize', revisar);
  if (document.fonts) document.fonts.ready.then(revisar);
  revisar();
});

// Portadas de los videos: se descargan recién cuando el video se acerca a la pantalla (en el inicio hay
// decenas de videos y bajarlas todas de una vuelve lento el teléfono). Sin script se ponen todas de inmediato.
{
  const conPortada = document.querySelectorAll('video[data-poster]');
  const poner = (v) => {
    v.poster = v.dataset.poster;
    v.removeAttribute('data-poster');
  };
  if ('IntersectionObserver' in window) {
    const cerca = new IntersectionObserver(
      (entradas, o) =>
        entradas.forEach((e) => {
          if (!e.isIntersecting) return;
          poner(e.target);
          o.unobserve(e.target);
        }),
      { rootMargin: '600px 300px' }
    );
    conPortada.forEach((v) => cerca.observe(v));
  } else conPortada.forEach(poner);
}

// Reels: se reproducen en loop y sin sonido solo mientras están en pantalla
const videos = document.querySelectorAll('video[data-autoplay]');
const ahorro = navigator.connection && navigator.connection.saveData;
const sinMovimiento = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (videos.length) {
  if (ahorro || sinMovimiento || !('IntersectionObserver' in window)) {
    videos.forEach((v) => {
      if (v.closest('.card')) v.remove();
      // en las láminas de Trabajos el video es solo un adelanto dentro de un enlace: queda su póster
      else if (!v.closest('.lamina__celda')) v.controls = true;
    });
  } else {
    const obs = new IntersectionObserver(
      (entradas) =>
        entradas.forEach((e) => {
          if (e.isIntersecting) e.target.play().catch(() => {});
          else e.target.pause();
        }),
      // en teléfonos solo se reproducen los que están bien dentro de la pantalla (menos videos a la vez)
      matchMedia('(max-width: 700px)').matches ? { threshold: 0.5 } : { rootMargin: '100px', threshold: 0.2 }
    );
    videos.forEach((v) => {
      v.addEventListener('playing', () => v.classList.add('activo'), { once: true });
      obs.observe(v);
    });
  }
}

// Carruseles (secciones del inicio, videos de un proyecto): las flechas avanzan de a una pieza y los puntos marcan la posición
document.querySelectorAll('[data-carrusel-caja]').forEach((caja) => {
  const carrusel = caja.querySelector('.carrusel, [data-carrusel-pista]');
  const flechas = caja.querySelectorAll('[data-carrusel]');
  const puntos = caja.querySelector('.puntos');
  const paso = () => {
    const tarjeta = carrusel.firstElementChild;
    return tarjeta.offsetWidth + (parseFloat(getComputedStyle(carrusel).columnGap) || 0);
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

// Las animaciones continuas (cintas, mosaicos, gráficos de "Así trabajo", burbujas) se pausan mientras
// están fuera de la pantalla: así el teléfono solo mueve lo que se está viendo.
if ('IntersectionObserver' in window) {
  const pausar = new IntersectionObserver(
    (entradas) => entradas.forEach((e) => e.target.classList.toggle('en-pausa', !e.isIntersecting)),
    { rootMargin: '150px' }
  );
  document.querySelectorAll('.portada, .hero__visual, .cinta, .muro, .proceso').forEach((el) => pausar.observe(el));
}

// Secciones del inicio: la banda (número, título, flecha y barra) aparece al entrar en pantalla
// (también servicios y "Así trabajo", cuyas tarjetas entran una por una)
const categorias = document.querySelectorAll('.categoria, #servicios, #proceso, .perfil-grilla');
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

  // En teléfonos no hay pausa con el nombre solo: las piezas salen de inmediato
  const movil = matchMedia('(max-width: 700px)').matches;
  const NOMBRE = movil ? 0 : 700; // el nombre solo, al centro
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

  // Las piezas de cada marca se descargan recién cuando le toca (ella y la siguiente), no las de todas juntas.
  // Sin script las imágenes conservan su dirección y cargan normal.
  const piezasDe = (m) => m.querySelectorAll('.collage__lienzo img');
  marcas.forEach((m, k) => {
    if (k < 2) return;
    piezasDe(m).forEach((img) => {
      img.dataset.src = img.getAttribute('src');
      img.removeAttribute('src');
    });
  });
  const cargar = (k) =>
    piezasDe(marcas[k]).forEach((img) => {
      if (!img.dataset.src) return;
      img.src = img.dataset.src;
      delete img.dataset.src;
    });

  const limpiar = () => {
    relojes.forEach(clearTimeout);
    relojes = [];
  };
  const despues = (ms, fn) => relojes.push(setTimeout(fn, ms));

  function mostrar(i) {
    limpiar();
    actual = i;
    cargar(i);
    cargar((i + 1) % marcas.length);
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
    // en teléfonos arranca apenas asoma, para que al llegar ya estén las piezas
    movil ? { rootMargin: '0px 0px 20% 0px', threshold: 0 } : { threshold: 0.3 }
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
  visor.setAttribute('role', 'dialog');
  visor.setAttribute('aria-modal', 'true');
  visor.setAttribute('aria-label', 'Imagen ampliada');
  visor.innerHTML =
    '<button class="flecha visor__cerrar" type="button" aria-label="Cerrar">✕</button><img alt="">' +
    '<div class="visor__barra"><button class="flecha" type="button" data-paso="-1" aria-label="Imagen anterior">←</button>' +
    '<span></span><button class="flecha" type="button" data-paso="1" aria-label="Imagen siguiente">→</button></div>';
  document.body.append(visor);
  const grande = visor.querySelector('img');
  const contador = visor.querySelector('span');
  let actual = 0;
  let origen = null; // lo que tenía el foco antes de abrir, para devolvérselo al cerrar
  const mostrar = (i) => {
    actual = (i + ampliables.length) % ampliables.length;
    grande.src = fuente(ampliables[actual]);
    grande.alt = ampliables[actual].alt;
    contador.textContent = `${actual + 1} / ${ampliables.length}`;
  };
  const cerrar = () => {
    visor.hidden = true;
    document.documentElement.style.overflow = '';
    if (origen) origen.focus({ preventScroll: true });
  };
  const abrir = (i) => {
    origen = document.activeElement;
    mostrar(i);
    visor.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    visor.querySelector('.visor__cerrar').focus();
  };
  conZoom.forEach((img) => {
    const ir = () => abrir(ampliables.findIndex((unica) => fuente(unica) === fuente(img)));
    // Las del mosaico solo decoran: el visor se abre con su botón "Ver página por página"
    if (img.closest('.muro')) return;
    img.addEventListener('click', ir);
    // Con teclado también se abren (Enter o espacio)
    if (img.getAttribute('aria-hidden') === 'true') return;
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', `Ampliar: ${img.alt}`);
    img.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      ir();
    });
  });
  document.querySelectorAll('[data-visor]').forEach((b) => b.addEventListener('click', () => abrir(0)));
  visor.addEventListener('click', (e) => {
    const paso = e.target.closest('[data-paso]');
    if (paso) mostrar(actual + Number(paso.dataset.paso));
    else if (e.target !== grande) cerrar();
  });
  document.addEventListener('keydown', (e) => {
    if (visor.hidden) return;
    if (e.key === 'Escape') cerrar();
    // el foco no sale del visor mientras está abierto
    if (e.key === 'Tab') {
      const botones = [...visor.querySelectorAll('button')];
      const i = botones.indexOf(document.activeElement);
      const sig = e.shiftKey ? (i <= 0 ? botones.length - 1 : i - 1) : (i + 1) % botones.length;
      e.preventDefault();
      botones[sig].focus();
    }
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
