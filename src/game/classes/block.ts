import { Group, Mesh, Object3D, Vector3 } from "three";

import { BLOCK_WIDTH } from "@/constants";
import { Face } from "@/constants/block";
import blocks, { BlockAttributeType, renderGeometry } from "@/constants/blocks";
import InstancedBlockManager from "./instancedBlockManager";
import { nameFromCoordinate } from "@/game/helpers/nameFromCoordinate";
import { BlockKeys, FaceAoType } from "@/type";
import { calNeighborsOffset } from "../helpers/calNeighborsOffset";
import { getFacesOcclusion } from "../helpers/calculateAO";
import BaseEntity, { BasePropsType } from "./baseEntity";

interface PropsType {
  position: Vector3;
  type: BlockKeys;
  blocksGroup: Group;
  blocksMapping: Map<string, Block>;
  instancedBlockManager: InstancedBlockManager;
  facesToRender?: Record<Face, boolean> | null;
  isPlace?: boolean;
  blockOcclusion?: Record<Face, null | FaceAoType> | null;
}

const { leftZ, rightZ, leftX, rightX, top, bottom } = Face;

export default class Block extends BaseEntity {
  blockFaceInstances: Record<Face, number | null> = {
    [leftZ]: null,
    [rightZ]: null,
    [leftX]: null,
    [rightX]: null,
    [top]: null,
    [bottom]: null,
  };
  type: BlockKeys;
  position: Vector3;
  atttribute: BlockAttributeType;
  blocksMapping: Map<string, Block>;
  blocksGroup: Group;
  instancedBlockManager: InstancedBlockManager;
  isPlace: boolean;
  blockOcclusion: Record<Face, null | FaceAoType> = {
    [leftZ]: null,
    [rightZ]: null,
    [leftX]: null,
    [rightX]: null,
    [bottom]: null,
    [top]: null,
  };

  constructor(props: BasePropsType & PropsType) {
    super(props);

    const {
      type,
      position,
      blocksMapping,
      blocksGroup,
      instancedBlockManager,
      facesToRender,
      isPlace,
      blockOcclusion,
    } = props!;

    this.blocksGroup = blocksGroup;
    this.type = type;
    this.position = position;
    this.atttribute = blocks[type];
    this.blocksMapping = blocksMapping;
    this.instancedBlockManager = instancedBlockManager;
    this.isPlace = !!isPlace;
    if (blockOcclusion) this.blockOcclusion = blockOcclusion;

    if (facesToRender === null) return;

    facesToRender ? this.renderWithKnownFace(facesToRender) : this.render();
  }

  renderWithKnownFace(facesToRender: Record<Face, boolean | any>) {
    if (facesToRender[leftZ]) this.addFace(leftZ);
    if (facesToRender[rightZ]) this.addFace(rightZ);
    if (facesToRender[leftX]) this.addFace(leftX);
    if (facesToRender[rightX]) this.addFace(rightX);
    if (facesToRender[top]) this.addFace(top);
    if (facesToRender[bottom]) this.addFace(bottom);
  }

  calculateAO() {
    const { x, y, z } = this.position;

    this.blockOcclusion = getFacesOcclusion([x, y, z], this.blocksMapping);
  }

  calculateAONeighbors() {
    const offSets = calNeighborsOffset(1, BLOCK_WIDTH);
    for (let hs = 1; hs > -6; hs--) {
      offSets.forEach(({ x, z }) => {
        if (x === 0 && z === 0 && hs === 0) return;

        const blockCoor = [
          this.position.x + x,
          this.position.y + hs * BLOCK_WIDTH,
          this.position.z + z,
        ];

        const block = this.blocksMapping.get(
          nameFromCoordinate(blockCoor[0], blockCoor[1], blockCoor[2])
        );

        block?.calculateAO();
        block?.rerenderAO();
      });
    }
  }

  rerenderAO() {
    // Store which faces were active
    const activeFaces: Record<Face, boolean> = {} as any;
    Object.entries(this.blockFaceInstances).forEach(([faceKey, instanceIndex]) => {
      const face = parseInt(faceKey) as Face;
      activeFaces[face] = instanceIndex !== null;
      if (instanceIndex !== null) {
        this.removeFace(face);
      }
    });

    this.renderWithKnownFace(activeFaces);
  }

  render() {
    this.calculateAO();

    const { x, y, z } = this.position;

    const leftZBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y, z + BLOCK_WIDTH)
    );
    if (leftZBlock) {
      leftZBlock.removeFace(rightZ);
    } else {
      this.addFace(leftZ);
    }

    const rightZBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y, z - BLOCK_WIDTH)
    );
    if (rightZBlock) {
      rightZBlock.removeFace(leftZ);
    } else {
      this.addFace(rightZ);
    }

    const leftXBlock = this.blocksMapping.get(
      nameFromCoordinate(x + BLOCK_WIDTH, y, z)
    );
    if (leftXBlock) {
      leftXBlock.removeFace(rightX);
    } else {
      this.addFace(leftX);
    }

    const rightXBlock = this.blocksMapping.get(
      nameFromCoordinate(x - BLOCK_WIDTH, y, z)
    );
    if (rightXBlock) {
      rightXBlock.removeFace(leftX);
    } else {
      this.addFace(rightX);
    }

    const topBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y + BLOCK_WIDTH, z)
    );
    if (topBlock) {
      topBlock.removeFace(bottom);
    } else {
      this.addFace(top);
    }

    const bottomBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y - BLOCK_WIDTH, z)
    );
    if (bottomBlock) {
      bottomBlock.removeFace(top);
    } else {
      this.addFace(bottom);
    }
  }

  removeFace(face: Face) {
    const instanceIndex = this.blockFaceInstances[face];
    if (instanceIndex === null) return;
    
    const blockKey = nameFromCoordinate(this.position.x, this.position.y, this.position.z);
    const faceTextureType = this.atttribute.textureMap[face];
    
    this.instancedBlockManager.deallocateInstance(
      blockKey,
      instanceIndex,
      this.type,
      faceTextureType
    );
    
    this.blockFaceInstances[face] = null;
  }

  addFace(face: Face) {
    // Skip if face already allocated
    if (this.blockFaceInstances[face] !== null) return;
    
    const faceAoKey = this.blockOcclusion[face] || "base";
    const faceTextureType = this.atttribute.textureMap[face];
    
    // Get rotation for this face
    const rotation = this.instancedBlockManager.getFaceRotation(face);
    
    // Allocate instance
    const blockKey = nameFromCoordinate(this.position.x, this.position.y, this.position.z);
    const instanceIndex = this.instancedBlockManager.allocateInstance(
      blockKey,
      this.type,
      faceTextureType,
      faceAoKey,
      this.position,
      rotation
    );
    
    // Track the instance index
    this.blockFaceInstances[face] = instanceIndex;
  }

  calFaceAttr(face: Face) {
    switch (face) {
      case leftZ:
        return { rotation: [0, 0, 0] };
      case rightZ:
        return {
          rotation: [0, Math.PI, 0],
        };
      case leftX:
        return {
          rotation: [0, Math.PI / 2, 0],
        };
      case rightX:
        return {
          rotation: [0, -Math.PI / 2, 0],
        };
      case top:
        return {
          rotation: [-Math.PI / 2, 0, 0],
        };
      case bottom:
        return {
          rotation: [Math.PI / 2, 0, 0],
        };
    }
  }

  destroy(isClearChunk?: boolean) {
    const { x, y, z } = this.position;

    // Deallocate all instances for this block
    const blockKey = nameFromCoordinate(x, y, z);
    this.instancedBlockManager.deallocateAllInstances(blockKey);

    if (isClearChunk) return;

    const leftZBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y, z + BLOCK_WIDTH)
    );
    leftZBlock?.addFace(rightZ);

    const rightZBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y, z - BLOCK_WIDTH)
    );
    rightZBlock?.addFace(leftZ);

    const leftXBlock = this.blocksMapping.get(
      nameFromCoordinate(x + BLOCK_WIDTH, y, z)
    );
    leftXBlock?.addFace(rightX);

    const rightXBlock = this.blocksMapping.get(
      nameFromCoordinate(x - BLOCK_WIDTH, y, z)
    );
    rightXBlock?.addFace(leftX);

    const topBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y + BLOCK_WIDTH, z)
    );
    topBlock?.addFace(bottom);

    const bottomBlock = this.blocksMapping.get(
      nameFromCoordinate(x, y - BLOCK_WIDTH, z)
    );
    bottomBlock?.addFace(top);

    this.blocksMapping.delete(nameFromCoordinate(x, y, z));
    this.calculateAONeighbors();
  }
}
