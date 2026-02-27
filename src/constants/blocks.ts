//icon
import bedRockIcon from "@/assets/blockIcon/Bedrock_JE2_BE2.webp";
import blockOfDiamondIcon from "@/assets/blockIcon/block_of_diamond.webp";
import blockOfEmeraldIcon from "@/assets/blockIcon/Block_of_Emerald_JE4_BE3.webp";
import blockOfGoldIcon from "@/assets/blockIcon/Block_of_Gold_JE6_BE3.webp";
import blockOfIronIcon from "@/assets/blockIcon/Block_of_Iron_JE4_BE3.webp";
import blockOfLapisIcon from "@/assets/blockIcon/Block_of_Lapis_Lazuli_JE3_BE3.webp";
import cobblestoneIcon from "@/assets/blockIcon/Cobblestone.webp";
import dirtIcon from "@/assets/blockIcon/Dirt.webp";
import furnanceIcon from "@/assets/blockIcon/Furnace_29_JE4.webp";
import grassIcon from "@/assets/blockIcon/Grass_Block.webp";
import leavesIcon from "@/assets/blockIcon/Oak_Leaves.webp";
import woodIcon from "@/assets/blockIcon/Oak_Log_29_JE5_BE3.webp";
import oakPlanksIcon from "@/assets/blockIcon/Oak_Planks.webp";
import sandIcon from "@/assets/blockIcon/Sand_JE5_BE3.webp";
import stoneIcon from "@/assets/blockIcon/Stone.webp";
// sound break
import breakBlock from "@/assets/sound/break/block.mp3";
import breakGrass from "@/assets/sound/break/grass.mp3";
import breakWood from "@/assets/sound/break/wood.mp3";
// sound place
import placeBlock from "@/assets/sound/place/block.mp3";
import placeGrass from "@/assets/sound/place/grass.mp3";
import placeWood from "@/assets/sound/place/wood.mp3";
// soundStep
import stepGrass from "@/assets/sound/step/grass3.ogg";
import stepStone from "@/assets/sound/step/stone3.ogg";
import { BlockKeys, BlocksType } from "@/type";

const blocks: BlocksType = {
  [BlockKeys.grass]: {
    name: "Grass",
    renderInInventory: true,
    icon: grassIcon,
    step: new Audio(stepGrass),
    place: new Audio(placeGrass),
    break: new Audio(breakGrass),
    volume: 0.1,
  },
  [BlockKeys.stone]: {
    name: "Stone",
    renderInInventory: true,
    icon: stoneIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(placeBlock),
    volume: 0.1,
  },
  [BlockKeys.sand]: {
    name: "Sand",
    renderInInventory: true,
    icon: sandIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(placeBlock),
    volume: 0.1,
  },
  [BlockKeys.dirt]: {
    name: "Dirt",
    renderInInventory: true,
    icon: dirtIcon,
    step: new Audio(stepGrass),
    place: new Audio(placeGrass),
    break: new Audio(breakGrass),
    volume: 0.1,
  },
  [BlockKeys.cobblestone]: {
    name: "Cobblestone",
    renderInInventory: true,
    icon: cobblestoneIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(breakBlock),
    volume: 0.1,
  },
  [BlockKeys.leaves]: {
    name: "Leaves",
    renderInInventory: true,
    icon: leavesIcon,
    step: new Audio(stepGrass),
    place: new Audio(placeGrass),
    break: new Audio(breakGrass),
    volume: 0.1,
  },
  [BlockKeys.wood]: {
    name: "Wood",
    renderInInventory: true,
    icon: woodIcon,
    step: new Audio(stepStone),
    place: new Audio(placeWood),
    break: new Audio(breakWood),
    volume: 0.5,
  },
  [BlockKeys.furnace]: {
    name: "Furnace",
    renderInInventory: true,
    icon: furnanceIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(breakBlock),
    volume: 0.1,
  },
  [BlockKeys.oakPlanks]: {
    name: "Oak Wood Planks",
    renderInInventory: true,
    icon: oakPlanksIcon,
    step: new Audio(stepStone),
    place: new Audio(placeWood),
    break: new Audio(breakWood),
    volume: 0.5,
  },
  [BlockKeys.blockOfDiamond]: {
    name: "Block of Diamond",
    renderInInventory: true,
    icon: blockOfDiamondIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(breakBlock),
    volume: 0.5,
  },
  [BlockKeys.blockOfIron]: {
    name: "Block of Iron",
    renderInInventory: true,
    icon: blockOfIronIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(breakBlock),
    volume: 0.5,
  },
  [BlockKeys.blockOfGold]: {
    name: "Block of Gold",
    renderInInventory: true,
    icon: blockOfGoldIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(breakBlock),
    volume: 0.5,
  },
  [BlockKeys.blockOfLapis]: {
    name: "Block of Lapis",
    renderInInventory: true,
    icon: blockOfLapisIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(breakBlock),
    volume: 0.5,
  },
  [BlockKeys.blockOfEmerald]: {
    name: "Block of Emerald",
    renderInInventory: true,
    icon: blockOfEmeraldIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(breakBlock),
    volume: 0.5,
  },
  [BlockKeys.water]: {
    name: "Water",
    renderInInventory: false,
    icon: bedRockIcon,
    step: new Audio(stepGrass),
    place: new Audio(placeGrass),
    break: new Audio(breakGrass),
    volume: 0.1,
  },
  [BlockKeys.bedrock]: {
    name: "Bedrock",
    renderInInventory: false,
    icon: bedRockIcon,
    step: new Audio(stepStone),
    place: new Audio(placeBlock),
    break: new Audio(placeBlock),
    volume: 0.1,
  },
};

Object.values(blocks).forEach((block) => {
  block.step.loop = true;
  block.step.volume = block.volume;
  block.step.playbackRate = 1.3;

  block.place.volume = 0.6;
  block.break.volume = 0.6;
});

export default blocks;
