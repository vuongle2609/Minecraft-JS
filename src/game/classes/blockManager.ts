import {
  BoxGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  Vector2,
  Vector3,
} from "three";

import { Face } from "@/constants/block";
import blocks from "@/constants/blocks";
import { getChunkCoordinate } from "@/game/helpers/chunkHelpers";
import { detailFromName } from "@/game/helpers/detailFromName";
import {
  nameChunkFromCoordinate,
  nameFromCoordinate,
} from "@/game/helpers/nameFromCoordinate";
import { BlockKeys, FaceAoType } from "@/type";

import { BLOCK_WIDTH } from "@/constants";
import BaseEntity, { BasePropsType } from "./baseEntity";
import Block from "./block";
import InventoryManager from "./inventoryManager";
import InstancedBlockManager from "./instancedBlockManager";

const { leftX, leftZ, bottom, rightX, rightZ, top } = Face;

interface PropsType {
  inventoryManager: InventoryManager;
}

export default class BlockManager extends BaseEntity {
  inventoryManager: InventoryManager;

  currentPlaceSound: HTMLAudioElement;

  currentBreakSound: HTMLAudioElement;

  blocksMapping: Map<string, Block> = new Map();

  blocksWorldChunk: Record<string, Record<string, BlockKeys | 0>> = {};
  chunksBlocks: Record<string, string[]> = {};

  chunksActive: string[] = [];

  blocksGroup = new Group();

  instancedBlockManager: InstancedBlockManager;

  disposeBlockManager: Function;

  blockDisplayHover = new Mesh(
    new BoxGeometry(BLOCK_WIDTH + 0.01, BLOCK_WIDTH + 0.01, BLOCK_WIDTH + 0.01),
    new MeshStandardMaterial({
      wireframe: true,
      visible: true,
    })
  );

  constructor(props: BasePropsType & PropsType) {
    super(props);

    this.inventoryManager = props.inventoryManager;
    this.blocksWorldChunk = props.worldStorage?.blocksWorldChunk || {};
  }

  async initialize() {
    // Initialize the InstancedBlockManager
    this.instancedBlockManager = new InstancedBlockManager(this.scene!, this.blocksGroup);
    
    this.blockDisplayHover.name = "helper";
    this.scene?.add(this.blockDisplayHover);
    this.scene?.add(this.blocksGroup);

    const eventMouseDown = this.onMouseDown.bind(this);

    document.addEventListener("mousedown", eventMouseDown, false);

    this.disposeBlockManager = () => {
      document.removeEventListener("mousedown", eventMouseDown, false);
      this.instancedBlockManager?.dispose();
    };

    this.worker?.addEventListener("message", (e) => {
      if (e.data.type === "renderPlaceBlock") {
        const { position, type } = e.data.data;

        this.handleRenderPlaceBlock(position, type);
      }
    });
  }

  updateBlock({
    x,
    y,
    z,
    type,
    facesToRender,
    blockOcclusion,
    isPlace,
  }: {
    x: number;
    y: number;
    z: number;
    type: BlockKeys | 0;
    facesToRender?: Record<Face, boolean> | null;
    blockOcclusion?: Record<Face, null | FaceAoType> | null;
    isPlace?: boolean;
  }) {
    // if block marked as destroyed then return
    if (type == 0) {
      return;
    }

    const position = new Vector3(x, y, z);

    const block = new Block({
      position: position,
      type: type,
      blocksMapping: this.blocksMapping,
      instancedBlockManager: this.instancedBlockManager,
      facesToRender,
      blocksGroup: this.blocksGroup,
      blockOcclusion,
    });

    this.blocksMapping.set(nameFromCoordinate(x, y, z), block);
    if (isPlace) block.calculateAONeighbors();
  }

  getIntersectObject() {
    const { raycaster } = this.mouseControl! || {};

    if (!this.camera || !this.scene || !this.control?.isLocked) return;

    raycaster.setFromCamera(new Vector2(), this.camera);

    const intersectObject = raycaster.intersectObjects(
      this.blocksGroup.children,
      false
    )[0];

    if (!intersectObject) return;

    if (intersectObject.distance > 12) return;

    return intersectObject;
  }

  removeBlock(x: number, y: number, z: number, isClearChunk?: boolean) {
    const blockToRemove = this.blocksMapping.get(nameFromCoordinate(x, y, z));

    blockToRemove?.destroy(isClearChunk);
  }

  handleHoverBlock() {
    const intersectObj = this.getIntersectObject();

    if (!intersectObj) {
      this.blockDisplayHover.visible = false;
      return;
    }

    const { x, y, z, type } = detailFromName(intersectObj.object.name);

    if (type == BlockKeys.water) {
      this.blockDisplayHover.visible = false;
      return;
    }

    this.blockDisplayHover.visible = true;
    this.blockDisplayHover.position.set(x, y, z);
  }

  handleGetBlock() {
    const intersectObj = this.getIntersectObject();

    if (!intersectObj) return;

    const clickedDetail = detailFromName(intersectObj.object.name);

    const { type } = clickedDetail;

    if (!blocks[type].renderInInventory) return;

    this.inventoryManager.inventory[this.inventoryManager.currentFocusIndex] =
      type;

    this.inventoryManager.renderHotbar();

    if (this.inventoryManager.currentFocus)
      this.inventoryManager.renderLabelFocusItem(
        blocks[this.inventoryManager.currentFocus].name
      );
  }

  handleBreakBlock() {
    const intersectObj = this.getIntersectObject();

    if (!intersectObj) return;

    const clickedDetail = detailFromName(intersectObj.object.name);

    const { x, y, z, type } = clickedDetail;

    if (type == BlockKeys.bedrock) return;
    if (type == BlockKeys.water) return;

    this.removeBlock(x, y, z);

    this.removeBlockWorker({
      position: [x, y, z],
    });

    const newUpdateBlockChunk = getChunkCoordinate(x, z);
    const chunkName = nameChunkFromCoordinate(
      newUpdateBlockChunk.x,
      newUpdateBlockChunk.z
    );

    this.blocksWorldChunk[chunkName] = this.blocksWorldChunk[chunkName] || {};
    this.blocksWorldChunk[chunkName][nameFromCoordinate(x, y, z)] = 0;

    // play sound
    if (this.currentBreakSound) {
      this.currentBreakSound.pause();
      this.currentBreakSound.currentTime = 0;
    }

    this.currentBreakSound = blocks[type].break;

    this.currentBreakSound.play();
  }

  handleRenderPlaceBlock(blockPositionArr: number[], placeType: BlockKeys) {
    const [x, y, z] = blockPositionArr;
    this.updateBlock({
      x,
      y,
      z,
      type: placeType,
      isPlace: true,
    });

    const chunk = getChunkCoordinate(x, z);
    const chunkName = nameChunkFromCoordinate(chunk.x, chunk.z);

    const coorName = nameFromCoordinate(x, y, z);

    this.chunksBlocks[chunkName]?.push(coorName);

    this.blocksWorldChunk[chunkName] = this.blocksWorldChunk[chunkName] || {};
    this.blocksWorldChunk[chunkName][coorName] = placeType;

    // play sound
    if (this.currentPlaceSound) {
      this.currentPlaceSound.pause();
      this.currentPlaceSound.currentTime = 0;
    }

    this.currentPlaceSound = blocks[placeType].place;

    this.currentPlaceSound.play();
  }

  handlePlaceBlock() {
    const intersectObj = this.getIntersectObject();

    if (!intersectObj) return;

    const clickedDetail = detailFromName(intersectObj.object.name);

    const clickedFace = clickedDetail.face;

    const { x, y, z } = clickedDetail;

    const blockPosition = new Vector3();

    switch (Number(clickedFace)) {
      case leftX:
        blockPosition.set(x + BLOCK_WIDTH, y, z);
        break;
      case rightX:
        blockPosition.set(x - BLOCK_WIDTH, y, z);
        break;
      case top:
        blockPosition.set(x, y + BLOCK_WIDTH, z);
        break;
      case bottom:
        blockPosition.set(x, y - BLOCK_WIDTH, z);
        break;
      case leftZ:
        blockPosition.set(x, y, z + BLOCK_WIDTH);
        break;
      case rightZ:
        blockPosition.set(x, y, z - BLOCK_WIDTH);
        break;
    }

    const placeType = this.inventoryManager.currentFocus;

    if (placeType) {
      this.updateBlockWorker({
        position: [blockPosition.x, blockPosition.y, blockPosition.z],
        type: placeType,
      });
    }
  }

  removeBlockWorker({ position }: { position: number[] }) {
    this.worker?.postMessage({
      type: "removeBlock",
      data: {
        position,
      },
    });
  }

  updateBlockWorker({
    position,
    type,
  }: {
    position: number[];
    type: BlockKeys;
  }) {
    this.worker?.postMessage({
      type: "requestPlaceBlock",
      data: {
        position,
        type,
      },
    });
  }

  onMouseDown(e: MouseEvent) {
    switch (e.button) {
      case 0:
        this.handleBreakBlock();
        break;
      case 1:
        this.handleGetBlock();
        break;
      case 2:
        this.handlePlaceBlock();
    }
  }

  update() {
    this.handleHoverBlock();
  }
}
