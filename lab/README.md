# Hero scene lab

Isolated prototype for the Archegon hero: a geological section through the
crust showing a geothermal doublet feeding a surface data-centre campus.

Nothing here is wired into the live site yet. Run:

    python3 -m http.server 4180
    open http://127.0.0.1:4180/lab/

## Files

- `scene-core.js`    seeded RNG, transport frames, conduit sweeping, fracture growth
- `scene-shaders.js` thermal ramp, rock mass shading, emissive fracture shading
- `scene-build.js`   well pair, stimulated volume, rock mass heat field
- `scene-surface.js` datum line, data-centre campus, convective particles
- `scene-main.js`    runtime, camera framing, pointer parallax

## Attribution

The tube-sweeping and instancing approach follows the open-source Sylva
study. The geometry, fracture propagation, thermal shading model, and
circulation animation are new work for Archegon.

Three.js r149 is MIT licensed; see `licenses/`.
