# Portafolio — Studio Herre

Sitio estático (HTML, CSS y JS, sin frameworks ni base de datos). Las páginas se generan a partir de dos archivos de datos con un script de Node sin dependencias (`build.js`), que Vercel ejecuta solo en cada publicación.

## Estructura

```
data/projects.json   ← todos los proyectos (lo único que tocas para agregar trabajos)
data/site.json       ← tu nombre, frase, bio, contacto y redes
media/<proyecto>/    ← imágenes WebP y reels MP4 de cada proyecto
media/site/          ← tu foto (nacho.webp) e imagen para compartir (og.jpg)
assets/              ← diseño: css/styles.css y js/main.js
build.js             ← genera el sitio en dist/
tools/preparar_imagenes.py  ← convierte tus imágenes a WebP
```

## Agregar un proyecto nuevo

**1. Prepara los archivos.** Junta en una carpeta las imágenes originales (JPG/PNG) y, si hay, los reels en MP4. Nombra `portada` a la imagen principal. Luego:

```bash
python tools/preparar_imagenes.py "C:\ruta\a\la\carpeta" nombre-del-proyecto
```

Esto crea `media/nombre-del-proyecto/` con `cover.webp`, `01.webp`, `02.webp`…, `og.jpg` (la imagen que aparece al compartir el link por WhatsApp) y copia los reels como `reel-01.mp4`… Al final imprime las líneas `portada` y `galeria` listas para pegar.

**2. Agrega el bloque en `data/projects.json`.** Copia uno existente y cámbiale los datos. El orden del archivo es el orden en el sitio (pon los nuevos arriba).

```json
{
  "slug": "nombre-del-proyecto",
  "titulo": "Nombre visible",
  "cliente": "Cliente",
  "categoria": "video",
  "anio": 2026,
  "resumen": "Una línea. Se usa como descripción al compartir el link.",
  "contexto": "Qué necesitaba el cliente.",
  "queHice": ["Tarea 1", "Tarea 2"],
  "resultado": "Qué se logró.",
  "portada": "cover.webp",
  "portadaVideo": "reel-01.mp4",
  "youtube": "ID_DEL_VIDEO",
  "galeria": ["01.webp", "02.webp", "reel-01.mp4"]
}
```

| Campo | Notas |
| --- | --- |
| `slug` | Igual al nombre de la carpeta en `media/`. Minúsculas, sin espacios ni tildes. Es la URL: `/proyectos/slug/`. |
| `categoria` | `rrss` (Social media), `video`, `identidad` (Identidad de marca) o `logos` (Logofolio). Define en qué sección numerada del inicio aparece y en qué vista de Trabajos. |
| `rubro` | Opcional. A qué se dedica el cliente ("Agencia de viajes"). Se muestra junto al año en las láminas de Trabajos y en el escenario de marcas del inicio. |
| `manual` | Opcional. Número de páginas de un manual de marca guardado en `media/<slug>/manual/` (`01.webp` grande y `m01.webp` miniatura por página). Activa el mosaico inclinado en la página del proyecto. |
| `youtube` | Opcional. Solo el ID: en `https://youtu.be/aqz-KE-bpKQ` es `aqz-KE-bpKQ`. Funciona con videos "No listado". |
| `portadaVideo` | Opcional. Un reel que se reproduce en loop en la tarjeta del proyecto. |
| `galeria` | Lista de archivos de la carpeta del proyecto. Los `.mp4` se muestran en loop y sin sonido. |
| `videos` | Opcional, para proyectos de video. Enlaza cada adelanto con su video completo en YouTube: `{"reel-01.mp4": "ID_DEL_VIDEO"}`. El adelanto mudo pasa a tener botón de play y abre el video con sonido. Sirve con Shorts "No listados". |
| `pies` | Opcional. Texto bajo una imagen, por nombre de archivo: `{"01.webp": "Rogienny Herrera · Marca personal"}`. |
| `laminas` | Opcional. Fichas de marca (imágenes altas) que se muestran al final de la página, en mosaico. |
| `mono` | Opcional (logofolio). Logos a una tinta con fondo transparente: `[{"archivo": "mono-01.webp", "nombre": "Marca", "ancho": 640, "alto": 497}]`. Se usan en la lámina crema del inicio y en la cinta de marcas. |

**3. Revisa y publica.**

```bash
node build.js --serve
```

Abre http://localhost:3000. Si falta un archivo o hay un error en el JSON, el script lo dice. Cuando esté bien:

```bash
git add .
```

```bash
git commit -m "Agrega proyecto nombre-del-proyecto"
```

```bash
git push
```

Vercel publica solo en un minuto aprox.

## Cómo se muestra cada proyecto

- **Inicio:** cada categoría es una sección numerada. Social media usa el escenario donde las marcas se turnan (toma las primeras piezas de cada proyecto `rrss`); Videos e Identidad son cintas en movimiento; Logofolio es la lámina crema con los logos `mono`.
- **Trabajos:** no hay tarjetas ni vista "Todos". Cada categoría tiene su vista de láminas (texto + mosaico de piezas) y se abre con `/trabajos/#rrss`, `#video` o `#identidad`. Una lámina de social media necesita al menos 5 imágenes en `galeria`; la de identidad, un `manual`. Una categoría con un solo proyecto (hoy Logofolio) abre directo la página de ese proyecto.
- **Página del proyecto:** identidad muestra el mosaico de páginas del manual; social media, el mosaico de publicaciones; video, sus videos arriba en carrusel con flechas.
- **Botones de cotizar:** cada vista de Trabajos y la página de Logofolio cierran con un botón que abre WhatsApp con un mensaje propio. Las frases están en `build.js` (busca `cierres`).

## Reels y videos

- **Reels (MP4 en el repo):** exporta en H.264, 720×1280, sin audio, 5–15 s, idealmente menos de 2–3 MB cada uno. En Media Encoder: formato H.264, VBR 1 pasada, ~1,5 Mbps, desmarcar "Exportar audio".
- **Póster del reel (opcional):** una imagen con el mismo nombre (`reel-01.webp`) se muestra mientras carga el video.
- **Videos largos:** súbelos a YouTube como "No listado" y pon el ID en `youtube`. El reproductor se carga recién al hacer clic, sin videos sugeridos de otros canales.

## Cambiar tus datos, foto y colores

- Textos, contacto y redes: `data/site.json`. Las redes con `"url": ""` no se muestran.
- Sección "Así trabajo" del inicio: bloque `proceso` en `data/site.json` (pasos, plazo, texto del botón y mensaje de WhatsApp). Si lo borras, la sección desaparece. Cada paso puede llevar una animación con `"grafico"`: `celular`, `timeline` o `dias`.
- Habilidades técnicas (bloque naranja en Sobre mí): lista `habilidades` en `data/site.json`. Íconos disponibles: `pluma`, `motion`, `video`, `redes`, `marca`.
- Secciones del inicio (01 Social media, 02 Videos, 03 Identidad de marca, 04 Logofolio): lista `secciones` en `data/site.json`. Ahí se cambian el nombre, el texto de la barra y el orden. Cada una elige cómo se muestra: `"collage": true` (escenario de marcas), `"cinta": true` (tira en movimiento; con `"curva": true` va en anillo curvo en escritorio y `"ritmo"` son los segundos por pieza), `"soloCinta": true` (sin nada más debajo) o `"rejilla": true` (lámina de logos). Sin ninguna, la sección muestra un carrusel de tarjetas.
- Textos de la voz del sitio: `intro`, `servicios` y `sobreMi.bio` en `data/site.json`. Todo va en primera persona ("yo"); evita mezclar con "hacemos".
- Tarjetas "En qué te puedo ayudar": lista `servicios` en `data/site.json`; el título se cambia en `serviciosTitulo`. Con `categoria`, la tarjeta enlaza a esa sección del inicio.
- Programas que usas: lista `herramientas` en `data/site.json` (sigla, nombre y `nivel` de 0 a 100, que define cuánto se llena el anillo). Si la dejas vacía (`[]`), la sección desaparece. Para mostrar un logo en vez de la sigla, agrega `"icono"` con la ruta a una silueta en WebP/PNG con fondo transparente (ver CapCut como ejemplo); se pinta sola con el color de acento.
- Foto de Sobre mí: reemplaza `media/site/nacho.webp` (vertical, ~1200×1500).
- Foto del inicio: `media/site/retrato-inicio.webp`, un recorte transparente que ya trae su círculo con la cabeza saliendo por arriba. Si la cambias, ajusta `fotoInicioCirculo` (centro y radio del círculo en píxeles de la imagen) en `data/site.json`.
- Imagen al compartir el inicio: `media/site/og.jpg` (1200×630).
- Colores y degradados: variables al inicio de `assets/css/styles.css`. `--grad-fondo` es el fondo del sitio (Noche en oscuro; crema con un resplandor suave en claro), `--grad-hero` el del inicio (Atardecer, solo en oscuro) y `--grad-fuego` el de las formas naranjas.
- Tipografías: Clash Display (títulos) y Satoshi (textos), cargadas desde [Fontshare](https://www.fontshare.com/). Para cambiarlas, edita el enlace de Fontshare en `build.js` y los nombres en `--titulos` y `--sans`.

## Publicar en Vercel (una sola vez)

1. Entra a https://vercel.com y crea una cuenta con **Continue with GitHub**.
2. **Add New… → Project** y elige el repo `portafolio` (si no aparece, "Adjust GitHub App Permissions" y dale acceso).
3. No cambies nada: la configuración ya viene en `vercel.json`. Clic en **Deploy**.
4. Listo. Desde ahí, cada `git push` a `main` actualiza el sitio.

Dominio propio: en Vercel, **Settings → Domains**. Si lo agregas, escribe la dirección en `"url"` de `data/site.json` (ej: `"https://nacho.cl"`) para que los links compartidos usen ese dominio.
