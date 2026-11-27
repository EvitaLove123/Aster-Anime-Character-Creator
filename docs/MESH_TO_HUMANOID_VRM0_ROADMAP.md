# Mesh-to-Humanoid VRM 0.x pipeline — implementation roadmap

## Stage A — Hunyuan3D 2.1
- Image-conditioned shape reconstruction.
- Optional texture pipeline.
- GLB mesh output.

## Stage B — humanoid rigging (not yet implemented)
A generated object mesh is not a humanoid avatar. Rigging needs body-part segmentation or a trained human/character auto-rigger, skeleton fitting (hips/spine/chest/head/arms/hands/legs/feet), weight painting, and validation of pose deformation. A generic auto-rig is not guaranteed to work for anime clothing, hair, accessories, tails, or nonhuman proportions. Keep a rigging adapter boundary so an actual rigging service can be integrated and tested.

## Stage C — VRM 0.x custom packaging (not yet implemented)
- Export skinned mesh + armature to glTF 2.0.
- Build the VRM 0.x extension data: meta, humanoid bone mapping, first-person settings, blendshape groups, look-at configuration, material settings, spring-bone and collider data as supported.
- Validate required bone mappings, weights, mesh/armature linkage, extension schema and compatibility in target viewers.
- Do not use UniVRM. A custom exporter still needs conformance testing; a plain GLB rename is not VRM.

## Testing target
Start with one generated, single-mesh humanoid. Test standing pose, T-pose, elbow/knee deformation, facial expressions, material transparency, and target-app loading. Expand features incrementally.
