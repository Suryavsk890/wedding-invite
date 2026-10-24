/* =========================================================
   1. 3D SCENE — shader background + glowing diamond ring
   ========================================================= */
const canvas = document.getElementById('scene');
const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 200);
camera.position.set(0, 0.2, 5.5);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

/* ---------- Shader background plane ---------- */
const bgGeo = new THREE.PlaneGeometry(40, 40);
const bgMat = new THREE.ShaderMaterial({
  uniforms: {
    uTime: { value: 0 },
    uColorA: { value: new THREE.Color('#0a0710') },
    uColorB: { value: new THREE.Color('#1a0f22') },
    uColorC: { value: new THREE.Color('#3a2410') },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform float uTime;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    varying vec2 vUv;

    // cheap noise
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }
    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x),
        u.y
      );
    }
    float fbm(vec2 p) {
      float v = 0.0;
      float a = 0.5;
      for (int i = 0; i < 5; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      vec2 uv = vUv;
      vec2 p = uv * 2.5;
      float t = uTime * 0.08;

      float n = fbm(p + vec2(t, t * 0.7));
      float glow = smoothstep(0.25, 0.85, n);

      vec3 col = mix(uColorA, uColorB, uv.y);
      col = mix(col, uColorC, glow * 0.55);

      // radial spotlight in the middle
      float d = distance(uv, vec2(0.5));
      col += uColorC * pow(1.0 - smoothstep(0.0, 0.7, d), 3.0) * 0.25;

      // vignette
      col *= 1.0 - smoothstep(0.55, 1.0, d) * 0.6;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
});
const bgPlane = new THREE.Mesh(bgGeo, bgMat);
bgPlane.position.z = -8;
scene.add(bgPlane);

/* ---------- Lights ---------- */
scene.add(new THREE.AmbientLight(0xffffff, 0.25));

const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.6);
keyLight.position.set(3, 4, 5);
scene.add(keyLight);

const rimLight = new THREE.PointLight(0xd9b779, 12, 14);
rimLight.position.set(-3.2, -1.5, -2);
scene.add(rimLight);

const fillLight = new THREE.PointLight(0x8899ff, 3, 12);
fillLight.position.set(2, -2, 3);
scene.add(fillLight);

const auraLight = new THREE.PointLight(0xffd89b, 6, 8);
auraLight.position.set(0, 1.4, 1);
scene.add(auraLight);

/* ---------- Ring group ---------- */
const ringGroup = new THREE.Group();
scene.add(ringGroup);

// Gold band
const bandGeo = new THREE.TorusGeometry(1.05, 0.085, 40, 200);
const bandMat = new THREE.MeshStandardMaterial({
  color: 0xd9b779,
  metalness: 1,
  roughness: 0.14,
  envMapIntensity: 1.2,
});
const band = new THREE.Mesh(bandGeo, bandMat);
ringGroup.add(band);

// Secondary thin band (delicate)
const band2Geo = new THREE.TorusGeometry(1.05, 0.03, 20, 160);
const band2 = new THREE.Mesh(band2Geo, bandMat.clone());
band2.position.z = 0.12;
band2.material.roughness = 0.22;
ringGroup.add(band2);

// Diamond (octahedron)
const diamondGeo = new THREE.OctahedronGeometry(0.45, 0);
const diamondMat = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  metalness: 0,
  roughness: 0,
  transmission: 1,
  thickness: 0.8,
  ior: 2.42,
  clearcoat: 1,
  clearcoatRoughness: 0,
  envMapIntensity: 2.2,
  emissive: 0x221100,
  emissiveIntensity: 0.2,
});
const diamond = new THREE.Mesh(diamondGeo, diamondMat);
diamond.position.y = 1.18;
ringGroup.add(diamond);

// Sparkle point light inside diamond
const sparkle = new THREE.PointLight(0xffe0a3, 4, 4);
sparkle.position.copy(diamond.position);
ringGroup.add(sparkle);

// Halo ring around diamond (additive)
const haloGeo = new THREE.RingGeometry(0.55, 0.62, 64);
const haloMat = new THREE.MeshBasicMaterial({
  color: 0xffe0a3,
  transparent: true,
  opacity: 0.35,
  side: THREE.DoubleSide,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
});
const halo = new THREE.Mesh(haloGeo, haloMat);
halo.position.copy(diamond.position);
halo.rotation.x = Math.PI / 2.4;
ringGroup.add(halo);

/* ---------- Particles (gold dust) ---------- */
const COUNT = 1200;
const positions = new Float32Array(COUNT * 3);
const seeds = new Float32Array(COUNT);
for (let i = 0; i < COUNT; i++) {
  positions[i * 3 + 0] = (Math.random() - 0.5) * 22;
  positions[i * 3 + 1] = (Math.random() - 0.5) * 22;
  positions[i * 3 + 2] = (Math.random() - 0.5) * 22;
  seeds[i] = Math.random() * Math.PI * 2;
}
const pGeo = new THREE.BufferGeometry();
pGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const pMat = new THREE.PointsMaterial({
  color: 0xf2d8a3,
  size: 0.045,
  transparent: true,
  opacity: 0.85,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  sizeAttenuation: true,
});
const particles = new THREE.Points(pGeo, pMat);
scene.add(particles);

/* ---------- Falling petals (thin planes) ---------- */
const petalCount = 30;
const petals = [];
const petalGeo = new THREE.PlaneGeometry(0.09, 0.16);
const petalMat = new THREE.MeshBasicMaterial({
  color: 0xe8c9a3,
  transparent: true,
  opacity: 0.55,
  side: THREE.DoubleSide,
});
for (let i = 0; i < petalCount; i++) {
  const m = new THREE.Mesh(petalGeo, petalMat.clone());
  m.position.set((Math.random() - 0.5) * 12, Math.random() * 10 - 3, (Math.random() - 0.5) * 8 - 2);
  m.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
  m.userData = {
    speed: 0.3 + Math.random() * 0.6,
    sway: Math.random() * Math.PI * 2,
    swaySpeed: 0.6 + Math.random() * 1.2,
    rotSpeed: (Math.random() - 0.5) * 1.2,
  };
  scene.add(m);
  petals.push(m);
}

/* ---------- Resize ---------- */
addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

/* ---------- Mouse parallax ---------- */
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
addEventListener('mousemove', (e) => {
  mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
  mouse.ty = (e.clientY / innerHeight - 0.5) * 2;
});

/* =========================================================
   2. GSAP — scroll choreography
   ========================================================= */
gsap.registerPlugin(ScrollTrigger);

gsap.to(ringGroup.rotation, {
  y: Math.PI * 2,
  duration: 14,
  repeat: -1,
  ease: 'none',
});

gsap.timeline({
  scrollTrigger: {
    trigger: '.scroll-container',
    start: 'top top',
    end: 'bottom bottom',
    scrub: 1.2,
  },
})
  .to(camera.position, { z: 3.6, y: 0.6, ease: 'power2.inOut' }, 0)
  .to(ringGroup.rotation, { x: 0.5, z: 0.35 }, 0)
  .to(ringGroup.scale, { x: 0.75, y: 0.75, z: 0.75 }, 0.3)
  .to(camera.position, { z: 6.5, y: -0.4 }, 0.6)
  .to(ringGroup.scale, { x: 1.35, y: 1.35, z: 1.35 }, 0.85);

// Section reveals
gsap.utils.toArray('.section').forEach((section) => {
  const content = section.querySelector('.content');
  if (!content) return;
  gsap.from(content, {
    opacity: 0,
    y: 80,
    filter: 'blur(10px)',
    duration: 1.1,
    ease: 'power3.out',
    scrollTrigger: { trigger: section, start: 'top 70%' },
  });
});

// Hero letters
gsap.from('.names .name, .names .amp', {
  y: 40,
  opacity: 0,
  filter: 'blur(12px)',
  stagger: 0.15,
  duration: 1.4,
  ease: 'power3.out',
  delay: 0.6,
});

gsap.from('.hero .eyebrow, .hero .tagline, .hero .scroll-cue', {
  opacity: 0,
  y: 20,
  stagger: 0.15,
  duration: 1,
  ease: 'power3.out',
  delay: 1.2,
});

// Magnetic cards on hover
document.querySelectorAll('.card').forEach((card) => {
  card.addEventListener('mousemove', (e) => {
    const r = card.getBoundingClientRect();
    const mx = (e.clientX - r.left) / r.width - 0.5;
    const my = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(card, {
      rotateY: mx * 6,
      rotateX: -my * 6,
      transformPerspective: 900,
      duration: 0.6,
      ease: 'power2.out',
    });
  });
  card.addEventListener('mouseleave', () => {
    gsap.to(card, { rotateX: 0, rotateY: 0, duration: 0.8, ease: 'power3.out' });
  });
});

/* =========================================================
   3. Render loop
   ========================================================= */
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();

  // Background shader time
  bgMat.uniforms.uTime.value = t;

  // Gentle ring bob
  ringGroup.position.y = Math.sin(t * 0.8) * 0.08;

  // Diamond rotation
  diamond.rotation.y += 0.008;
  diamond.rotation.x = Math.sin(t * 0.6) * 0.15;

  // Halo pulsing
  halo.rotation.z += 0.003;
  halo.material.opacity = 0.25 + Math.sin(t * 1.6) * 0.12;

  // Sparkle + aura
  sparkle.intensity = 3 + Math.sin(t * 3) * 2;
  auraLight.intensity = 4 + Math.sin(t * 2.2) * 2;

  // Particle drift
  particles.rotation.y += 0.0006;
  particles.rotation.x += 0.00025;

  // Petals fall
  petals.forEach((p) => {
    const d = p.userData;
    p.position.y -= d.speed * 0.01;
    p.position.x += Math.sin(t * d.swaySpeed + d.sway) * 0.003;
    p.rotation.x += d.rotSpeed * 0.01;
    p.rotation.z += d.rotSpeed * 0.005;
    if (p.position.y < -4) {
      p.position.y = 6 + Math.random() * 2;
      p.position.x = (Math.random() - 0.5) * 12;
    }
  });

  // Mouse parallax (smooth)
  mouse.x += (mouse.tx - mouse.x) * 0.05;
  mouse.y += (mouse.ty - mouse.y) * 0.05;
  ringGroup.rotation.x += (mouse.y * 0.25 - ringGroup.rotation.x) * 0.05;
  camera.position.x += (mouse.x * 0.4 - camera.position.x) * 0.03;

  renderer.render(scene, camera);
}
animate();

/* =========================================================
   4. Loader
   ========================================================= */
addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('loader').classList.add('hidden');
  }, 800);
});

/* =========================================================
   5. Countdown
   ========================================================= */
const weddingDate = new Date('2026-06-12T17:00:00');

function pad(n) { return String(n).padStart(2, '0'); }

function tick() {
  const diff = weddingDate - new Date();
  if (diff <= 0) {
    ['days', 'hours', 'minutes', 'seconds'].forEach(id => {
      document.getElementById(id).textContent = '00';
    });
    return;
  }
  const d = Math.floor(diff / 86400000);
  const h = Math.floor(diff / 3600000) % 24;
  const m = Math.floor(diff / 60000) % 60;
  const s = Math.floor(diff / 1000) % 60;
  document.getElementById('days').textContent = pad(d);
  document.getElementById('hours').textContent = pad(h);
  document.getElementById('minutes').textContent = pad(m);
  document.getElementById('seconds').textContent = pad(s);
}
tick();
setInterval(tick, 1000);

/* =========================================================
   6. RSVP (client-side)
   ========================================================= */
document.getElementById('rsvp-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const name = document.getElementById('rsvp-name').value.trim();
  const attend = document.getElementById('rsvp-attend').value;
  const msg = document.getElementById('rsvp-msg');

  if (!name || !attend) return;

  msg.textContent = attend === 'yes'
    ? `Thank you, ${name}. We can't wait to celebrate with you. ✦`
    : `Thank you for letting us know, ${name}. You'll be missed. ✦`;

  gsap.fromTo(msg, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.6 });
  e.target.reset();
});
