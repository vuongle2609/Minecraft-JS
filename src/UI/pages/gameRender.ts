import GameScene from "@/game/classes/gameScene";
import { RenderPage } from "@/game/classes/renderPage";
import { WorldsType } from "@/type";

import Router from "../router";
import { $ } from "../utils/selector";

export default class GameRender extends RenderPage {
  router: Router;
  gameScene: GameScene;

  id: string;

  constructor(router: Router) {
    super();

    this.router = router;
  }

  element = String.raw` 
      <div id="loading_modal"
        class="fixed top-0 bottom-0 left-0 right-0 items-center justify-center bg-gray-900/70 flex flex-col z-50 gap-2 text-lg text-white"
        style="background-image: url('/assets/home/dirt_background.webp')">
        <span>Loading world</span>
        <span>Building terrain</span>
      </div>

      <div id="modal_focus"
        class="fixed top-0 bottom-0 left-0 right-0 items-center justify-center bg-gray-900/70 flex flex-col z-30">
        <div class="flex flex-col w-full h-full items-center justify-center px-[200px] gap-4">
          <h2 class="text-white text-lg">Game Menu</h2>

          <button class="mc-button" id="focus">
            <div class="title">
              Back To Game
            </div>
          </button>

          <button class="mc-button" id="quit">
            <div class="title">
              Save and Quit to Title
            </div>
          </button>
        </div>
      </div>

      <div id="modal_game" class="fixed top-0 bottom-0 left-0 right-0 items-center justify-center z-20">
        <div class="text-white font-medium fixed top-2 left-2">
          <span id="infoScene"></span>
          <span id="coordinate"></span>
          <br />
          <span id="chunk"></span>
          <br />
          <span id="fps"></span>
        </div>

        <div class="relative shadow-md">
          <div class="w-1 h-5 bg-gray-500 absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2"></div>
          <div class="w-5 h-1 bg-gray-500 absolute top-1/2 -translate-y-1/2 left-1/2 -translate-x-1/2"></div>
        </div>

        <div id="itemLabel"
          class="fixed opacity-0 text-white bottom-20 text-xl transition-all duration-300 drop-shadow-md"></div>

        <div class="fixed bottom-1 bg-gray-900/60 border-[3px] border-solid border-black">
          <div class="shadow-inset flex" id="inventory_container">
          </div>
        </div>
      </div>

      <div id="modal_water" class="fixed top-0 bottom-0 left-0 right-0 bg-blue-900/70 z-10 hidden">
      </div>

      <canvas id="gameScene" class="fixed top-0 bottom-0 left-0 right-0 w-full h-full -z-10"></canvas>

      <canvas id="gameSceneDebug" class="fixed top-0 right-0 w-[200px] h-[200px] z-50"></canvas>
    `;

  render<T>(state?: T) {
    this.id = state as string;
    super.render();
  }

  saveGame = () => {
    const worlds = JSON.parse(localStorage.getItem("worlds") || "{}");

    const rotation = this.gameScene.camera.rotation.toArray();

    const newWorlds: Record<string, WorldsType> = {
      ...worlds,
      [this.id || ""]: {
        ...worlds[this.id || ""],
        blocksWorldChunk: this.gameScene.chunkManager.blocksWorldChunk,
        initPos: this.gameScene.player.player.position.toArray(),
        rotation,
      },
    };

    localStorage.setItem("worlds", JSON.stringify(newWorlds));
  };

  afterRender = () => {
    this.gameScene = new GameScene(this.id);

    $("#quit").onclick = () => {
      $("#gameScene").remove();

      this.gameScene.disposeRender();

      this.router.navigate("mainScreen");
    };

    this.router.soundManager.changeActiveTheme("mice_on_venus");

    window.onbeforeunload = (e) => {
      this.saveGame();
    };

    (window as any).befforeUnMount = () => this.saveGame();
  };
}
