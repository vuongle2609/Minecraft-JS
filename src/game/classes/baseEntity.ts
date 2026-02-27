import { GUI } from "dat.gui";
import { Camera, Scene } from "three";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";

import MouseControl from "@/game/action/mouseControl";
import PhysicsEngine from "@/game/physics/physics";
import { WorldsType } from "@/type";

import ChunkManager from "./chunkManager";

export interface BasePropsType {
  scene?: Scene;
  control?: PointerLockControls;
  mouseControl?: MouseControl;
  gui?: GUI;
  camera?: Camera;
  physicsEngine?: PhysicsEngine;
  chunkManager?: ChunkManager;
  worker?: Worker;
  id?: string;
  worldStorage?: WorldsType;
}

export default class BaseEntity {
  scene?: Scene;
  control?: PointerLockControls;
  gui?: GUI;
  camera?: Camera;
  mouseControl?: MouseControl;
  chunkManager?: ChunkManager;
  worker?: Worker;
  id?: string;
  worldStorage?: WorldsType;

  constructor(props?: BasePropsType) {
    const {
      control,
      gui,
      scene,
      camera,
      mouseControl,
      chunkManager,
      worker,
      id,
      worldStorage,
    } = props || {};

    this.control = control;
    this.gui = gui;
    this.scene = scene;
    this.camera = camera;
    this.mouseControl = mouseControl;
    this.chunkManager = chunkManager;
    this.worker = worker;
    this.id = id;
    this.worldStorage = worldStorage;
  }
}
