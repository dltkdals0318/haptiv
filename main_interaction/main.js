import * as PIXI from "pixi.js";

// === 쨍한 색상 팔레트 ===
const VIVID_COLORS = [
  [180 / 255, 255 / 255, 100 / 255], // 라임
  [255 / 255, 80 / 255, 120 / 255],  // 핫핑크
  [80 / 255, 220 / 255, 255 / 255],  // 시안
  [255 / 255, 160 / 255, 40 / 255],  // 오렌지
  [180 / 255, 100 / 255, 255 / 255], // 퍼플
  [255 / 255, 230 / 255, 50 / 255],  // 옐로우
  [255 / 255, 100 / 255, 60 / 255],  // 코랄
  [100 / 255, 255 / 255, 180 / 255], // 민트
];

const randomColor =
  VIVID_COLORS[Math.floor(Math.random() * VIVID_COLORS.length)];

// === 3가지 질감 프리셋 ===
const PRESETS = {
  // 1) 기본 - 깔끔한 메타볼 (따라오고 + 밀어내기)
  default: {
    name: "기본 (Default)",
    blur: 8,
    blurQuality: 4,
    threshold: 0.5,
    particleRadius: 24,
    particleCount: 300,
    scaleMin: 0.3,
    scaleRange: 0.7,
    spreadRadius: 150,
    spring: 0.008,
    friction: 0.95,
    jitter: 0.15,
    mouseRadius: 60,
    repelForce: 5,
    attractRadius: 300,
    attractForce: 0.15,
    fragment: `
      precision mediump float;
      in vec2 vTextureCoord;
      out vec4 finalColor;
      uniform sampler2D uTexture;
      uniform float uThreshold;
      uniform vec3 uColor;

      void main(void) {
        vec4 color = texture(uTexture, vTextureCoord);
        if (color.a > uThreshold) {
          finalColor = vec4(uColor, 1.0);
        } else {
          finalColor = vec4(0.0);
        }
      }
    `,
  },

  // 2) 까슬까슬 - 입자가 흩뿌려지듯 튀고, 뚝뚝 끊기는 모래/자갈 느낌
  grainy: {
    name: "까슬까슬 (Grainy)",
    blur: 3,
    blurQuality: 2,
    threshold: 0.55,
    particleRadius: 12,
    particleCount: 1000,
    scaleMin: 0.15,
    scaleRange: 0.5,
    spreadRadius: 150,   // 기본과 동일
    spring: 0.04,
    friction: 0.85,
    jitter: 0.5,
    mouseRadius: 50,     // 영향 범위 축소
    repelForce: 14,
    attractRadius: 0,
    attractForce: 0,
    fragment: `
      precision mediump float;
      in vec2 vTextureCoord;
      out vec4 finalColor;
      uniform sampler2D uTexture;
      uniform float uThreshold;
      uniform vec3 uColor;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        float a = hash(i);
        float b = hash(i + vec2(1.0, 0.0));
        float c = hash(i + vec2(0.0, 1.0));
        float d = hash(i + vec2(1.0, 1.0));
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
      }

      void main(void) {
        vec4 color = texture(uTexture, vTextureCoord);
        float n = noise(vTextureCoord * 800.0) * 0.25;
        float adjustedThreshold = uThreshold + n - 0.125;

        if (color.a > adjustedThreshold) {
          float grain = noise(vTextureCoord * 1200.0) * 0.06;
          finalColor = vec4(uColor + grain - 0.03, 1.0);
        } else {
          finalColor = vec4(0.0);
        }
      }
    `,
  },

  // 3) 부드러운 - 꿀처럼 점성 높은 액체, 느릿느릿 저항하며 구멍 뚫림
  silky: {
    name: "부드러운 (Silky)",
    blur: 18,
    blurQuality: 6,
    threshold: 0.25,
    particleRadius: 32,
    particleCount: 200,
    scaleMin: 0.4,
    scaleRange: 0.8,
    spreadRadius: 100,   // 블러가 크니까 spread 줄여서 크기 맞춤
    spring: 0.0015,
    friction: 0.985,
    jitter: 0.02,
    mouseRadius: 70,
    repelForce: 2.5,
    attractRadius: 0,
    attractForce: 0,
    fragment: `
      precision mediump float;
      in vec2 vTextureCoord;
      out vec4 finalColor;
      uniform sampler2D uTexture;
      uniform float uThreshold;
      uniform vec3 uColor;

      void main(void) {
        vec4 color = texture(uTexture, vTextureCoord);
        float edge = smoothstep(uThreshold - 0.12, uThreshold + 0.02, color.a);
        if (edge > 0.01) {
          finalColor = vec4(uColor * (0.95 + edge * 0.05), edge);
        } else {
          finalColor = vec4(0.0);
        }
      }
    `,
  },
};

// 랜덤 프리셋 선택
const presetKeys = Object.keys(PRESETS);
const chosenKey = presetKeys[Math.floor(Math.random() * presetKeys.length)];
const preset = PRESETS[chosenKey];
console.log(
  `[Metaball] 질감: ${preset.name} / 색상: rgb(${randomColor.map((c) => Math.round(c * 255))})`
);

// PIXI.js v8 Application 초기화
const app = new PIXI.Application();

await app.init({
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundAlpha: 0,
  resolution: window.devicePixelRatio || 1,
  autoDensity: true,
  antialias: false,
  preference: "webgl",
});

document.getElementById("app").appendChild(app.canvas);

// 파티클용 원형 텍스처 생성
function createCircleTexture(radius) {
  const graphics = new PIXI.Graphics();
  graphics.circle(0, 0, radius);
  graphics.fill({ color: 0xffffff, alpha: 1 });
  return app.renderer.generateTexture(graphics);
}

const circleTexture = createCircleTexture(preset.particleRadius);

// 파티클 컨테이너 생성
const particleContainer = new PIXI.Container();
app.stage.addChild(particleContainer);

// 파티클 배열
const particles = [];

// 화면 중앙
const centerX = app.screen.width / 2;
const centerY = app.screen.height / 2;

// 파티클 초기화
for (let i = 0; i < preset.particleCount; i++) {
  const particle = new PIXI.Sprite(circleTexture);
  particle.anchor.set(0.5);

  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * preset.spreadRadius;
  particle.x = centerX + Math.cos(angle) * radius;
  particle.y = centerY + Math.sin(angle) * radius;

  particle.homeX = particle.x;
  particle.homeY = particle.y;

  particle.vx = 0;
  particle.vy = 0;

  const scale = preset.scaleMin + Math.random() * preset.scaleRange;
  particle.scale.set(scale);

  particleContainer.addChild(particle);
  particles.push(particle);
}

// 공통 vertex 쉐이더
const vertexShader = `
  in vec2 aPosition;
  out vec2 vTextureCoord;
  uniform vec4 uInputSize;
  uniform vec4 uOutputFrame;
  uniform vec4 uOutputTexture;

  vec4 filterVertexPosition(void) {
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;
    return vec4(position, 0.0, 1.0);
  }

  vec2 filterTextureCoord(void) {
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
  }

  void main(void) {
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
  }
`;

// 블러 필터
const blurFilter = new PIXI.BlurFilter({
  strength: preset.blur,
  quality: preset.blurQuality,
});

// Threshold 필터 (프리셋별 fragment 쉐이더 적용)
const thresholdFilter = new PIXI.Filter({
  glProgram: PIXI.GlProgram.from({
    vertex: vertexShader,
    fragment: preset.fragment,
  }),
  resources: {
    thresholdUniforms: {
      uThreshold: { value: preset.threshold, type: "f32" },
      uColor: {
        value: new Float32Array(randomColor),
        type: "vec3<f32>",
      },
    },
  },
});

// 필터 적용
particleContainer.filters = [blurFilter, thresholdFilter];

// 마우스 위치 추적
let mouseX = -1000;
let mouseY = -1000;

app.canvas.addEventListener("mousemove", (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});

app.canvas.addEventListener("mouseleave", () => {
  mouseX = -1000;
  mouseY = -1000;
});

app.canvas.addEventListener("touchmove", (e) => {
  if (e.touches.length > 0) {
    mouseX = e.touches[0].clientX;
    mouseY = e.touches[0].clientY;
  }
});

app.canvas.addEventListener("touchend", () => {
  mouseX = -1000;
  mouseY = -1000;
});

// 애니메이션 루프 (프리셋별 물리값 적용)
app.ticker.add((ticker) => {
  const delta = ticker.deltaTime;

  particles.forEach((particle) => {
    const dxMouse = particle.x - mouseX;
    const dyMouse = particle.y - mouseY;
    const distMouse = Math.sqrt(dxMouse * dxMouse + dyMouse * dyMouse);

    // 마우스 반발 (구멍 뚫기)
    if (distMouse < preset.mouseRadius && distMouse > 0) {
      const force = (1 - distMouse / preset.mouseRadius) * preset.repelForce;
      particle.vx += (dxMouse / distMouse) * force;
      particle.vy += (dyMouse / distMouse) * force;
    }
    // 마우스 끌어당김 (기본 프리셋만 작동)
    else if (
      preset.attractRadius > 0 &&
      distMouse < preset.attractRadius &&
      distMouse > 0
    ) {
      const force =
        (1 - distMouse / preset.attractRadius) * preset.attractForce;
      particle.vx -= (dxMouse / distMouse) * force;
      particle.vy -= (dyMouse / distMouse) * force;
    }

    // 홈으로 복원
    const dxHome = particle.homeX - particle.x;
    const dyHome = particle.homeY - particle.y;
    particle.vx += dxHome * preset.spring;
    particle.vy += dyHome * preset.spring;

    // 랜덤 떨림
    particle.vx += (Math.random() - 0.5) * preset.jitter;
    particle.vy += (Math.random() - 0.5) * preset.jitter;

    // 마찰
    particle.vx *= preset.friction;
    particle.vy *= preset.friction;

    // 위치 업데이트
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
  });
});

// 창 크기 변경 대응
window.addEventListener("resize", () => {
  app.renderer.resize(window.innerWidth, window.innerHeight);

  const newCenterX = app.screen.width / 2;
  const newCenterY = app.screen.height / 2;

  particles.forEach((particle) => {
    const offsetX = particle.homeX - centerX;
    const offsetY = particle.homeY - centerY;
    particle.homeX = newCenterX + offsetX;
    particle.homeY = newCenterY + offsetY;
  });
});
