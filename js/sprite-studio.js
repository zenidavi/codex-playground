import { loadSpriteFile, walkingFrame } from './sprite-sheet.js';
import { readSprite, writeSprite, deleteSprite } from './sprite-storage.js';
import { pokemonArt } from './pixel-art.js';
import { STARTERS, SPECIES } from './data.js';

export function mountSpriteStudio({ world, onChanged, onMessage, getPartner }) {
  const $ = id => document.getElementById(id);
  const dialog = $('sprite-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const states = new Map(STARTERS.map(species => [species, {
    candidate: null, installed: null, source: null, filename: '', generation: 0,
    loading: false, applying: false, hideBackground: true, saved: false,
    notice: '', error: false, portrait: pokemonArt(species).toDataURL(),
  }]));
  let selected = STARTERS.includes(getPartner()) ? getPartner() : 'charmander';
  let direction = 'down', walking = !reduced, frameId, animationStart = performance.now();

  $('sprite-species-list').innerHTML = STARTERS.map(species => `<button data-sprite-species="${species}" aria-pressed="false" aria-label="Editar sprites de ${SPECIES[species].name}"><img src="${states.get(species).portrait}" width="36" height="36" alt=""><span><strong>${SPECIES[species].name}</strong><small>Original</small></span></button>`).join('');

  function render() {
    const state = states.get(selected), name = SPECIES[selected].name;
    $('sprite-selected-name').textContent = `Seu ${name}.`;
    $('sprite-preview').setAttribute('aria-label', `Prévia animada do ${name}`);
    $('sprite-apply').innerHTML = `Aplicar ao ${name} <span>→</span>`;
    $('sprite-apply').disabled = state.loading || state.applying || !state.candidate;
    $('sprite-remove').disabled = state.loading || state.applying || !state.installed;
    $('sprite-file').disabled = state.applying;
    $('sprite-hide-background').disabled = state.applying;
    $('sprite-hide-background').checked = state.hideBackground;
    $('sprite-feedback').textContent = state.notice;
    $('sprite-feedback').classList.toggle('error', state.error);
    $('sprite-file-info').textContent = state.source
      ? `${state.filename} · ${state.saved ? 'imagem salva neste navegador' : `${state.candidate?.image.naturalWidth || '?'} × ${state.candidate?.image.naturalHeight || '?'} · 16 quadros`}`
      : 'Folha quadrada de 4 × 4 quadros · até 2048 × 2048 e 8 MB.';
    $('sprite-partner-note').textContent = getPartner() && getPartner() !== selected
      ? 'Seu parceiro atual é outro Pokémon. Aplicar esta arte não troca seu parceiro nem apaga seu progresso.'
      : `A arte será usada no cenário, no retrato do parceiro e nas vistas de batalha do ${name}.`;
    for (const button of dialog.querySelectorAll('[data-sprite-species]')) {
      const entry = states.get(button.dataset.spriteSpecies);
      button.setAttribute('aria-pressed', String(button.dataset.spriteSpecies === selected));
      button.querySelector('img').src = entry.portrait;
      button.querySelector('small').textContent = entry.installed ? 'Personalizado' : 'Original';
    }
  }
  function message(species, text, error = false) {
    Object.assign(states.get(species), { notice: text, error });
    if (selected === species) render();
  }
  function select(species) {
    if (!states.has(species)) return;
    selected = species; animationStart = performance.now();
    $('sprite-file').value = '';
    render();
  }
  function draw(time) {
    const canvas = $('sprite-preview'), ctx = canvas.getContext('2d'), state = states.get(selected);
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.imageSmoothingEnabled = false;
    const frame = walkingFrame((time - animationStart) / 1000, walking, reduced);
    const art = (state.candidate || state.installed)?.frame(direction, frame) || pokemonArt(selected, direction === 'up');
    ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
    if (dialog.open) frameId = requestAnimationFrame(draw);
  }
  async function prepare(species, blob, name) {
    const state = states.get(species), token = ++state.generation;
    Object.assign(state, { loading: true, candidate: null, source: blob, filename: name, saved: false });
    message(species, 'Preparando sua prévia…');
    try {
      const sheet = await loadSpriteFile(blob, { hideBackground: state.hideBackground });
      if (token !== state.generation) return;
      state.candidate = sheet;
      message(species, `Prévia pronta. Confira as direções e clique em Aplicar ao ${SPECIES[species].name}.`);
    } catch (error) {
      if (token !== state.generation) return;
      state.source = null; state.filename = '';
      message(species, error.message, true);
    } finally {
      if (token === state.generation) { state.loading = false; if (selected === species) render(); }
    }
  }
  function install(species, sheet) {
    const state = states.get(species);
    state.installed = sheet; state.portrait = sheet.frame('down').toDataURL();
    world.installPokemonSheet(species, sheet); onChanged(species, sheet);
  }
  $('sprite-species-list').addEventListener('click', event => {
    const button = event.target.closest('[data-sprite-species]');
    if (button) select(button.dataset.spriteSpecies);
  });
  $('sprite-file').addEventListener('change', () => {
    const file = $('sprite-file').files[0];
    if (file) void prepare(selected, file, file.name);
  });
  $('sprite-hide-background').addEventListener('change', () => {
    const state = states.get(selected); state.hideBackground = $('sprite-hide-background').checked;
    if (state.source) void prepare(selected, state.source, state.filename);
  });
  for (const button of dialog.querySelectorAll('[data-preview-direction]')) button.addEventListener('click', () => {
    direction = button.dataset.previewDirection;
    for (const item of dialog.querySelectorAll('[data-preview-direction]')) item.setAttribute('aria-pressed', String(item === button));
  });
  $('sprite-walking').setAttribute('aria-pressed', String(walking));
  $('sprite-walking').textContent = walking ? 'Pausar caminhada' : 'Animar caminhada';
  $('sprite-walking').disabled = reduced;
  $('sprite-walking').addEventListener('click', () => {
    walking = !walking; animationStart = performance.now();
    $('sprite-walking').setAttribute('aria-pressed', String(walking));
    $('sprite-walking').textContent = walking ? 'Pausar caminhada' : 'Animar caminhada';
  });
  $('sprite-apply').addEventListener('click', async () => {
    const species = selected, state = states.get(species), name = SPECIES[species].name;
    if (!state.candidate || state.loading || state.applying) return;
    state.applying = true; render(); install(species, state.candidate);
    const record = { version: 1, species, blob: state.source, filename: state.filename, hideBackground: state.hideBackground };
    try {
      await writeSprite(record, species); state.saved = true;
      const partner = getPartner();
      message(species, partner === species ? 'Aplicado! Feche esta janela e caminhe para ver sua arte no cenário.' : partner ? `Aplicado ao ${name}. Sua jornada atual foi preservada; escolha ${name} ao iniciar outra aventura para vê-lo no mapa.` : `Aplicado! Comece uma jornada com ${name} para ver sua arte no cenário.`);
      onMessage(`Visual do ${name} salvo neste navegador.`);
    } catch { message(species, 'Visual aplicado nesta sessão. O navegador não permitiu salvar a imagem para a próxima visita.'); }
    finally { state.applying = false; if (selected === species) render(); }
  });
  $('sprite-remove').addEventListener('click', async () => {
    const species = selected, state = states.get(species);
    if (!state.installed || state.loading || state.applying) return;
    Object.assign(state, { applying: true, installed: null, candidate: null, source: null, filename: '', saved: false, portrait: pokemonArt(species).toDataURL() });
    state.generation++;
    render(); world.removePokemonSheet(species); onChanged(species, null);
    $('sprite-file').value = '';
    try { await deleteSprite(species); message(species, `O visual original do ${SPECIES[species].name} foi restaurado.`); }
    catch { message(species, 'Visual original nesta sessão. O navegador não permitiu apagar a imagem salva.'); }
    finally { state.applying = false; if (selected === species) render(); }
  });
  dialog.addEventListener('close', () => cancelAnimationFrame(frameId));
  render();
  const ready = Promise.allSettled(STARTERS.map(async species => {
    const state = states.get(species), token = state.generation;
    try {
      const record = await readSprite(species);
      if (!record || record.version !== 1 || (record.species && record.species !== species)) return;
      const sheet = await loadSpriteFile(record.blob, { hideBackground: record.hideBackground === true });
      if (state.generation !== token || state.source || state.applying) return;
      Object.assign(state, { candidate: sheet, source: record.blob, filename: record.filename || `${SPECIES[species].name} salvo`, hideBackground: record.hideBackground === true, saved: true });
      install(species, sheet);
      message(species, `Seu visual salvo do ${SPECIES[species].name} foi restaurado.`);
      render();
    } catch { /* Each optional image fails independently; the game stays playable. */ }
  }));
  return {
    ready,
    open() {
      cancelAnimationFrame(frameId);
      if (STARTERS.includes(getPartner())) select(getPartner());
      else render();
      animationStart = performance.now(); frameId = requestAnimationFrame(draw);
    },
  };
}
