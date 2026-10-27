import { loadSpriteFile, walkingFrame } from './sprite-sheet.js';
import { readSprite, writeSprite, deleteSprite } from './sprite-storage.js';
import { pokemonArt } from './pixel-art.js';

export function mountSpriteStudio({ world, onChanged, onMessage, getPartner }) {
  const $ = id => document.getElementById(id);
  const dialog = $('sprite-dialog');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let candidate = null, installed = null, source = null, filename = '', generation = 0;
  let direction = 'down', walking = !reduced, frameId, animationStart = performance.now();
  let loading = false, applying = false;
  const message = (text, error = false) => {
    $('sprite-feedback').textContent = text;
    $('sprite-feedback').classList.toggle('error', error);
  };
  const controls = () => {
    $('sprite-apply').disabled = loading || applying || !candidate;
    $('sprite-remove').disabled = loading || applying || !installed;
    $('sprite-file').disabled = applying;
    $('sprite-hide-background').disabled = applying;
  };
  function draw(time) {
    const canvas = $('sprite-preview'), ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    const frame = walkingFrame((time - animationStart) / 1000, walking, reduced);
    const art = (candidate || installed)?.frame(direction, frame) || pokemonArt('charmander', direction === 'up');
    ctx.drawImage(art, 0, 0, canvas.width, canvas.height);
    if (dialog.open) frameId = requestAnimationFrame(draw);
  }
  async function prepare(blob, name) {
    const token = ++generation;
    loading = true; candidate = null; source = blob; filename = name; controls();
    message('Preparando sua prévia…');
    try {
      const sheet = await loadSpriteFile(blob, { hideBackground: $('sprite-hide-background').checked });
      if (token !== generation) return;
      candidate = sheet;
      $('sprite-file-info').textContent = `${name} · ${sheet.image.naturalWidth} × ${sheet.image.naturalHeight} · 16 quadros`;
      message('Prévia pronta. Confira as direções e clique em Aplicar ao Charmander.');
    } catch (error) {
      if (token !== generation) return;
      source = null; filename = ''; $('sprite-file-info').textContent = 'Nenhuma nova imagem selecionada.';
      message(error.message, true);
    } finally { if (token === generation) { loading = false; controls(); } }
  }
  $('sprite-file').addEventListener('change', () => {
    const file = $('sprite-file').files[0];
    if (file) void prepare(file, file.name);
  });
  $('sprite-hide-background').addEventListener('change', () => { if (source) void prepare(source, filename); });
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
    if (!candidate || loading || applying) return;
    applying = true; controls();
    installed = candidate; world.installPokemonSheet('charmander', installed); onChanged(installed);
    const record = { version: 1, blob: source, filename, hideBackground: $('sprite-hide-background').checked };
    try {
      await writeSprite(record);
      const partner = getPartner();
      message(partner === 'charmander' ? 'Aplicado! Feche esta janela e caminhe para ver sua arte no cenário.' : partner ? 'Aplicado ao Charmander. Sua jornada atual foi preservada; escolha Charmander ao iniciar outra aventura para vê-lo no mapa.' : 'Aplicado! Comece uma jornada com Charmander para ver sua arte no cenário.');
      onMessage('Visual do Charmander salvo neste navegador.');
    } catch {
      message('Visual aplicado nesta sessão. O navegador não permitiu salvar a imagem para a próxima visita.');
    } finally { applying = false; controls(); }
  });
  $('sprite-remove').addEventListener('click', async () => {
    if (!installed || loading || applying) return;
    applying = true; controls();
    installed = null; candidate = null; source = null; filename = '';
    world.removePokemonSheet('charmander'); onChanged(null);
    $('sprite-file').value = ''; $('sprite-file-info').textContent = 'Nenhuma nova imagem selecionada.';
    try { await deleteSprite(); message('O visual original do Charmander foi restaurado.'); }
    catch { message('Visual original nesta sessão. O navegador não permitiu apagar a imagem salva.'); }
    finally { applying = false; controls(); }
  });
  dialog.addEventListener('close', () => cancelAnimationFrame(frameId));
  controls();
  const ready = (async () => {
    try {
      const record = await readSprite();
      if (!record || record.version !== 1) return;
      // A selection made while IndexedDB opens always takes precedence.
      const token = generation;
      const sheet = await loadSpriteFile(record.blob, { hideBackground: record.hideBackground === true });
      if (generation !== token || source || applying) return;
      installed = sheet; candidate = sheet; source = record.blob; filename = record.filename || 'Charmander salvo';
      $('sprite-hide-background').checked = record.hideBackground === true;
      $('sprite-file-info').textContent = `${filename} · imagem salva neste navegador`;
      world.installPokemonSheet('charmander', sheet); onChanged(sheet); controls();
      message('Seu visual salvo foi restaurado.');
    } catch { /* Sprite customization is optional; the default game stays playable. */ }
  })();
  return {
    ready,
    open() {
      cancelAnimationFrame(frameId); animationStart = performance.now();
      $('sprite-partner-note').textContent = getPartner() && getPartner() !== 'charmander'
        ? 'Seu parceiro atual é outro Pokémon. Aplicar a arte não troca seu parceiro nem apaga seu progresso.'
        : 'A arte será usada no cenário, no retrato do parceiro e nas vistas de batalha do Charmander.';
      frameId = requestAnimationFrame(draw);
    },
  };
}
