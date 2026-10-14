// Versiones livianas (2048px máx, WebP) de las portadas del carrusel.
// Las URLs originales siguen siendo la clave en toda la app; solo cambia lo que se descarga.
const COVER_MAP = {
  "./images/CALDO/CALDO-1 (PORTADA).jpg": "/images/covers/cover-00.webp",
  "./images/blua_constelaciones_finales.jpg": "/images/covers/cover-01.webp",
  "./images/PLATA/PLATA-2.jpg": "/images/covers/cover-02.webp",
  "./images/CAT-17.jpg": "/images/covers/cover-03.webp",
  "./images/NWB&W-09.jpg": "/images/covers/cover-04.webp",
  "./images/S-1.jpg": "/images/covers/cover-05.webp",
  "./images/MDLST/MDLST-1.png": "/images/covers/cover-06.webp",
  "./images/TEO/V1.jpg": "/images/covers/cover-07.webp",
  "./images/LENOIR/LENOIR-1.jpg": "/images/covers/cover-08.webp",
  "./images/KABOA/KABOA-1.jpg": "/images/covers/cover-09.webp",
  "./images/AMOUR/portada.jpg": "/images/covers/cover-10.webp",
  "./images/MARCOS/MARCOSMUF-5 (PORTADA).jpg": "/images/covers/cover-11.webp",
  "./images/PASARELA/PASARELA MUF-12(PORTADA).jpg": "/images/covers/cover-12.webp",
  "./images/IDENTIDAD/IDENTIDAD MUF-1 (PORTADA).jpg": "/images/covers/cover-13.webp",
  "./images/X/@enzocimillo_ex-_1.jpg": "/images/covers/cover-14.webp",
};

export const optimizedCover = (url) => COVER_MAP[url] || url;
