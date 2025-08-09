import MouseControl from "@/game/action/mouseControl";
import Player from "@/game/player/character";
import { WorldsType } from "@/type";
import { $ } from "@/UI/utils/selector";
import {
  Cache,
  Clock,
  Color,
  FogExp2,
  PerspectiveCamera,
  Scene,
  WebGLRenderer,
} from "three";
import { PointerLockControls } from "three/examples/jsm/controls/PointerLockControls";

import { BLOCK_WIDTH } from "@/constants";
import ChunkManager from "./chunkManager";
import Cloud from "./cloud";
import InventoryManager from "./inventoryManager";
import Light from "./light";
import { RenderPage } from "./renderPage";

Cache.enabled = true;

export default class GameScene extends RenderPage {
  id: string;
  worldStorage: WorldsType;

  removedWindow = false;

  renderer = new WebGLRenderer({
    antialias: true,
    canvas: document.querySelector("#gameScene") as HTMLCanvasElement,
  });

  rendererDebug = new WebGLRenderer({
    antialias: true,
    canvas: document.querySelector("#gameSceneDebug") as HTMLCanvasElement,
  });

  worker = new Worker(new URL("../physics/worker", import.meta.url), {
    type: "module",
  });

  scene = new Scene();

  camera = new PerspectiveCamera(
    70,
    window.innerWidth / window.innerHeight,
    0.1,
    2000
  );

  cameraDebug = new PerspectiveCamera(70, 200 / 200, 0.1, 2000);

  control = new PointerLockControls(this.camera, document.body);

  coordinateElement: HTMLElement;
  fpsElement: HTMLElement;
  chunkElement: HTMLElement;
  infoElement: HTMLElement;

  clock = new Clock();
  frames = 0;
  prevTime = performance.now();

  player: Player;

  mouseControl: MouseControl;

  chunkManager: ChunkManager;

  inventoryManager: InventoryManager;

  lastCallTime = 0;
  cloud = new Cloud({ scene: this.scene });

  constructor(id: string) {
    super();

    this.id = id;
    this.worldStorage = JSON.parse(localStorage.getItem("worlds") || "{}")[id];

    this.initialize();
  }

  initialize() {
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = false;

    this.rendererDebug.setSize(200, 200);
    this.rendererDebug.shadowMap.enabled = false;

    window.addEventListener(
      "resize",
      () => {
        this.onWindowResize();
      },
      false
    );

    this.element = this.renderer.domElement;

    document.body.appendChild(this.element);

    this.scene.background = new Color("#6EB1FF");
    // this.scene.fog = new FogExp2(0xcccccc, 0.007);

    if (this.worldStorage.rotation)
      this.camera.rotation.fromArray(this.worldStorage.rotation as any);

    new Light({
      scene: this.scene,
    });

    this.coordinateElement = $("#coordinate");
    this.fpsElement = $("#fps");
    this.chunkElement = $("#chunk");
    this.infoElement = $("#infoScene");

    this.mouseControl = new MouseControl({
      control: this.control,
      camera: this.camera,
    });

    this.inventoryManager = new InventoryManager({
      control: this.control,
      mouseControl: this.mouseControl,
    });

    this.worker.postMessage({
      type: "init",
      data: {
        initPos: this.worldStorage.initPos,
        seed: this.worldStorage?.seed,
        type: this.worldStorage?.worldType,
        chunkBlocksCustom: this.worldStorage.blocksWorldChunk,
      },
    });

    this.chunkManager = new ChunkManager({
      mouseControl: this.mouseControl,
      scene: this.scene,
      camera: this.camera,
      inventoryManager: this.inventoryManager,
      control: this.control,
      worker: this.worker,
      id: this.id,
      worldStorage: this.worldStorage,
    });

    this.player = new Player({
      scene: this.scene,
      camera: this.camera,
      chunkManager: this.chunkManager,
      worker: this.worker,
    });

    this.worker.addEventListener("message", (e) => {
      if (e.data.type === "removeLoading") {
        const loadingModal = $("#loading_modal");
        loadingModal.style.display = "none";
        this.control?.lock();
      }
    });

    this.inventoryManager.renderHotbar();

    this.RAF(0);
  }

  onWindowResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  renderCoordinate() {
    const { x, y, z } =
      this.player?.player.position.clone().multiplyScalar(1 / BLOCK_WIDTH) ||
      {};

    if (this.coordinateElement)
      this.coordinateElement.innerHTML = `XYZ: ${x.toFixed(3)} / ${y.toFixed(
        3
      )} / ${z.toFixed(3)}`;

    if (this.chunkElement)
      this.chunkElement.innerHTML =
        "Chunk: " +
        this.chunkManager.currentChunk[0] +
        " " +
        this.chunkManager.currentChunk[1];
  }

  renderFps() {
    this.frames++;
    const time = performance.now();

    if (time >= this.prevTime + 1000) {
      if (this.fpsElement)
        this.fpsElement.innerHTML =
          "FPS: " +
          String(Math.round((this.frames * 1000) / (time - this.prevTime)));

      this.frames = 0;
      this.prevTime = time;
    }
  }

  renderInfo() {
    const { info } = this.renderer;

    this.infoElement.innerHTML = `
    <div class="flex flex-col">
      <span>Geometries: ${info.memory.geometries} / Textures: ${info.memory.textures}</span>
      <span>Calls: ${info.render.calls} / Frame: ${info.render.frame} / Lines: ${info.render.lines} / Points: ${info.render.points} / Triangles: ${info.render.triangles}</span>
    </div>
    `;
  }

  disposeRender() {
    this.renderer.dispose();
    this.chunkManager.dispose();
    this.player.input.dispose();
    this.inventoryManager.dispose();
    this.worker.terminate();
    this.removedWindow = true;
  }

  RAF(t: number) {
    requestAnimationFrame((t) => {
      if (this.removedWindow) return;

      this.RAF(t);
    });

    if (!this.mouseControl?.paused) {
      const delta = this.clock.getDelta();

      // prevent when user not click and delta get larger make
      // miss calculate player init position :))
      if (delta > 0.1) return;

      this.renderCoordinate();
      this.renderInfo();
      this.renderFps();

      this.player?.update(delta, t);

      this.cloud?.update(this.player.player.position);

      this.chunkManager?.update();

      const { x, y, z } = this.player.player.position;
      this.cameraDebug.position.set(x, y, z + 5);
      this.cameraDebug.lookAt(this.player.player.position);

      this.renderer.render(this.scene, this.camera);
      // this.rendererDebug.render(this.scene, this.cameraDebug);
    }
  }
}
