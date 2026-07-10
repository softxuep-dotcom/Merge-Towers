# Enemy sprite generation v2

## Output contract

- One sheet per enemy, exactly 5 columns × 3 rows.
- Row order: `front`, `left`, `front_left` (down-left 45° three-quarter view).
- Exactly five coherent loop frames per row: contact, compression/passing, extension, recovery, loop closure.
- Same identity, scale, baseline, lighting, and 2.5D camera elevation across all 15 cells.
- No shadow, floor plane, text, labels, grid lines, or watermark.
- Flat chroma key only: `#ff00ff` for green subjects; `#00ff00` for other subjects.

## Shared generation prompt

```text
Use case: stylized-concept
Asset type: production game enemy sprite sheet
Input images: supplied front and left frames are identity, palette, rendering-style, and motion references only
Primary request: completely redraw a production-quality 15-frame locomotion sheet for exactly the same enemy
Scene/backdrop: perfectly flat solid chroma-key background; one uniform color only
Style/medium: polished hand-painted 2.5D mobile tower-defense sprite, crisp antialiased edges, matching the supplied references
Composition/framing: exact 5 columns by 3 rows, evenly spaced, one fully separated sprite per cell; top row front/toward player, middle row directly left, bottom row diagonally down-left at a clear 45-degree three-quarter angle
Animation: exactly five coherent loop frames per row; frame 5 loops smoothly to frame 1; readable limb/body motion without identity drift
Constraints: exactly 15 sprites; directions must be visually distinct; identical scale, baseline, lighting, character design, and camera elevation; no cast/contact shadow, reflection, floor plane, grid, label, text, or watermark; generous padding; never use the key color in the subject
Avoid: extra characters, merged or cropped sprites, inconsistent scale, gradients, lighting variation, perspective drift, simple mirroring or geometric distortion as a substitute for the diagonal view
```

## Enemy-specific subject prompts

- `slime`: glossy lime-green slime, yellow highlights, dark red-brown angry eyes, tiny side droplets; five-frame squash/stretch locomotion.
- `mini`: smaller neutral-cute lime-green mini slime, exactly two round dark dot eyes and no brows, irises, mouth, or aggressive expression.
- `runner`: agile cream quadruped with large swept blue-and-white feather ears, blue eyes, teal feather collar, indigo paws, and one blue feather tail; five-frame gallop with four readable legs.
- `tank`: olive/tan armored tortoise with green shell spines, bronze harness, two round metal side shields with green gem centers, and thick clawed legs; heavy five-frame walk.
- `flyer`: compact orange insect with blue compound eyes, two yellow antennae, four translucent pale-pink veined wings, and tiny dark legs; five-frame wingbeat is fully raised → 45° downstroke → near-horizontal low point → 45° upstroke → raised recovery, with a visible low → high → low body bob and tucked legs.
- `splitter`: one fused two-lobed rock creature, dominant molten-orange lobe with the only pair of glowing eyes plus a faceless attached charcoal lobe; short rock legs and heavy walk.
- `boss`: massive broad-shouldered mossy stone golem with tan carved plates, square spiral shoulder motifs, glowing green eyes, huge fists, and short heavy legs; weighted walk with arm swing.

## References and post-processing

The accepted v2 sheets were redrawn from the former v1 front/left review frames; those superseded v1 files were removed after v2 integration was verified. Chroma-key sources are the `*-sheet-generated.png` files. `*-sheet-alpha.png` files were produced with the imagegen skill's `remove_chroma_key.py` helper using border auto-key sampling, soft matte, despill, transparent threshold 12, and opaque threshold 220.
