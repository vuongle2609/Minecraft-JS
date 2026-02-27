import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Group,
  Mesh,
  MeshLambertMaterial,
} from "three";
import { ChunkGeometryData } from "@/game/helpers/chunkGeometryBuilder";

export class ChunkMesh {
  chunkName: string;
  group: Group;
  opaqueMesh: Mesh;
  transparentMesh: Mesh;

  private opaqueGeom: BufferGeometry;
  private transparentGeom: BufferGeometry;

  // Track allocated buffer capacities (in face count) to avoid reallocating
  // when the geometry only changes slightly (block break/place)
  private opaqueCapacity = 0;
  private transparentCapacity = 0;

  constructor(
    chunkName: string,
    opaqueMaterial: MeshLambertMaterial,
    waterMaterial: MeshLambertMaterial
  ) {
    this.chunkName = chunkName;
    this.group = new Group();
    this.group.name = `chunk_${chunkName}`;

    // Create meshes once — never add/remove from group
    this.opaqueGeom = new BufferGeometry();
    this.opaqueMesh = new Mesh(this.opaqueGeom, opaqueMaterial);
    this.opaqueMesh.name = `opaque_${chunkName}`;
    this.opaqueMesh.frustumCulled = true;
    this.opaqueMesh.visible = false;
    this.group.add(this.opaqueMesh);

    this.transparentGeom = new BufferGeometry();
    this.transparentMesh = new Mesh(this.transparentGeom, waterMaterial);
    this.transparentMesh.name = `water_${chunkName}`;
    this.transparentMesh.renderOrder = 1;
    this.transparentMesh.frustumCulled = true;
    this.transparentMesh.visible = false;
    this.group.add(this.transparentMesh);
  }

  buildFromGeometryData(data: ChunkGeometryData): void {
    this.opaqueCapacity = this.updateGeometry(
      this.opaqueGeom,
      this.opaqueMesh,
      data.opaquePositions,
      data.opaqueNormals,
      data.opaqueUvs,
      data.opaqueColors,
      data.opaqueIndices,
      this.opaqueCapacity
    );

    this.transparentCapacity = this.updateGeometry(
      this.transparentGeom,
      this.transparentMesh,
      data.transparentPositions,
      data.transparentNormals,
      data.transparentUvs,
      data.transparentColors,
      data.transparentIndices,
      this.transparentCapacity
    );
  }

  private updateGeometry(
    geom: BufferGeometry,
    mesh: Mesh,
    positions: Float32Array,
    normals: Float32Array,
    uvs: Float32Array,
    colors: Float32Array,
    indices: Uint32Array,
    currentCapacity: number
  ): number {
    const faceCount = indices.length / 6;

    if (faceCount === 0) {
      mesh.visible = false;
      return currentCapacity;
    }

    // Check if we can reuse existing buffers (fits within capacity)
    if (faceCount <= currentCapacity && faceCount > currentCapacity / 4) {
      // Reuse existing GPU buffers — just copy data in-place
      const posAttr = geom.attributes.position as BufferAttribute;
      const normAttr = geom.attributes.normal as BufferAttribute;
      const uvAttr = geom.attributes.uv as BufferAttribute;
      const colorAttr = geom.attributes.color as BufferAttribute;
      const idxAttr = geom.index as BufferAttribute;

      (posAttr.array as Float32Array).set(positions);
      posAttr.needsUpdate = true;

      (normAttr.array as Float32Array).set(normals);
      normAttr.needsUpdate = true;

      (uvAttr.array as Float32Array).set(uvs);
      uvAttr.needsUpdate = true;

      (colorAttr.array as Float32Array).set(colors);
      colorAttr.needsUpdate = true;

      (idxAttr.array as Uint32Array).set(indices);
      idxAttr.needsUpdate = true;

      geom.setDrawRange(0, indices.length);
      geom.computeBoundingSphere();
      mesh.visible = true;

      return currentCapacity;
    }

    // Need to (re)allocate — allocate with 50% headroom for future updates
    const newCapacity = Math.ceil(faceCount * 1.5);
    const vertCapacity = newCapacity * 4;
    const idxCapacity = newCapacity * 6;

    // Create padded buffers so future smaller updates fit without realloc
    const posArr = new Float32Array(vertCapacity * 3);
    posArr.set(positions);
    const normArr = new Float32Array(vertCapacity * 3);
    normArr.set(normals);
    const uvArr = new Float32Array(vertCapacity * 2);
    uvArr.set(uvs);
    const colorArr = new Float32Array(vertCapacity * 3);
    colorArr.set(colors);
    const idxArr = new Uint32Array(idxCapacity);
    idxArr.set(indices);

    const posAttr = new BufferAttribute(posArr, 3);
    posAttr.setUsage(DynamicDrawUsage);
    geom.setAttribute("position", posAttr);

    const normAttr = new BufferAttribute(normArr, 3);
    normAttr.setUsage(DynamicDrawUsage);
    geom.setAttribute("normal", normAttr);

    const uvAttr = new BufferAttribute(uvArr, 2);
    uvAttr.setUsage(DynamicDrawUsage);
    geom.setAttribute("uv", uvAttr);

    const colorAttr = new BufferAttribute(colorArr, 3);
    colorAttr.setUsage(DynamicDrawUsage);
    geom.setAttribute("color", colorAttr);

    const idxBuf = new BufferAttribute(idxArr, 1);
    idxBuf.setUsage(DynamicDrawUsage);
    geom.setIndex(idxBuf);

    geom.setDrawRange(0, indices.length);
    geom.computeBoundingSphere();
    mesh.visible = true;

    return newCapacity;
  }

  setVisible(visible: boolean): void {
    this.group.visible = visible;
  }

  dispose(): void {
    this.opaqueGeom.dispose();
    this.transparentGeom.dispose();
    this.group.removeFromParent();
  }
}
