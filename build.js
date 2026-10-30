// Genera el sitio estático en /dist a partir de data/*.json.
// Sin dependencias: `node build.js` (o `node build.js --serve` para verlo en local).

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const OUT = path.join(ROOT, 'dist');

const CATEGORIAS = {
  rrss: 'Social media',
  video: 'Edición de video',
  identidad: 'Identidad de marca',
  logos: 'Logofolio',
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

    const paginasManual = Array.from({ length: p.manual || 0 }, (_, n) => String(n + 1).padStart(2, '0')).flatMap((nn) => [
      `manual/${nn}.webp`,
      `manual/m${nn}.webp`,
    ]);
    const archivos = [p.portada, p.portadaVideo, ...(p.galeria || []), ...(p.laminas || []), ...(p.mono || []).map((m) => m.archivo), ...paginasManual].filter(Boolean);
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

function layout(site, { title, description, urlPath, image, body, active, jsonld, type = 'website', extraHead = '' }) {
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
<script>document.documentElement.classList.add('js');try{var t=localStorage.getItem('tema');if(t)document.documentElement.dataset.theme=t}catch(e){}</script>
<link rel="preconnect" href="https://api.fontshare.com">
<link rel="preconnect" href="https://cdn.fontshare.com" crossorigin>
<link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=clash-display@300,500,600,700&f[]=satoshi@400,500,700&display=swap">
${extraHead}
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
  <div class="footer__fila">
    <div>
      <p class="footer__cta">¿Tienes una marca por forjar?</p>
      <p class="footer__legal">© ${new Date().getFullYear()} ${esc(site.nombre)}. Todos los derechos reservados.</p>
    </div>
    <div class="footer__links">
      <a class="footer__icono" href="${esc(waLink(site))}" target="_blank" rel="noopener" aria-label="Escribir por WhatsApp" title="WhatsApp"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg></a>
      <a class="footer__icono" href="mailto:${esc(site.email)}" aria-label="Escribir a ${esc(site.email)}" title="${esc(site.email)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.5 12 13.5l8.5-6"/></svg></a>
      ${redes}
    </div>
  </div>
  <p class="footer__marca" aria-hidden="true">${esc(site.nombre)}</p>
</footer>
<script src="/assets/js/main.js?v=${VERSION}" defer></script>
</body>
</html>
`;
}

function card(p, { eager = false } = {}) {
  const base = `/media/${p.slug}/`;
  const video = p.portadaVideo
    ? `<video muted loop playsinline preload="none" data-autoplay aria-hidden="true"><source src="${base}${esc(p.portadaVideo)}" type="video/mp4"></video>`
    : '';
  return `<a class="card" href="/proyectos/${p.slug}/" data-cat="${p.categoria}">
  <div class="card__media">
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
    const video = `<video muted loop playsinline preload="none" data-autoplay style="aspect-ratio:${s.w}/${s.h}"${
      tienePoster ? ` data-poster="${base}${esc(poster)}"` : ''
    } aria-label="${esc(p.titulo)}, reel ${i + 1}"><source src="${base}${esc(archivo)}" type="video/mp4"></video>`;
    // "videos" (opcional): ID de YouTube por archivo. El adelanto mudo pasa a ser un botón que abre el video completo.
    const yt = p.videos && p.videos[archivo];
    if (yt) {
      return `<figure class="galeria__item galeria__item--reel yt yt--vertical" data-yt="${esc(yt)}" style="aspect-ratio:${s.w}/${s.h}">
  <button type="button" aria-label="Reproducir con sonido: ${esc(p.titulo)}, video ${i + 1}">${video}<span class="yt__play" aria-hidden="true"></span></button>
</figure>`;
    }
    return `<figure class="galeria__item galeria__item--reel">
  ${video}
</figure>`;
  }
  const num = `${String(i + 1).padStart(2, '0')} / ${String(p.galeria.length).padStart(2, '0')}`;
  // "pies" (opcional): texto bajo una imagen, por nombre de archivo. Reemplaza al número.
  const pie = p.pies && p.pies[archivo];
  const mini = archivo.replace(/([^/]+)$/, 'm$1');
  const tieneMini = exists(`media/${p.slug}/${mini}`);
  const visible = tieneMini ? mini : archivo;
  return `<figure class="galeria__item">
  <img src="${base}${esc(visible)}"${tieneMini ? ` data-full="${base}${esc(archivo)}"` : ''} alt="${esc(pie || `${p.titulo}, imagen ${i + 1}`)}"${sizeAttrs(`media/${p.slug}/${visible}`)} loading="lazy" decoding="async" data-zoom>
  ${pie ? `<figcaption class="galeria__pie">${esc(pie)}</figcaption>` : `<figcaption>${num}</figcaption>`}
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

// Cinta de marcas: los logos a una tinta del logofolio, cada uno dentro de una caja del mismo tamaño,
// pasando despacio y sin corte (van dos veces seguidas).
function cintaMarcas(projects) {
  const lf = projects.find((p) => (p.mono || []).length);
  if (!lf) return '';
  const logo = (m, copia) =>
    `<i${copia ? ' aria-hidden="true"' : ` role="img" aria-label="${esc(m.nombre)}"`} style="--logo:url('/media/${lf.slug}/${esc(
      m.archivo
    )}')"></i>`;
  return `
<div class="marcas">
  <div class="cinta marcas__cinta" role="group" aria-label="Marcas que confiaron en mi trabajo" style="--piezas:${lf.mono.length};--ritmo:4.5s">
    <div class="cinta__pista">
      ${lf.mono.map((m) => logo(m, false)).join('')}
      ${lf.mono.map((m) => logo(m, true)).join('')}
    </div>
  </div>
</div>`;
}

function paginaInicio(site, projects) {
  // Una sección numerada por categoría (orden y nombres en site.json → "secciones"), con sus proyectos en una tira.
  const secciones = (site.secciones || [])
    .map((sec) => ({ ...sec, lista: projects.filter((p) => p.categoria === sec.categoria) }))
    .filter((sec) => sec.lista.length)
    .map((sec, n) => {
      const anios = sec.lista.map((p) => Number(p.anio)).filter(Boolean);
      const rango = anios.length ? [...new Set([Math.min(...anios), Math.max(...anios)])].join(' – ') : '';
      const num = String(n + 1).padStart(2, '0');

      // Cinta ("cinta": true en site.json): las piezas de todos los proyectos de la sección, intercaladas por
      // cliente, en una tira que se desliza sola. Va dos veces seguida para que el recorrido no tenga corte.
      let cinta = '';
      if (sec.cinta) {
        const POR_PROYECTO = 6;
        const piezas = [];
        for (let k = 0; k < POR_PROYECTO; k++) {
          for (const p of sec.lista) {
            // Imágenes tal cual; de los reels se usa su póster (reel-01.mp4 → reel-01.webp)
            let lista = (p.galeria || [])
              .map((a) => (/\.mp4$/i.test(a) ? a.replace(/\.mp4$/i, '.webp') : a))
              .filter((a) => /\.webp$/i.test(a) && exists(`media/${p.slug}/${a}`));
            // Manuales de marca: primero la tapa, luego los mockups; si hay pocos, se completa con páginas
            // repartidas a lo largo del manual (logotipo, colores, tipografía suelen caer ahí).
            if (p.manual) {
              const pag = (n) => `manual/${String(n).padStart(2, '0')}.webp`;
              const extra = [0.45, 0.6, 0.75, 0.9].map((f) => pag(Math.max(2, Math.round(p.manual * f))));
              lista = [...new Set([pag(1), ...lista, ...extra])].slice(0, Math.max(4, lista.length + 1));
            }
            const archivo = lista[k];
            if (!archivo) continue;
            const mini = archivo.replace(/([^/]+)$/, 'm$1');
            // Si la pieza es el póster de un reel, se guarda también el video para reproducirlo en la cinta
            const video = archivo.replace(/\.webp$/i, '.mp4');
            piezas.push({
              p,
              src: exists(`media/${p.slug}/${mini}`) ? mini : archivo,
              video: (p.galeria || []).includes(video) ? video : null,
            });
          }
        }
        const item = ({ p, src, video }, copia, i = -1) => {
          const dim = webpSize(`media/${p.slug}/${src}`) || { w: 9, h: 16 };
          // Los reels se reproducen mudos y en loop solo mientras pasan por la pantalla (lo maneja main.js)
          const medio = video
            ? `<video muted loop playsinline preload="none" data-autoplay data-poster="/media/${p.slug}/${esc(src)}" style="aspect-ratio:${dim.w}/${dim.h}" aria-label="${
                copia ? '' : `Video para ${esc(p.cliente || p.titulo)}`
              }"><source src="/media/${p.slug}/${esc(video)}" type="video/mp4"></video>`
            : `<img src="/media/${p.slug}/${esc(src)}" alt="${copia ? '' : `Diseño para ${esc(p.cliente || p.titulo)}`}"${sizeAttrs(`media/${p.slug}/${src}`)} loading="lazy" decoding="async">`;
          return `<a class="cinta__item" href="/proyectos/${p.slug}/"${copia ? ' aria-hidden="true" tabindex="-1"' : ''}${i >= 0 ? ` style="--i:${i}"` : ''}>
        ${i >= 0 ? medio.replace('loading="lazy"', 'loading="eager"') : medio}
        <span>${esc(p.cliente || p.titulo)}</span>
      </a>`;
        };
        // "curva": las piezas van sobre un cilindro que gira, visto desde fuera (la del centro queda grande y de frente; las de los lados se alejan e inclinan).
        // El anillo necesita una cantidad pareja de piezas: se recorta a 20 y, si hay pocas, se repiten hasta 16.
        if (sec.curva && piezas.length) {
          const anillo = piezas.slice(0, 20);
          const propias = anillo.length;
          while (anillo.length < 16) anillo.push(...anillo.slice(0, propias));
          cinta = `
  <div class="cinta cinta--curva${
    // piezas apaisadas (páginas de manual): el anillo usa celdas 16:9
    (webpSize(`media/${anillo[0].p.slug}/${anillo[0].src}`) || { w: 1, h: 2 }).w > (webpSize(`media/${anillo[0].p.slug}/${anillo[0].src}`) || { w: 1, h: 2 }).h ? ' cinta--ancha' : ''
  }" style="--piezas:${anillo.length}${sec.ritmo ? `;--ritmo:${Number(sec.ritmo)}s` : ''}">
    <div class="cinta__pista">
      ${anillo.map((x, i) => item(x, i >= propias, i)).join('')}
      ${
        // En teléfonos la cinta va plana (más liviana): necesita las piezas una segunda vez para no tener corte
        anillo.map((x) => item(x, true).replace('class="cinta__item"', 'class="cinta__item cinta__item--movil"')).join('')
      }
    </div>
  </div>`;
        } else if (piezas.length) {
          cinta = `
  <div class="cinta${
    (webpSize(`media/${piezas[0].p.slug}/${piezas[0].src}`) || { w: 1, h: 2 }).w > (webpSize(`media/${piezas[0].p.slug}/${piezas[0].src}`) || { w: 1, h: 2 }).h
      ? ' cinta--ancha'
      : ''
  }" style="--piezas:${piezas.length}${sec.ritmo ? `;--ritmo:${Number(sec.ritmo)}s` : ''}">
    <div class="cinta__pista">
      ${piezas.map((x) => item(x, false)).join('')}
      ${piezas.map((x) => item(x, true)).join('')}
    </div>
  </div>`;
        }
      }
      // Collage ("collage": true): un bloque por marca con seis piezas superpuestas y su nombre al centro.
      // Reemplaza a las tarjetas de proyecto de esa sección.
      const collages = sec.collage
        ? sec.lista
            .map((p) => {
              const piezas = (p.galeria || [])
                .filter((a) => /\.webp$/i.test(a))
                .slice(0, 6)
                .map((archivo) => {
                  const mini = archivo.replace(/([^/]+)$/, 'm$1');
                  return exists(`media/${p.slug}/${mini}`) ? mini : archivo;
                });
              return `
  <a class="collage" href="/proyectos/${p.slug}/" aria-label="Ver el proyecto ${esc(p.titulo)}">
    <div class="collage__barra"><span>Contenido para redes sociales</span><span>Ver proyecto ↗</span><span>${p.anio ? `${esc(p.anio)} //` : ''}</span></div>
    <div class="collage__cuerpo">
      <strong class="collage__marca">${esc(p.cliente || p.titulo)}</strong>
      <div class="collage__lienzo">
        ${piezas
          .map(
            (src) =>
              `<img src="/media/${p.slug}/${esc(src)}" alt=""${sizeAttrs(`media/${p.slug}/${src}`)} loading="lazy" decoding="async">`
          )
          .join('')}
      </div>
      <span class="collage__rubro">${esc(p.rubro || CATEGORIAS[p.categoria])}</span>
    </div>
  </a>`;
            })
            .join('')
        : '';
      // Rejilla ("rejilla": true): las piezas de la sección directo en una grilla (logofolio), cada una con su pie.
      const fichas = sec.rejilla
        ? sec.lista.flatMap((p) =>
            (p.galeria || []).map((archivo) => {
              const mini = archivo.replace(/([^/]+)$/, 'm$1');
              const src = exists(`media/${p.slug}/${mini}`) ? mini : archivo;
              const pie = (p.pies && p.pies[archivo]) || p.titulo;
              return `
    <a class="galeria__item" href="/proyectos/${p.slug}/">
      <img src="/media/${p.slug}/${esc(src)}" alt="${esc(pie)}"${sizeAttrs(`media/${p.slug}/${src}`)} loading="lazy" decoding="async">
      <span class="galeria__pie">${esc(pie)}</span>
    </a>`;
            })
          )
        : [];
      // "soloCinta": la sección muestra únicamente la cinta (cada pieza lleva a su proyecto), sin tarjetas
      const soloCinta = sec.soloCinta && cinta;
      const sinCarrusel = collages || fichas.length || soloCinta;
      const cuenta = fichas.length
        ? `${fichas.length} ${fichas.length === 1 ? 'logotipo' : 'logotipos'}`
        : `${sec.lista.length} ${sec.lista.length === 1 ? 'proyecto' : 'proyectos'}`;
      // Si el proyecto trae sus logos a una tinta ("mono"), la sección va como lámina de logofolio:
      // texto a la izquierda y los logos en una cuadrícula de tres columnas separada por líneas punteadas.
      const lf = sec.rejilla && sec.lista.find((p) => (p.mono || []).length);
      const lamina = lf
        ? `
  <div class="logofolio">
    <div class="logofolio__texto">
      <span>Portafolio — ${esc(sec.titulo)}</span>
      <div>
        <h3>${esc(lf.titulo)}</h3>
        <p>${esc(lf.contexto || lf.resumen || '')}</p>
      </div>
      <span>${lf.mono.length} marcas</span>
    </div>
    <div class="logofolio__grilla">
      ${lf.mono
        .map(
          (m) =>
            `<a class="logofolio__celda" href="/proyectos/${lf.slug}/" title="${esc(m.nombre)}"><i role="img" aria-label="Logotipo de ${esc(
              m.nombre
            )}" style="--logo:url('/media/${lf.slug}/${esc(m.archivo)}')"></i></a>`
        )
        .join('')}
      <a class="logofolio__celda logofolio__ver" href="/proyectos/${lf.slug}/">Ver logofolio ↗</a>
    </div>
  </div>`
        : '';
      const tira = soloCinta
        ? ''
        : lamina
        ? lamina
        : fichas.length
        ? `
  <div class="galeria galeria--logos rejilla">${fichas.join('')}
  </div>`
        : collages
        ? `
  <div class="collage-escena">${collages}
  </div>
  <div class="collage-puntos"></div>`
        : `
  <div class="carrusel" tabindex="0" aria-label="${esc(sec.titulo)}">
    ${sec.lista.map((p, i) => card(p, { eager: n === 0 && i < 2 })).join('')}
  </div>
  <div class="puntos" aria-hidden="true"></div>`;
      return `
<section class="seccion categoria" id="${sec.categoria}"${sinCarrusel ? '' : ' data-carrusel-caja'}>
  <a class="categoria__banda" href="${
    // Si la categoría tiene un solo proyecto (Logofolio), el clic lleva directo a él, sin pasar por Trabajos
    sec.lista.length === 1 ? `/proyectos/${sec.lista[0].slug}/` : `/trabajos/#${sec.categoria}`
  }" aria-label="${sec.lista.length === 1 ? `Ver ${esc(sec.titulo)}` : `Ver todos los trabajos de ${esc(sec.titulo)}`}">
    <span class="categoria__num" aria-hidden="true">${num}</span>
    <span class="categoria__titulo">
      <h2>${esc(sec.titulo)}</h2>
      <small>(Categoría de trabajo)</small>
    </span>
    <span class="categoria__flecha" aria-hidden="true">↗</span>
  </a>
  ${
    // Con el escenario de marcas no va esta barra: el escenario ya trae la suya (rubro, enlace y año)
    collages
      ? ''
      : `<div class="categoria__barra">
    <span>${esc(sec.detalle || '')}</span>
    <span>${cuenta}</span>
    <span class="categoria__nav">
      ${rango ? `${rango} //` : ''}
      ${
        sinCarrusel
          ? ''
          : `<button class="flecha" type="button" data-carrusel="-1" aria-label="Anteriores">←</button>
      <button class="flecha" type="button" data-carrusel="1" aria-label="Siguientes">→</button>`
      }
    </span>
  </div>`
  }
  ${cinta}${tira}${sec.categoria === 'video' ? proceso(site).replace('<section class="seccion" id="proceso">', '<div class="subseccion" id="proceso">').replace(/<\/section>\s*$/, '</div>') : ''}
</section>`;
    })
    .join('\n');
  const servicios = (site.servicios || [])
    .map((s) => {
      // Si el servicio indica "categoria" y esa sección existe en el inicio, la tarjeta lleva a ella.
      const destino = s.categoria && (site.secciones || []).some((x) => x.categoria === s.categoria) && projects.some((p) => p.categoria === s.categoria);
      const dentro = `<h3>${esc(s.titulo)}</h3><p>${esc(s.texto)}</p>`;
      // "Ver más" solo existe en móvil, donde el texto va recortado: lo despliega hacia abajo (main.js)
      const mas = '<button class="servicios__mas" type="button" aria-expanded="false" hidden>Ver más</button>';
      return destino
        ? `<li><a href="#${s.categoria}">${dentro}<span class="servicios__ver">Ver trabajos ↓</span></a>${mas}</li>`
        : `<li>${dentro}${mas}</li>`;
    })
    .join('');
  const bloqueServicios = servicios
    ? `
<section class="seccion" id="servicios">
  <div class="seccion__cabecera">
    <div><h2>${esc(site.serviciosTitulo || 'Servicios')}</h2></div>
    <div class="seccion__lado"><p class="etiqueta">Servicios</p></div>
  </div>
  <ul class="servicios">${servicios}</ul>
</section>`
    : '';
  // "fotoInicio": encuadre propio para el círculo del inicio; si no hay, se usa la foto de Sobre mí
  const foto = site.fotoInicio || (site.sobreMi && site.sobreMi.foto);
  // "fotoInicioCirculo": la foto es un PNG/WebP transparente que ya trae su círculo con la cabeza saliendo por
  // arriba. Se indica el centro y el radio de ese círculo (en píxeles de la imagen) y aquí se calcula el tamaño
  // y la posición para que calce con el círculo iluminado del sitio (92 % del contenedor).
  let estiloFoto = '';
  const circ = site.fotoInicio && site.fotoInicioCirculo;
  const dimFoto = circ && webpSize(site.fotoInicio);
  if (dimFoto) {
    const ancho = (92 * dimFoto.w) / (2 * circ.r);
    const alto = (ancho * dimFoto.h) / dimFoto.w;
    const izq = 50 - (circ.cx / dimFoto.w) * ancho;
    const arriba = 50 - (circ.cy / dimFoto.h) * alto;
    estiloFoto = ` class="sobresale" style="width:${ancho.toFixed(2)}%;left:${izq.toFixed(2)}%;top:${arriba.toFixed(2)}%"`;
  }
  // "Soy diseñador gráfico" → ["Diseñador", "gráfico"] para la línea pequeña sobre el título
  const rol = site.frase.replace(/^soy\s+/i, '').replace(/^./, (c) => c.toUpperCase()).split(' ');
  const body = `
<section class="portada" aria-label="Portafolio ${new Date().getFullYear()}">
  <div class="hero__marco">
    <p class="portada__rol"><b>${esc(rol[0])}</b> <em>${esc(rol.slice(1).join(' '))}</em></p>
    <div class="portada__caja" aria-hidden="true">
      <p class="portada__titulo">Portaf<span class="portada__huella"><svg viewBox="2 1 20 21" fill="none" stroke="currentColor" stroke-width="0.95" stroke-linecap="round"><path pathLength="100" stroke-dasharray="100" d="M10.50 20.71V11a1.5 1.5 0 0 1 3.0 0V19.81"/><path pathLength="100" stroke-dasharray="46 5 49" d="M9.00 20.33V11a3.0 3.0 0 0 1 6.0 0V20.33"/><path pathLength="100" stroke-dasharray="18 4 50 5 23" d="M7.50 19.67V11a4.5 4.5 0 0 1 9.0 0V18.77"/><path pathLength="100" stroke-dasharray="62 4 34" d="M6.00 18.64V11a6.0 6.0 0 0 1 12.0 0V18.64"/><path pathLength="100" stroke-dasharray="30 5 40 4 21" d="M4.50 17.00V11a7.5 7.5 0 0 1 15.0 0V16.10"/><path pathLength="100" stroke-dasharray="12 6 30 5 47" d="M3.00 13.31V11a9.0 9.0 0 0 1 18.0 0V13.31"/><path d="M12 11.4V20.83"/></svg></span>lio</p>
      <span class="portada__burbuja"><span>${(site.servicios || []).map((x) => esc(x.titulo)).join(' · ')}</span></span>
    </div>
    <p class="hero__pastilla"><span aria-hidden="true">↙</span><em>${new Date().getFullYear()}</em></p>
    <i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i>
    <span class="hero__guia"><svg class="hero__pluma" viewBox="18 13 28 47" aria-hidden="true">
      <defs><linearGradient id="pluma" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--acento)"/><stop offset="1" stop-color="var(--acento-2)"/></linearGradient></defs>
      <path fill="url(#pluma)" fill-rule="evenodd" d="M32 15l12 20-4.5 15h-15L20 35zm-1 5v11.2a3.6 3.6 0 1 0 2 0V20zM24.5 53h15v5h-15z"/>
    </svg></span>
  </div>
</section>

<section class="hero">
  <div class="hero__texto">
    ${site.etiqueta ? `<p class="etiqueta">${esc(site.etiqueta)}</p>` : ''}
    <h1 class="hero__nombre">${esc(site.nombre)}</h1>
    <p class="hero__frase">${esc(site.frase)}</p>
    <p class="hero__intro">${esc(site.intro)}</p>
    <div class="hero__botones">
      <a class="boton" href="/trabajos/">Ver trabajos</a>
      <a class="boton boton--linea" href="/contacto/">Forjemos tu marca</a>
    </div>
    ${herramientas(site, 'Herramientas con las que trabajo')}
  </div>
  <div class="hero__visual">
    ${foto && exists(foto) ? `<img src="/${esc(foto)}?v=${VERSION}" alt="Retrato del diseñador de ${esc(site.nombre)}"${sizeAttrs(foto)}${estiloFoto} decoding="async" fetchpriority="high">` : ''}
    ${Object.values(CATEGORIAS).map((c) => `<span class="hero__chip">${c}</span>`).join('')}
  </div>
</section>
${cintaMarcas(projects)}
${bloqueServicios}
${secciones}
${(site.secciones || []).some((x) => x.categoria === 'video') && projects.some((p) => p.categoria === 'video') ? '' : proceso(site)}`;

  return layout(site, {
    title: `${site.nombre} — ${site.frase.replace(/\.$/, '')}`,
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
    ...usadas.map((c) => {
      const lista = projects.filter((p) => p.categoria === c);
      // Categoría con un solo proyecto: el botón abre ese proyecto directamente
      return `<button type="button" data-filtro="${c}" data-nombre="${CATEGORIAS[c]}" data-total="${lista.length}"${lista.length === 1 ? ` data-ir="/proyectos/${lista[0].slug}/"` : ''} aria-pressed="false">${
        CATEGORIAS[c]
      } <sup>${lista.length}</sup></button>`;
    }),
  ].join('');
  // Láminas: con los filtros "Social media", "Video" e "Identidad de marca" cada marca va en una lámina, con el
  // texto a un lado y sus piezas en un mosaico (una grande y varias chicas).
  const lamina = (p, piezas, n, total, tipo) => {
    const ancha = tipo === 'ancha';
    // Imágenes: cada pieza lleva al proyecto
    const pieza = (archivo, k) => {
      const mini = archivo.replace(/([^/]+)$/, 'm$1');
      // la pieza grande usa la imagen completa; las chicas, su miniatura
      const src = k > 0 && exists(`media/${p.slug}/${mini}`) ? mini : archivo;
      return `<a href="/proyectos/${p.slug}/"${k ? ' tabindex="-1"' : ''}><img src="/media/${p.slug}/${esc(src)}" alt="${
        k ? '' : `Diseños para ${esc(p.cliente || p.titulo)}`
      }"${sizeAttrs(`media/${p.slug}/${src}`)} loading="lazy" decoding="async"></a>`;
    };
    // Videos: aquí solo van los adelantos mudos en bucle; cada uno lleva al proyecto, donde se ven completos.
    // Si el proyecto tiene más de los que se muestran, la última pieza avisa cuántos faltan.
    const resto = tipo === 'video' ? p.galeria.filter((a) => /\.mp4$/i.test(a)).length - piezas.length : 0;
    const celda = (archivo, k) => {
      const poster = archivo.replace(/\.mp4$/i, '.webp');
      return `<a class="lamina__celda" href="/proyectos/${p.slug}/"${k ? ' tabindex="-1"' : ''} aria-label="Ver los videos de ${esc(
        p.cliente || p.titulo
      )}"><video muted loop playsinline preload="none" data-autoplay${
        exists(`media/${p.slug}/${poster}`) ? ` data-poster="/media/${p.slug}/${esc(poster)}"` : ''
      }><source src="/media/${p.slug}/${esc(archivo)}" type="video/mp4"></video>${
        // la última pieza lleva siempre un aviso visible; las demás lo muestran al pasar el cursor
        k === piezas.length - 1
          ? `<span class="lamina__mas">${resto > 0 ? `+${resto} más` : 'Ver completo'}</span>`
          : '<span class="lamina__mas lamina__mas--cursor">Ver completo</span>'
      }</a>`;
    };
    return `<article class="lamina${ancha ? ' lamina--ancha' : ''}${tipo === 'video' ? ' lamina--video' : ''}">
      <div class="lamina__texto">
        <span>${esc(CATEGORIAS[p.categoria])} — ${String(n + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}</span>
        <div>
          <h2>${esc(ancha ? p.titulo : p.cliente || p.titulo)}</h2>
          <p>${esc(p.contexto || p.resumen || '')}</p>
          <a class="boton" href="/proyectos/${p.slug}/">Ver proyecto</a>
        </div>
        <span>${esc([p.rubro, p.anio].filter(Boolean).join(' · '))}</span>
      </div>
      <div class="lamina__mosaico${tipo === 'video' ? ` lamina__mosaico--fila" style="--n:${piezas.length}` : ''}">${piezas
        .map(tipo === 'video' ? celda : pieza)
        .join('')}</div>
    </article>`;
  };
  const vistaLaminas = (cat, lista, tipo, cierre = '') =>
    lista.length
      ? `
  <div class="laminas" data-vista="${cat}" hidden>
    ${lista.map(({ p, piezas }, n) => lamina(p, piezas, n, lista.length, tipo)).join('\n    ')}${cierre}
  </div>`
      : '';
  // Cierre de cada vista: una frase y un botón para cotizar ese servicio por WhatsApp
  const cierre = (frase, apoyo, boton, mensaje) => `
    <div class="laminas__cierre">
      <p>${esc(frase)} <span>${esc(apoyo)}</span></p>
      <a class="boton" href="https://wa.me/${site.whatsapp}?text=${encodeURIComponent(mensaje)}" target="_blank" rel="noopener">${esc(boton)}</a>
    </div>`;
  const pr = site.proceso || {};
  const cierres = {
    rrss: cierre(
      '¿Quieres un feed con una sola línea gráfica?',
      'Yo me encargo del diseño.',
      'Cotizar diseño para redes',
      `Hola ${site.nombre}, quiero cotizar diseño para redes sociales.`
    ),
    video: cierre(
      '¿Ya tienes tus clips grabados?',
      'De todo lo demás me encargo yo.',
      pr.boton || 'Cotizar edición de video',
      pr.mensaje || `Hola ${site.nombre}, quiero cotizar edición de video.`
    ),
    identidad: cierre(
      '¿Tu marca necesita una identidad propia?',
      'La construyo contigo, del logotipo al manual.',
      'Cotizar identidad de marca',
      `Hola ${site.nombre}, quiero cotizar una identidad de marca.`
    ),
  };
  // Social media: las primeras cinco publicaciones (formato vertical)
  const conPosts = projects
    .filter((p) => p.categoria === 'rrss')
    .map((p) => ({ p, piezas: (p.galeria || []).filter((a) => /\.webp$/i.test(a)).slice(0, 5) }))
    .filter((x) => x.piezas.length === 5);
  // Identidad: la tapa del manual en grande, luego los mockups y, si faltan, páginas repartidas a lo largo
  // del manual (logotipo, colores, tipografía suelen caer ahí). Seis piezas apaisadas.
  const conManual = projects
    .filter((p) => p.categoria === 'identidad' && p.manual)
    .map((p) => {
      const pag = (n) => `manual/${String(n).padStart(2, '0')}.webp`;
      const mockups = (p.galeria || []).filter((a) => /\.webp$/i.test(a));
      const extra = [0.25, 0.4, 0.55, 0.7, 0.85].map((f) => pag(Math.max(2, Math.round(p.manual * f))));
      return { p, piezas: [...new Set([pag(1), ...mockups.slice(0, 3), ...extra, ...mockups.slice(3)])].slice(0, 6) };
    })
    .filter((x) => x.piezas.length === 6);
  // Video: hasta tres videos por marca, iguales y en fila
  const conVideos = projects
    .filter((p) => p.categoria === 'video' && !p.youtube)
    .map((p) => {
      const reels = (p.galeria || []).filter((a) => /\.mp4$/i.test(a));
      return { p, piezas: reels.slice(0, 3) };
    })
    .filter((x) => x.piezas.length);
  // La primera vista sale visible desde el HTML (las demás las muestra el filtro)
  const laminas = (vistaLaminas('rrss', conPosts, '', cierres.rrss) + vistaLaminas('video', conVideos, 'video', cierres.video) + vistaLaminas('identidad', conManual, 'ancha', cierres.identidad)).replace(' hidden>', '>');
  const body = `
<section class="cabecera cabecera--trabajos">
  <div class="cabecera__fila">
    <p class="etiqueta">Portafolio</p>
    <p class="cabecera__dato" data-cuenta>${(() => {
      // cantidad de la primera categoría; al cambiar de filtro la actualiza main.js
      const n = projects.filter((p) => p.categoria === usadas[0]).length;
      return `${CATEGORIAS[usadas[0]]} · ${n} ${n === 1 ? 'proyecto' : 'proyectos'}`;
    })()}</p>
  </div>
  <h1 class="solo-lectores">Trabajos</h1>
  <div class="filtros" role="group" aria-label="Filtrar por categoría">${filtros}</div>
</section>
<section class="seccion seccion--pegada">
  ${laminas}
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
      <img src="${base}${esc(p.portada)}" alt=""${sizeAttrs(`media/${p.slug}/${p.portada}`)} decoding="async" fetchpriority="high">
      <span class="yt__play" aria-hidden="true"></span>
    </button>
  </div>`
    : `<img class="proyecto__portada" src="${base}${esc(p.portada)}" alt="${esc(p.titulo)}"${sizeAttrs(
        `media/${p.slug}/${p.portada}`
      )} decoding="async" fetchpriority="high" data-zoom>`;

  const bloque = (clase, titulo, contenido) => (contenido ? `<div class="info--${clase}"><h2>${titulo}</h2>${contenido}</div>` : '');
  const queHice = Array.isArray(p.queHice)
    ? `<ol>${p.queHice.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>`
    : p.queHice
    ? `<p>${esc(p.queHice)}</p>`
    : '';

  const galeria = p.galeria || [];
  const reels = galeria.filter((a) => /\.mp4$/i.test(a)).length;
  const imagenes = galeria.length - reels;
  const plural = (n, uno, varios) => n && `${n} ${n === 1 ? uno : varios}`;
  // Social media sin video: la galería son publicaciones verticales y va como muro de posts
  const esLogos = p.tipo === 'logofolio';
  const esPosts = (p.categoria === 'rrss' && !p.youtube) || esLogos;
  // Proyecto de video sin YouTube: la galería son adelantos verticales mudos, en fila como los posts
  const esReels = p.categoria === 'video' && !p.youtube;
  const piezas = [
    p.manual && `Manual de ${p.manual} páginas`,
    esLogos
      ? plural(imagenes, 'logotipo', 'logotipos')
      : plural(imagenes, p.manual ? 'mockup' : esPosts ? 'pieza' : 'imagen', p.manual ? 'mockups' : esPosts ? 'piezas' : 'imágenes'),
    plural((p.laminas || []).length, 'ficha de marca', 'fichas de marca'),
    plural(reels, esReels ? 'video' : 'reel', esReels ? 'videos' : 'reels'),
  ]
    .filter(Boolean)
    .join(' · ');
  const fila = (dt, dd) => (dd ? `<div><dt>${dt}</dt><dd>${esc(dd)}</dd></div>` : '');
  const wa = `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
    `Hola ${site.nombre}, vi el proyecto ${p.titulo} en tu portafolio y quiero algo similar.`
  )}`;

  // Mosaico del manual: todas las páginas en filas inclinadas que se deslizan despacio.
  // Cada fila lleva sus páginas dos veces seguidas para que el deslizamiento no tenga corte.
  let muro = '';
  if (p.manual) {
    const FILAS = 4;
    // Mínimo 7 por fila: así media fila siempre es más ancha que la pantalla y no quedan huecos al deslizarse.
    const porFila = Math.max(7, Math.ceil(p.manual / FILAS));
    const pagina = (n, copia) => {
      const nn = String(n).padStart(2, '0');
      return `<img src="${base}manual/m${nn}.webp" data-full="${base}manual/${nn}.webp" data-zoom width="640" height="360" loading="lazy" decoding="async" alt="${
        copia ? '' : `${esc(p.titulo)}, página ${n} del manual`
      }"${copia ? ' aria-hidden="true"' : ''}>`;
    };
    const filas = Array.from({ length: FILAS }, (_, f) => {
      const nums = Array.from({ length: porFila }, (_, k) => ((f * porFila + k) % p.manual) + 1);
      return `<div class="muro__fila">${nums.map((n) => pagina(n, false)).join('')}${nums.map((n) => pagina(n, true)).join('')}</div>`;
    }).join('\n      ');
    muro = `<section class="muro" aria-label="Páginas del manual de marca">
    <div class="muro__mascara"><div class="muro__lienzo">
      ${filas}
    </div></div>
    <button class="boton muro__boton" type="button" data-visor>Ver el manual página por página</button>
  </section>`;
  } else if (esPosts && imagenes >= 4) {
    // Social media: el mismo mosaico, armado con las publicaciones (verticales o cuadradas) en tres filas.
    const FILAS = 3;
    const posts = galeria.filter((x) => /\.webp$/i.test(x));
    // Mínimo 9 por fila para que media fila cubra siempre la pantalla; cada fila parte en una pieza distinta.
    // Con pocas piezas la fila da vueltas completas a la lista, para que no queden dos iguales juntas en el empalme.
    const porFila =
      posts.length < 9 ? posts.length * Math.ceil(9 / posts.length) : Math.max(9, Math.ceil(posts.length / FILAS));
    const salto = posts.length < 9 ? Math.ceil(posts.length / FILAS) : porFila;
    const pieza = (archivo, copia) => {
      const mini = archivo.replace(/([^/]+)$/, 'm$1');
      const src = exists(`media/${p.slug}/${mini}`) ? mini : archivo;
      return `<img src="${base}${esc(src)}" data-full="${base}${esc(archivo)}" data-zoom${sizeAttrs(`media/${p.slug}/${src}`)} loading="lazy" decoding="async" alt="${
        copia ? '' : `${esc(p.titulo)}, pieza ${posts.indexOf(archivo) + 1}`
      }"${copia ? ' aria-hidden="true"' : ''}>`;
    };
    const filas = Array.from({ length: FILAS }, (_, f) => {
      const lista = Array.from({ length: porFila }, (_, k) => posts[(f * salto + k) % posts.length]);
      return `<div class="muro__fila">${lista.map((x) => pieza(x, false)).join('')}${lista.map((x) => pieza(x, true)).join('')}</div>`;
    }).join('');
    muro = `<section class="muro muro--posts" aria-label="Publicaciones del proyecto">
    <div class="muro__mascara"><div class="muro__lienzo">
      ${filas}
    </div></div>
    <button class="boton muro__boton" type="button" data-visor>Ver las piezas una por una</button>
  </section>`;
  }

  const galeriaHtml = galeria.length
      ? `${p.manual ? '<h2 class="proyecto__subtitulo">Aplicaciones</h2>' : ''}${
          esReels && reels
            ? galeria.every((a) => !/\.mp4$/i.test(a) || (p.videos && p.videos[a]))
              ? '<h2 class="proyecto__subtitulo">Videos <small>toca uno para verlo con sonido</small></h2>'
              : '<h2 class="proyecto__subtitulo">Adelantos <small>sin sonido</small></h2>'
            : ''
        }
  ${
    // Logofolio: los logos van en un carrusel (de a cuatro en escritorio, de a dos en teléfonos), con flechas y puntos
    esLogos
      ? `<div class="logos-caja" data-carrusel-caja>
    <div class="logos-caja__nav">
      <button class="flecha" type="button" data-carrusel="-1" aria-label="Logos anteriores">←</button>
      <button class="flecha" type="button" data-carrusel="1" aria-label="Logos siguientes">→</button>
    </div>`
      : ''
  }<section class="galeria${esLogos ? ' galeria--logos' : esPosts || esReels ? ' galeria--posts' : ''}"${
          esLogos ? ' data-carrusel-pista' : ''
        } aria-label="Galería">${galeria.map((a, n) => galeriaItem(p, a, n)).join('\n')}</section>${
          esLogos ? '<div class="puntos" aria-hidden="true"></div></div>' : ''
        }`
      : '';
  // Proyectos de video: los videos (que ya se reproducen mudos) van arriba, en lugar de la imagen de portada
  const reelsArriba = esReels && reels > 0;

  const body = `
<article class="proyecto">
  <header class="cabecera proyecto__cabecera">
    <div class="proyecto__titular">
      <a class="etiqueta" href="/trabajos/#${p.categoria}">${CATEGORIAS[p.categoria]}</a>
      <h1 style="--letras:${Math.max(...p.titulo.split(/\s+/).map((w) => w.length))}">${esc(p.titulo)}</h1>
      ${p.resumen ? `<p class="proyecto__resumen">${esc(p.resumen)}</p>` : ''}
    </div>
    <dl class="proyecto__ficha">
      ${fila('Cliente', p.cliente)}
      ${fila('Año', p.anio)}
      ${fila('Categoría', CATEGORIAS[p.categoria])}
      ${fila('Contenido', piezas)}
    </dl>
  </header>

  ${muro || (reelsArriba
      ? `<div class="proyecto__reels" data-carrusel-caja>
    <div class="proyecto__reels-cab">
      ${galeriaHtml.slice(0, galeriaHtml.indexOf('<section')).trim()}
      <span class="seccion__nav">
        <button class="flecha" type="button" data-carrusel="-1" aria-label="Videos anteriores">←</button>
        <button class="flecha" type="button" data-carrusel="1" aria-label="Videos siguientes">→</button>
      </span>
    </div>
    ${galeriaHtml.slice(galeriaHtml.indexOf('<section')).replace('<section class="galeria', '<section class="carrusel galeria')}
    <div class="puntos" aria-hidden="true"></div>
  </div>` : `<div class="proyecto__principal">${principal}</div>`)}

  <section class="proyecto__info">
    ${bloque('contexto', 'Contexto', p.contexto ? `<p>${esc(p.contexto)}</p>` : '')}
    ${bloque('hice', 'Qué hice', queHice)}
    ${bloque('resultado', 'Resultado', (p.resultado ? `<p>${esc(p.resultado)}</p>` : '') + `<a class="boton" href="${esc(wa)}" target="_blank" rel="noopener">Quiero algo así</a>`)}
  </section>

  ${reelsArriba ? '' : galeriaHtml}
  ${
    (p.laminas || []).length
      ? `<h2 class="proyecto__subtitulo">Fichas de marca</h2>
  <section class="galeria galeria--fichas" aria-label="Fichas de marca">${p.laminas.map((a, n) => galeriaItem(p, a, n)).join('\n')}</section>`
      : ''
  }
  ${
    // Logofolio: cierra con su propio botón para cotizar, igual que las vistas de Trabajos
    esLogos
      ? `<div class="laminas__cierre laminas__cierre--proyecto">
    <p>¿Tu marca necesita un logotipo? <span>Lo diseño con sus versiones listas para usar.</span></p>
    <a class="boton" href="https://wa.me/${site.whatsapp}?text=${encodeURIComponent(
      `Hola ${site.nombre}, quiero cotizar un logotipo.`
    )}" target="_blank" rel="noopener">Cotizar logotipo</a>
  </div>`
      : ''
  }
</article>

<a class="siguiente" href="/proyectos/${siguiente.slug}/">
  <img src="/media/${siguiente.slug}/${esc(siguiente.portada)}" alt=""${sizeAttrs(`media/${siguiente.slug}/${siguiente.portada}`)} loading="lazy" decoding="async">
  <div>
    <span>Siguiente proyecto</span>
    <strong>${esc(siguiente.titulo)}</strong>
    <em>${CATEGORIAS[siguiente.categoria]}${siguiente.anio ? ` · ${esc(siguiente.anio)}` : ''}</em>
  </div>
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

// Íconos de trazo para los pasos de "Cómo trabajo" en Sobre mí
const ICONOS_PASO = {
  buscar: '<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>',
  idea: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V16h5.2v-.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
  pluma: '<path d="m14.5 4.5 5 5L9 20H4v-5z"/><path d="m12.5 6.5 5 5"/>',
  pulir: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.4 2.4M15.3 15.3l2.4 2.4M6.3 17.7l2.4-2.4M15.3 8.7l2.4-2.4"/>',
  enviar: '<path d="M21 3 10 14"/><path d="m21 3-6.5 18-4.5-7-7-4.5z"/>',
};

// Sobre mí: presentación con el apellido del estudio en grande detrás de la foto, cifras, proyectos destacados,
// herramientas, cómo trabajo, una cita y el contacto. Los textos están en "sobreMi.perfil" (data/site.json).
function paginaSobreMi(site, projects) {
  const s = site.sobreMi || {};
  const pf = s.perfil || {};
  const foto = site.fotoInicio && exists(site.fotoInicio) ? site.fotoInicio : s.foto;
  // Cifras reales, calculadas de los proyectos: no hay que actualizarlas a mano
  const lf = projects.find((p) => (p.mono || []).length);
  // "Mi Casa con Subsidio" y "Micasaconsubsidio.cl" son la misma marca: se comparan sin espacios ni dominio
  const clave = (n) => n.toLowerCase().replace(/\.cl$/, '').replace(/[^a-z0-9]/g, '');
  const marcas = new Set([
    ...projects.filter((p) => p !== lf).map((p) => clave((p.cliente || p.titulo).split(' —')[0])),
    ...((lf && lf.mono) || []).map((m) => clave(m.nombre)),
  ]);
  const videos = projects
    .filter((p) => p.categoria === 'video')
    .reduce((n, p) => n + (p.galeria || []).filter((a) => /\.mp4$/i.test(a)).length, 0);
  // "cifras" en data/site.json manda (incluye trabajos que no están en el portafolio); si no hay, se calculan
  const cifras = (pf.cifras || []).length
    ? pf.cifras.map((x) => [x.numero, ...x.texto.split(/ (.*)/s).slice(0, 2)])
    : [
        [projects.length, 'Proyectos', 'realizados'],
        [marcas.size, 'Marcas', 'acompañadas'],
        [videos, 'Videos', 'editados'],
      ];
  const destacados = (pf.destacados || []).map((slug) => projects.find((p) => p.slug === slug)).filter(Boolean);
  const wa = waLink(site);
  const icono = (trazo) =>
    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${trazo}</svg>`;
  const fila = (trazo, texto, href) =>
    `<a class="perfil-contacto__fila" href="${esc(href)}"${/^https?:/.test(href) ? ' target="_blank" rel="noopener"' : ''}><i aria-hidden="true">${icono(trazo)}</i><span>${esc(texto)}</span></a>`;
  const body = `
<section class="perfil">
  <div class="perfil__barra">
    <p>${esc((pf.rol || '').split(' y ')[0])}<br><span>${esc(site.nombre)}</span></p>
    <p>${esc(pf.disponible || '')} <b aria-hidden="true">✦</b></p>
  </div>
  <div class="perfil__escena">
    <p class="perfil__fondo" aria-hidden="true">${esc(site.nombre.split(' ').pop())}</p>
    ${foto && exists(foto) ? `<img class="perfil__foto" src="/${esc(foto)}?v=${VERSION}" alt="Retrato de ${esc(pf.nombre || site.nombre)}"${sizeAttrs(foto)} decoding="async" fetchpriority="high">` : ''}
    <div class="perfil__texto">
      <p class="perfil__hola">${esc(pf.hola || '')}</p>
      <h1>${esc(pf.nombre || 'Sobre mí')}</h1>
      <p class="perfil__rol">${esc(pf.rol || '')}</p>
      <p class="perfil__intro">${esc(pf.intro || '')}</p>
    </div>
    <div class="perfil__lado">
      <p class="perfil__idea"><b aria-hidden="true">✦</b><span>${esc(pf.idea || '')}</span></p>
      <ul class="perfil__cifras">${cifras.map(([n, l1, l2]) => `<li><strong>${n}+</strong><span>${esc(l1)}<br>${esc(l2)}</span></li>`).join('')}</ul>
    </div>
  </div>
</section>

<section class="perfil-grilla">
  <div class="perfil-col">
    <h2>Herramientas y habilidades</h2>
    <p class="perfil-col__sub">Lo que hago</p>
    <ul class="perfil-etiquetas">${[
      ...new Set([...(site.servicios || []).map((x) => x.titulo), ...(site.habilidades || []).map((h) => h.nombre)].map((t) => t.trim())),
    ]
      .map((t) => `<li>${esc(t)}</li>`)
      .join('')}</ul>
    <p class="perfil-col__sub">Con qué lo hago</p>
    <ul class="perfil-herr">${(site.herramientas || [])
      .map((h) => {
        const nivel = Math.max(0, Math.min(100, Number(h.nivel) || 0));
        // Con "icono" (silueta) se dibuja el logo; si no, la sigla en el color de la app
        const logo = h.icono && exists(h.icono) ? `<i style="--icono:url('/${esc(h.icono)}')"></i>` : esc(h.sigla);
        return `<li data-app="${esc((h.sigla || '').toLowerCase())}"><span class="perfil-herr__logo" aria-hidden="true">${logo}</span><span class="perfil-herr__nombre">${esc(h.nombre)}</span><span class="perfil-herr__pct">${nivel}%</span><span class="perfil-herr__barra" role="meter" aria-label="Dominio de ${esc(h.nombre)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${nivel}"><i style="--nivel:${nivel / 100}"></i></span></li>`;
      })
      .join('')}</ul>
  </div>
  <div class="perfil-col">
    <h2>Cómo trabajo</h2>
    <ol class="perfil-pasos">${(pf.pasos || [])
      .map(
        (x, i) =>
          `<li><b>${String(i + 1).padStart(2, '0')}</b><i aria-hidden="true">${icono(ICONOS_PASO[x.icono] || '')}</i><span><strong>${esc(x.titulo)}</strong>${esc(x.texto)}</span></li>`
      )
      .join('')}</ol>
  </div>
  <figure class="perfil-cita">
    <span class="perfil-cita__comillas" aria-hidden="true">“</span>
    <blockquote>${esc(pf.cita || '')}</blockquote>
    <figcaption>${esc(pf.firma || '')}</figcaption>
    <a href="/contacto/">Forjemos tu marca <span aria-hidden="true">✦</span></a>
  </figure>
</section>

<section class="perfil-bloque">
  <div class="perfil-bloque__cab">
    <h2>Proyectos destacados</h2>
    <a href="/trabajos/">Ver todos los trabajos <span aria-hidden="true">⟶</span></a>
  </div>
  <div class="perfil-destacados">
    ${destacados
      .map(
        (p, i) => `<a class="perfil-destacado" href="/proyectos/${p.slug}/">
      <img src="/media/${p.slug}/${esc(p.portada)}" alt="${esc(p.titulo)}"${sizeAttrs(`media/${p.slug}/${p.portada}`)} loading="lazy" decoding="async">
      <span class="perfil-destacado__pie"><b>${String(i + 1).padStart(2, '0')}</b><span><strong>${esc(p.cliente || p.titulo)}</strong><small>${esc(CATEGORIAS[p.categoria])}</small></span><i aria-hidden="true">⟶</i></span>
    </a>`
      )
      .join('\n    ')}
  </div>
</section>

<section class="perfil-contacto">
  <div>
    <h2>Trabajemos<br>juntos <span aria-hidden="true">✦</span></h2>
    <p>${esc(pf.contacto || '')}</p>
    <a class="perfil-contacto__disp" href="${esc(wa)}" target="_blank" rel="noopener"><i aria-hidden="true">⟶</i>${esc(pf.disponible || '')}</a>
  </div>
  <div class="perfil-contacto__lista">
    ${fila('<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7.5 12 13.5l8.5-6"/>', site.email, `mailto:${site.email}`)}
    ${fila('<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>', `WhatsApp ${site.whatsappVisible || ''}`.trim(), wa)}
    ${site.url ? fila('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>', site.url.replace(/^https?:\/\//, ''), site.url) : ''}
  </div>
</section>`;
  return layout(site, {
    title: 'Sobre mí',
    description: pf.intro || (s.bio && s.bio[0]) || site.descripcion,
    urlPath: '/sobre-mi/',
    active: 'sobre-mi',
    body,
    // letra manuscrita para "Hola, soy" y la firma (solo en esta página)
    extraHead:
      '<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Mrs+Saint+Delafield&display=swap">',
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
  <p class="cabecera__bajada">¿Tienes una marca por forjar? Escríbeme y te respondo con una propuesta clara: qué haría, en cuánto tiempo y cuánto cuesta.</p>
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

// Brief estratégico: cuestionario por pasos que se envía al correo del estudio (Web3Forms, sin servidor propio;
// la clave "web3formsKey" de site.json solo permite enviar correos al estudio, por eso puede ir en la página).
// No aparece en el menú ni en Google: se comparte por enlace. Las preguntas están en data/brief.json.
function paginaBrief(site) {
  const b = readJson('data/brief.json');
  const total = b.secciones.length;
  const campo = (q) => {
    const id = `b-${q.id}`;
    const req = q.obligatoria ? ' required' : '';
    const titulo = `${esc(q.texto)}${q.obligatoria ? ' <i aria-hidden="true">*</i>' : ''}`;
    const ph = q.ayuda ? ` placeholder="${esc(q.ayuda)}"` : '';
    if (q.tipo === 'opcion' || q.tipo === 'varias') {
      const tipo = q.tipo === 'opcion' ? 'radio' : 'checkbox';
      return `<fieldset class="campo campo--opciones"><legend>${titulo}</legend><div class="opciones">${q.opciones
        .map((o) => `<label><input type="${tipo}" name="${q.id}" value="${esc(o)}"><span>${esc(o)}</span></label>`)
        .join('')}</div></fieldset>`;
    }
    if (q.tipo === 'corto' || q.tipo === 'tel' || q.tipo === 'email') {
      const tipo = q.tipo === 'corto' ? 'text' : q.tipo;
      const extra = q.tipo === 'email' || q.id === 'instagram' ? ' spellcheck="false" autocapitalize="off"' : '';
      return `<div class="campo"><label for="${id}">${titulo}</label><input id="${id}" name="${q.id}" type="${tipo}" autocomplete="${esc(q.autocomplete || 'off')}"${extra}${ph}${req}></div>`;
    }
    return `<div class="campo"><label for="${id}">${titulo}</label><textarea id="${id}" name="${q.id}" rows="3" autocomplete="off"${ph}${req}></textarea></div>`;
  };
  // Para el correo: cada respuesta llega con el texto de su pregunta
  const etiquetas = Object.fromEntries(b.secciones.flatMap((s) => s.preguntas.map((q) => [q.id, q.texto])));
  const body = `
<section class="cabecera cabecera--brief">
  <p class="etiqueta">${esc(b.titulo)}</p>
  <h1>${esc(b.lema)}</h1>
  <p class="cabecera__bajada">${esc(b.intro)}</p>
</section>
<section class="brief">
  <form class="brief__form" action="https://api.web3forms.com/submit" method="POST" data-total="${total}">
    <input type="hidden" name="access_key" value="${esc(site.web3formsKey || '')}">
    <input type="hidden" name="subject" value="Nuevo brief estratégico">
    <input type="hidden" name="from_name" value="Brief ${esc(site.nombre)}">
    <input type="checkbox" name="botcheck" class="solo-lectores" tabindex="-1" autocomplete="off" aria-hidden="true">
    <div class="brief__progreso" hidden>
      <div class="brief__barra"><span></span></div>
      <p aria-live="polite"></p>
    </div>
    ${b.secciones
      .map(
        (s, i) => `<fieldset class="brief__seccion" data-paso="${i}">
      <legend><b>${String(i + 1).padStart(2, '0')}</b>${esc(s.titulo)}</legend>
      <p class="brief__objetivo">${esc(s.objetivo)}</p>
      ${s.preguntas.map(campo).join('\n      ')}
    </fieldset>`
      )
      .join('\n    ')}
    <p class="brief__error" role="alert" hidden></p>
    <div class="brief__nav">
      <button class="boton boton--linea brief__atras" type="button" hidden>Atrás</button>
      <p class="brief__guardado">Tus respuestas se guardan en este dispositivo: puedes seguir después.</p>
      <button class="boton brief__siguiente" type="button" hidden>Siguiente</button>
      <button class="boton brief__enviar" type="submit">Enviar brief</button>
    </div>
  </form>
  <div class="brief__gracias" hidden tabindex="-1">
    <p class="etiqueta">Brief recibido</p>
    <h2>¡Gracias! Ya tengo tus respuestas.</h2>
    <p>Las reviso y te escribo en las próximas 24 a 48 horas con los siguientes pasos. Si quieres adelantar algo, escríbeme.</p>
    <a class="boton" href="${esc(waLink(site))}" target="_blank" rel="noopener">Escribir por WhatsApp</a>
  </div>
</section>
<script>window.BRIEF_ETIQUETAS = ${JSON.stringify(etiquetas).replace(/</g, '\\u003c')};</script>
<script src="/assets/js/brief.js?v=${VERSION}" defer></script>`;
  return layout(site, {
    title: b.titulo,
    description: b.intro,
    urlPath: '/brief/',
    body,
    extraHead: '<meta name="robots" content="noindex">',
  });
}

// Paquetes y precios (identidad y video): página que no está enlazada en el sitio; se comparte por enlace.
// Paquetes de identidad de marca: tarjetas con precio, comparación y condiciones. Cada paquete lleva al brief
// con ese paquete ya elegido. Los datos (data/paquetes.json) son los mismos del PDF de paquetes.
function paginaPaquetes(site) {
  const d = readJson('data/paquetes.json');
  const check =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const precio = (n) => `${n}<small>${esc(d.moneda)}</small>`;
  const celda = (v) =>
    v === true ? `<span class="si">${check}<span class="solo-lectores">Incluido</span></span>` : v === false ? '<span class="no" aria-label="No incluido">—</span>' : esc(v);
  const tarjeta = (p) => {
    const items = [...(p.estrategia ? [p.estrategia.titulo] : []), ...p.grupos.flatMap((g) => g.items.map(([t]) => t))];
    return `<article class="plan${p.recomendado ? ' plan--rec' : ''}">
      ${p.recomendado ? '<p class="plan__chip">Recomendado</p>' : ''}
      <h2>${esc(p.nombre)}</h2>
      <p class="plan__frase">${esc(p.frase)}</p>
      <p class="plan__precio">${precio(p.precio)}</p>
      <p class="plan__ideal"><b>Ideal para:</b> ${esc(p.ideal)}</p>
      <ul class="plan__lista">${items.map((t) => `<li>${check}<span>${esc(t)}</span></li>`).join('')}</ul>
      <p class="plan__cond">${p.cambios} cambios incluidos · ${p.anticipo}% de anticipo</p>
      <a class="boton${p.recomendado ? '' : ' boton--linea'} plan__boton" href="/brief/?paquete=${encodeURIComponent(p.nombre)}">Empezar con ${esc(p.nombre)}</a>
    </article>`;
  };
  const rec = d.paquetes.findIndex((p) => p.recomendado);
  const identidad = `
<section class="planes">
  ${d.paquetes.map(tarjeta).join('\n  ')}
</section>
<section class="compara-web">
  <h2>Compara en detalle</h2>
  <div class="compara-web__caja" tabindex="0" role="region" aria-label="Comparación de paquetes">
    <table>
      <thead><tr><th scope="col"><span class="solo-lectores">Concepto</span></th>${d.paquetes
        .map((p, i) => `<th scope="col"${i === rec ? ' class="dest"' : ''}>${esc(p.nombre)}<small>${p.precio} ${esc(d.moneda)}</small></th>`)
        .join('')}</tr></thead>
      <tbody>${d.compara
        .map((f) => `<tr><th scope="row">${esc(f[0])}</th>${f.slice(1).map((v, i) => `<td${i === rec ? ' class="dest"' : ''}>${celda(v)}</td>`).join('')}</tr>`)
        .join('')}</tbody>
    </table>
  </div>
  <p class="compara-web__nota">Precios en ${esc(d.moneda)}. Cada cambio adicional: ${d.cambioExtra} ${esc(d.moneda)}. Un cambio de concepto (empezar de cero) se cotiza aparte.</p>
</section>
<section class="condiciones">
  <div><h3>Pagos</h3><p>El anticipo para empezar y el resto al entregar. Acepto USDT por Binance o Zelle.</p></div>
  <div><h3>Cambios adicionales</h3><p>${d.cambioExtra} ${esc(d.moneda)} cada uno. Un cambio de concepto se cotiza aparte.</p></div>
  <div><h3>Archivos finales</h3><p>Se entregan al completar el pago.</p></div>
  <div><h3>Tiempo de entrega</h3><p>Lo acordamos al inicio, según el paquete y tus tiempos.</p></div>
</section>
<section class="paquetes-cta">
  <h2>¿No sabes cuál elegir?</h2>
  <p>Responde el brief y te recomiendo el paquete que mejor le queda a tu marca. Toma unos 15 minutos.</p>
  <div><a class="boton" href="/brief/">Responder el brief</a><a class="boton boton--linea" href="${esc(waLink(site))}" target="_blank" rel="noopener">Preguntar por WhatsApp</a></div>
</section>`;

  // Edición de video (data/video.json): precio por video y packs mensuales; cada botón abre WhatsApp con el plan escrito
  const v = readJson('data/video.json');
  const wa = (msg) => `https://wa.me/${site.whatsapp}?text=${encodeURIComponent(msg)}`;
  const num = (n) => (n % 1 ? n.toFixed(2).replace('.', ',') : String(n));
  const planVideo = (p) => `<article class="plan plan--video${p.recomendado ? ' plan--rec' : ''}">
      ${p.recomendado ? '<p class="plan__chip">Recomendado</p>' : ''}
      <p class="plan__grupo">${esc(p.grupo)}</p>
      <h2>${esc(p.nombre)}</h2>
      <p class="plan__frase">${esc(p.frase)}</p>
      <p class="plan__precio">${p.precio}<small>${esc(v.moneda)} ${esc(p.unidad)}</small></p>
      ${p.porVideo ? `<p class="plan__porvideo">${num(p.porVideo)} ${esc(v.moneda)} por video</p>` : ''}
      <p class="plan__ideal"><b>Ideal para:</b> ${esc(p.ideal)}</p>
      <ul class="plan__lista">${p.incluye.map((x) => `<li>${check}<span>${esc(x)}</span></li>`).join('')}</ul>
      <a class="boton${p.recomendado ? '' : ' boton--linea'} plan__boton" href="${esc(wa(p.mensaje))}" target="_blank" rel="noopener">${p.grupo === 'Por video' ? 'Pedir un video' : `Quiero el ${esc(p.nombre)}`}</a>
    </article>`;
  const video = `
<section class="planes planes--4">
  ${v.planes.map(planVideo).join('\n  ')}
</section>
<p class="compara-web__nota planes__nota">Precios en ${esc(v.moneda)}, para videos de ${esc(v.duracionBase)}.</p>
<section class="extras">
  <h2>Extras</h2>
  <ul>${v.extras.map(([t, pr]) => `<li><span>${esc(t)}</span><b>${esc(pr)}</b></li>`).join('')}</ul>
</section>
<section class="condiciones">
  ${v.condiciones.map(([t, x]) => `<div><h3>${esc(t)}</h3><p>${esc(x)}</p></div>`).join('\n  ')}
</section>
<section class="paquetes-cta">
  <h2>¿Tienes un video en mente?</h2>
  <p>Cuéntame qué grabaste y para qué red es; te digo qué edición le queda mejor.</p>
  <div><a class="boton" href="${esc(wa('Hola Roger, quiero editar un video.'))}" target="_blank" rel="noopener">Escribir por WhatsApp</a><a class="boton boton--linea" href="/trabajos/#video">Ver videos editados</a></div>
</section>`;

  const body = `
<section class="cabecera cabecera--brief">
  <p class="etiqueta">Precios</p>
  <h1>Paquetes</h1>
  <p class="cabecera__bajada">Elige el servicio y el paquete que necesita tu marca hoy. Si no estás seguro, escríbeme y te recomiendo el correcto.</p>
  <div class="pestanas" role="tablist" aria-label="Servicios">
    <a class="pestanas__btn" role="tab" href="#identidad" id="tab-identidad" aria-controls="identidad" aria-selected="true">Identidad de marca</a>
    <a class="pestanas__btn" role="tab" href="#video" id="tab-video" aria-controls="video" aria-selected="false">Edición de video</a>
  </div>
</section>
<div class="panel-servicio" id="identidad" role="tabpanel" aria-labelledby="tab-identidad">${identidad}</div>
<div class="panel-servicio" id="video" role="tabpanel" aria-labelledby="tab-video">${video}</div>
<script src="/assets/js/paquetes.js?v=${VERSION}" defer></script>`;
  return layout(site, {
    title: 'Paquetes y precios',
    description: `Paquetes de identidad de marca (${d.paquetes.map((p) => `${p.nombre} ${p.precio} ${d.moneda}`).join(', ')}) y edición de video (desde ${Math.min(...v.planes.map((p) => p.precio))} ${v.moneda} por video) de ${site.nombre}.`,
    urlPath: '/paquetes/',
    body,
    // No aparece en el menú ni en Google: Roger comparte el enlace cuando un cliente pregunta precios
    extraHead: '<meta name="robots" content="noindex">',
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
  write('sobre-mi/index.html', paginaSobreMi(site, projects));
  write('contacto/index.html', paginaContacto(site));
  write('paquetes/index.html', paginaPaquetes(site));
  write('brief/index.html', paginaBrief(site));
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
