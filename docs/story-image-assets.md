# ORBIT story illustration assets

Created 2026-09-27 with the built-in image generation tool (no external stock imagery). These are original AI-generated editorial illustrations, not astronomical observation photographs or scale diagrams. Published story prose and publication hashes are unchanged.

The web delivery files use 640 px and 1200 px WebP versions with the same composition. Cards use responsive srcset; only the featured image loads eagerly. The original category defaults and article overrides in `data/story-images.json` remain available for legacy stories; they do not satisfy the bespoke-cover requirement for new daily drafts. Artwork metadata stays separate from editorial article JSON and its publication hashes.

## New daily story covers

The daily editorial task creates two article drafts and two new, subject-specific AI illustrations in one dated draft PR. Each article has its own explicit image key, 640×360 and 1200×675 WebP deliveries, Korean alt text, and a provenance record containing the final prompt and actual generation tool. New covers follow the approved midnight navy, restrained mint, and warm cream/amber style; they are labelled AI editorial illustrations, never observation photographs or literal scale diagrams.

The canonical creation, review, validation, and safe-rerun procedure is [`_editorial/IMAGE_WORKFLOW.md`](../_editorial/IMAGE_WORKFLOW.md). Generation failure leaves the draft incomplete; an existing category cover cannot be substituted to mark the daily task complete. The original asset list and generation prompts below are a historical record and are not replaced when new covers are added.

## Delivery files

- `images/stories/saturn-rings-640.webp` — 640×360, 17,062 bytes
- `images/stories/saturn-rings-1200.webp` — 1200×675, 56,786 bytes
- `images/stories/light-year-640.webp` — 640×360, 13,506 bytes
- `images/stories/light-year-1200.webp` — 1200×675, 46,004 bytes
- `images/stories/comet-tails-640.webp` — 640×360, 12,258 bytes
- `images/stories/comet-tails-1200.webp` — 1200×675, 45,454 bytes
- `images/stories/night-observing-640.webp` — 640×360, 17,486 bytes
- `images/stories/night-observing-1200.webp` — 1200×675, 68,312 bytes
- `images/stories/moon-phases-640.webp` — 640×360, 12,952 bytes
- `images/stories/moon-phases-1200.webp` — 1200×675, 40,882 bytes
- `images/stories/deep-space-640.webp` — 640×360, 30,458 bytes
- `images/stories/deep-space-1200.webp` — 1200×675, 98,270 bytes
- `images/stories/planets-640.webp` — 640×360, 18,752 bytes
- `images/stories/planets-1200.webp` — 1200×675, 52,102 bytes
- `images/stories/spaceflight-640.webp` — 640×360, 31,512 bytes
- `images/stories/spaceflight-1200.webp` — 1200×675, 98,172 bytes

## Final generation prompts

### saturn-rings

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: majestic Saturn occupying center-left to center, a warm pale amber gas giant with soft horizontal atmospheric bands. Its thin elegant rings run diagonally from lower-left to upper-right, visibly many fine concentric icy-particle bands, with correct ring occlusion behind the planet and a believable shadow on the rings. The complete outer rings fit comfortably inside the frame. On the far right a few subtle brighter tiny ice flecks hint at particulate composition but NO floating boulders, no inset diagrams, no unrelated planets. Quiet sparse navy space. This is the feature image about Saturn's rings being many particles, not one solid ice plate.
```

### light-year

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: conceptual illustration of a very long distance crossed by light. A luminous warm ivory star near the left quarter of frame and a small recognizable blue-green Earth near the right quarter, connected by one delicate straight mint ray. The two celestial bodies are far apart across spacious deep navy starfield, never touching; the star is a gentle radiating glow not a fiery explosion. Earth's night side and tiny atmospheric rim softly visible. No numbers, rulers, clocks, trajectories, arrows or scale labels. Clearly an editorial conceptual illustration, not a literal solar-system scale model. Clean elegant single focal narrative.
```

### comet-tails

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: scientific editorial illustration of a comet with two distinct tails. A small distant warm sunlight glow just INSIDE the left edge. An irregular icy charcoal nucleus at x40% y55%, with a soft mint coma. A thin, straight blue/mint ion tail streams diagonally to the upper right, AWAY from the sun. A broader softly curved ivory-gold dust tail sweeps to the lower right, also away from the sun. Both tails remain on the right/anti-solar side of the nucleus. Graceful delicate translucent dust detail, plenty of dark space, no explosions, no flame streaks, no asteroid impacts, no spacecraft. Tails readable at thumbnail size.
```

### night-observing

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: peaceful night-sky observing illustration. Low dark rolling mountain ridge across bottom 20 percent; one tiny adult observer standing calmly beside a modest tripod telescope near lower-right, both silhouettes. Above them broad rich navy sky with a soft restrained Milky Way band, subtle mint-blue starlight and sparse individually bright stars. A dim warm amber/red observing light close to the telescope's feet, very subtle. No bright city, no large moon, no fantastical planets, no tent, no prominent face or character. Sky occupies80percent; quiet believable night landscape, suitable cover for dark adaptation, stargazing and seasonal constellations.
```

### moon-phases

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: an elegant conceptual lunar illustration for articles about the Moon and planets. Three separated lunar disks in a gentle horizontal sequence against empty midnight space: a slim waxing crescent at left, a first-quarter half-lit Moon at middle, and a softly lit full Moon at right. All illuminated portions on the right (consistent waxing sequence), fine understated gray-lunar crater texture, subtly warm ivory light and cool navy shadow. Disks modestly varied in size for editorial visual rhythm, no orbit lines, no sun, no Earth, no eclipse red color, no labels or scientific scale. Main disks all fully framed with dark margins, visually serene, retain restrained naturalistic illustration style.
```

### deep-space

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: an elegant distant spiral galaxy, clearly a flattened rotating disk seen at a gentle oblique angle, with a warm ivory core and delicate blue-mint spiral arms, tiny pink-amber nebular pockets, surrounded by vast deep navy space and sparse stars. Galaxy occupies about60percent of frame, complete arms fit with generous margins. Subtle dust lanes, soft detail rather than oversaturated neon; sophisticated naturalistic editorial illustration, no black hole vortex, no bright explosions, no rockets, no planets. Suitable generic story cover for stars, galaxies, universe and exploration.
```

### planets

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: elegant editorial planetary cover. Three visually distinct rocky planets suspended across a wide deep navy space, all complete with margins: a dominant pale warm ochre Venus with opaque softly swirling cloud layers near center-right; a smaller recognizable blue-white Earth at left; a small rusty ochre Mars farther upper-left. Beautiful restrained amber and cool mint-blue interplay. No crescent/half/full Moon sequence, no orbit diagram or arrows, no gas giant rings, no Sun, no planetary labels. This is a conceptual grouping of planets, NOT a literal solar-system scale view. Keep each sphere separate and calm, no aligned eclipses or planets overlapping. Atmospheric highlights subtle and shadowed limbs soft, one coherent light direction.
```

### spaceflight

```text
Create a finished original editorial astronomy cover illustration for the Korean website ORBIT. Wide landscape 16:9, approximately 1536x864, edge-to-edge raster art with NO text, captions, lettering, logos, watermark, border, UI, or panels. This is a subject-specific standalone image asset. Match a sophisticated science magazine: deep midnight navy (#0B1423), softly shaded celestial forms, refined warm cream/amber and restrained mint/cyan accents, very subtle grain, sparse pinprick stars, believable material detail with the clarity and intentional composition of an illustration. Naturalistic illustrated rendering, neither cartoon clipart nor busy science-fiction concept art. Dark edge areas blend into the website; main subject cleanly framed with generous margins for crop safety. No UI mockup.
Subject: a plausible robotic interplanetary spacecraft gliding past a large Earthlike blue-green planet, an elegant depiction of exploration and gravity assist. Compact gold-foil bus, one restrained dish antenna and two neatly engineered dark-blue solar arrays, occupying about30percent of the frame in lower-left-middle, fully visible. Curved blue atmospheric limb of a complete medium planet at upper-right, soft stars behind. One very faint curved mint orbital arc suggests the flyby trajectory, only a conceptual path without arrows or labels. No engine fire, no weapons, no station, no logos, no imaginary branded mission. Naturalistic sophisticated editorial illustration, warm gold spacecraft against navy and cool blue planet, with uncluttered negative space.
```

