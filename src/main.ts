import { loadAllAssets } from './assets';
import {
  attachKeyboardListeners,
  computeViewportLayout,
  createEmptyInput,
  createVirtualJoystick,
} from './core/input';
import { attachDebugConsole } from './core/debugConsole';
import { initSecretSantaDB } from './core/secretSantaDB';
import secretText from '../inspiration/secret.txt';
import { createCamera3D, updateCamera3D } from './rendering/math3d';
import { renderGame } from './rendering/renderer';
import { Hardware3DRenderer, WebGL3DRenderer } from './rendering/webglRenderer';
import { WebGPURenderer } from './rendering/webgpuRenderer';
import {
  createGameState,
  parseLevelQueryParam,
  updateGameState,
} from './world/gameState';

export function detectIsLandscape(): boolean {
  if (typeof window === 'undefined') return false;

  // 1. screen.orientation API (modern standard)
  if (typeof screen !== 'undefined' && screen.orientation?.type) {
    if (screen.orientation.type.startsWith('landscape')) return true;
    if (screen.orientation.type.startsWith('portrait')) return false;
  }

  // 2. window.orientation (iOS Safari legacy standard: 90 or -90 is landscape)
  if (typeof window.orientation === 'number') {
    if (Math.abs(window.orientation) === 90) return true;
    if (window.orientation === 0 || window.orientation === 180) return false;
  }

  // 3. CSS media query matching (evaluated by CSS engine in real-time)
  if (typeof window.matchMedia === 'function') {
    const m = window.matchMedia('(orientation: landscape)');
    if (m && typeof m.matches === 'boolean') {
      return m.matches;
    }
  }

  // 4. Fallback to window dimensions
  return window.innerWidth > window.innerHeight;
}

function getActionLabel(promptText: string): string {
  // Strip "Z: " prefix if present and return concise action
  const clean = promptText.replace(/^Z:\s*/i, '').trim();
  if (!clean) return 'Action';
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

async function startGame(): Promise<void> {
  const gameContainer = document.getElementById('game-container');
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement | null;
  if (!canvas) {
    throw new Error('Could not find #game-canvas element');
  }

  let webgpuCanvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement | null;
  if (!webgpuCanvas && gameContainer) {
    webgpuCanvas = document.createElement('canvas');
    webgpuCanvas.id = 'webgpu-canvas';
    webgpuCanvas.width = 1280;
    webgpuCanvas.height = 1120;
    gameContainer.insertBefore(webgpuCanvas, canvas);
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not get 2D rendering context');
  }

  // Detect mobile / touch / iOS device
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const isIOSDevice =
    /iPhone|iPad|iPod/i.test(ua) ||
    (typeof navigator !== 'undefined' &&
      navigator.platform === 'MacIntel' &&
      navigator.maxTouchPoints > 1);
  const isMobileDevice =
    isIOSDevice ||
    (typeof window !== 'undefined' &&
      ('ontouchstart' in window ||
        navigator.maxTouchPoints > 0 ||
        window.matchMedia('(pointer: coarse)').matches));

  const replace3DCanvas = (): HTMLCanvasElement | null => {
    if (!webgpuCanvas || ! webgpuCanvas.parentElement) return webgpuCanvas;
    const fresh = document.createElement('canvas');
    fresh.id = 'webgpu-canvas';
    fresh.width = webgpuCanvas.width;
    fresh.height = webgpuCanvas.height;
    fresh.style.width = webgpuCanvas.style.width;
    fresh.style.height = webgpuCanvas.style.height;
    webgpuCanvas.parentElement.replaceChild(fresh, webgpuCanvas);
    webgpuCanvas = fresh;
    return webgpuCanvas;
  };

  const rendererParam =
    typeof window !== 'undefined'
      ? new URLSearchParams(window.location.search).get('renderer')?.toLowerCase()
      : null;
  const preferWebGL = rendererParam === 'webgl' || (rendererParam !== 'webgpu' && isIOSDevice);

  let webgpuRenderer: Hardware3DRenderer | null = null;
  if (webgpuCanvas) {
    if (preferWebGL) {
      webgpuRenderer = WebGL3DRenderer.create(webgpuCanvas);
      if (!webgpuRenderer) {
        const fresh = replace3DCanvas();
        if (fresh) {
          webgpuRenderer = await WebGPURenderer.create(fresh);
        }
      }
    } else {
      webgpuRenderer = await WebGPURenderer.create(webgpuCanvas);
      if (!webgpuRenderer) {
        const fresh = replace3DCanvas();
        if (fresh) {
          webgpuRenderer = WebGL3DRenderer.create(fresh);
        }
      }
    }
  }
  const camera3d = createCamera3D();

  const joystickContainer = document.getElementById('virtual-joystick-container');
  const joystickStick = document.getElementById('virtual-joystick-stick');
  const mobileActionBtn = document.getElementById('mobile-action-btn') as HTMLButtonElement | null;

  const assets = await loadAllAssets();
  const input = createEmptyInput();

  let joystick: ReturnType<typeof createVirtualJoystick> | null = null;
  if (joystickContainer && joystickStick) {
    joystick = createVirtualJoystick({
      container: joystickContainer,
      stick: joystickStick,
      input,
    });

    if (isMobileDevice) {
      joystick.show();
    } else {
      joystick.hide();
    }
  }

  let lastLayoutKey = '';
  let lastIsLandscape: boolean | null = null;

  const applyViewportLayout = (force = false): void => {
    if (typeof window === 'undefined') return;

    if (window.scrollX !== 0 || window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }

    const isLandscape = detectIsLandscape();

    const vv = window.visualViewport;
    const rawW = Math.round(vv ? vv.width : window.innerWidth);
    const rawH = Math.round(vv ? vv.height : window.innerHeight);

    // Compute layout using detectIsLandscape to ensure horizontal and vertical axes
    // are correctly mapped regardless of delayed browser viewport updates
    const layout = computeViewportLayout(rawW, rawH, isLandscape);

    const layoutKey = `${layout.isLandscape}-${layout.containerWidth}-${layout.containerHeight}-${layout.canvasWidth}-${layout.canvasHeight}`;
    if (!force && layoutKey === lastLayoutKey) {
      return;
    }
    lastLayoutKey = layoutKey;

    if (lastIsLandscape !== null && lastIsLandscape !== layout.isLandscape) {
      joystick?.reset();
    }
    lastIsLandscape = layout.isLandscape;

    if (gameContainer) {
      gameContainer.style.left = '0px';
      gameContainer.style.top = '0px';
      gameContainer.style.width = `${layout.containerWidth}px`;
      gameContainer.style.height = `${layout.containerHeight}px`;
    }

    canvas.style.width = `${layout.canvasWidth}px`;
    canvas.style.height = `${layout.canvasHeight}px`;
    if (webgpuCanvas) {
      webgpuCanvas.style.width = `${layout.canvasWidth}px`;
      webgpuCanvas.style.height = `${layout.canvasHeight}px`;
      const dpr = isMobileDevice
        ? Math.min(1.5, Math.max(1, window.devicePixelRatio || 1))
        : Math.min(2, Math.max(1, window.devicePixelRatio || 1.5));
      const minW = isMobileDevice ? 512 : 1024;
      const maxW = isMobileDevice ? 1024 : 2048;
      const minH = isMobileDevice ? 448 : 896;
      const maxH = isMobileDevice ? 896 : 1792;
      const targetW = Math.max(minW, Math.min(maxW, Math.round(layout.canvasWidth * dpr)));
      const targetH = Math.max(minH, Math.min(maxH, Math.round(layout.canvasHeight * dpr)));
      if (webgpuCanvas.width !== targetW || webgpuCanvas.height !== targetH) {
        webgpuCanvas.width = targetW;
        webgpuCanvas.height = targetH;
      }
    }

    if (joystickContainer) {
      joystickContainer.style.width = `${layout.joystickSize}px`;
      joystickContainer.style.height = `${layout.joystickSize}px`;
      joystickContainer.style.left = `${layout.joystickLeft}px`;
      joystickContainer.style.top = `${layout.joystickTop}px`;
      joystickContainer.style.right = 'auto';
      joystickContainer.style.bottom = 'auto';
      joystickContainer.style.transform = 'none';
    }

    if (mobileActionBtn) {
      mobileActionBtn.style.left = `${layout.actionBtnLeft}px`;
      mobileActionBtn.style.right = 'auto';
      if (layout.actionBtnTop !== null) {
        mobileActionBtn.style.top = `${layout.actionBtnTop}px`;
        mobileActionBtn.style.bottom = 'auto';
        mobileActionBtn.style.transform = 'translateY(-50%)';
      } else {
        mobileActionBtn.style.top = 'auto';
        mobileActionBtn.style.bottom = `${layout.actionBtnBottom ?? 24}px`;
        mobileActionBtn.style.transform = 'none';
      }
    }
  };

  const onOrientationOrResize = (): void => {
    applyViewportLayout(true);
    // Re-apply across mobile browser rotation animation phases
    setTimeout(() => applyViewportLayout(true), 50);
    setTimeout(() => applyViewportLayout(true), 150);
    setTimeout(() => applyViewportLayout(true), 300);
    setTimeout(() => applyViewportLayout(true), 500);
  };

  // WebKit (Safari, and Chrome/Firefox on iOS) sometimes keeps the *portrait* layout viewport
  // width after rotating to landscape, so pages only use the left part of the screen until reload.
  // Re-writing the viewport <meta> with a changed (but visually harmless) argument forces WebKit
  // to re-parse it and recompute the layout viewport for the new orientation.
  const viewportMeta = document.querySelector<HTMLMetaElement>('meta[name="viewport"]');
  const baseViewportContent = viewportMeta?.content ?? '';
  const nudgeViewportMeta = (): void => {
    if (!viewportMeta || !baseViewportContent) return;
    const nudged = /maximum-scale=[\d.]+/.test(baseViewportContent)
      ? baseViewportContent.replace(/maximum-scale=[\d.]+/, 'maximum-scale=1.001')
      : `${baseViewportContent}, maximum-scale=1.001`;
    viewportMeta.content = nudged;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        viewportMeta.content = baseViewportContent;
        onOrientationOrResize();
      });
    });
  };

  const onOrientationChange = (): void => {
    onOrientationOrResize();
    // iOS fires orientation events before the rotation animation finishes, so nudge twice
    nudgeViewportMeta();
    setTimeout(nudgeViewportMeta, 350);
  };

  applyViewportLayout(true);
  window.addEventListener('resize', onOrientationOrResize);
  window.addEventListener('orientationchange', onOrientationChange);
  window.addEventListener('scroll', () => applyViewportLayout(false), { passive: true });
  window.visualViewport?.addEventListener('resize', onOrientationOrResize);
  window.visualViewport?.addEventListener('scroll', () => applyViewportLayout(false));
  if (typeof screen !== 'undefined' && screen.orientation?.addEventListener) {
    screen.orientation.addEventListener('change', onOrientationChange);
  }

  const searchParams = new URLSearchParams(window.location.search);

  if (searchParams.has('debug')) {
    attachDebugConsole(document.getElementById('viewport-frame'));
  }

  let fpsElement: HTMLPreElement | null = null;
  if (searchParams.has('fps')) {
    const viewportFrame = document.getElementById('viewport-frame');
    if (viewportFrame) {
      fpsElement = document.createElement('pre');
      fpsElement.id = 'viewport-fps-text';
      fpsElement.textContent = 'fps: 0';
      viewportFrame.appendChild(fpsElement);
    }
  }

  // Initialize SecretSantaDB and debug log giver/receiver mappings
  const secretSantaDB = await initSecretSantaDB(secretText);

  attachKeyboardListeners(window, input, {
    onToggleJoystick: () => {
      joystick?.toggle();
      applyViewportLayout(true);
    },
  });

  const initialLevelId = parseLevelQueryParam(searchParams.get('level'));
  const hasLevelOverride = searchParams.has('level');

  const isDebug = searchParams.has('debug');
  const isCheat = searchParams.has('cheat');
  const isGiveUpSorry = searchParams.has('giveUpSorry');

  const state = createGameState({
    isMobile: isMobileDevice,
    showIntroDialogue: !hasLevelOverride,
    initialLevelId,
    debug: isDebug,
    cheat: isCheat,
    giveUpSorry: isGiveUpSorry,
    secretSantaDB,
  });
  state.joystickActive = isMobileDevice;

  if (mobileActionBtn) {
    mobileActionBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      input.actionJustPressed = true;
      input.action = true;
    });
    mobileActionBtn.addEventListener('pointerup', () => {
      input.action = false;
    });
    mobileActionBtn.addEventListener('pointercancel', () => {
      input.action = false;
    });
  }

  // On mobile (or when virtual joystick is active), tapping anywhere on screen advances dialogue trees
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (!(isMobileDevice || joystick?.isVisible())) return;
      if (!state.activeDialogue) return;
      if (
        mobileActionBtn &&
        (e.target === mobileActionBtn || mobileActionBtn.contains(e.target as Node))
      ) {
        return;
      }
      e.preventDefault();
      input.actionJustPressed = true;
    },
    { passive: false }
  );

  // Enable 3D camera-relative WASD movement and arrow-key camera turning (without mouse camera movement).
  input.cameraYaw = -Math.PI / 2;
  input.cameraPitch = 0.38;

  let lastTimestamp: number | null = null;
  let fpsFrameCount = 0;
  let fpsAccumSeconds = 0;
  let currentFps = 0;

  function frame(now: number): void {
    applyViewportLayout(false);

    const rawDtSeconds =
      lastTimestamp === null ? 0 : Math.max(0, (now - lastTimestamp) / 1000);
    const dtSeconds = Math.min(rawDtSeconds, 0.1);
    lastTimestamp = now;

    if (fpsElement && rawDtSeconds > 0) {
      fpsFrameCount += 1;
      fpsAccumSeconds += rawDtSeconds;
      if (currentFps === 0) {
        currentFps = Math.round(1 / rawDtSeconds);
        fpsElement.textContent = `fps: ${currentFps}`;
      }
      if (fpsAccumSeconds >= 0.25) {
        currentFps = Math.round(fpsFrameCount / fpsAccumSeconds);
        fpsElement.textContent = `fps: ${currentFps}`;
        fpsFrameCount = 0;
        fpsAccumSeconds = 0;
      }
    }

    // Track joystick active state in game state so renderer & entities (like dog speed) adapt
    const isJoystickShown = joystick?.isVisible() ?? false;
    state.joystickActive = isJoystickShown;

    updateGameState(state, input, dtSeconds);
    updateCamera3D(camera3d, state, input, dtSeconds, canvas!.width / canvas!.height);
    renderGame(ctx!, state, assets, { webgpuRenderer, camera3d });

    // Sync mobile action button visibility and text with nearby interactable
    if (mobileActionBtn) {
      if (isJoystickShown && state.nearbyInteractable) {
        mobileActionBtn.textContent = getActionLabel(state.nearbyInteractable.promptText);
        mobileActionBtn.style.display = 'block';
      } else {
        mobileActionBtn.style.display = 'none';
      }
    }

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

startGame().catch((err) => {
  console.error('Failed to start Xmas Rensbo:', err);
});
