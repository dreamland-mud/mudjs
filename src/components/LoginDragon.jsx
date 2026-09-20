import React, { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import '../login-dragon.css';

// The ghost-dragon that perches behind the login card: a rigged Meshy drake in obsidian
// with glowing cyan eyes/cracks and a blue-cyan arcane orb whose core is a white->brand
// (#bb86fc, the logo colour) gradient. It watches the cursor, breathes, flaps a wing on
// click, and shakes its head "no" on a wrong password (parent calls .shake()). Decorative
// and aria-hidden; a static poster covers prefers-reduced-motion and the load. All the
// numbers below were dialled on the live prototype and are frozen here.
const DIR = (import.meta.env.BASE_URL || '/') + 'dragon/';

// frozen tuning
const ROT = -0.54;                       // model.rotation.y -- faces the camera
const BODY = [0x2c / 255 * 0.34, 0x32 / 255 * 0.34, 0x3b / 255 * 0.34]; // obsidian multiplier (brightness 0.34)
const FEAT = 1.65;                       // eyes/cracks emissive
const ORB_EMIT = 2.2;                    // orb glow strength
const FLAP = 0.12;                       // idle wing amplitude
const PERCH = 0.61, ZOOM = 0.70;         // framing
const HALO = 0.20;                       // outer cyan glow (canvas drop-shadow + bottom pool)
const ORB = new THREE.Vector3(0.29, 1.02, 0.52); // orb centre (object space)
const ORB_R = 0.15;
const ORB_PULSE_S = 2.6;                 // orb glow period -- matches the login input focus orbit
const WINGS = ['Bone_028', 'Bone_029', 'Bone_030', 'Bone_031']; // the upper-back pair + tips
const HEAD_BONE = 'Bone_032';
const ORB_BLUE = 'vec3(0.36,0.52,1.0)';  // orb glow colour in the shader (blends toward cyan)

const LoginDragon = forwardRef(function LoginDragon(props, ref) {
  const hostRef = useRef(null);
  const posterRef = useRef(null);
  const api = useRef({ shake() {} });          // set once the scene is live
  useImperativeHandle(ref, () => ({ shake: () => api.current.shake() }), []);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return; // poster stays, no WebGL
    const host = hostRef.current;
    if (!host) return;
    let raf = 0, renderer = null, disposed = false;

    try {
      let W = host.clientWidth, H = host.clientHeight;
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      renderer.setSize(W, H);
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.2;
      renderer.setClearColor(0x000000, 0);      // transparent -> no box around the dragon
      renderer.domElement.style.filter =        // baked outer cyan halo
        `drop-shadow(0 0 ${14 * HALO}px rgba(57,214,255,${0.5 * HALO})) drop-shadow(0 0 ${6 * HALO}px rgba(57,214,255,${0.6 * HALO}))`;
      host.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 100);
      camera.position.set(0, 0, 7); camera.lookAt(0, 0, 0);
      let modelSize = null;
      function fitView() {
        if (!modelSize) return;
        const aspect = host.clientWidth / host.clientHeight;
        const vfov = THREE.MathUtils.degToRad(camera.fov);
        const fitH = (modelSize.y * 0.60) / Math.tan(vfov / 2);
        const fitW = (modelSize.x / 2) / (Math.tan(vfov / 2) * aspect);
        const dist = Math.max(fitH, fitW * 0.9) * ZOOM;
        const cy = modelSize.y * PERCH;
        camera.position.set(0, cy, dist); camera.lookAt(0, cy, 0);
        camera.aspect = aspect; camera.updateProjectionMatrix();
      }

      scene.add(new THREE.AmbientLight(0x233040, 0.55));
      const key = new THREE.DirectionalLight(0xbcc6e0, 0.6); key.position.set(-3, 2.5, 4); scene.add(key);
      const rim = new THREE.DirectionalLight(0x39d6ff, 1.3); rim.position.set(2.5, 3, -4); scene.add(rim);
      const under = new THREE.DirectionalLight(0x2a6f9f, 0.35); under.position.set(0, -2, 3); scene.add(under);

      const root = new THREE.Group(); scene.add(root);
      const meshMats = [];
      let head = null;
      let orbLight = null, orbSprite = null, orbBase = 0;   // set once the orb is built; pulsed in animate()
      const rest = new WeakMap();
      const flapBones = {};

      // same-origin PNG textures (never depend on the GLB's blob: URLs)
      const texLoader = new THREE.TextureLoader();
      const setTex = (file, srgb, apply) => texLoader.load(DIR + file, tx => {
        tx.flipY = false;
        tx.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
        tx.needsUpdate = true;
        for (const m of meshMats) { apply(m, tx); m.needsUpdate = true; }
      });

      new GLTFLoader().load(DIR + 'dragon.glb', gltf => {
        if (disposed) return;
        try {
          const model = gltf.scene;
          model.traverse(o => {
            if (o.isMesh && o.material) {
              o.frustumCulled = false;
              const m = o.material;
              m.emissiveMap = m.map || null;
              m.emissive = m.map ? new THREE.Color(0xffffff) : new THREE.Color(0x39d6ff);
              m.color = new THREE.Color().setRGB(BODY[0], BODY[1], BODY[2]);
              m.emissiveIntensity = FEAT;
              m.metalness = 0.1; m.roughness = 0.72;
              m.onBeforeCompile = sh => {
                m.userData.shader = sh;
                sh.uniforms.uOrbEmit = { value: ORB_EMIT };
                sh.uniforms.uOrbPos = { value: ORB.clone() };
                sh.uniforms.uOrbR = { value: ORB_R };
                sh.vertexShader = sh.vertexShader
                  .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;')
                  .replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;');
                sh.fragmentShader = sh.fragmentShader
                  .replace('#include <common>', '#include <common>\nvarying vec3 vObjPos;\nuniform float uOrbEmit;\nuniform vec3 uOrbPos;\nuniform float uOrbR;')
                  .replace('#include <emissivemap_fragment>',
                    // gate emissive to strong-cyan texels (eyes/cracks), dark body stays dark.
                    // MUST stay inside USE_EMISSIVEMAP so a map-less material can't break the compile.
                    '#ifdef USE_EMISSIVEMAP\n' +
                    '  vec4 _em=texture2D(emissiveMap, vEmissiveMapUv);\n' +
                    '  float _cy=max(_em.g,_em.b);\n' +
                    '  float _gate=smoothstep(0.42,0.62,_cy);\n' +
                    '  totalEmissiveRadiance *= _em.rgb*_gate;\n' +
                    '  float _eye=smoothstep(0.62,0.85,_cy);\n' +          // eyes = hottest cyan -> pinned full, ignores FEAT
                    '  totalEmissiveRadiance=mix(totalEmissiveRadiance, vec3(0.0,1.0,1.0)*2.4, _eye);\n' +
                    '#endif\n' +
                    '  float _rim=pow(1.0-clamp(dot(normalize(vNormal),normalize(vViewPosition)),0.0,1.0),4.0);\n' +
                    '  totalEmissiveRadiance+=vec3(0.0,0.85,1.0)*_rim*0.45;\n' +
                    // orb: recolour emissive to blue-cyan inside a sphere at the raised hand
                    '  float _od=distance(vObjPos, uOrbPos);\n' +
                    '  float _op=1.0 - smoothstep(uOrbR*0.4, uOrbR, _od);\n' +
                    '  totalEmissiveRadiance=mix(totalEmissiveRadiance, ' + ORB_BLUE + '*uOrbEmit, _op);'
                  );
              };
              m.needsUpdate = true; meshMats.push(m);
            }
          });
          model.rotation.y = ROT;
          root.add(model);
          model.updateWorldMatrix(true, true);

          const box = new THREE.Box3();
          model.traverse(o => {
            if (o.isMesh && o.geometry) {
              if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
              box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
            }
          });
          if (box.isEmpty()) box.set(new THREE.Vector3(-1.24, 0, -1.05), new THREE.Vector3(1.21, 1.70, 1.04));
          const center = box.getCenter(new THREE.Vector3());
          modelSize = box.getSize(new THREE.Vector3());
          model.position.sub(new THREE.Vector3(center.x, box.min.y, center.z)); // feet at y=0
          fitView();

          head = model.getObjectByName(HEAD_BONE);
          if (head) rest.set(head, head.quaternion.clone());

          const wpos = new THREE.Vector3();
          for (const n of WINGS) {
            const b = model.getObjectByName(n);
            if (!b) continue;
            b.getWorldPosition(wpos);
            flapBones[n] = { obj: b, rest: b.quaternion.clone(), side: wpos.x >= 0 ? 1 : -1 };
          }

          // real light + white->brand-purple gradient core at the orb hand
          orbLight = new THREE.PointLight(0x6a86ff, ORB_EMIT, 2.6, 2.0);
          orbLight.position.copy(ORB); model.add(orbLight);
          const cv = document.createElement('canvas'); cv.width = cv.height = 128;
          const g = cv.getContext('2d'); const rg = g.createRadialGradient(64, 64, 0, 64, 64, 64);
          rg.addColorStop(0, 'rgba(255,255,255,1)'); rg.addColorStop(0.30, 'rgba(224,198,255,0.95)');
          rg.addColorStop(0.60, 'rgba(187,134,252,0.5)'); rg.addColorStop(1, 'rgba(187,134,252,0)');
          g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
          const spTex = new THREE.CanvasTexture(cv); spTex.colorSpace = THREE.SRGBColorSpace;
          orbSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: spTex, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false }));
          orbSprite.position.copy(ORB); orbBase = ORB_R * 2.6; orbSprite.scale.set(orbBase, orbBase, orbBase);
          model.add(orbSprite);

          setTex('albedo.png', true, (m, tx) => { m.map = tx; m.emissiveMap = tx; });
          setTex('normal.png', false, (m, tx) => { m.normalMap = tx; });
          setTex('mr.png', false, (m, tx) => { m.roughnessMap = tx; m.metalnessMap = tx; m.metalness = 1.0; m.roughness = 1.0; });

          if (posterRef.current) posterRef.current.style.display = 'none';
        } catch (e) { /* leave the poster up if the model can't be dressed */ }
      }, undefined, () => { /* GLB failed to load: poster stays */ });

      // interaction: cursor tracking + click flap + head-raise; shake() driven from the parent
      let px = 0, py = 0, tx = 0, ty = 0, clickAt = -999, shakeAt = -999;
      const clock = new THREE.Clock();
      api.current.shake = () => { shakeAt = clock.getElapsedTime(); };
      const onMove = e => { px = (e.clientX / innerWidth) * 2 - 1; py = (e.clientY / innerHeight) * 2 - 1; };
      const onDown = () => { clickAt = clock.getElapsedTime(); };
      addEventListener('pointermove', onMove);
      host.addEventListener('pointerdown', onDown);

      const _pw = new THREE.Quaternion(), _rw = new THREE.Quaternion(), _dw = new THREE.Quaternion(),
        _tw = new THREE.Quaternion(), _e = new THREE.Euler(), _q = new THREE.Quaternion(),
        _pf = new THREE.Quaternion(), _df = new THREE.Quaternion(), _Z = new THREE.Vector3(0, 0, 1);
      function aimHead(yaw, pitch) {
        if (!head || !head.parent) return;
        head.parent.getWorldQuaternion(_pw);
        _rw.copy(_pw).multiply(rest.get(head));
        _e.set(pitch, yaw, 0, 'YXZ'); _dw.setFromEuler(_e);
        _tw.copy(_dw).multiply(_rw);
        _q.copy(_pw).invert().multiply(_tw);
        head.quaternion.slerp(_q, 0.18);
      }
      function flapBone(fb, angle) {          // rotate about world-Z, expressed in the bone's parent frame
        fb.obj.parent.getWorldQuaternion(_pf);
        _df.setFromAxisAngle(_Z, angle);
        _q.copy(_pf).invert().multiply(_df).multiply(_pf).multiply(fb.rest);
        fb.obj.quaternion.copy(_q);
      }

      function animate(t) {
        tx += (px - tx) * 0.06; ty += (py - ty) * 0.06;
        const ct = t - clickAt, st = t - shakeAt;
        const wp = (ct >= 0 && ct < 0.45) ? Math.sin(ct / 0.45 * Math.PI) * 0.85 : 0;   // one fast wing flap (eased)
        const hr = (ct >= 0 && ct < 0.5) ? Math.sin(ct / 0.5 * Math.PI) * 0.32 : 0;      // head-raise with the flap
        const sh = (st >= 0 && st < 0.8) ? Math.sin(st * 18.0) * 0.6 * (1 - st / 0.8) : 0; // "no" head-shake
        root.rotation.y = -tx * 0.10;
        aimHead(tx * 0.5 + sh, ty * 0.30 + Math.sin(t * 1.3) * 0.05 - hr);
        const wingAng = FLAP * Math.sin(t * 2.2) + wp;
        for (const n in flapBones) {
          const fb = flapBones[n];
          if (WINGS.indexOf(n) >= 0) flapBone(fb, wingAng * fb.side);
        }
        // orb glow pulses on the same 2.6s cadence as a focused login input
        // (pc-focus-orbit), so the crest and the form breathe together
        const orbPulse = 0.5 + 0.5 * Math.sin(t * (Math.PI * 2 / ORB_PULSE_S)); // 0..1
        const orbEmit = ORB_EMIT * (0.75 + 0.5 * orbPulse);                     // ~0.75..1.25 x
        const breathe = FEAT * (1 + Math.sin(t * 1.4) * 0.12);
        for (const m of meshMats) {
          m.emissiveIntensity = breathe;
          if (m.userData.shader) m.userData.shader.uniforms.uOrbEmit.value = orbEmit;
        }
        if (orbLight) orbLight.intensity = orbEmit;
        if (orbSprite) { const s = orbBase * (0.9 + 0.2 * orbPulse); orbSprite.scale.set(s, s, s); }
      }
      function tick() {
        raf = requestAnimationFrame(tick);
        try { animate(clock.getElapsedTime()); } catch (e) { /* a bad frame must not blank the login */ }
        renderer.render(scene, camera);        // always render
      }
      tick();

      const onResize = () => { W = host.clientWidth; H = host.clientHeight; renderer.setSize(W, H); fitView(); };
      addEventListener('resize', onResize);

      return () => {
        disposed = true;
        cancelAnimationFrame(raf);
        removeEventListener('pointermove', onMove);
        removeEventListener('resize', onResize);
        host.removeEventListener('pointerdown', onDown);
        try { renderer.dispose(); } catch (e) { /* ignore */ }
        if (renderer && renderer.domElement && renderer.domElement.parentNode)
          renderer.domElement.parentNode.removeChild(renderer.domElement);
      };
    } catch (e) {
      // WebGL unavailable / init failed: the poster carries the login
      if (renderer) { try { renderer.dispose(); } catch (_) { /* ignore */ } }
      return () => { disposed = true; if (raf) cancelAnimationFrame(raf); };
    }
  }, []);

  return (
    <div className="login-dragon" aria-hidden="true">
      <img ref={posterRef} className="ld-poster" src={DIR + 'poster.webp'} alt="" />
      <div className="ld-scene" ref={hostRef} />
      <div className="ld-glow" />
    </div>
  );
});

export default LoginDragon;
