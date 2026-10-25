import * as THREE from 'three';

/**
 * Food colours for the 3D dishes (sRGB hex; three converts to linear).
 * These are asset data, not UI colours — the UI still uses theme tokens only.
 */
const c = (hex: number) => new THREE.Color(hex);

export const FOOD = {
  plate: c(0x2a2522),
  plateRim: c(0x3a332e),
  plateLight: c(0xf1ece6),
  plateLightRim: c(0xd9d0c6),
  slate: c(0x1f2224),
  slateEdge: c(0x34383b),
  bowl: c(0x23201e),
  bowlRim: c(0xe9e2d8),

  // Bread
  bunPale: c(0xe2a455),
  bunGold: c(0xc46f1c),
  bunTop: c(0x86360a),
  bunDeep: c(0x5a2306),
  crumb: c(0xf1dcb0),
  crumbLight: c(0xf8ead0),
  crumbHole: c(0xc9a774),
  sesame: c(0xf6ecd2),
  sesameDark: c(0xd9c08e),

  // Beef & cheese
  beef: c(0x7c4127),
  beefCrust: c(0x5a2a12),
  beefChar: c(0x2e1508),
  cheddar: c(0xf79a06),
  cheddarDeep: c(0xe27a00),

  // Veg
  pickleSkin: c(0x4f6a1e),
  pickleFlesh: c(0xb7c46a),
  pickleSeed: c(0xe6e0a8),
  onion: c(0xf3ecf0),
  onionEdge: c(0xa45c8e),
  cucumber: c(0x86b25a),
  cucumberSkin: c(0x2f5a1e),
  avocado: c(0xb9cf5a),
  avocadoDeep: c(0x5f8a2a),
  avocadoSkin: c(0x2c3d14),
  edamame: c(0x5f9e22),
  edamameLight: c(0x8cc43e),
  mango: c(0xffb52e),
  mangoDeep: c(0xf28a12),
  herb: c(0x3f6b1c),

  // Sauces
  sauceZhar: c(0xe8742a),
  sauceDark: c(0xb04a14),
  tomato: c(0xb3260f),
  tomatoDeep: c(0x7e1608),
  honey: c(0xc06a08),
  ponzu: c(0x5a2a0c),
  berry: c(0x6e0d22),
  berryGloss: c(0x9e1a34),

  // Wood
  wood: c(0xa8703e),
  woodDeep: c(0x6e4220),
  woodEdge: c(0x5a3418),

  // Pizza
  dough: c(0xf0cf95),
  crust: c(0xc9802f),
  crustDeep: c(0x8d4a14),
  char: c(0x2a160c),
  mozzarella: c(0xf9e6bd),
  mozzBrown: c(0xc9822e),
  pepperoni: c(0x9c2212),
  pepperoniDeep: c(0x4a0c05),
  pepperoniFat: c(0xe8a070),

  // Fish & rice
  salmon: c(0xff8a4c),
  salmonDeep: c(0xf2632e),
  salmonFat: c(0xffd9c2),
  rice: c(0xf6f2ea),
  riceShadow: c(0xd9d2c4),
  nori: c(0x1c2618),
  creamCheese: c(0xfbf7ee),
  ginger: c(0xf6b9b0),
  wasabi: c(0x8fae3a),

  // Dessert
  cheesecake: c(0xfbe9c4),
  cheesecakeTop: c(0xd99a52),
  graham: c(0xa86a32),
  grahamDeep: c(0x7a4a1e),
  blueberry: c(0x2c2a52),
  blueberryBloom: c(0x6b6f98),
  raspberry: c(0xc0183a),
  mint: c(0x3f8a2c),
};
