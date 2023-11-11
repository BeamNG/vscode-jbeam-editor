const jbeamDocumentation = {
  // the forum is [section] > [keyword]
  // to make it easier the console will say "No documentation found for: beams > beamDamp" - which you can copy&paste
  
  // nodes
  "nodes > id": {
    "description": "Defines the node name. **Need to be unique** for the whole vehicle",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_id)"
  },
  "nodes > posX": {
    "description": "The X (left/right) position in 3D space. Left is positive, right is negative",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_posX)"
  },
  "nodes > posY": {
    "description": "The Y (forward/back) position in 3D space. Backward is positive, forward is negative",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_posY)"
  },
  "nodes > posZ": {
    "description": "The Z (up/down) position in 3D space. Up is positive, down is negative",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_posZ)"
  },
  "nodes > nodeWeight": {
    "description": "The weight of the node in kg",
    "type": "number",
    "default": "options.nodeWeight",
    "note": "As of game version `0.30` the default weight of a node is `{{< jbeamDefaultValue \"defaultNodeWeight\">}} kg`",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_nodeWeight)"
  },
  "nodes > collision": {
    "description": "If the node can collide with anything. True by default",
    "type": "boolean",
    "default": "true",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_collision)"
  },
  "nodes > selfCollision": {
    "description": "If the node can collide with the vehicle it belongs to. False by default",
    "type": "boolean",
    "default": "false",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_selfCollision)"
  },
  "nodes > staticCollision": {
    "description": "If the node can collide with map objects and terrain. True by default",
    "type": "boolean",
    "default": "true",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_staticCollision)"
  },
  "nodes > group": {
    "description": "Groups a set of nodes into a group that can be used later in other sections",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_group)"
  },
  "nodes > engineGroup": {
    "description": "A different kind of group, related to powertrain simulation",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_engineGroup)"
  },
  "nodes > frictionCoef": {
    "description": "Static friction of the node. Default is 1",
    "type": "number",
    "default": "1",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_frictionCoef)"
  },
  "nodes > slidingFrictionCoef": {
    "description": "Sliding friction of the node. Defaults to the same value as static friction",
    "type": "number",
    "default": "frictionCoef",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_slidingFrictionCoef)"
  },
  "nodes > nodeMaterial": {
    "description": "Physics material of the node, rubber, metal, etc.",
    "type": "string",
    "default": "options.nodeMaterial",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_nodeMaterial)"
  },
  "nodes > impactGenericEvent": {
    "description": "Overrides the node's generic impact sound event",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_impactGenericEvent)"
  },
  "nodes > impactMetalEvent": {
    "description": "Overrides the node's metal impact sound event",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_impactMetalEvent)"
  },
  "nodes > impactPlasticEvent": {
    "description": "Overrides the node's plastic impact sound event",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_impactPlasticEvent)"
  },
  "nodes > fixed": {
    "description": "If the node is fixed in 3D space (Can’t move at all). False by default",
    "type": "boolean",
    "default": "false",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_fixed)"
  },
  "nodes > noLoadCoef": {
    "description": "The friction coefficient modifier on zero load. Used by tires",
    "type": "float",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_noLoadCoef)"
  },
  "nodes > fullLoadCoef": {
    "description": "The friction coefficient modifier on full load. Used by tires",
    "type": "float",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_fullLoadCoef)"
  },
  "nodes > stribeckExponent": {
    "description": "Allows finer control of the sliding friction curve. Default is 1.75. Used by tires",
    "type": "float",
    "default": "1.75",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_stribeckExponent)"
  },
  "nodes > stribeckVelMult": {
    "description": "Allows finer control of the sliding friction curve. Affects the velocity at which the sliding coefficient will apply. Used by tires",
    "type": "float",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_stribeckVelMult)"
  },
  "nodes > softnessCoef": {
    "description": "Affects tire squeal. Default is 0.6. Used by tires",
    "type": "float",
    "default": "0.6",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_softnessCoef)"
  },
  "nodes > treadCoef": {
    "description": "Multiplies ground roughness coefficient for this node. Default is 1. Used by tires",
    "type": "float",
    "default": "1",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_treadCoef)"
  },
  "nodes > loadSensitivitySlope": {
    "description": "The loss of coef per newton of normal force. Used by tires",
    "type": "float",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_loadSensitivitySlope)"
  },
  "nodes > pairedNode": {
    "description": "Groups the inner and outer tire nodes into pairs. Used by tires",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/nodes/#args_pairedNode)"
  },
  "beams > id1": {
    "description": "Name of the first node",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_id1)"
  },
  "beams > id2": {
    "description": "Name of the second node",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_id2)"
  },
  "beams > beamType": {
    "description": "Sets the type of the beam. Possible values: NORMAL, HYDRO, ANISOTROPIC, BOUNDED, PRESSURED, SUPPORT, BROKEN, LBEAM",
    "type": "string",
    "default": "NORMAL",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_beamType)"
  },
  "beams > beamSpring": {
    "description": "Rigidity of the beam (N/m).",
    "type": "number",
    "default": "4300000",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_beamSpring)"
  },
  "beams > beamDamp": {
    "description": "Damping of the beam (N/m/s).",
    "type": "number",
    "default": "580",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_beamDamp)"
  },
  "beams > beamStrength": {
    "description": "Strength of the beam. (N). A value of 'FLT_MAX' will result in an unbreakable beam.",
    "type": "number",
    "default": "FLT_MAX",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_beamStrength)"
  },
  "beams > beamDeform": {
    "description": "How much force (N) is required to deform the beam permanently. A value of 'FLT_MAX' will result in a beam that can't be permanently deformed.",
    "type": "number",
    "default": "220000",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_beamDeform)"
  },
  "beams > beamPrecompression": {
    "description": "Precompression of the beam. The length it will become as soon as it spawns.",
    "type": "number",
    "default": "1.0",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_beamPrecompression)"
  },
  "beams > precompressionRange": {
    "description": "Precompression length change in meters. Overrides beamPrecompression.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_precompressionRange)"
  },
  "beams > beamPrecompressionTime": {
    "description": "Time in seconds for precompressed beams to reach their requested length.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_beamPrecompressionTime)"
  },
  "beams > breakGroup": {
    "description": "The breakGroup of this beam. A beam gets automatically broken when another beam from the same breakGroup breaks.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_breakGroup)"
  },
  "beams > breakGroupType": {
    "description": "Sets breakgroup behavior. If set to 0, this beam will break others in the breakGroup. If set to 1, this beam will NOT break others in the breakGroup, but will be broken by the group.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_breakGroupType)"
  },
  "beams > disableMeshBreaking": {
    "description": "Disables mesh breaking. Useful when the breakable beam only acts as a structural support, for example in passenger cabins.",
    "type": "boolean",
    "default": "false",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_disableMeshBreaking)"
  },
  "beams > disableTriangleBreaking": {
    "description": "Disables triangle breaking. Useful when the breakable beam only acts as a structural support, for example in passenger cabins.",
    "type": "boolean",
    "default": "false",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_disableTriangleBreaking)"
  },
  "beams > name": {
    "description": "Name of the beam. Used by some systems to identify the specific beam to use.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_name)"
  },
  "beams > dampCutoffHz": {
    "description": "Limits the vibration frequency above which damping applies. Only applies to normal, bounded, and l-beams.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_dampCutoffHz)"
  },
  "beams > deformLimit": {
    "description": "Limits how much the beam can deform in compression.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_deformLimit)"
  },
  "beams > deformLimitExpansion": {
    "description": "Limits how much the beam can deform in expansion. Used to avoid excessive stretching.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_deformLimitExpansion)"
  },
  "beams > deformLimitStress": {
    "description": "Limits the beamDeform gain to this value (N). Useful to simulate friction on certain kinds of suspension.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_deformLimitStress)"
  },
  "beams > optional": {
    "description": "Deactivates errors when one of the beam's node is missing. Used for cases where one of the nodes that make up the beam is located in an optional component.",
    "type": "boolean",
    "default": "false",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_optional)"
  },
  "beams > deformGroup": {
    "description": "Identifies which deform group this beam is part of. Used to trigger flexbody deform groups and for damage simulation on some powertrain components.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_deformGroup)"
  },
  "beams > deformationTriggerRatio": {
    "description": "Level of deformation above which the deformGroup is triggered. Typical values are very small numbers under 0.1.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_deformationTriggerRatio)"
  },
  "beams > soundFile": {
    "description": "The FMOD event to play on beam compression.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_soundFile)"
  },
  "beams > colorFactor": {
    "description": "Reduces the overall FMOD event volume by up to 10dB.",
    "type": "number",
    "default": "0.5",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_colorFactor)"
  },
  "beams > attackFactor": {
    "description": "Sets the envelope attack factor of the sound.",
    "type": "number",
    "default": "10",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_attackFactor)"
  },
  "beams > volumeFactor": {
    "description": "Sets the relationship between the beam compression and sound volume.",
    "type": "number",
    "default": "1",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_volumeFactor)"
  },
  "beams > decayFactor": {
    "description": "Sets the envelope decay/release factors of the sound.",
    "type": "number",
    "default": "10",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_decayFactor)"
  },
  "beams > pitchFactor": {
    "description": "Impulse-based pitch bend factor.",
    "type": "number",
    "default": "0",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_pitchFactor)"
  },
  "beams > maxStress": {
    "description": "The beam stress value treated as full compression by the sound system.",
    "type": "number",
    "default": "35000",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/beams/#args_maxStress)"
  },
  "flexbodies > mesh": {
    "description": "Defines the name of the mesh. This is the same name as in blender.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_mesh)"
  },
  "flexbodies > group": {
    "description": "Defines the id of the node group this mesh is linked to. A mesh can be linked to multiple node groups.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_group)"
  },
  "flexbodies > pos": {
    "description": "Position offset of the flexbody.",
    "type": "float3",
    "default": "0,0,0",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_pos)"
  },
  "flexbodies > rot": {
    "description": "Rotation offset of the flexbody. Uses the intrinsic Euler +Z +X +Y rotation system.",
    "type": "float3",
    "default": "0,0,0",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_rot)"
  },
  "flexbodies > scale": {
    "description": "Scale offset of the flexbody.",
    "type": "float3",
    "default": "1,1,1",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_scale)"
  },
  "flexbodies > deformGroup": {
    "description": "Defines the deform group that will be used for this mesh. This name should match the deform group defined in the beams section.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_deformGroup)"
  },
  "flexbodies > deformMaterialBase": {
    "description": "The name of the initial material that will get changed. Any mesh that has a deform group applied should have only a single material to avoid issues.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_deformMaterialBase)"
  },
  "flexbodies > deformMaterialDamaged": {
    "description": "The name of the material to use when the break group is triggered.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_deformMaterialDamaged)"
  },
  "flexbodies > deformSound": {
    "description": "The sound clip that will be played when the deform group is triggered.",
    "type": "string",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_deformSound)"
  },
  "flexbodies > deformVolume": {
    "description": "The volume of the sound clip that is played when the deform group is triggered.",
    "type": "number",
    "default": "",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_deformVolume)"
  },
  "flexbodies > disableMeshBreaking": {
    "description": "Disables mesh breaking. Mesh breaking allows polygons of a flexbody mesh to be dynamically removed when an underlying beam breaks.",
    "type": "boolean",
    "default": "false",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_disableMeshBreaking)"
  },
  "flexbodies > ignoreNodeOffset": {
    "description": "Whether the position of the mesh should ignore the nodeOffset modifier.",
    "type": "boolean",
    "default": "false",
    "documentation": "[here](https://documentation.beamng.com/modding/vehicle/sections/flexbodies/#args_ignoreNodeOffset)"
  }

}

module.exports = {
  jbeamDocumentation
}
