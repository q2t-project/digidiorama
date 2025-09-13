async function loadManifest() {
  const res = await fetch('assets/manifest.json');
  return res.json();
}

function getQueryParam(name) {
  return new URLSearchParams(location.search).get(name);
}

(async () => {
  const manifest = await loadManifest();
  const sel = document.getElementById('dataset');
  manifest.forEach((m, i) => {
    const opt = document.createElement('option');
    opt.value = m.file;
    opt.textContent = `${m.title} (${m.file})`;
    sel.appendChild(opt);
  });

  const initial = getQueryParam('file') || (manifest[0] && manifest[0].file);
  if (initial) sel.value = initial;

  sel.addEventListener('change', () => {
    const file = sel.value;
    const url = new URL(location.href);
    url.searchParams.set('file', file);
    history.replaceState(null, '', url.toString());
    console.log('[digigiorama] selected', file);
  });

  console.log('[digigiorama] manifest loaded:', manifest);
  console.log('[digigiorama] initial file:', initial);
})();
