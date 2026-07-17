import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { poemas } from "./poemas.js";
import { frases } from "./frases.js";

/* =========================================================
   0. Personalização
   Troque o NOME pelo nome de quem vai receber a viagem,
   e o TRACK pelo id da faixa no Spotify (se quiser outra
   versão de "Cor de Marte").
   ========================================================= */
const NOME = "Oceano"; // <- o apelido de quem recebe a viagem
// A música toca do arquivo "musica.mp3" colocado nesta mesma pasta.

document.getElementById("nomePessoa").textContent = NOME;

/* =========================================================
   1. Cena, câmera, renderizador, controles
   ========================================================= */
const canvas = document.querySelector(".webgl");
const scene = new THREE.Scene();

const isMobile =
  window.matchMedia("(pointer: coarse)").matches ||
  Math.min(window.innerWidth, window.innerHeight) < 700;

const sizes = { width: window.innerWidth, height: window.innerHeight };
const pixelRatio = Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2);

const camera = new THREE.PerspectiveCamera(58, sizes.width / sizes.height, 0.1, 300);
camera.position.set(0, 3, 26); // começa longe; a viagem aproxima
scene.add(camera);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(sizes.width, sizes.height);
renderer.setPixelRatio(pixelRatio);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 4;
controls.maxDistance = 20;
controls.enablePan = false;
controls.enabled = false; // só liga depois da viagem começar
controls.autoRotate = true;
controls.autoRotateSpeed = 0.35;
controls.rotateSpeed = isMobile ? 0.6 : 0.9;
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN };

/* =========================================================
   2. Céu de estrelas + nebulosa avermelhada
   ========================================================= */
// Estrelas distantes
{
  const g = new THREE.BufferGeometry();
  const n = isMobile ? 1600 : 3200;
  const p = new Float32Array(n * 3);
  const c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    // numa casca esférica bem grande
    const r = 60 + Math.random() * 120;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    p[i3] = Math.sin(ph) * Math.cos(th) * r;
    p[i3 + 1] = Math.cos(ph) * r;
    p[i3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    // maioria branca, algumas puxando pro quente
    const quente = Math.random() < 0.25;
    const col = new THREE.Color().setHSL(quente ? 0.06 : 0.6, quente ? 0.5 : 0.1, 0.85);
    c[i3] = col.r; c[i3 + 1] = col.g; c[i3 + 2] = col.b;
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  scene.add(
    new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.5,
        sizeAttenuation: true,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
      })
    )
  );
}

// Nebulosa: nuvens grandes e suaves em tons de Marte
{
  const g = new THREE.BufferGeometry();
  const n = isMobile ? 1400 : 3000;
  const p = new Float32Array(n * 3);
  const c = new Float32Array(n * 3);
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const i3 = i * 3;
    const r = 14 + Math.random() * 30;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    p[i3] = Math.sin(ph) * Math.cos(th) * r;
    p[i3 + 1] = Math.cos(ph) * r * 0.6;
    p[i3 + 2] = Math.sin(ph) * Math.sin(th) * r;
    const col = new THREE.Color().setHSL(0.02 + Math.random() * 0.05, 0.75, 0.35 + Math.random() * 0.2);
    c[i3] = col.r; c[i3 + 1] = col.g; c[i3 + 2] = col.b;
    s[i] = 8 + Math.random() * 22;
  }
  g.setAttribute("position", new THREE.BufferAttribute(p, 3));
  g.setAttribute("color", new THREE.BufferAttribute(c, 3));
  g.setAttribute("aScale", new THREE.BufferAttribute(s, 1));
  const mat = new THREE.ShaderMaterial({
    depthWrite: false,
    transparent: true,
    blending: THREE.AdditiveBlending,
    uniforms: { uPix: { value: pixelRatio } },
    vertexShader: `
      attribute float aScale;
      attribute vec3 color;
      varying vec3 vColor;
      uniform float uPix;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aScale * uPix * (30.0 / -mv.z);
        vColor = color;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      void main() {
        float d = distance(gl_PointCoord, vec2(0.5));
        float a = smoothstep(0.5, 0.0, d);
        gl_FragColor = vec4(vColor * a, a * 0.07);
      }
    `,
  });
  scene.add(new THREE.Points(g, mat));
}

/* =========================================================
   3. MARTE — o planeta-coração (superfície procedural)
   ========================================================= */
const RAIO_MARTE = 2.2;

// Ruído simplex 3D (Ashima) — usado pra "esculpir" a superfície
const RUIDO_GLSL = `
  vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
  vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
  float snoise(vec3 v){
    const vec2 C=vec2(1.0/6.0,1.0/3.0);
    const vec4 D=vec4(0.0,0.5,1.0,2.0);
    vec3 i=floor(v+dot(v,C.yyy));
    vec3 x0=v-i+dot(i,C.xxx);
    vec3 g=step(x0.yzx,x0.xyz);
    vec3 l=1.0-g;
    vec3 i1=min(g.xyz,l.zxy);
    vec3 i2=max(g.xyz,l.zxy);
    vec3 x1=x0-i1+C.xxx;
    vec3 x2=x0-i2+C.yyy;
    vec3 x3=x0-D.yyy;
    i=mod289(i);
    vec4 p=permute(permute(permute(
        i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));
    float n_=0.142857142857;
    vec3 ns=n_*D.wyz-D.xzx;
    vec4 j=p-49.0*floor(p*ns.z*ns.z);
    vec4 x_=floor(j*ns.z);
    vec4 y_=floor(j-7.0*x_);
    vec4 x=x_*ns.x+ns.yyyy;
    vec4 y=y_*ns.x+ns.yyyy;
    vec4 h=1.0-abs(x)-abs(y);
    vec4 b0=vec4(x.xy,y.xy);
    vec4 b1=vec4(x.zw,y.zw);
    vec4 s0=floor(b0)*2.0+1.0;
    vec4 s1=floor(b1)*2.0+1.0;
    vec4 sh=-step(h,vec4(0.0));
    vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
    vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
    vec3 p0=vec3(a0.xy,h.x);
    vec3 p1=vec3(a0.zw,h.y);
    vec3 p2=vec3(a1.xy,h.z);
    vec3 p3=vec3(a1.zw,h.w);
    vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
    p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
    vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
    m=m*m;
    return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
  }
  float fbm(vec3 p){
    float f=0.0, a=0.5;
    for(int i=0;i<5;i++){ f+=a*snoise(p); p*=2.03; a*=0.5; }
    return f;
  }
`;

const marteGeo = new THREE.SphereGeometry(RAIO_MARTE, 96, 96);
const marteMat = new THREE.ShaderMaterial({
  uniforms: {
    uLight: { value: new THREE.Vector3(0.7, 0.35, 0.6).normalize() },
    uPulso: { value: 0 }, // pulsa levemente no ritmo (coração)
  },
  vertexShader: `
    varying vec3 vPos;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    void main() {
      vPos = position;
      vNormalW = normalize(mat3(modelMatrix) * normal);
      vec4 wp = modelMatrix * vec4(position, 1.0);
      vViewDir = normalize(cameraPosition - wp.xyz);
      gl_Position = projectionMatrix * viewMatrix * wp;
    }
  `,
  fragmentShader: `
    uniform vec3 uLight;
    uniform float uPulso;
    varying vec3 vPos;
    varying vec3 vNormalW;
    varying vec3 vViewDir;
    ${RUIDO_GLSL}
    void main() {
      vec3 p = normalize(vPos);
      float n = fbm(p * 2.1);
      float n2 = fbm(p * 5.5 + n);
      float h = n * 0.6 + n2 * 0.4;

      // paleta de Marte: da ferrugem escura ao laranja quente
      vec3 escuro = vec3(0.30, 0.07, 0.05);
      vec3 medio  = vec3(0.72, 0.26, 0.12);
      vec3 claro  = vec3(0.97, 0.56, 0.30);
      vec3 col = mix(escuro, medio, smoothstep(-0.35, 0.30, h));
      col = mix(col, claro, smoothstep(0.25, 0.75, h));

      // calotas polares geladas
      float polo = smoothstep(0.80, 0.96, abs(p.y) + n2 * 0.05);
      col = mix(col, vec3(0.93, 0.86, 0.82), polo * 0.85);

      // luz direcional + ambiente
      float dif = max(dot(normalize(vNormalW), normalize(uLight)), 0.0);
      col *= 0.16 + dif * 1.05;

      // brilho quente na borda (rim)
      float rim = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 3.0);
      col += rim * vec3(0.95, 0.38, 0.16) * (0.55 + uPulso * 0.35);

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const marte = new THREE.Mesh(marteGeo, marteMat);
scene.add(marte);

// Atmosfera: halo quente ao redor do planeta
{
  const atmGeo = new THREE.SphereGeometry(RAIO_MARTE * 1.06, 64, 64);
  const atmMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
    uniforms: { uPulso: { value: 0 } },
    vertexShader: `
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        vNormalW = normalize(mat3(modelMatrix) * normal);
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vViewDir = normalize(cameraPosition - wp.xyz);
        gl_Position = projectionMatrix * viewMatrix * wp;
      }
    `,
    fragmentShader: `
      uniform float uPulso;
      varying vec3 vNormalW;
      varying vec3 vViewDir;
      void main() {
        float f = pow(1.0 - max(dot(normalize(vNormalW), normalize(vViewDir)), 0.0), 2.3);
        vec3 col = vec3(1.0, 0.45, 0.20);
        gl_FragColor = vec4(col * f, f * (0.9 + uPulso * 0.4));
      }
    `,
  });
  var atmosfera = new THREE.Mesh(atmGeo, atmMat);
  scene.add(atmosfera);
}

/* =========================================================
   4. Estrelas orbitando Marte
   Dois tipos de estrela giram em volta do planeta:
   - laranjas: os poemas
   - DOURADAS: as frases de vocês duas (as "estrelas-nós")
   Elas são intercaladas pra se espalharem entre as órbitas.
   ========================================================= */
const itens = [];
{
  // Prepara cada item já com tudo que o painel precisa mostrar
  let np = 0;
  const listaPoemas = poemas.map((p) => {
    np++;
    return {
      tipo: "poema",
      conta: `poema ${np} de ${poemas.length}`,
      titulo: p.titulo,
      versos: p.versos,
      rotulo: p.titulo,
    };
  });
  let nf = 0;
  const listaFrases = frases.map((f) => {
    nf++;
    return {
      tipo: "frase",
      conta: `das nossas conversas · ${nf} de ${frases.length}`,
      titulo: "nós ✦",
      // quebra a frase em sentenças pra cair em cascata também
      versos: f.texto.split(/(?<=[.?!])\s+/),
      rotulo: "✦ uma coisa que a gente diz",
    };
  });
  // intercala: 2 poemas, 1 frase, 2 poemas, 1 frase...
  while (listaPoemas.length || listaFrases.length) {
    if (listaPoemas.length) itens.push(listaPoemas.shift());
    if (listaPoemas.length) itens.push(listaPoemas.shift());
    if (listaFrases.length) itens.push(listaFrases.shift());
  }
}

const N = itens.length;
const orbitas = []; // params de cada órbita
const estrelaGeo = new THREE.BufferGeometry();
const posEstrelas = new Float32Array(N * 3);
const corEstrelas = new Float32Array(N * 3);
const idEstrelas = new Float32Array(N);
const goldEstrelas = new Float32Array(N); // 1 = estrela dourada (frase)

for (let i = 0; i < N; i++) {
  // eixo aleatório de inclinação da órbita
  const axis = new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize();
  let u = new THREE.Vector3(0, 1, 0).cross(axis);
  if (u.lengthSq() < 0.001) u = new THREE.Vector3(1, 0, 0).cross(axis);
  u.normalize();
  const v = axis.clone().cross(u).normalize();

  orbitas.push({
    u,
    v,
    raio: RAIO_MARTE + 1.3 + i * 0.45 + Math.random() * 0.25,
    fase: Math.random() * Math.PI * 2,
    vel: 0.05 + Math.random() * 0.06,
  });

  const dourada = itens[i].tipo === "frase";
  const c = dourada
    ? new THREE.Color().setHSL(0.115, 0.95, 0.78) // dourado quente
    : new THREE.Color().setHSL(0.05 + Math.random() * 0.05, 0.9, 0.72);
  corEstrelas[i * 3] = c.r;
  corEstrelas[i * 3 + 1] = c.g;
  corEstrelas[i * 3 + 2] = c.b;
  idEstrelas[i] = i;
  goldEstrelas[i] = dourada ? 1 : 0;
}

estrelaGeo.setAttribute("position", new THREE.BufferAttribute(posEstrelas, 3));
estrelaGeo.setAttribute("aColor", new THREE.BufferAttribute(corEstrelas, 3));
estrelaGeo.setAttribute("aId", new THREE.BufferAttribute(idEstrelas, 1));
estrelaGeo.setAttribute("aGold", new THREE.BufferAttribute(goldEstrelas, 1));

const estrelaMat = new THREE.ShaderMaterial({
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  transparent: true,
  uniforms: {
    uSize: { value: (isMobile ? 165 : 135) * pixelRatio },
    uSelected: { value: -1 },
    uHover: { value: -1 },
    uTime: { value: 0 },
  },
  vertexShader: `
    uniform float uSize;
    uniform float uSelected;
    uniform float uHover;
    uniform float uTime;
    attribute float aId;
    attribute float aGold;
    attribute vec3 aColor;
    varying vec3 vColor;
    varying float vBright;
    void main() {
      vec4 mv = modelViewMatrix * vec4(position, 1.0);
      gl_Position = projectionMatrix * mv;
      float pulso = 0.9 + 0.18 * sin(uTime * 2.0 + aId * 1.7);
      // douradas (as frases de vocês) são maiores e mais vivas
      float sizeMul = pulso * (1.0 + aGold * 0.35);
      float bright = 1.4 + aGold * 0.5;
      if (abs(aId - uSelected) < 0.5) { sizeMul = 2.4; bright = 2.6; }
      else if (abs(aId - uHover) < 0.5) { sizeMul = 1.7; bright = 2.0; }
      gl_PointSize = uSize * sizeMul * (1.0 / -mv.z);
      vColor = aColor;
      vBright = bright;
    }
  `,
  fragmentShader: `
    varying vec3 vColor;
    varying float vBright;
    void main() {
      float d = distance(gl_PointCoord, vec2(0.5));
      // núcleo branco-quente e um halo colorido ao redor (a estrela "brilha")
      float core = clamp(1.0 - d * 2.0, 0.0, 1.0);
      float halo = pow(clamp(1.0 - d * 1.6, 0.0, 1.0), 2.2);
      // anel fino ao redor: sinal de que a estrela é um "botão" tocável
      float anel = smoothstep(0.035, 0.0, abs(d - 0.40));
      vec3 col = mix(vColor, vec3(1.0), pow(core, 2.2));
      col += vec3(1.0, 0.85, 0.62) * anel * 0.7;
      float alpha = (pow(core, 1.5) + halo * 0.35 + anel * 0.55) * vBright;
      gl_FragColor = vec4(col * 1.2, alpha);
    }
  `,
});
const estrelas = new THREE.Points(estrelaGeo, estrelaMat);
scene.add(estrelas);

// Atualiza as posições das estrelas nas órbitas
function moverEstrelas(t) {
  const pos = estrelaGeo.attributes.position.array;
  for (let i = 0; i < N; i++) {
    const o = orbitas[i];
    const a = t * o.vel + o.fase;
    const x = Math.cos(a) * o.raio;
    const y = Math.sin(a) * o.raio;
    pos[i * 3] = o.u.x * x + o.v.x * y;
    pos[i * 3 + 1] = o.u.y * x + o.v.y * y;
    pos[i * 3 + 2] = o.u.z * x + o.v.z * y;
  }
  estrelaGeo.attributes.position.needsUpdate = true;
}

/* =========================================================
   5. Estrelas cadentes ocasionais
   ========================================================= */
const cadentes = [];
function criarCadente() {
  const g = new THREE.BufferGeometry();
  // direção variada pra não parecerem riscos paralelos
  const dir = new THREE.Vector3(
    -0.7 - Math.random() * 0.5,
    -0.1 - Math.random() * 0.7,
    (Math.random() - 0.5) * 0.9
  ).normalize();
  const start = new THREE.Vector3(
    14 + Math.random() * 12,
    2 + Math.random() * 14,
    -10 + Math.random() * 20
  );
  const pts = [start.clone(), start.clone().addScaledVector(dir, 3.5)];
  g.setFromPoints(pts);
  const m = new THREE.LineBasicMaterial({
    color: 0xffb27a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
  });
  const linha = new THREE.Line(g, m);
  scene.add(linha);
  cadentes.push({ linha, dir, vida: 0, dur: 1.1 + Math.random() * 0.6, vel: 26 });
}
setInterval(() => {
  if (!viagemComecou) return;
  if (Math.random() < 0.5) criarCadente();
}, 3400);

function atualizarCadentes(dt) {
  for (let i = cadentes.length - 1; i >= 0; i--) {
    const c = cadentes[i];
    c.vida += dt;
    const p = c.vida / c.dur;
    c.linha.position.addScaledVector(c.dir, c.vel * dt);
    c.linha.material.opacity = Math.sin(Math.min(p, 1) * Math.PI) * 0.9;
    if (p >= 1) {
      scene.remove(c.linha);
      c.linha.geometry.dispose();
      c.linha.material.dispose();
      cadentes.splice(i, 1);
    }
  }
}

/* =========================================================
   6. Interação: hover e toque nas estrelas
   Em vez de raycaster, medimos a distância NA TELA até cada
   estrela e abrimos a mais próxima do dedo — no celular fica
   muito mais fácil acertar o toque.
   ========================================================= */
const RAIO_TOQUE = isMobile ? 48 : 26; // tolerância em pixels

function estrelaPertoDe(x, y, raioPx) {
  let melhor = -1;
  let melhorD = raioPx;
  for (let i = 0; i < N; i++) {
    const p = posicaoNaTela(i);
    if (!p.visivel) continue;
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < melhorD) {
      melhorD = d;
      melhor = i;
    }
  }
  return melhor;
}

let hoverId = -1;
let guiaId = -1; // estrela que fica destacada com "toque aqui" até o 1º toque

if (!isMobile) {
  canvas.addEventListener("pointermove", (e) => {
    if (!viagemComecou) return;
    hoverId = estrelaPertoDe(e.clientX, e.clientY, RAIO_TOQUE);
    canvas.style.cursor = hoverId >= 0 ? "pointer" : "grab";
  });
}

let down = null;
canvas.addEventListener("pointerdown", (e) => {
  down = { x: e.clientX, y: e.clientY, t: Date.now() };
});
canvas.addEventListener("pointerup", (e) => {
  if (!down) return;
  const movido = Math.hypot(e.clientX - down.x, e.clientY - down.y);
  const rapido = Date.now() - down.t < 500;
  down = null;
  // controls.enabled só liga quando a câmera termina de chegar —
  // evita abrir poema com clique acidental durante o voo de entrada
  if (viagemComecou && controls.enabled && movido < 10 && rapido) {
    const id = estrelaPertoDe(e.clientX, e.clientY, RAIO_TOQUE);
    if (id >= 0) abrirPoema(id);
  }
});

/* =========================================================
   7. Rótulo que segue a estrela em foco
   ========================================================= */
const rotulo = document.getElementById("rotulo");
const _v = new THREE.Vector3();

function posicaoNaTela(id) {
  const pos = estrelaGeo.attributes.position.array;
  _v.set(pos[id * 3], pos[id * 3 + 1], pos[id * 3 + 2]);
  _v.applyMatrix4(estrelas.matrixWorld).project(camera);
  return {
    x: (_v.x * 0.5 + 0.5) * sizes.width,
    y: (-_v.y * 0.5 + 0.5) * sizes.height,
    visivel: _v.z < 1,
  };
}

function atualizarRotulo() {
  let id = -1;
  let texto = "";
  if (poemaAtual >= 0) {
    id = poemaAtual;
    texto = itens[id].rotulo;
  } else if (hoverId >= 0 && viagemComecou) {
    id = hoverId;
    texto = itens[id].rotulo;
  } else if (guiaId >= 0 && viagemComecou) {
    // ensina o toque: acompanha uma estrela com o convite
    id = guiaId;
    texto = "✦ toque aqui pra abrir";
  }
  if (id < 0) {
    rotulo.style.opacity = 0;
    return;
  }
  rotulo.style.display = "block";
  rotulo.textContent = texto;
  const p = posicaoNaTela(id);
  rotulo.style.opacity = p.visivel ? 1 : 0;
  rotulo.style.left = p.x + "px";
  rotulo.style.top = p.y + "px";
}

/* =========================================================
   8. Painel de poema
   ========================================================= */
const poemaEl = document.getElementById("poema");
const poemaTitulo = document.getElementById("poemaTitulo");
const poemaCorpo = document.getElementById("poemaCorpo");
const poemaConta = document.getElementById("poemaConta");
let poemaAtual = -1;

function abrirPoema(id) {
  poemaAtual = ((id % N) + N) % N;
  guiaId = -1; // o convite "toque aqui" já cumpriu o papel
  const p = itens[poemaAtual];
  estrelaMat.uniforms.uSelected.value = poemaAtual;

  poemaConta.textContent = p.conta;
  poemaTitulo.textContent = p.titulo;
  // frases de vocês ganham um ar de "recado" no painel
  poemaEl.classList.toggle("poema--nos", p.tipo === "frase");

  // Monta os versos com uma leve animação em cascata
  poemaCorpo.innerHTML = "";
  p.versos.forEach((linha, i) => {
    if (linha === "") {
      const espaco = document.createElement("span");
      espaco.className = "vazio";
      poemaCorpo.appendChild(espaco);
      return;
    }
    const el = document.createElement("div");
    el.className = "verso";
    el.textContent = linha;
    el.style.animationDelay = `${0.15 + i * 0.09}s`;
    poemaCorpo.appendChild(el);
  });

  poemaEl.classList.add("aberto");
  poemaEl.setAttribute("aria-hidden", "false");
}

function fecharPoema() {
  poemaEl.classList.remove("aberto");
  poemaEl.setAttribute("aria-hidden", "true");
  estrelaMat.uniforms.uSelected.value = -1;
  poemaAtual = -1;
}

document.getElementById("fecharPoema").addEventListener("click", fecharPoema);
document.getElementById("poemaProximo").addEventListener("click", () => abrirPoema(poemaAtual + 1));
document.getElementById("poemaAnterior").addEventListener("click", () => abrirPoema(poemaAtual - 1));

window.addEventListener("keydown", (e) => {
  if (poemaEl.classList.contains("aberto")) {
    if (e.key === "ArrowRight") abrirPoema(poemaAtual + 1);
    if (e.key === "ArrowLeft") abrirPoema(poemaAtual - 1);
    if (e.key === "Escape") fecharPoema();
  }
});

/* =========================================================
   9. Player da música (o pilar da experiência)
   Toca o arquivo "musica.mp3" da pasta, em loop, com um
   player próprio — sem tela do Spotify no meio da viagem.
   ========================================================= */
const player = document.getElementById("player");
const audio = document.getElementById("audio");
const botaoTocar = document.getElementById("tocarPausar");
const barra = document.getElementById("barra");
const progresso = document.getElementById("progresso");
const playerLegenda = document.getElementById("playerLegenda");

let audioOk = true;
function semMusica() {
  audioOk = false;
  playerLegenda.textContent = "coloque o arquivo musica.mp3 na pasta";
}
audio.addEventListener("error", semMusica);
// o erro pode ter acontecido antes do script carregar — confere agora
if (audio.error || audio.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
  semMusica();
}

function tocarMusica() {
  if (!audioOk) return;
  // navegadores só deixam tocar depois de um gesto — o botão
  // "Começar a viagem" é esse gesto
  audio.play().catch(() => {});
}

botaoTocar.addEventListener("click", () => {
  if (!audioOk) return;
  if (audio.paused) audio.play().catch(() => {});
  else audio.pause();
});

audio.addEventListener("play", () => {
  botaoTocar.textContent = "❚❚";
  botaoTocar.classList.add("tocando");
});
audio.addEventListener("pause", () => {
  botaoTocar.textContent = "▶";
  botaoTocar.classList.remove("tocando");
});

audio.addEventListener("timeupdate", () => {
  if (!audio.duration) return;
  progresso.style.width = (audio.currentTime / audio.duration) * 100 + "%";
});

// Clicar na barra pula pra aquele ponto da música
barra.addEventListener("click", (e) => {
  if (!audioOk || !audio.duration) return;
  const r = barra.getBoundingClientRect();
  audio.currentTime = ((e.clientX - r.left) / r.width) * audio.duration;
});

document.getElementById("playerToggle").addEventListener("click", () => {
  player.classList.toggle("recolhido");
});

/* =========================================================
   10. Dedicatória final
   ========================================================= */
const dedicatoria = document.getElementById("dedicatoria");
document.getElementById("botaoFinal").addEventListener("click", () => {
  dedicatoria.classList.add("aberta");
});
document.getElementById("fecharDedicatoria").addEventListener("click", () => {
  dedicatoria.classList.remove("aberta");
});
dedicatoria.addEventListener("click", (e) => {
  if (e.target === dedicatoria) dedicatoria.classList.remove("aberta");
});

/* =========================================================
   11. A viagem: câmera se aproxima de Marte ao começar
   ========================================================= */
let viagemComecou = false;
let introInicio = 0;
const camDe = new THREE.Vector3(0, 3, 26);
const camPara = new THREE.Vector3(0, 1.6, 8.5);
const DUR_INTRO = 4.2;

function comecarViagem() {
  if (viagemComecou) return;
  viagemComecou = true;
  introInicio = clock.getElapsedTime();
  tocarMusica(); // a música começa junto com a viagem

  document.getElementById("abertura").classList.add("oculta");
  document.getElementById("marca").classList.add("visivel");
  document.getElementById("player").style.opacity = 1;

  // botões só aparecem quando a câmera chega
  setTimeout(() => {
    document.getElementById("botaoFinal").classList.add("visivel");
  }, (DUR_INTRO + 0.5) * 1000);
}
document.getElementById("comecar").addEventListener("click", comecarViagem);

function easeInOut(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

/* =========================================================
   12. Loop principal
   ========================================================= */
const clock = new THREE.Clock();
let ultimo = 0;

function tick() {
  const t = clock.getElapsedTime();
  const dt = Math.min(t - ultimo, 0.05);
  ultimo = t;

  // Marte gira devagar; a atmosfera acompanha
  marte.rotation.y = t * 0.06;
  const pulso = 0.5 + 0.5 * Math.sin(t * 1.6);
  marteMat.uniforms.uPulso.value = pulso;
  if (typeof atmosfera !== "undefined") atmosfera.material.uniforms.uPulso.value = pulso;

  // Estrelas-poema nas órbitas
  moverEstrelas(t);
  estrelaMat.uniforms.uTime.value = t;

  atualizarCadentes(dt);

  // Animação de entrada da câmera
  if (viagemComecou) {
    const p = (t - introInicio) / DUR_INTRO;
    if (p < 1) {
      camera.position.lerpVectors(camDe, camPara, easeInOut(p));
      camera.lookAt(0, 0, 0);
    } else if (!controls.enabled) {
      controls.enabled = true;
      controls.target.set(0, 0, 0);
      // escolhe uma estrela perto do centro pra ensinar o toque
      guiaId = estrelaPertoDe(sizes.width / 2, sizes.height / 2, 99999);
    }
  }

  // destaque no shader: hover do mouse ou a estrela-guia
  estrelaMat.uniforms.uHover.value = hoverId >= 0 ? hoverId : guiaId;

  controls.update();
  renderer.render(scene, camera);
  atualizarRotulo();
  window.requestAnimationFrame(tick);
}

window.addEventListener("resize", () => {
  sizes.width = window.innerWidth;
  sizes.height = window.innerHeight;
  camera.aspect = sizes.width / sizes.height;
  camera.updateProjectionMatrix();
  renderer.setSize(sizes.width, sizes.height);
});

// Dica adaptada ao aparelho
document.getElementById("dica").textContent = isMobile
  ? "toque nas estrelas · as douradas guardam as nossas palavras"
  : "clique nas estrelas · as douradas guardam as nossas palavras";

tick();
