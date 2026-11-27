# Auto Humanoid Rigging and VRM 0.x — technical integration contract

## Not yet implemented
This document is a pipeline contract, not a claim that automatic rigging or VRM export is working. A Hunyuan-generated GLB is not a humanoid rig and must not be renamed to .vrm.

## Rig worker contract (planned)
Input: generated GLB plus optional rig profile (anime humanoid, proportions, pose preset).
Output: GLB with a skinned humanoid armature, skin weights, and validated bone names; diagnostic report; no success response if it fails validation.

### Minimum humanoid skeleton mapping
- hips
- spine
- chest (optional in VRM 0.x mapping depending profile)
- neck, head
- left/right shoulder, upperArm, lowerArm, hand
- left/right upperLeg, lowerLeg, foot, toes

### Rigging validation gates
- Require humanoid body segmentation or robust landmark fitting before binding; do not blindly attach a generic skeleton to arbitrary mesh topology.
- Check mesh-to-armature bind, nonzero weights, normalized weight sums, and required bones.
- Test neutral T/A-pose and elbow/knee deformation; keep accessories/hair as separate meshes when practical.
- Clearly report failures; avoid claiming anime face/garment deformation quality is guaranteed.

## Custom VRM 0.x exporter (planned, no UniVRM)
The exporter will build a glTF 2.0 container with VRM 0.x extension metadata. Expected data includes:
- VRM metadata and humanoid bone mapping
- first-person and look-at settings
- blendshape groups and mesh bindings
- material/shading settings, including supported MToon configuration
- spring-bone groups and collider data, if available

Implementation should use a validated glTF/GLB writer and schema-aware extension serialization, not a file extension rename. Test output with a VRM 0.x parser and target apps before enabling the download button.

## Pipeline state model (planned)
`queued → image_to_mesh → rigging → validation → vrm_export → complete`
Failures should include stage-specific diagnostics. Keep original generated GLB available when a downstream stage fails.
