import { InstancedMesh, MeshLambertMaterial } from "three";

export enum BlockKeys {
  grass = 1,
  stone = 3,
  sand = 4,
  dirt = 5,
  cobblestone = 6,
  leaves = 7,
  wood = 8,
  furnace = 9,
  oakPlanks = 10,
  blockOfDiamond = 11,
  blockOfIron = 12,
  blockOfGold = 13,
  blockOfLapis = 14,
  blockOfEmerald = 15,
  water = 16,
  bedrock = 17,
}

export enum BlockTextureType {
  top,
  side,
  sideOther,
  bottom,
  front,
  back,
}

export enum FaceAoType {
  e1 = 1,
  e2 = 2,
  e3 = 3,
  e4 = 4,
  f1 = 5,
  f2 = 6,
  f3 = 7,
  f4 = 8,
  v1 = 9,
  v2 = 10,
  v3 = 11,
  v4 = 12,
}

export interface PlayerInput {
  forward: boolean;
  backward: boolean;
  left: boolean;
  right: boolean;
  space: boolean;
  shift: boolean;
  leftClick: boolean;
  rightClick: boolean;
}

export type BlocksMappingType = Record<string, BlockKeys | 0>;

export interface WorldsType {
  createdDate: Date;
  blocksWorldChunk: Record<string, BlocksMappingType>;
  name: string;
  worldType: number;
  seed?: number;
  initPos?: number[];
  rotation?: number[];
}

export interface BlocksIntancedMapping
  extends Record<BlockKeys, BlocksIntancedType> {}

export interface BlocksIntancedType
  extends Record<
    BlockTextureType,
    Record<FaceAoType | "base", {
      mesh: InstancedMesh;
      count: number;
      indexCanAllocate: number[];
    }>
  > {}

export type BlocksType = Record<
  BlockKeys,
  {
    name: string;
    renderInInventory: boolean;
    icon: string;
    step: HTMLAudioElement;
    place: HTMLAudioElement;
    break: HTMLAudioElement;
    volume: 0.1;
    texture: Record<BlockTextureType, MeshLambertMaterial>;
    textureMap: BlockTextureType[];
    textureFaceAo: Record<
      BlockTextureType,
      Record<FaceAoType | "base", MeshLambertMaterial>
    >;
  }
>;
