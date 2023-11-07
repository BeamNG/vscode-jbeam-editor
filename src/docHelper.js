const jbeamDocumentation = {
  // the forum is [section] > [keyword]
  // to make it easier the console will say "No documentation found for: beams > beamDamp" - which you can copy&paste
  
  // nodes
  "nodes > collision": "Defines how the node collides with the world. See [here for more info](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_collision)",
  "nodes > name": "Defines the node name. **Need to be unique** for the whole vehicle",
  "nodes > posX": "The X (left/right) position in 3D space",
  "nodes > posY": "The Y (forward/back) position in 3D space",
  "nodes > posZ": "The Z (up/down) position in 3D space",
  "nodes > nodeWeight": {
    "description": "The weight of the node in kg",
    "type": "number",
    "default": "options.nodeWeight",
    "note": "As of game version 0.30.0.0 the default weight of a node is 25 kg",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_nodeWeight)"
  },
  "nodes > collision": "If the node can collide with anything",
  "nodes > selfCollision": "If the node can collide with the vehicle it belongs to",
  "nodes > staticCollision": "If the node can collide with map objects and terrain",
  "nodes > group": "Groups a set of nodes into a group that can be used later in other sections",
  "nodes > engineGroup": "A different kind of group, related to powertrain simulation",
  "nodes > frictionCoef": "Static friction of the node",
  
  
  // beams
  "beams > id1": "id1 - The first node of the beam",
  "beams > beamPrecompression": "Please fill the documentation :)",
  "beams > beamType": "Please fill the documentation :)",
  "beams > beamLongBound": "Please fill the documentation :)",
  "beams > beamShortBound": "Please fill the documentation :)",
  "beams > beamSpring": "Please fill the documentation :)",
  "beams > beamDamp": "Please fill the documentation :)",
  "beamDeform": "beamDeform - Please fill the documentation :)",
  "beams > beamStrength": "Please fill the documentation :)",
  "deformGroup": "Deformgroup",
  "beams > deformationTriggerRatio": "Please fill the documentation :)",
}

module.exports = {
  jbeamDocumentation
}
