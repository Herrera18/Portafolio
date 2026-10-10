"""Convierte las imágenes de un proyecto a WebP liviano y las deja en media/<slug>/.

Uso:
    python tools/preparar_imagenes.py "C:\\ruta\\a\\carpeta-con-originales" mi-proyecto

- La imagen llamada "cover" o "portada" (o la primera, si no hay) pasa a ser cover.webp
  y de ella sale og.jpg, la imagen que se ve al compartir el link por WhatsApp.
- El resto se numera 01.webp, 02.webp... en orden alfabético.
- Los .mp4 se copian tal cual (expórtalos ya livianos, ver README).

Requiere Pillow:  pip install pillow
"""

import re
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageOps

RAIZ = Path(__file__).resolve().parent.parent
ANCHO_MAX = 1600
CALIDAD = 80
EXT_IMG = {".jpg", ".jpeg", ".png", ".webp", ".tif", ".tiff", ".bmp"}


def abrir(ruta):
    img = ImageOps.exif_transpose(Image.open(ruta))
    return img.convert("RGBA" if "A" in img.getbands() else "RGB")


def guardar_webp(img, destino, ancho_max=ANCHO_MAX):
    if img.width > ancho_max:
        img = img.resize((ancho_max, round(img.height * ancho_max / img.width)), Image.LANCZOS)
    img.save(destino, "WEBP", quality=CALIDAD, method=6)
    print(f"  {destino.name:<14} {img.width}x{img.height}  {destino.stat().st_size // 1024} KB")


def main():
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    origen, slug = Path(sys.argv[1]), sys.argv[2]
    if not origen.is_dir():
        sys.exit(f"No existe la carpeta: {origen}")
    if not re.fullmatch(r"[a-z0-9]+(-[a-z0-9]+)*", slug):
        sys.exit('El nombre del proyecto va en minúsculas, sin espacios ni tildes (ej: "cafe-origen").')

    destino = RAIZ / "media" / slug
    destino.mkdir(parents=True, exist_ok=True)

    imagenes = sorted(p for p in origen.iterdir() if p.suffix.lower() in EXT_IMG)
    videos = sorted(p for p in origen.iterdir() if p.suffix.lower() == ".mp4")
    if not imagenes:
        sys.exit("No encontré imágenes en esa carpeta.")

    portada = next((p for p in imagenes if p.stem.lower() in ("cover", "portada")), imagenes[0])
    resto = [p for p in imagenes if p != portada]

    print(f"media/{slug}/")
    img = abrir(portada)
    guardar_webp(img, destino / "cover.webp")
    ImageOps.fit(img.convert("RGB"), (1200, 630), Image.LANCZOS).save(destino / "og.jpg", quality=82, optimize=True)
    print("  og.jpg         1200x630")

    galeria = []
    for i, ruta in enumerate(resto, 1):
        nombre = f"{i:02d}.webp"
        guardar_webp(abrir(ruta), destino / nombre)
        galeria.append(nombre)
    for i, ruta in enumerate(videos, 1):
        nombre = f"reel-{i:02d}.mp4"
        shutil.copyfile(ruta, destino / nombre)
        print(f"  {nombre:<14} {(destino / nombre).stat().st_size // 1024} KB")
        galeria.append(nombre)

    lista = ", ".join(f'"{g}"' for g in galeria)
    print(f'\nCopia esto en data/projects.json:\n    "portada": "cover.webp",\n    "galeria": [{lista}]')


if __name__ == "__main__":
    main()
