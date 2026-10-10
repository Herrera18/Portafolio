// Genera el sitio estático en /dist a partir de data/*.json.
// Sin dependencias: `node build.js` (o `node build.js --serve` para verlo en local).

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const CATEGORIAS = {
  video: 'Video',
  rrss: 'RRSS',
  identidad: 'Identidad visual',
};

// ---------- utilidades ----------

const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function readJson(rel) {
  const file = path.join(ROOT, rel);
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`No se pudo leer ${rel}: ${e.message}\nRevisa comas, comillas y llaves.`);
  }
}

function write(rel, content) {
  const file = path.join(OUT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

// Ancho y alto de un WebP leyendo su cabecera (evita saltos de layout al cargar).
function webpSize(rel) {
  try {
    const b = fs.readFileSync(path.join(ROOT, rel));
    const tipo = b.toString('ascii', 12, 16);
    if (tipo === 'VP8 ') return { w: b.readUInt16LE(26) & 0x3fff, h: b.readUInt16LE(28) & 0x3fff };
    if (tipo === 'VP8L') {
      const n = b.readUInt32LE(21);
      return { w: (n & 0x3fff) + 1, h: ((n >>> 14) & 0x3fff) + 1 };
    }
    if (tipo === 'VP8X') return { w: 1 + b.readUIntLE(24, 3), h: 1 + b.readUIntLE(27, 3) };
  } catch (e) {}
  return null;
}

function sizeAttrs(rel, fallback) {
  const s = webpSize(rel) || fallback;
  return s ? ` width="${s.w}" height="${s.h}"` : '';
}

// ---------- validación ----------

function validar(projects) {
  const errores = [];
  const vistos = new Set();
  if (!Array.isArray(projects)) throw new Error('projects.json debe ser una lista [ ... ] de proyectos.');

  projects.forEach((p, i) => {
    const id = p.slug || `proyecto #${i + 1}`;
    const err = (m) => errores.push(`  - ${id}: ${m}`);

    if (!p.slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) {
      err('"slug" debe ir en minúsculas, sin espacios ni tildes (ej: "cafe-origen").');
    } else if (vistos.has(p.slug)) {
      err('el "slug" está repetido.');
    }
    vistos.add(p.slug);

    if (!p.titulo) err('falta "titulo".');
    if (!CATEGORIAS[p.categoria]) err(`"categoria" debe ser una de: ${Object.keys(CATEGORIAS).join(', ')}.`);
    if (!p.portada) err('falta "portada".');

    const archivos = [p.portada, p.portadaVideo, ...(p.galeria || [])].filter(Boolean);
    for (const a of archivos) {
      if (!exists(`media/${p.slug}/${a}`)) err(`no existe el archivo media/${p.slug}/${a}`);
    }
  });

  if (errores.length) throw new Error(`Hay problemas en data/projects.json:\n${errores.join('\n')}`);
}

// ---------- piezas de HTML ----------

function waLink(site) {
  return `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(site.whatsappMensaje || '')}`;
}

function layout(site, { title, description, urlPath, image, body, active, jsonld, type = 'website' }) {
  const fullTitle = urlPath === '/' ? title : `${title} — ${site.nombre}`;
  const canonical = site.url + urlPath;
  const ogImage = site.url + (image || '/media/site/og.jpg');
  const nav = [
    ['/', 'Inicio', 'inicio'],
    ['/trabajos/', 'Trabajos', 'trabajos'],
    ['/sobre-mi/', 'Sobre mí', 'sobre-mi'],
  ]
    .map(([href, label, key]) => `<a href="${href}"${active === key ? ' aria-current="page"' : ''}>${label}</a>`)
    .join('');
  const redes = (site.redes || [])
    .filter((r) => r.url)
    .map((r) => `<a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.nombre)}</a>`)
    .join('');

  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(fullTitle)}</title>
<meta name="description" content="${esc(description)}">
<link rel="canonical" href="${esc(canonical)}">
<meta property="og:type" content="${type}">
<meta property="og:site_name" content="${esc(site.nombre)}">
<meta property="og:locale" content="es_LA">
<meta property="og:title" content="${esc(fullTitle)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${esc(canonical)}">
<meta property="og:image" content="${esc(ogImage)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#18212e">
<link rel="icon" href="/assets/favicon.svg" type="image/svg+xml">
<script>try{var t=localStorage.getItem('tema');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="preconnect" href="https://api.fontshare.com">
<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@500,600,700&f[]=satoshi@400,500,700&display=swap">
<link rel="stylesheet" href="/assets/css/styles.css?v=${VERSION}">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="skip" href="#contenido">Saltar al contenido</a>
<header class="header">
  <a class="logo" href="/">${esc(site.nombre)}</a>
  <nav class="nav" aria-label="Principal">
    ${nav}
  </nav>
  <div class="header__acciones">
    <a class="boton header__cta" href="/contacto/"${active === 'contacto' ? ' aria-current="page"' : ''}>Contacto</a>
    <button class="tema" type="button" aria-label="Cambiar entre tema claro y oscuro"><span aria-hidden="true"></span></button>
  </div>
</header>
<main id="contenido">
${body}
</main>
<footer class="footer">
  <p class="footer__cta">¿Trabajamos juntos?</p>
  <div class="footer__links">
    <a href="${esc(waLink(site))}" target="_blank" rel="noopener">WhatsApp</a>
    <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>
    ${redes}
  </div>
  <p class="footer__legal">© ${new Date().getFullYear()} ${esc(site.nombre)}</p>
</footer>
<script src="/assets/js/main.js?v=${VERSION}" defer></script>
</body>
</html>
`;
}

function card(p, { eager = false, num = 0 } = {}) {
  const base = `/media/${p.slug}/`;
  const video = p.portadaVideo
    ? `<video muted loop playsinline preload="none" data-autoplay aria-hidden="true"><source src="${base}${esc(p.portadaVideo)}" type="video/mp4"></video>`
    : '';
  return `<a class="card" href="/proyectos/${p.slug}/" data-cat="${p.categoria}">
  <div class="card__media">
    ${num ? `<span class="card__num">${String(num).padStart(2, '0')}</span>` : ''}
    <img src="${base}${esc(p.portada)}" alt="${esc(p.titulo)}"${sizeAttrs(`media/${p.slug}/${p.portada}`)} loading="${eager ? 'eager' : 'lazy'}" decoding="async">
    ${video}
  </div>
  <div class="card__info">
    <h3>${esc(p.titulo)}</h3>
    <p>${CATEGORIAS[p.categoria]}${p.anio ? ` · ${esc(p.anio)}` : ''}</p>
    <span class="card__ver" aria-hidden="true">Ver proyecto ↗</span>
  </div>
</a>`;
}

function galeriaItem(p, archivo, i) {
  const base = `/media/${p.slug}/`;
  if (/\.mp4$/i.test(archivo)) {
    // Si existe una imagen con el mismo nombre (reel-01.webp) se usa como póster.
    const poster = archivo.replace(/\.mp4$/i, '.webp');
    const tienePoster = exists(`media/${p.slug}/${poster}`);
    const s = (tienePoster && webpSize(`media/${p.slug}/${poster}`)) || { w: 9, h: 16 };
    return `<figure class="galeria__item galeria__item--reel">
  <video muted loop playsinline preload="none" data-autoplay style="aspect-ratio:${s.w}/${s.h}"${tienePoster ? ` poster="${base}${esc(poster)}"` : ''} aria-label="${esc(p.titulo)}, reel ${i + 1}"><source src="${base}${esc(archivo)}" type="video/mp4"></video>
</figure>`;
  }
  return `<figure class="galeria__item">
  <img src="${base}${esc(archivo)}" alt="${esc(p.titulo)}, imagen ${i + 1}"${sizeAttrs(`media/${p.slug}/${archivo}`)} loading="lazy" decoding="async">
</figure>`;
}

function herramientas(site, titulo) {
  const lista = site.herramientas || [];
  if (!lista.length) return '';
  return `<div class="herramientas">
    ${titulo ? `<p class="herramientas__titulo">${titulo}</p>` : ''}
    <ul>${lista
      .map((h) => {
        // Con "icono" (silueta con fondo transparente) se dibuja el logo en el color de acento; si no, la sigla.
        const icono = h.icono && exists(h.icono) ? `<i style="--icono:url('/${esc(h.icono)}')"></i>` : esc(h.sigla);
        // "nivel" (0 a 100) define cuánto se llena el anillo; sin nivel, el anillo va completo.
        const nivel = Math.max(0, Math.min(100, Number(h.nivel)));
        const conNivel = h.nivel != null && !Number.isNaN(nivel);
        return `<li><b aria-hidden="true" style="--nivel:${conNivel ? nivel : 100}">${icono}</b>${esc(h.nombre)}</li>`;
      })
      .join('')}</ul>
  </div>`;
}

// Íconos disponibles para "habilidades" en site.json (campo "icono").
const ICONOS = {
  pluma:
    '<path fill-rule="evenodd" d="M2 3h3v1.2h4.6V3h4.8v1.2H19V3h3v3.6h-3V5.6h-4.6v1h-4.8v-1H5v1H2zM12 8.4l5.6 6.2L15 22H9l-2.6-7.4zm-.6 2.2v3.2a1.9 1.9 0 1 0 1.2 0v-3.2z"/>',
  motion: '<path d="M5.5 2.5h13c0 5.6-4 6.6-4 9.5s4 3.9 4 9.5h-13c0-5.6 4-6.6 4-9.5s-4-3.9-4-9.5z"/>',
  video:
    '<path fill-rule="evenodd" d="M2 4.5h20v15H2zM4 6.5v2h2v-2zm0 4.5v2h2v-2zm0 4.5v2h2v-2zM18 6.5v2h2v-2zm0 4.5v2h2v-2zm0 4.5v2h2v-2zM10 8.8v6.4l5.2-3.2z"/>',
  redes:
    '<path fill-rule="evenodd" d="M7 2.5h10A4.5 4.5 0 0 1 21.5 7v10a4.5 4.5 0 0 1-4.5 4.5H7A4.5 4.5 0 0 1 2.5 17V7A4.5 4.5 0 0 1 7 2.5zm5 5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2.2a2.3 2.3 0 1 1 0 4.6 2.3 2.3 0 0 1 0-4.6zM17 5.8a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4z"/>',
  marca: '<path d="M12 2l2.900 6.3 6.900.8-5.100 4.700 1.4 6.8L12 17.2l-6.100 3.4 1.4-6.8L2.2 9.100l6.900-.8z"/>',
};

function habilidades(site) {
  const lista = site.habilidades || [];
  if (!lista.length) return '';
  return `<ul class="habilidades">${lista
    .map(
      (h) =>
        `<li><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICONOS[h.icono] || ICONOS.marca}</svg>${esc(h.nombre)}</li>`
    )
    .join('')}</ul>`;
}

// Animaciones de la sección "Así trabajo" (campo "grafico" de cada paso). Son solo HTML + CSS.
const GRAFICOS = {
  celular: `<div class="grafico" aria-hidden="true">
        <div class="g-escena">
          <div class="g-cel"><span></span></div>
          <i class="g-clip g-clip--1"></i><i class="g-clip g-clip--2"></i><i class="g-clip g-clip--3"></i><i class="g-clip g-clip--4"></i>
          <div class="g-carpeta"></div>
          <small class="g-cuenta"><span><em><b>0</b><b>1</b><b>2</b><b>3</b><b>4</b></em></span>/4 clips recibidos</small>
        </div>
      </div>`,
  timeline: `<div class="grafico grafico--timeline" aria-hidden="true">
        <div class="g-fila"><small>Gancho</small><i class="g-gancho f1"></i></div>
        <div class="g-fila"><small>Video</small><i class="g-video f2"></i></div>
        <div class="g-fila"><small>Subs</small><i class="g-subs f3"></i></div>
        <div class="g-fila"><small>Sonido</small><i class="g-sonido f4"></i></div>
        <span class="g-cursor"></span>
      </div>`,
  dias: `<div class="grafico grafico--dias" aria-hidden="true">
        ${[1, 2, 3]
          .map((n) => `<div class="g-dia"><small>Día ${n}</small><b>${n}</b><i class="f${n}"><small>Día ${n}</small><b>${n}</b></i></div>`)
          .join('')}
        <span class="g-listo f4">Listo para publicar</span>
      </div>`,
};

function proceso(site) {
  const pr = site.proceso;
  if (!pr || !(pr.pasos || []).length) return '';
  const wa = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(pr.mensaje || site.whatsappMensaje || '')}`;
  const pasos = pr.pasos
    .map(
      (paso, i) => `<li>
      ${GRAFICOS[paso.grafico] || ''}
      <span class="proceso__num">${String(i + 1).padStart(2, '0')}</span>
      <h3>${esc(paso.titulo)}</h3>
      <p>${esc(paso.texto)}</p>
      ${(paso.detalles || []).length ? `<ul class="proceso__detalles">${paso.detalles.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>` : ''}
    </li>`
    )
    .join('');
  return `
<section class="seccion" id="proceso">
  <div class="seccion__cabecera">
    <div>
      <h2>${esc(pr.titulo)}</h2>
      ${pr.bajada ? `<p class="seccion__bajada">${esc(pr.bajada)}</p>` : ''}
    </div>
    ${pr.etiqueta ? `<div class="seccion__lado"><p class="etiqueta">${esc(pr.etiqueta)}</p></div>` : ''}
  </div>
  <ol class="proceso">${pasos}</ol>
  ${pr.boton ? `<div class="seccion__pie"><a class="boton" href="${esc(wa)}" target="_blank" rel="noopener">${esc(pr.boton)}</a></div>` : ''}
</section>`;
}

// ---------- páginas ----------

function paginaInicio(site, projects) {
  const destacados = projects.filter((p) => p.destacado).slice(0, 4);
  const servicios = (site.servicios || [])
    .map((s) => `<li><h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p></li>`)
    .join('');
  const foto = site.sobreMi && site.sobreMi.foto;
  const body = `
<section class="hero">
  <div class="hero__texto">
    ${site.etiqueta ? `<p class="etiqueta">${esc(site.etiqueta)}</p>` : ''}
    <div class="hero__marco">
      <h1 class="hero__nombre">${esc(site.nombre)}</h1>
      <p class="hero__frase">${esc(site.frase)}</p>
      <i></i><i></i><i></i><i></i>
      <svg class="hero__pluma" viewBox="18 13 28 47" aria-hidden="true">
        <defs><linearGradient id="pluma" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--acento)"/><stop offset="1" stop-color="var(--acento-2)"/></linearGradient></defs>
        <path fill="url(#pluma)" fill-rule="evenodd" d="M32 15l12 20-4.5 15h-15L20 35zm-1 5v11.2a3.6 3.6 0 1 0 2 0V20zM24.5 53h15v5h-15z"/>
      </svg>
    </div>
    <p class="hero__intro">${esc(site.intro)}</p>
    <div class="hero__botones">
      <a class="boton" href="/trabajos/">Ver trabajos</a>
      <a class="boton boton--linea" href="/contacto/">Hablemos</a>
    </div>
    ${herramientas(site, 'Herramientas con las que trabajo')}
  </div>
  <div class="hero__visual">
    ${foto && exists(foto) ? `<img src="/${esc(foto)}" alt="Retrato de ${esc(site.nombre)}"${sizeAttrs(foto)} decoding="async">` : ''}
    ${Object.values(CATEGORIAS).map((c) => `<span class="hero__chip">${c}</span>`).join('')}
  </div>
</section>

<section class="seccion">
  <div class="seccion__cabecera">
    <div><h2>Algunos trabajos recientes</h2></div>
    <div class="seccion__lado">
      <p class="etiqueta">Destacados</p>
      <div class="seccion__nav">
        <a class="seccion__ver" href="/trabajos/">Ver todos los trabajos</a>
        <button class="flecha" type="button" data-carrusel="-1" aria-label="Trabajos anteriores">←</button>
        <button class="flecha" type="button" data-carrusel="1" aria-label="Trabajos siguientes">→</button>
      </div>
    </div>
  </div>
  <div class="carrusel" id="destacados" tabindex="0" aria-label="Trabajos destacados">
    ${destacados.map((p, i) => card(p, { eager: i < 2, num: i + 1 })).join('')}
  </div>
</section>

<section class="seccion">
  <div class="seccion__cabecera">
    <div><h2>Qué hago</h2></div>
    <div class="seccion__lado"><p class="etiqueta">Servicios</p></div>
  </div>
  <ul class="servicios">${servicios}</ul>
</section>
${proceso(site)}`;

  return layout(site, {
    title: `${site.nombre} — ${site.frase.replace(/^Soy\s+/i, '').replace(/^./, (c) => c.toUpperCase())}`,
    description: site.descripcion,
    urlPath: '/',
    active: 'inicio',
    body,
    jsonld: {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: site.nombre,
      jobTitle: 'Diseñador gráfico',
      description: site.descripcion,
      email: `mailto:${site.email}`,
      ...(site.url ? { url: site.url } : {}),
      sameAs: (site.redes || []).filter((r) => r.url).map((r) => r.url),
    },
  });
}

function paginaTrabajos(site, projects) {
  const usadas = Object.keys(CATEGORIAS).filter((c) => projects.some((p) => p.categoria === c));
  const filtros = [
    `<button type="button" data-filtro="todos" aria-pressed="true">Todos <sup>${projects.length}</sup></button>`,
    ...usadas.map(
      (c) =>
        `<button type="button" data-filtro="${c}" aria-pressed="false">${CATEGORIAS[c]} <sup>${
          projects.filter((p) => p.categoria === c).length
        }</sup></button>`
    ),
  ].join('');
  const body = `
<section class="cabecera">
  <p class="etiqueta">Portafolio</p>
  <h1>Trabajos</h1>
  <div class="filtros" role="group" aria-label="Filtrar por categoría">${filtros}</div>
</section>
<section class="seccion seccion--pegada">
  <div class="grid grid--3" id="galeria">
    ${projects.map((p, i) => card(p, { eager: i < 3 })).join('\n')}
  </div>
</section>`;
  return layout(site, {
    title: 'Trabajos',
    description: `Proyectos de video, redes sociales e identidad visual de ${site.nombre}.`,
    urlPath: '/trabajos/',
    active: 'trabajos',
    body,
  });
}

function paginaProyecto(site, projects, p, i) {
  const base = `/media/${p.slug}/`;
  const siguiente = projects[(i + 1) % projects.length];
  const og = exists(`media/${p.slug}/og.jpg`) ? `${base}og.jpg` : null;

  const principal = p.youtube
    ? `<div class="yt" data-yt="${esc(p.youtube)}">
    <button type="button" aria-label="Reproducir video: ${esc(p.titulo)}">
      <img src="${base}${esc(p.portada)}" alt=""${sizeAttrs(`media/${p.slug}/${p.portada}`)} decoding="async">
      <span class="yt__play" aria-hidden="true"></span>
    </button>
  </div>`
    : `<img class="proyecto__portada" src="${base}${esc(p.portada)}" alt="${esc(p.titulo)}"${sizeAttrs(
        `media/${p.slug}/${p.portada}`
      )} decoding="async">`;

  const bloque = (titulo, contenido) => (contenido ? `<div><h2>${titulo}</h2>${contenido}</div>` : '');
  const queHice = Array.isArray(p.queHice)
    ? `<ul>${p.queHice.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`
    : p.queHice
    ? `<p>${esc(p.queHice)}</p>`
    : '';

  const body = `
<article class="proyecto">
  <header class="cabecera">
    <a class="etiqueta" href="/trabajos/#${p.categoria}">${CATEGORIAS[p.categoria]}</a>
    <h1>${esc(p.titulo)}</h1>
    <dl class="proyecto__ficha">
      ${p.cliente ? `<div><dt>Cliente</dt><dd>${esc(p.cliente)}</dd></div>` : ''}
      ${p.anio ? `<div><dt>Año</dt><dd>${esc(p.anio)}</dd></div>` : ''}
    </dl>
  </header>

  <div class="proyecto__principal">${principal}</div>

  <section class="proyecto__texto">
    ${bloque('Contexto', p.contexto ? `<p>${esc(p.contexto)}</p>` : '')}
    ${bloque('Qué hice', queHice)}
    ${bloque('Resultado', p.resultado ? `<p>${esc(p.resultado)}</p>` : '')}
  </section>

  ${
    p.galeria && p.galeria.length
      ? `<section class="galeria" aria-label="Galería">${p.galeria.map((a, n) => galeriaItem(p, a, n)).join('\n')}</section>`
      : ''
  }
</article>

<a class="siguiente" href="/proyectos/${siguiente.slug}/">
  <span>Siguiente proyecto</span>
  <strong>${esc(siguiente.titulo)}</strong>
</a>`;

  return layout(site, {
    title: p.titulo,
    description: p.resumen || p.contexto || site.descripcion,
    urlPath: `/proyectos/${p.slug}/`,
    image: og,
    type: 'article',
    active: 'trabajos',
    body,
  });
}

function paginaSobreMi(site) {
  const s = site.sobreMi || {};
  const body = `
<section class="cabecera"><p class="etiqueta">Perfil</p><h1>Sobre mí</h1></section>
<section class="sobre">
  ${
    s.foto && exists(s.foto)
      ? `<img class="sobre__foto" src="/${esc(s.foto)}" alt="Retrato de ${esc(site.nombre)}"${sizeAttrs(s.foto)} decoding="async">`
      : ''
  }
  <div class="sobre__texto">
    ${(s.bio || []).map((t) => `<p>${esc(t)}</p>`).join('')}
    ${(site.habilidades || []).length ? `<h2>Habilidades técnicas</h2>${habilidades(site)}` : ''}
    <h2>Con quién trabajo</h2>
    <ul class="lista">${(s.clientes || []).map((c) => `<li>${esc(c)}</li>`).join('')}</ul>
    ${(site.herramientas || []).length ? `<h2>Herramientas</h2>${herramientas(site)}` : ''}
    <a class="boton" href="/contacto/">Hablemos</a>
  </div>
</section>`;
  return layout(site, {
    title: 'Sobre mí',
    description: (s.bio && s.bio[0]) || site.descripcion,
    urlPath: '/sobre-mi/',
    active: 'sobre-mi',
    body,
  });
}

function paginaContacto(site) {
  const redes = (site.redes || [])
    .filter((r) => r.url)
    .map(
      (r) =>
        `<a class="contacto__item" href="${esc(r.url)}" target="_blank" rel="noopener"><span>${esc(r.nombre)}</span><strong>Ver perfil</strong></a>`
    )
    .join('');
  const body = `
<section class="cabecera">
  <p class="etiqueta">Hablemos</p>
  <h1>Contacto</h1>
  <p class="cabecera__bajada">Cuéntame qué necesitas y te respondo con una propuesta.</p>
</section>
<section class="contacto">
  <a class="contacto__item contacto__item--principal" href="${esc(waLink(site))}" target="_blank" rel="noopener"><span>WhatsApp</span><strong>${esc(
    site.whatsappVisible || site.whatsapp
  )}</strong></a>
  <a class="contacto__item" href="mailto:${esc(site.email)}"><span>Correo</span><strong>${esc(site.email)}</strong></a>
  ${redes}
</section>`;
  return layout(site, {
    title: 'Contacto',
    description: `Escríbele a ${site.nombre} por WhatsApp o correo para cotizar tu proyecto.`,
    urlPath: '/contacto/',
    active: 'contacto',
    body,
  });
}

function pagina404(site) {
  return layout(site, {
    title: 'Página no encontrada',
    description: site.descripcion,
    urlPath: '/404.html',
    body: `<section class="cabecera"><h1>No encontré esa página</h1><p class="cabecera__bajada"><a class="enlace" href="/trabajos/">Ver los trabajos</a></p></section>`,
  });
}

// ---------- build ----------

let VERSION = '';

function build() {
  const site = readJson('data/site.json');
  const projects = readJson('data/projects.json');
  validar(projects);

  // En Vercel la URL pública llega sola; en local se usa la de site.json (si hay).
  const vercelUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  site.url = (site.url || (vercelUrl ? `https://${vercelUrl}` : '')).replace(/\/$/, '');
  VERSION = Date.now().toString(36);

  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  fs.cpSync(path.join(ROOT, 'assets'), path.join(OUT, 'assets'), { recursive: true });
  fs.cpSync(path.join(ROOT, 'media'), path.join(OUT, 'media'), { recursive: true });

  write('index.html', paginaInicio(site, projects));
  write('trabajos/index.html', paginaTrabajos(site, projects));
  write('sobre-mi/index.html', paginaSobreMi(site));
  write('contacto/index.html', paginaContacto(site));
  write('404.html', pagina404(site));
  projects.forEach((p, i) => write(`proyectos/${p.slug}/index.html`, paginaProyecto(site, projects, p, i)));

  const rutas = ['/', '/trabajos/', '/sobre-mi/', '/contacto/', ...projects.map((p) => `/proyectos/${p.slug}/`)];
  write('robots.txt', `User-agent: *\nAllow: /\n${site.url ? `Sitemap: ${site.url}/sitemap.xml\n` : ''}`);
  if (site.url) {
    write(
      'sitemap.xml',
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rutas
        .map((r) => `  <url><loc>${site.url}${r}</loc></url>`)
        .join('\n')}\n</urlset>\n`
    );
  }

  console.log(`Sitio generado en dist/ — ${projects.length} proyectos, ${rutas.length} páginas.`);
}

function serve() {
  const http = require('http');
  const tipos = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.webp': 'image/webp',
    '.jpg': 'image/jpeg',
    '.png': 'image/png',
    '.mp4': 'video/mp4',
    '.xml': 'application/xml',
    '.txt': 'text/plain; charset=utf-8',
  };
  const port = Number(process.env.PORT) || 3000;
  http
    .createServer((req, res) => {
      let ruta = decodeURIComponent(req.url.split('?')[0]);
      if (ruta.endsWith('/')) {
        ruta += 'index.html';
        // Regenera al pedir una página, así los cambios se ven al recargar.
        try {
          require('child_process').execFileSync(process.execPath, [__filename], { stdio: 'pipe' });
        } catch (e) {
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          return res.end(String(e.stderr || e.message));
        }
      }
      let file = path.join(OUT, ruta);
      if (!file.startsWith(OUT)) return res.writeHead(403).end();
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        res.writeHead(301, { Location: ruta + '/' });
        return res.end();
      }
      let status = 200;
      if (!fs.existsSync(file)) {
        file = path.join(OUT, '404.html');
        status = 404;
      }
      const total = fs.statSync(file).size;
      const headers = { 'Content-Type': tipos[path.extname(file)] || 'application/octet-stream', 'Accept-Ranges': 'bytes' };
      const rango = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
      if (rango && status === 200) {
        const ini = rango[1] ? Number(rango[1]) : 0;
        const fin = rango[2] ? Math.min(Number(rango[2]), total - 1) : total - 1;
        res.writeHead(206, { ...headers, 'Content-Range': `bytes ${ini}-${fin}/${total}`, 'Content-Length': fin - ini + 1 });
        return fs.createReadStream(file, { start: ini, end: fin }).pipe(res);
      }
      res.writeHead(status, { ...headers, 'Content-Length': total });
      fs.createReadStream(file).pipe(res);
    })
    .listen(port, () => console.log(`Vista previa en http://localhost:${port}`));
}

try {
  build();
} catch (e) {
  console.error(`\n${e.message}\n`);
  process.exit(1);
}
if (process.argv.includes('--serve')) serve();
