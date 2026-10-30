// Brief estratégico: muestra una sección a la vez, guarda lo escrito en el navegador y envía las respuestas al correo.
// Sin JavaScript el formulario se ve completo y se envía igual (Web3Forms recibe el POST normal).
(() => {
  const form = document.querySelector('.brief__form');
  if (!form) return;
  const secciones = [...form.querySelectorAll('.brief__seccion')];
  const total = secciones.length;
  const progreso = form.querySelector('.brief__progreso');
  const barra = progreso.querySelector('.brief__barra span');
  const estado = progreso.querySelector('p');
  const atras = form.querySelector('.brief__atras');
  const siguiente = form.querySelector('.brief__siguiente');
  const enviar = form.querySelector('.brief__enviar');
  const error = form.querySelector('.brief__error');
  const gracias = document.querySelector('.brief__gracias');
  const CLAVE = 'brief-herre';
  const INTERNOS = ['access_key', 'subject', 'from_name', 'botcheck']; // campos del servicio, no respuestas
  let paso = 0;

  // --- Guardar y recuperar lo escrito (solo en este dispositivo) ---
  const leer = () => {
    const datos = {};
    new FormData(form).forEach((v, k) => {
      if (INTERNOS.includes(k)) return;
      datos[k] = k in datos ? [].concat(datos[k], v) : v;
    });
    return datos;
  };
  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({ paso, datos: leer() }));
    } catch (e) {}
  };
  try {
    const previo = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (previo) {
      Object.entries(previo.datos || {}).forEach(([k, v]) => {
        const valores = [].concat(v);
        form.querySelectorAll(`[name="${CSS.escape(k)}"]`).forEach((el) => {
          if (el.type === 'radio' || el.type === 'checkbox') el.checked = valores.includes(el.value);
          else el.value = valores[0];
        });
      });
      paso = Math.min(Number(previo.paso) || 0, total - 1);
    }
  } catch (e) {}
  form.addEventListener('input', guardar);
  form.addEventListener('change', guardar);

  // --- Pasos ---
  const mostrar = (n, enfocar) => {
    paso = Math.max(0, Math.min(n, total - 1));
    n = paso;
    secciones.forEach((s, i) => (s.hidden = i !== n));
    const titulo = secciones[n].querySelector('legend').textContent.replace(/^\d+/, '');
    barra.style.width = `${((n + 1) / total) * 100}%`;
    estado.textContent = `Paso ${n + 1} de ${total} · ${titulo}`;
    atras.hidden = n === 0;
    siguiente.hidden = n === total - 1;
    enviar.hidden = n !== total - 1;
    error.hidden = true;
    if (enfocar) {
      form.closest('.brief').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
      secciones[n].querySelector('input, textarea').focus({ preventScroll: true });
    }
    guardar();
  };
  // Antes de avanzar, revisa los obligatorios de la sección actual
  const valida = () => {
    const campos = [...secciones[paso].querySelectorAll('input, textarea')];
    const malo = campos.find((c) => !c.checkValidity());
    if (malo) {
      malo.reportValidity();
      malo.focus();
      return false;
    }
    return true;
  };
  progreso.hidden = false;
  form.classList.add('brief__form--pasos');
  atras.addEventListener('click', () => mostrar(paso - 1, true));
  siguiente.addEventListener('click', () => valida() && mostrar(paso + 1, true));
  // Enter en un campo corto avanza en vez de enviar todo
  form.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('input') && paso < total - 1) {
      e.preventDefault();
      siguiente.click();
    }
  });
  mostrar(paso, false);

  // --- Envío ---
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!valida()) return;
    const etiquetas = window.BRIEF_ETIQUETAS || {};
    const datos = leer();
    const cuerpo = {
      access_key: form.elements.access_key.value,
      subject: `Brief estratégico — ${datos.marca || 'Nueva marca'}`,
      from_name: `${datos.nombre || 'Cliente'} · ${datos.marca || 'Brief'}`,
      botcheck: form.elements.botcheck.checked,
    };
    if (datos.correo) cuerpo.replyto = datos.correo;
    Object.entries(datos).forEach(([k, v]) => {
      cuerpo[etiquetas[k] || k] = [].concat(v).join(', ').trim() || '—';
    });
    enviar.disabled = true;
    enviar.textContent = 'Enviando…';
    error.hidden = true;
    try {
      const r = await fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(cuerpo),
      });
      const res = await r.json().catch(() => ({}));
      if (!r.ok || String(res.success) === 'false') throw new Error(res.message || r.status);
      try {
        localStorage.removeItem(CLAVE);
      } catch (e2) {}
      form.hidden = true;
      gracias.hidden = false;
      gracias.scrollIntoView({ block: 'center' });
      gracias.focus({ preventScroll: true });
    } catch (err) {
      const motivo = String(err.message || '');
      error.textContent = `No se pudo enviar. Revisa tu conexión e inténtalo otra vez; tus respuestas siguen guardadas.${motivo ? ` (Detalle: ${motivo})` : ''}`;
      error.hidden = false;
      enviar.disabled = false;
      enviar.textContent = 'Enviar brief';
    }
  });
})();
