import * as THREE from '../assets/vendor/three.module.js';
import { WORLD, START_POSITION, TREES, BUILDINGS, FENCES, NPCS, seededRandom, terrainAt, movePosition } from './world-model.js';
import { pokemonArt, trainerArt, treeArt, grassArt } from './pixel-art.js';
import { loadSpriteSheet, walkingFrame, movementDirection } from './sprite-sheet.js';
import { POKEMON_SHEETS } from './sprite-assets.js';

const textureCache = new WeakMap();
function texture(canvas) {
  if (textureCache.has(canvas)) return textureCache.get(canvas);
  const map = new THREE.CanvasTexture(canvas);
  map.magFilter = THREE.NearestFilter;
  map.minFilter = THREE.NearestFilter;
  map.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(canvas, map);
  return map;
}
const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
const flatGeometry = new THREE.PlaneGeometry(1, 1);
const materials = new Map();
function material(color, extra = {}) {
  const key = `${color}:${JSON.stringify(extra)}`;
  if (!materials.has(key)) materials.set(key, new THREE.MeshLambertMaterial({ color, ...extra }));
  return materials.get(key);
}
function box(group, x, y, z, sx, sy, sz, color, extra) {
  const mesh = new THREE.Mesh(boxGeometry, material(color, extra));
  mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz);
  mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function groundPlane(group, x, z, sx, sz, color, y = .015) {
  const mesh = new THREE.Mesh(flatGeometry, material(color));
  mesh.rotation.x = -Math.PI / 2; mesh.scale.set(sx, sz, 1); mesh.position.set(x, y, z);
  mesh.receiveShadow = true; group.add(mesh); return mesh;
}
function shadow(group, x, z, size = .6) {
  const mesh = new THREE.Mesh(new THREE.CircleGeometry(size, 20), new THREE.MeshBasicMaterial({ color: '#223c32', transparent: true, opacity: .23, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2; mesh.scale.y = .6; mesh.position.set(x, .035, z); group.add(mesh); return mesh;
}
function billboard(group, canvas, x, z, width, height, y = 0, lit = true) {
  const mat = lit ? new THREE.MeshLambertMaterial({ map: texture(canvas), transparent: true, alphaTest: .4, side: THREE.DoubleSide }) : new THREE.MeshBasicMaterial({ map: texture(canvas), transparent: true, alphaTest: .4, side: THREE.DoubleSide });
  const mesh = new THREE.Mesh(flatGeometry, mat);
  mesh.position.set(x, y + height / 2, z); mesh.scale.set(width, height, 1); mesh.rotation.y = .54;
  mesh.castShadow = true; group.add(mesh); return mesh;
}
function lightScene(scene, battle = false) {
  scene.background = new THREE.Color(battle ? '#abb8a0' : '#a9bdac');
  scene.fog = new THREE.FogExp2(battle ? '#bbcab0' : '#b9c9b0', .012);
  scene.add(new THREE.HemisphereLight('#d8e8e2', '#66704b', 1.65));
  const sun = new THREE.DirectionalLight('#ffe2a0', 2.5);
  sun.position.set(-9, 24, 12); sun.target.position.set(battle ? 0 : 15, 0, battle ? 0 : 14);
  sun.castShadow = true;
  const shadowSize = innerWidth < 700 ? 1024 : 1536;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -30; sun.shadow.camera.right = 30;
  sun.shadow.camera.top = 30; sun.shadow.camera.bottom = -30;
  sun.shadow.camera.far = 90;
  sun.shadow.bias = -.0005; sun.shadow.normalBias = .045;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight('#a9c9d4', .7); fill.position.set(15, 9, -15); scene.add(fill);
  return sun;
}
function makeRoof(group, x, z, width, depth, color) {
  const roof = new THREE.BufferGeometry();
  const w = width / 2, d = depth / 2, h = 1.15;
  const vertices = new Float32Array([
    -w,0,-d, w,0,-d, 0,h,-d, -w,0,d, 0,h,d, w,0,d,
    -w,0,-d, 0,h,-d, 0,h,d, -w,0,-d, 0,h,d, -w,0,d,
    0,h,-d, w,0,-d, w,0,d, 0,h,-d, w,0,d, 0,h,d,
    -w,0,-d, -w,0,d, w,0,d, -w,0,-d, w,0,d, w,0,-d,
  ]);
  roof.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); roof.computeVertexNormals();
  const mesh = new THREE.Mesh(roof, material(color)); mesh.position.set(x, 2.2, z); mesh.castShadow = true; mesh.receiveShadow = true; group.add(mesh);
  // Terracotta/metal roof seams keep the surfaces from feeling like plain cubes.
  for (let dz = -depth / 2; dz <= depth / 2; dz += .27) {
    const left = box(group, x - width / 4, 2.78, z + dz, width / 2 + .13, .045, .035, color);
    left.rotation.z = Math.atan2(1.15, width / 2);
    const right = box(group, x + width / 4, 2.78, z + dz, width / 2 + .13, .045, .035, color);
    right.rotation.z = -Math.atan2(1.15, width / 2);
  }
}
function makeBuilding(scene, building) {
  const { x, z, width, depth, kind } = building;
  const center = kind === 'center';
  box(scene, x, .15, z, width + .3, .3, depth + .4, '#8c8b70');
  box(scene, x, 1.15, z, width, 2.05, depth, '#e0d9b5');
  box(scene, x, .4, z + depth / 2 + .015, width, .38, .08, '#a9ad91');
  makeRoof(scene, x, z, width + .5, depth + .5, center ? '#b76755' : '#49777a');
  box(scene, x, 2.19, z + depth / 2 + .18, width + .4, .18, .2, center ? '#9a554a' : '#395c63');
  box(scene, x, .78, z + depth / 2 + .04, .8, 1.5, .12, '#615e49');
  box(scene, x, .79, z + depth / 2 + .12, .58, 1.3, .06, '#8b805b');
  box(scene, x + .2, .74, z + depth / 2 + .16, .055, .055, .05, '#e4c980');
  for (const dx of [-1.33, 1.33]) {
    box(scene, x + dx, 1.28, z + depth / 2 + .06, .8, .85, .12, '#6c7968');
    box(scene, x + dx, 1.29, z + depth / 2 + .13, .59, .65, .05, '#f4d48e', { emissive: '#e7a959', emissiveIntensity: .35 });
    box(scene, x + dx, 1.29, z + depth / 2 + .17, .05, .65, .05, '#857d5c');
    box(scene, x + dx, 1.29, z + depth / 2 + .17, .59, .05, .05, '#857d5c');
    box(scene, x + dx, .78, z + depth / 2 + .2, .94, .19, .35, '#87744e');
    for (let i = -1; i <= 1; i++) box(scene, x + dx + i * .23, .93, z + depth / 2 + .22, .16, .19, .15, i ? '#73884f' : '#ceab79');
  }
  box(scene, x + 1.1, 2.8, z - .65, .4, 1.5, .45, '#918d75');
  if (center) {
    box(scene, x, 1.9, z + depth / 2 + .18, .58, .49, .12, '#e9dfbc');
    box(scene, x, 1.9, z + depth / 2 + .26, .14, .38, .04, '#b8655a');
    box(scene, x, 1.9, z + depth / 2 + .26, .38, .14, .04, '#b8655a');
  } else {
    box(scene, x, 1.9, z + depth / 2 + .18, .5, .45, .12, '#d8cf9e');
    box(scene, x, 1.9, z + depth / 2 + .26, .12, .26, .04, '#517e72');
  }
  groundPlane(scene, x, z + depth / 2 + .85, 1.5, 1.7, '#c5b992', .024);
}

export class WorldRenderer {
  constructor(canvas, callbacks = {}) {
    this.canvas = canvas;
    this.callbacks = callbacks;
    this.position = { ...START_POSITION };
    this.followPosition = { ...this.position };
    this.keys = new Set();
    this.mode = 'world';
    this.enabled = false;
    this.direction = 'down';
    this.clock = 0;
    this.walkClock = 0;
    this.frame = 0;
    this.effects = [];
    this.pokemonSheets = new Map();
    this.partnerDirection = 'down';
    this.partnerWalkClock = 0;
    this.worldTrees = [];
    this.reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.needsUpdate = true;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    lightScene(this.scene);
    this.camera = new THREE.OrthographicCamera(-12, 12, 8, -8, .1, 160);
    this.camera.position.set(28, 24, 38);
    this.camera.lookAt(16, 0, 20);
    this.createLandscape();
    this.createActors();
    this.createBattle();
    for (const [species, url] of Object.entries(POKEMON_SHEETS)) {
      void this.loadPokemonSheet(species, url).catch(() => this.callbacks.onAssetError?.(`Não foi possível carregar a nova arte de ${species}. O visual original foi mantido.`));
    }
    this.createPostprocessing();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas.parentElement);
    this.resize();
    this.lastTime = performance.now();
    this.disposed = false;
    this.animate = this.animate.bind(this);
    this.animationId = requestAnimationFrame(this.animate);
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault(); this.enabled = false;
      this.callbacks.onError?.('A conexão gráfica foi interrompida. Recarregue a página para continuar; o progresso está salvo.');
    });
  }
  createLandscape() {
    const random = seededRandom(73);
    box(this.scene, 16, -.72, 14, 32.3, 1.4, 28.3, '#716f50');
    const land = new THREE.Shape();
    land.moveTo(0, 0); land.lineTo(32, 0); land.lineTo(32, -28); land.lineTo(0, -28); land.closePath();
    const lakeHole = new THREE.Path();
    lakeHole.moveTo(23.5, -9.5); lakeHole.lineTo(23.5, -24); lakeHole.lineTo(30, -24); lakeHole.lineTo(30, -9.5); lakeHole.closePath();
    land.holes.push(lakeHole);
    const landMesh = new THREE.Mesh(new THREE.ShapeGeometry(land), material('#839d65'));
    landMesh.rotation.x = -Math.PI / 2; landMesh.position.y = .015; landMesh.receiveShadow = true; this.scene.add(landMesh);
    groundPlane(this.scene, 16, 14, 130, 130, '#71865f', -.76);
    // Small flat details are batched into one mesh, rather than hundreds of draws.
    const count = 1800;
    const grass = new THREE.InstancedMesh(flatGeometry, material('#ffffff'), count);
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    for (let i = 0; i < count; i++) {
      dummy.position.set(random() * 32, .021, random() * 28);
      dummy.rotation.x = -Math.PI / 2;
      dummy.scale.set(.025 + random() * .12, .025 + random() * .08, 1); dummy.updateMatrix();
      if (['water', 'bridge'].includes(terrainAt(dummy.position.x, dummy.position.z))) { dummy.scale.setScalar(0); dummy.updateMatrix(); }
      grass.setMatrixAt(i, dummy.matrix); grass.setColorAt(i, color.set(['#94a96e', '#718b59', '#a4b578', '#65825a'][i % 4]));
    }
    grass.receiveShadow = true; this.scene.add(grass);
    groundPlane(this.scene, 15.5, 14, 2.4, 25, '#c8b88f', .027);
    groundPlane(this.scene, 17.4, 16, 25, 1.4, '#c8b88f', .028);
    groundPlane(this.scene, 15.5, 22.55, 15, 1.5, '#c8b88f', .028);
    for (let i = 0; i < 38; i++) {
      const z = 2 + random() * 24, x = 14.5 + random() * 2;
      groundPlane(this.scene, x, z, .11 + random() * .2, .04 + random() * .1, '#ad9c79', .031);
    }
    // Recessed lake, with a timber bridge as the only crossing.
    box(this.scene, 26.75, -.18, 16.75, 6.65, .2, 14.7, '#a5ab7c');
    this.water = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 14.2, 10, 20), new THREE.MeshPhongMaterial({ color: '#72acb0', transparent: true, opacity: .86, shininess: 110, specular: '#e9e6be' }));
    this.water.rotation.x = -Math.PI / 2; this.water.position.set(26.75, .045, 16.75); this.water.receiveShadow = true; this.scene.add(this.water);
    this.waterGlints = [];
    for (let i = 0; i < 42; i++) {
      const ripple = groundPlane(this.scene, 23.85 + random() * 5.8, 9.8 + random() * 13.8, .12 + random() * .45, .025, '#d4dfbc', .09);
      ripple.material = new THREE.MeshBasicMaterial({ color: '#dce6cd', transparent: true, opacity: .5 });
      this.waterGlints.push(ripple);
    }
    for (let x = 23.3; x < 30.2; x += .28) box(this.scene, x, .14, 16, .25, .21, 1.55, Math.round(x * 10) % 2 ? '#9e8b60' : '#b5a075');
    for (const z of [15.2, 16.8]) {
      box(this.scene, 26.75, .72, z, 7.1, .12, .1, '#8d7b55');
      for (let x = 23.3; x < 30.3; x += 1.13) box(this.scene, x, .39, z, .12, .9, .12, '#7f7350');
    }
    for (const tree of TREES) this.addTree(this.scene, tree.x, tree.z, tree.scale, Math.round(random()));
    for (const building of BUILDINGS) makeBuilding(this.scene, building);
    // Hills beyond the walkable map add depth behind the 2D tree silhouettes.
    for (let i = 0; i < 14; i++) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(4 + random() * 3, 5 + random() * 5, 5), material(i % 2 ? '#718a72' : '#809780'));
      hill.position.set(-5 + i * 3.5, 1, -5 - random() * 5); hill.rotation.y = random(); this.scene.add(hill);
    }
    const tuftPositions = [];
    for (let z = 5.2; z < 14; z += .48) for (let x = 5.1; x < 23; x += .48) if (terrainAt(x, z) === 'tall-grass') tuftPositions.push([x + random() * .12, z + random() * .12]);
    const grassMaterial = new THREE.MeshLambertMaterial({ map: texture(grassArt()), transparent: true, alphaTest: .5, side: THREE.DoubleSide });
    const tufts = new THREE.InstancedMesh(flatGeometry, grassMaterial, tuftPositions.length);
    for (let i = 0; i < tuftPositions.length; i++) {
      dummy.position.set(tuftPositions[i][0], .28, tuftPositions[i][1]); dummy.rotation.set(0, .54, 0); dummy.scale.set(.6, .53, 1); dummy.updateMatrix(); tufts.setMatrixAt(i, dummy.matrix);
    }
    tufts.receiveShadow = true; this.scene.add(tufts);
    // Fences, lamps, tiny flowers and stones give the village a lived-in scale.
    for (const [x0, x1, z] of FENCES) {
      box(this.scene, (x0 + x1) / 2, .46, z, x1 - x0, .12, .1, '#b8af83');
      box(this.scene, (x0 + x1) / 2, .77, z, x1 - x0, .1, .1, '#c9bd91');
      for (let x = x0; x <= x1; x += 1) box(this.scene, x, .5, z, .16, 1.03, .17, '#a79c73');
    }
    for (const [x, z] of [[13.2, 22], [17.5, 21.5], [22.6, 16], [13.1, 9]]) {
      box(this.scene, x, 1, z, .11, 2, .11, '#4d6153');
      box(this.scene, x, 2.07, z, .34, .45, .34, '#4f6050');
      box(this.scene, x, 2.07, z + .025, .23, .3, .29, '#f4d794', { emissive: '#ffbe5e', emissiveIntensity: .6 });
      const point = new THREE.PointLight('#ffd389', 2.5, 4); point.position.set(x, 1.8, z); this.scene.add(point);
    }
    const flowers = new THREE.InstancedMesh(boxGeometry, material('#fff'), 120);
    for (let i = 0; i < 120; i++) {
      let x, z;
      do { x = 4 + random() * 19; z = 4 + random() * 21; } while (terrainAt(x, z) !== 'grass');
      dummy.position.set(x, .12, z); dummy.rotation.set(0, random(), 0); dummy.scale.set(.07, .14, .07); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix); flowers.setColorAt(i, color.set(['#e8ce85', '#e2b1a4', '#b7cbaa'][i % 3]));
    }
    this.scene.add(flowers);
    const sign = NPCS.find(npc => npc.id === 'sign');
    box(this.scene, sign.x, .45, sign.z, .1, .9, .12, '#7f7656');
    box(this.scene, sign.x, .95, sign.z, .88, .5, .1, '#b8aa79');
    box(this.scene, sign.x, .97, sign.z + .06, .47, .035, .02, '#786b4c');
    box(this.scene, sign.x, .84, sign.z + .06, .32, .035, .02, '#786b4c');
    this.particles = [];
    for (let i = 0; i < 32; i++) {
      const mesh = new THREE.Mesh(flatGeometry, new THREE.MeshBasicMaterial({ color: i % 3 ? '#f2d68c' : '#d4e4b8', transparent: true, opacity: .65, side: THREE.DoubleSide }));
      mesh.position.set(5 + random() * 23, .8 + random() * 6, 5 + random() * 20); mesh.scale.setScalar(i % 3 ? .035 : .07);
      this.scene.add(mesh); this.particles.push({ mesh, base: mesh.position.clone(), phase: random() * 10 });
    }
  }
  addTree(scene, x, z, scale = 1, variant = 0) {
    const tree = billboard(scene, treeArt(variant), x, z, 3 * scale, 4.2 * scale, 0);
    tree.receiveShadow = false;
    if (scene === this.scene) { tree.material.alphaTest = .15; this.worldTrees.push(tree); }
    shadow(scene, x, z, 1.25 * scale);
    return tree;
  }
  createActors() {
    this.trainer = billboard(this.scene, trainerArt(), this.position.x, this.position.z, .74, 1.13, .03);
    this.trainer.castShadow = false;
    this.trainerShadow = shadow(this.scene, this.position.x, this.position.z, .33);
    this.partner = billboard(this.scene, pokemonArt('bulbasaur'), this.position.x + .8, this.position.z + .9, .75, .75, .03);
    this.partner.castShadow = false;
    this.partnerShadow = shadow(this.scene, this.partner.position.x, this.partner.position.z, .33);
    this.partnerSpecies = 'bulbasaur';
    for (const npc of NPCS.filter(item => item.kind !== 'sign')) {
      billboard(this.scene, trainerArt(npc.kind), npc.x, npc.z, .75, 1.13, .03);
      shadow(this.scene, npc.x, npc.z, .33);
      const mark = document.createElement('canvas'); mark.width = 16; mark.height = 18;
      const ctx = mark.getContext('2d'); ctx.fillStyle = npc.kind === 'nurse' ? '#f4bc9a' : '#ffe0a0';
      if (npc.kind === 'nurse') { ctx.fillRect(6, 3, 4, 11); ctx.fillRect(3, 6, 10, 4); }
      else { ctx.fillRect(7, 2, 3, 8); ctx.fillRect(7, 12, 3, 3); }
      billboard(this.scene, mark, npc.x, npc.z, .31, .35, 1.5, false);
    }
  }
  createBattle() {
    this.battleScene = new THREE.Scene(); lightScene(this.battleScene, true);
    this.battleCamera = new THREE.OrthographicCamera(-9, 9, 5, -5, .1, 100);
    this.battleCamera.position.set(8.5, 8, 14); this.battleCamera.lookAt(0, .3, 0);
    groundPlane(this.battleScene, 0, 0, 65, 65, '#8b9e69');
    const random = seededRandom(199);
    for (let i = 0; i < 38; i++) {
      // Place trees in camera space: behind combatants and at the outer edges.
      const lateral = i < 28 ? -16 + (i % 14) * 2.5 : (i % 2 ? -11.7 : 11.7);
      const depth = i < 28 ? -8 - Math.floor(i / 14) * 2.7 : -5 + Math.floor((i - 28) / 2) * 2;
      this.addTree(this.battleScene, lateral * .855 + depth * .52, -lateral * .52 + depth * .855, 1 + random() * .35, i % 2);
    }
    for (const [x, z, scale] of [[-2.6, 2, 2.1], [2.8, -3.2, 1.8]]) {
      const circle = new THREE.Mesh(new THREE.CircleGeometry(scale, 48), material('#a3ad76'));
      circle.rotation.x = -Math.PI / 2; circle.position.set(x, .018, z); circle.scale.y = .72; circle.receiveShadow = true; this.battleScene.add(circle);
      shadow(this.battleScene, x, z, scale * .55);
    }
    this.battlePlayer = billboard(this.battleScene, pokemonArt('bulbasaur', true), -2.6, 2, 2.65, 2.65, .1);
    this.battleEnemy = billboard(this.battleScene, pokemonArt('pidgey'), 2.8, -3.2, 2.2, 2.2, .1);
    this.battleEnemy.scale.x *= -1;
  }
  createPostprocessing() {
    const targetType = this.renderer.extensions.has('EXT_color_buffer_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    this.target = new THREE.WebGLRenderTarget(1, 1, { type: targetType });
    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.postMaterial = new THREE.ShaderMaterial({
      uniforms: { sceneMap: { value: this.target.texture }, resolution: { value: new THREE.Vector2(1, 1) }, motion: { value: this.reducedMotion ? 0 : 1 } },
      vertexShader: 'varying vec2 vUv; void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader: `
        uniform sampler2D sceneMap; uniform vec2 resolution; varying vec2 vUv;
        void main(){
          vec2 pixel=1.0/resolution;
          vec3 base=texture2D(sceneMap,vUv).rgb;
          float blur=pow(clamp(abs(vUv.y-.48)*2.2-.38,0.,1.),1.5)*2.7;
          vec3 soft=base*0.36;
          soft+=texture2D(sceneMap,vUv+vec2(pixel.x*blur, pixel.y*blur)).rgb*.16;
          soft+=texture2D(sceneMap,vUv+vec2(-pixel.x*blur,pixel.y*blur)).rgb*.16;
          soft+=texture2D(sceneMap,vUv+vec2(pixel.x*blur,-pixel.y*blur)).rgb*.16;
          soft+=texture2D(sceneMap,vUv-vec2(pixel.x*blur,pixel.y*blur)).rgb*.16;
          vec3 glow=vec3(0.);
          glow+=max(texture2D(sceneMap,vUv+vec2(pixel.x*4.,0.)).rgb-.85,0.);
          glow+=max(texture2D(sceneMap,vUv-vec2(pixel.x*4.,0.)).rgb-.85,0.);
          glow+=max(texture2D(sceneMap,vUv+vec2(0.,pixel.y*4.)).rgb-.85,0.);
          glow+=max(texture2D(sceneMap,vUv-vec2(0.,pixel.y*4.)).rgb-.85,0.);
          vec3 color=soft+glow*.07;
          float vignette=1.0-smoothstep(.17,.9,distance(vUv,vec2(.5,.51)));
          color*=mix(.76,1.03,vignette);
          color=mix(color*vec3(.94,1.01,1.035),color*vec3(1.035,1.015,.96),smoothstep(.05,.9,dot(color,vec3(.2126,.7152,.0722))));
          gl_FragColor=vec4(color,1.);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
      depthTest: false, depthWrite: false,
    });
    this.postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.postMaterial));
  }
  resize() {
    const { width, height } = this.canvas.parentElement.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    const ratio = this.renderer.getPixelRatio();
    this.target.setSize(Math.floor(width * ratio), Math.floor(height * ratio));
    this.postMaterial.uniforms.resolution.value.set(width * ratio, height * ratio);
    const aspect = width / height;
    // On phones show more of the route vertically, keeping sprites readable.
    const viewWidth = aspect < .8 ? 15 : aspect < 1.4 ? 19 : 25;
    this.camera.left = -viewWidth / 2; this.camera.right = viewWidth / 2;
    this.camera.top = viewWidth / aspect / 2; this.camera.bottom = -this.camera.top; this.camera.updateProjectionMatrix();
    const battleWidth = aspect < .8 ? 11 : 18;
    this.battleCamera.left = -battleWidth / 2; this.battleCamera.right = battleWidth / 2;
    this.battleCamera.top = battleWidth / aspect / 2; this.battleCamera.bottom = -this.battleCamera.top; this.battleCamera.updateProjectionMatrix();
  }
  setInput(direction, pressed) { if (pressed) this.keys.add(direction); else this.keys.delete(direction); }
  clearInput() { this.keys.clear(); }
  setPosition(position) {
    this.position = { ...position }; this.followPosition = { ...position };
    this.partner.position.set(position.x + .8, .405, position.z + .65);
  }
  setPartner(species) {
    this.partnerSpecies = species; this.partnerDirection = 'down'; this.partnerWalkClock = 0;
    this.partner.material.map = texture(this.pokemonCanvas(species)); this.partner.material.needsUpdate = true;
  }
  pokemonCanvas(species, direction = 'down', frame = 0, back = false) {
    return this.pokemonSheets.get(species)?.frame(direction, frame) || pokemonArt(species, back);
  }
  async loadPokemonSheet(species, url) {
    // Keep the current artwork if downloading/decoding/validating the asset fails.
    const sheet = await loadSpriteSheet(url);
    if (this.disposed) return;
    this.installPokemonSheet(species, sheet);
    return sheet;
  }
  refreshPokemonArt(species) {
    if (this.partnerSpecies === species) this.partner.material.map = texture(this.pokemonCanvas(species, this.partnerDirection));
    if (this.battleSpecies?.player === species) this.battlePlayer.material.map = texture(this.pokemonCanvas(species, 'up', 0, true));
    if (this.battleSpecies?.enemy === species) this.battleEnemy.material.map = texture(this.pokemonCanvas(species));
  }
  releasePokemonSheet(sheet) {
    if (!sheet) return;
    for (const canvas of sheet.frames.values()) { textureCache.get(canvas)?.dispose(); textureCache.delete(canvas); }
  }
  installPokemonSheet(species, sheet) {
    const previous = this.pokemonSheets.get(species);
    this.pokemonSheets.set(species, sheet); this.refreshPokemonArt(species);
    if (previous !== sheet) this.releasePokemonSheet(previous);
  }
  removePokemonSheet(species) {
    const previous = this.pokemonSheets.get(species);
    this.pokemonSheets.delete(species); this.refreshPokemonArt(species); this.releasePokemonSheet(previous);
  }
  showWorld() { this.mode = 'world'; this.clearInput(); this.renderer.shadowMap.needsUpdate = true; }
  showBattle(game) {
    this.mode = 'battle'; this.clearInput();
    this.renderer.shadowMap.needsUpdate = true;
    this.battleSpecies = { player: game.player.species, enemy: game.enemy.species };
    this.battlePlayer.material.map = texture(this.pokemonCanvas(game.player.species, 'up', 0, true));
    this.battlePlayer.material.needsUpdate = true;
    this.battleEnemy.material.map = texture(this.pokemonCanvas(game.enemy.species));
    this.battleEnemy.material.needsUpdate = true;
    this.battlePlayer.visible = true; this.battleEnemy.visible = true;
    this.battlePlayer.material.opacity = 1; this.battleEnemy.material.opacity = 1;
    this.battlePlayer.position.set(-2.6, 1.425, 2); this.battleEnemy.position.set(2.8, 1.2, -3.2);
  }
  setBattleResult(phase) {
    if (['victory', 'captured', 'escaped'].includes(phase)) this.battleEnemy.visible = false;
    if (phase === 'defeat') this.battlePlayer.material.opacity = .25;
  }
  animateEvent(event, moveType = 'normal') {
    if (this.reducedMotion) {
      if (event.kind === 'capture') this.battleEnemy.visible = false;
      return;
    }
    const playerTarget = event.target === 'player';
    const target = playerTarget ? this.battlePlayer : this.battleEnemy;
    const attacker = playerTarget ? this.battleEnemy : this.battlePlayer;
    const colors = { fire: '#ffc578', water: '#a3e2ef', grass: '#b9da79', normal: '#ffedbd', electric: '#ffe784', bug: '#c5de81' };
    if (event.kind === 'attack') {
      this.effects.push({ kind: 'attack', target, attacker, time: 0, origin: attacker.position.clone(), targetOrigin: target.position.clone(), color: colors[moveType] || colors.normal });
    }
    if (event.kind === 'heal') this.effects.push({ kind: 'heal', target: this.battlePlayer, time: 0 });
    if (event.kind === 'capture' || event.kind === 'throw') {
      const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = '#35443b'; ctx.fillRect(3, 2, 10, 12); ctx.fillRect(2, 4, 12, 8);
      ctx.fillStyle = '#f3ead4'; ctx.fillRect(3, 8, 10, 5); ctx.fillStyle = '#c76e55'; ctx.fillRect(3, 3, 10, 5);
      ctx.fillStyle = '#35443b'; ctx.fillRect(2, 7, 12, 2); ctx.fillRect(6, 6, 4, 4); ctx.fillStyle = '#fff2cf'; ctx.fillRect(7, 7, 2, 2);
      const ball = billboard(this.battleScene, canvas, -2.6, 2, .4, .4, 1);
      this.effects.push({ kind: 'ball', mesh: ball, time: 0, success: event.kind === 'capture' });
    }
    for (const effect of this.effects) effect.started ??= performance.now();
  }
  burst(position, color) {
    for (let i = 0; i < 13; i++) {
      const mesh = new THREE.Mesh(boxGeometry, new THREE.MeshBasicMaterial({ color, transparent: true }));
      mesh.scale.setScalar(.06 + (i % 3) * .02); mesh.position.copy(position);
      this.battleScene.add(mesh);
      const angle = i / 13 * Math.PI * 2;
      this.effects.push({ kind: 'spark', mesh, time: 0, started: performance.now(), vx: Math.cos(angle) * 2, vy: .6 + (i % 4) * .4, vz: Math.sin(angle) * 2 });
    }
  }
  updateEffects(dt) {
    for (const effect of [...this.effects]) {
      effect.time = (performance.now() - effect.started) / 1000;
      let done = false;
      if (effect.kind === 'attack') {
        const t = effect.time;
        effect.attacker.position.x = effect.origin.x + Math.sin(Math.min(t / .36, 1) * Math.PI) * (effect.targetOrigin.x - effect.origin.x) * .22;
        if (t > .18 && !effect.burst) { this.burst(effect.targetOrigin, effect.color); effect.burst = true; }
        effect.target.material.opacity = t > .18 && t < .6 ? .35 + Math.abs(Math.sin(t * 35)) * .65 : 1;
        done = t > .65;
        if (done) { effect.attacker.position.copy(effect.origin); effect.target.material.opacity = 1; }
      } else if (effect.kind === 'spark') {
        effect.mesh.position.x += effect.vx * dt; effect.mesh.position.z += effect.vz * dt;
        effect.mesh.position.y += effect.vy * dt; effect.vy -= dt * 4;
        effect.mesh.material.opacity = Math.max(0, 1 - effect.time / .6); done = effect.time > .6;
      } else if (effect.kind === 'heal') {
        if (!effect.burst) { this.burst(effect.target.position, '#c1eda0'); effect.burst = true; }
        effect.target.material.color.set(effect.time < .5 ? '#ccffa9' : '#ffffff'); done = effect.time > .6;
      } else if (effect.kind === 'ball') {
        const t = Math.min(effect.time / .55, 1);
        effect.mesh.position.set(-2.6 + t * 5.4, 1.4 + Math.sin(t * Math.PI) * 2.5, 2 - t * 5.2);
        effect.mesh.rotation.z = effect.time * 12;
        if (t === 1 && !effect.burst) { this.burst(this.battleEnemy.position, '#ffe3a2'); effect.burst = true; }
        if (effect.success && t === 1) this.battleEnemy.visible = false;
        done = effect.time > 1.05;
      }
      if (done) {
        if (effect.mesh) { this.battleScene.remove(effect.mesh); effect.mesh.material.dispose(); }
        this.effects.splice(this.effects.indexOf(effect), 1);
      }
    }
  }
  updateMovement(dt) {
    if (!this.enabled || !this.callbacks.canMove?.() || this.mode !== 'world') return false;
    let dx = Number(this.keys.has('right')) - Number(this.keys.has('left'));
    let dz = Number(this.keys.has('down')) - Number(this.keys.has('up'));
    const magnitude = Math.hypot(dx, dz);
    if (!magnitude) return false;
    dx /= magnitude; dz /= magnitude;
    this.direction = Math.abs(dx) > Math.abs(dz) ? (dx > 0 ? 'right' : 'left') : (dz > 0 ? 'down' : 'up');
    const next = movePosition(this.position, dx * dt * 3.4, dz * dt * 3.4);
    const distance = Math.hypot(next.x - this.position.x, next.z - this.position.z);
    this.position = next;
    if (distance > .0001) { this.walkClock += dt; this.callbacks.onMove?.(this.position, distance); return true; }
    return false;
  }
  animate(time) {
    if (this.disposed) return;
    this.animationId = requestAnimationFrame(this.animate);
    const dt = Math.min((time - this.lastTime) / 1000, .06); this.lastTime = time;
    if (document.hidden) return;
    this.clock += dt;
    const moving = this.updateMovement(dt);
    const frame = moving ? Math.floor(this.walkClock * 8) % 2 : 0;
    if (this.frame !== frame || this.lastDirection !== this.direction) {
      this.trainer.material.map = texture(trainerArt('trainer', this.direction, frame)); this.frame = frame; this.lastDirection = this.direction;
    }
    this.trainer.position.set(this.position.x, .595 + (moving && !this.reducedMotion ? frame * .025 : 0), this.position.z);
    this.trainerShadow.position.set(this.position.x, .035, this.position.z);
    const partnerDistance = Math.hypot(this.position.x - this.partner.position.x, this.position.z - this.partner.position.z);
    let partnerMoving = false;
    if (partnerDistance > .95) {
      const follow = 1 - Math.exp(-dt * 4);
      const dx = (this.position.x - this.partner.position.x) * follow;
      const dz = (this.position.z - this.partner.position.z + .25) * follow;
      partnerMoving = Math.hypot(dx, dz) > .001;
      this.partnerDirection = movementDirection(dx, dz, this.partnerDirection);
      if (partnerMoving) this.partnerWalkClock += dt;
      this.partner.position.x += dx;
      this.partner.position.z += dz;
    }
    const partnerFrame = walkingFrame(this.partnerWalkClock, partnerMoving, this.reducedMotion);
    this.partner.material.map = texture(this.pokemonCanvas(this.partnerSpecies, this.partnerDirection, partnerFrame));
    this.partner.position.y = .405 + (moving && !this.reducedMotion ? Math.abs(Math.sin(this.walkClock * 10)) * .06 : 0);
    this.partnerShadow.position.set(this.partner.position.x, .035, this.partner.position.z);
    this.followPosition.x += (this.position.x - this.followPosition.x) * (1 - Math.exp(-dt * 5));
    this.followPosition.z += (this.position.z - this.followPosition.z) * (1 - Math.exp(-dt * 5));
    const focus = new THREE.Vector3(this.followPosition.x, .1, this.followPosition.z - 1.9);
    focus.x = THREE.MathUtils.clamp(focus.x, 9.5, 23);
    focus.z = THREE.MathUtils.clamp(focus.z, 8, 19.5);
    if (!this.enabled) { focus.set(16.7, .1, 18.3); }
    this.camera.position.copy(focus).add(new THREE.Vector3(10.5, 15.2, 17)); this.camera.lookAt(focus);
    for (const tree of this.worldTrees) {
      const dx = tree.position.x - this.position.x, dz = tree.position.z - this.position.z;
      const depth = dx * .525 + dz * .85, lateral = Math.abs(dx * .85 - dz * .525);
      const opacity = this.enabled && depth > .1 && depth < 5 && lateral < 1.5 ? .35 : 1;
      tree.material.opacity += (opacity - tree.material.opacity) * Math.min(1, dt * 8);
    }
    if (!this.reducedMotion) {
      this.waterGlints.forEach((glint, index) => { glint.material.opacity = .17 + Math.max(0, Math.sin(this.clock * 1.2 + index * 1.8)) * .38; });
      this.particles.forEach(({ mesh, base, phase }) => {
        mesh.position.set(base.x + Math.sin(this.clock * .2 + phase) * .6, base.y + Math.sin(this.clock * .6 + phase) * .35, base.z + Math.cos(this.clock * .25 + phase) * .5); mesh.rotation.set(this.clock * .3 + phase, phase, this.clock * .2);
      });
      const positions = this.water.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) positions.setZ(i, Math.sin(positions.getX(i) * 2 + this.clock) * .018 + Math.cos(positions.getY(i) * 3 + this.clock * 1.5) * .009);
      positions.needsUpdate = true;
    }
    this.updateEffects(dt);
    const camera = this.mode === 'world' ? this.camera : this.battleCamera;
    const scene = this.mode === 'world' ? this.scene : this.battleScene;
    this.renderer.setRenderTarget(this.target); this.renderer.render(scene, camera);
    this.renderer.setRenderTarget(null); this.renderer.render(this.postScene, this.postCamera);
    this.callbacks.onFrame?.(this.position);
  }
  drawMap(canvas, position = this.position) {
    const ctx = canvas.getContext('2d');
    const sx = canvas.width / WORLD.width, sy = canvas.height / WORLD.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const colors = { grass: '#71865b', 'tall-grass': '#3e6950', path: '#c6b58a', water: '#719fa5', bridge: '#b3a079', edge: '#374e40', building: '#a5a181' };
    for (let z = 0; z < WORLD.height; z++) for (let x = 0; x < WORLD.width; x++) {
      ctx.fillStyle = colors[terrainAt(x + .5, z + .5)]; ctx.fillRect(x * sx, z * sy, Math.ceil(sx), Math.ceil(sy));
    }
    for (const tree of TREES) { ctx.fillStyle = '#3f5e43'; ctx.fillRect(tree.x * sx - sx / 2, tree.z * sy - sy / 2, sx, sy); }
    for (const npc of NPCS) { ctx.fillStyle = npc.kind === 'nurse' ? '#efaa91' : '#e7d59d'; ctx.fillRect(npc.x * sx - 2, npc.z * sy - 2, 4, 4); }
    ctx.fillStyle = '#172c2b'; ctx.beginPath(); ctx.arc(position.x * sx, position.z * sy, sx * .7 + 1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff6d5'; ctx.beginPath(); ctx.arc(position.x * sx, position.z * sy, sx * .5, 0, Math.PI * 2); ctx.fill();
  }
  dispose() {
    this.disposed = true; cancelAnimationFrame(this.animationId); this.resizeObserver.disconnect();
    this.renderer.dispose(); this.target.dispose();
  }
}
