---
name: gemini-mcp
description: Generate and edit images, video, and music with Google Gemini models via MCP. Use when the user asks to generate, create, or edit images (Gemini / Nano Banana), produce a consistent set of images, compose/blend multiple images, generate a short video (text→video or image→video, via the omni model), or generate music/audio clips (via Lyria). Triggers on phrases like "generate an image of", "edit this image with Gemini", "create a set of consistent images", "make a video of", "generate a video", "generate music", "make a song/audio clip", "use Nano Banana to make", or any request to produce images, video, or music via the Gemini API. Requires the @chrischall/gemini-mcp package installed and the gemini server registered (see Setup below).
---

# gemini-mcp

MCP server for Google Gemini media generation — natural-language **image**, **video**, and **music** creation via the Gemini API (Nano Banana / Nano Banana Pro images, omni video, Lyria music).

- **npm:** [npmjs.com/package/@chrischall/gemini-mcp](https://www.npmjs.com/package/@chrischall/gemini-mcp)
- **Source:** [github.com/chrischall/gemini-mcp](https://github.com/chrischall/gemini-mcp)

## Setup

### Option A — npx (recommended)

Add to `.mcp.json` in your project or `~/.claude/mcp.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "npx",
      "args": ["-y", "@chrischall/gemini-mcp"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Option B — from source

```bash
git clone https://github.com/chrischall/gemini-mcp
cd gemini-mcp
npm install && npm run build
```

Then add to `.mcp.json`:

```json
{
  "mcpServers": {
    "gemini": {
      "command": "node",
      "args": ["/path/to/gemini-mcp/dist/index.js"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

Or use a `.env` file in the project directory with `GEMINI_API_KEY=<value>`.

### Getting your API key

1. Go to [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Create an API key (requires a Google account)
3. Copy the key and set it as `GEMINI_API_KEY`

Note: Image generation requires a billing-enabled Google Cloud project.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes | Your Google Gemini API key |
| `GEMINI_IMAGE_MODEL` | No | Override the default image model (default: `gemini-3.1-flash-image`) |
| `GEMINI_OUTPUT_DIR` | No | Default directory for saved images (default: current working directory) |
| `GEMINI_INPUT_DIR` | No | Directory to resolve bare input-image filenames against (e.g. point at Cowork's `uploads/` folder so `images: ["house.jpg"]` works) |

## Tools

### Models
| Tool | Description |
|------|-------------|
| `gemini_list_models` | List available Gemini image models and the current default |

**Which model to pick** (per-call `model`, or `GEMINI_IMAGE_MODEL`):

| Model | When to use | Reference-image caps (of 14 max) |
|-------|-------------|----------------------------------|
| `gemini-3.1-flash-image` (Nano Banana 2) | The versatile generalist workhorse for all tasks — balances speed with state-of-the-art 4K generation, world knowledge, and reliable text rendering; excels at multi-reference-image processing and consistency. Only model with video input + image_search grounding | 10 objects + 4 characters + 3 style refs |
| `gemini-3-pro-image` (Nano Banana Pro) | The premium choice for the most complex visual tasks — highest world knowledge, advanced localization, accurate brand consistency, precision creative control | 6 objects + 5 characters |
| `gemini-3.1-flash-lite-image` (Nano Banana 2 Lite) | The fastest/cheapest for simple tasks — 1K output only, no Google Search grounding | 14 objects (no character consistency) |

### Image Generation
| Tool | Description |
|------|-------------|
| `gemini_image_generate(prompt, count?, images_url?, images_file_uris?, images?, images_base64?, video_url?, video_path?, google_search?, seed?, filename?, model?, aspect_ratio?, image_size?, thinking_level?, output_dir?, inline?)` | Generate image(s) from a text prompt (optionally image-conditioned — see **Reference images** below — or video-conditioned via `video_url`/`video_path`) |
| `gemini_image_edit(prompt, images_url?, images_file_uris?, images?, images_base64?, google_search?, seed?, filename?, model?, aspect_ratio?, image_size?, thinking_level?, output_dir?, inline?)` | Edit or compose input image(s) with a text instruction. Requires ≥1 input from any of the four reference forms |
| `gemini_image_set(master_prompt, scenes? \| count?, reference_mode?, master_images_url?, master_images_file_uris?, master_images?, master_images_base64?, google_search?, seed?, basename?, model?, thinking_level?, ...)` | Master image (optionally seeded from a reference photo) plus N consistent images referencing it. `master_images_url` / `master_images_file_uris` are resolved **once** and passed to the master *and* every scene |

### Reference images — four ways in, one that costs context

These apply to **every** tool that takes a reference image: the four image tools, plus
`gemini_video_generate` (reference stills) and `gemini_music_generate`.

| Parameter | Where the bytes travel | Context cost |
|---|---|---|
| `images_url` (`master_images_url`) | the **server** downloads the https URL | none |
| `images_file_uris` (`master_images_file_uris`) | a `files/<id>` reference from `gemini_upload_file` | none |
| `images` | read off local disk (stdio builds only) | none |
| `images_base64` | **through the tool-call JSON** | **~14k tokens per JPEG** |

**Reach for `images_base64` last.** It costs ~14k tokens per modest photo, and a truncated file
read produces base64 that still *looks* valid — so the corruption surfaces as a bad generation,
not an error.

- `images_url` accepts public `https://` URLs only (private/loopback/link-local hosts refused,
  every redirect revalidated), must be `Content-Type: image/*`, capped at 15MB. Errors name the
  failing URL. Over 6MB is auto-uploaded to the Files API instead of inlined.
- `images_file_uris` accepts `files/<id>` or the full uri. Retained **~48h**; reusable across
  any number of calls until then.
- On stdio, an `images` path referenced **more than once in a session** is auto-uploaded to the
  Files API (keyed on path + mtime + size) so the bytes stop being re-sent.

### Files API
| Tool | Description |
|------|-------------|
| `gemini_upload_file(url? \| data_base64? \| path?, mime_type?, display_name?, confirm?)` | Upload once, get a reusable `files/<id>`. Exactly one source. `url` is fetched by the server (image/video/audio, ≤100MB); `path` is stdio-only and confirm-gated; `data_base64` is the last resort |
| `gemini_list_files(page_size?)` | List current uploads with MIME types and expiry |
| `gemini_delete_file(file_uri, confirm)` | Delete an upload before its ~48h expiry |

On the **hosted hosted deployment** there is also `POST /upload`, behind the same OAuth token as
`/mcp` — the zero-base64 path for an agent with a shell:

```bash
curl -X POST https://<hosted deployment>/upload \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  -H "Content-Type: image/jpeg" \
  --data-binary @photo.jpg
# → {"file_uri":"files/abc123", ...}   then: images_file_uris: ["files/abc123"]
```

### Multi-turn (Interactions API)
| Tool | Description |
|------|-------------|
| `gemini_interact(input, previous_interaction_id?, continue_last?, images_url?, images_file_uris?, images?, images_base64?, video_url?, video_path?, google_search?, search_types?, model?, aspect_ratio?, image_size?, thinking_level?, filename?, output_dir?, inline?)` | **Preferred tool for iterative refinement.** Generate/edit via Gemini's **Interactions API**. Returns an `interaction_id`; pass it back as `previous_interaction_id` (or set `continue_last: true` to reuse the session's most recent one) to **iteratively refine the same image** conversationally — do NOT start a new interaction or re-upload the image per tweak. Output is **JPEG**. |

### Video & Music (preview — funded account)
| Tool | Description |
|------|-------------|
| `gemini_video_generate(prompt, aspect_ratio?, task?, images_url?, images_file_uris?, images?, images_base64?, from_clipboard?, previous_interaction_id?, continue_last?, model?, filename?, output_dir?, timeout_ms?, idempotency_key?, async?)` | Generate a short video via the Gemini omni model: `text_to_video` (default), `image_to_video` / `reference_to_video` (supply reference image[s]), or `edit` (with `previous_interaction_id` / `continue_last`). `aspect_ratio` is `16:9` or `9:16`. Written to disk as **MP4**. Runs long — use `async: true` + `gemini_get_result`, or raise `timeout_ms`. |
| `gemini_music_generate(prompt, model?, audio_format?, images_url?, images_file_uris?, images?, images_base64?, from_clipboard?, previous_interaction_id?, continue_last?, filename?, output_dir?, inline?, timeout_ms?, idempotency_key?, async?)` | Generate music from a prompt (mood/genre/instruments/structure/lyrics) via a Lyria model: `lyria-3-clip-preview` (~30s, default) or `lyria-3-pro-preview` (longer, WAV-capable). `audio_format` `mp3` (default) or `wav` (**Pro-only**). Written to disk as MP3/WAV, or returned inline. |

### Async / idempotency (any generation tool)
| Tool | Description |
|------|-------------|
| `gemini_get_result(job_id)` | Fetch a generation started with `async: true`. Returns `running` while in flight, then the normal result on completion. Lets a long video/music/image generation outlive a host's `tools/call` timeout. All generation tools also accept `idempotency_key` — a repeat call with the same key returns the recorded result (`reused: true`) instead of billing again. |

## Workflows

**Generate a single image:**
```
gemini_image_generate(prompt: "a red maple leaf on white background, studio photo")
→ returns path to saved PNG
```

**Generate multiple variations:**
```
gemini_image_generate(prompt: "a cartoon fox", count: 4, output_dir: "/tmp/foxes")
→ returns paths to 4 PNG files
```

**Edit an existing image:**
```
gemini_image_edit(prompt: "make the background blue", images: ["/path/to/image.png"])
→ returns path to edited PNG
```

**Edit an image you only have a URL for (nothing downloads into the conversation):**
```
gemini_image_edit(prompt: "make the background blue", images_url: ["https://example.com/photo.jpg"])
→ the server fetches the URL itself; returns path to edited PNG
```

**Reuse one photo across many generations (hosted hosted deployment, agent with a shell):**
```
$ curl -X POST https://<hosted deployment>/upload -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: image/jpeg" --data-binary @photo.jpg
  → {"file_uri": "files/abc123"}

gemini_image_edit(prompt: "make it winter",  images_file_uris: ["files/abc123"])
gemini_image_edit(prompt: "make it sunrise", images_file_uris: ["files/abc123"])
→ two edits, one upload, zero image bytes in context. Valid ~48h.
```

**Generate a consistent set (master + scenes):**
```
gemini_image_set(
  master_prompt: "a cartoon fox named Rusty, orange fur, blue scarf",
  scenes: ["Rusty waving hello", "Rusty eating an apple", "Rusty sleeping"]
)
→ returns paths to master + 3 scene images, all consistent
```

**Generate variations of a concept:**
```
gemini_image_set(
  master_prompt: "minimalist logo for a coffee shop",
  count: 5
)
→ returns master + 5 variations
```

**Use a reference photo by value (when you have the bytes):**
```
gemini_image_edit(
  prompt: "place this house on a vintage travel-poster background",
  images_base64: ["data:image/jpeg;base64,/9j/4AAQ..."]   // or raw base64
)
→ returns path to the edited image
```
`images_base64` is for bytes you actually have — a file you `Read`/encode, a URL
you fetch, or a `data:` URI the user pastes as **text**.

**Iterate on ONE image conversationally (multi-turn):**
```
r1 = gemini_interact(input: "a cozy reading nook, watercolor")
   → { images: [...], interaction_id: "v1_abc…" }
r2 = gemini_interact(input: "add a sleeping cat on the chair",
                     previous_interaction_id: r1.interaction_id)
   → refined image that preserves r1; returns a NEW interaction_id
r3 = gemini_interact(input: "warmer lighting", continue_last: true)
   → same chain, without threading the id (uses the session's most recent interaction)
```
Prefer this over re-running `gemini_image_edit` when you're making a *series* of incremental edits — the model keeps the prior result in context. Every result echoes `interaction_id` (and `previous_interaction_id` when chaining) plus a `hint` with the exact follow-up call.

**Generate a video (preview — runs long, use async):**
```
job = gemini_video_generate(prompt: "a paper boat sailing down a rain gutter, cinematic",
                            aspect_ratio: "16:9", async: true)
   → { job_id, status: "running" }   (returns immediately — no host timeout)
gemini_get_result(job_id: job.job_id)
   → "running" until done, then the MP4 path on disk
# Animate a still instead: gemini_video_generate(prompt: "…", task: "image_to_video", images: ["/path/still.png"])
```

**Generate music (preview):**
```
gemini_music_generate(prompt: "warm lo-fi hip hop, mellow Rhodes, vinyl crackle, 70bpm")
   → ~30s MP3 on disk (lyria-3-clip-preview)
# Longer / WAV: gemini_music_generate(prompt: "…", model: "lyria-3-pro-preview", audio_format: "wav")
```
**⚠️ Chat-pasted/attached images can't be fed to these tools directly.** A pasted
image reaches the assistant as a *vision* block — the assistant can SEE it but
never receives the original bytes, and the host doesn't write it to disk. So
neither `images` (no file exists) nor `images_base64` (the bytes can't be
reconstructed from a downscaled vision rendering) is obtainable from a paste.
To use a real reference photo, the **user** must make the bytes available: save
the file and give its **path** (→ `images`), drop it into the project dir, paste
it as a **`data:` URI in text**, or host it at a **URL** (fetch → base64 →
`images_base64`). This is a host/Cowork limitation, not an MCP one.

Two built-in ways to get past the unreachable-paste problem without any manual
extraction:
- **`from_clipboard: true`** (macOS) — the tool reads the image off the system
  clipboard itself (osascript), downscales it, and uses it. The user just needs
  to **copy** the image (⌘C — distinct from pasting it inline into chat, which
  doesn't keep it on the clipboard). Works on every image tool:
  `gemini_image_edit(prompt: "…", from_clipboard: true)`.
- **`GEMINI_INPUT_DIR`** — point it at a folder (e.g. Cowork's `uploads/`); then a
  **bare filename** resolves against it: `gemini_image_edit(prompt: "…", images: ["house.jpg"])`.

## Prompting playbook

Condensed from Google's official Nano Banana prompting guide. Core rule:
**describe the scene, don't list keywords** — narrative sentences beat tag soups.

**Best practices:**
- **Be hyper-specific.** "Ornate elven plate armor, etched with silver leaf patterns" beats "fantasy armor".
- **Give context & intent.** "Create a logo for a high-end minimalist skincare brand" beats "create a logo".
- **Iterate conversationally** (`gemini_interact`): "warmer lighting", "same, but more serious expression".
- **Step-by-step for complex scenes.** "First, a misty forest background. Then a stone altar in the foreground. Finally a glowing sword on the altar."
- **Semantic negatives.** Describe what you want positively — "an empty, deserted street" — instead of "no cars".
- **Camera language controls composition.** Wide-angle / macro / low-angle perspective / 85mm portrait lens / three-point softbox lighting.

**Generation templates (abbreviated):**
- *Photorealistic:* `photorealistic [shot type] of [subject] in [setting], [lighting], shot from [angle] with [lens]`
- *Sticker/illustration:* `[style] sticker of [subject] doing [activity], bold outlines, cel-shading, [palette], white background`
- *Text in image:* `create a [type] for [brand] with the text "[exact text]" in a [font style]` — Gemini renders text well; Pro is best for professional assets. Tip: generate the wording first, then ask for the image containing it.
- *Product shot:* `high-resolution studio-lit photo of [product] on [surface], [lighting setup], [angle], sharp focus on [detail]`
- *Minimalist/negative space:* `single [subject] in [frame position], vast empty [color] background` — for text-overlay backgrounds.
- *Comic/storyboard:* `make a 3 panel comic in [style]; put the character in [scene]` (Pro or 3.1 Flash).

**Editing templates (abbreviated):**
- *Add/remove:* `using the provided image of [subject], [add/remove] [element]; match the original style/lighting/perspective`
- *Inpaint (semantic mask):* `change only the [element] to [new element]; keep everything else exactly the same`
- *Style transfer:* `transform the photo of [subject] into the style of [artist/style]; preserve composition`
- *Compose:* `take the [element from image 1] and place it with [element from image 2]; adjust lighting/shadows to match`
- *Detail preservation:* describe the critical element (face, logo) in detail and say it must "remain completely unchanged"
- *Sketch → finished:* `turn this rough sketch of [subject] into a [style] photo; keep [features], add [details]`
- *Character 360°:* iterate angles via `gemini_interact` ("in profile looking right"), feeding prior outputs back for consistency

## Notes

- **Input images** accept either file **paths** (`images` / `master_images`) or **base64/data-URI values** (`images_base64` / `master_images_base64`).
- **`seed`** makes a result reproducible; it's echoed in the result metadata (a random one is chosen + echoed when omitted). `count>1` uses `seed, seed+1, …` so the images differ. Determinism isn't fully guaranteed by the model.
- **`filename`/`basename`** set the output name (extension stripped); names never overwrite (a `-2`, `-3` suffix is added). The result echoes the absolute path(s), `model`, `seed`, and aspect/size.
- **No edit-strength control.** Gemini exposes no denoise/strength knob, and Nano Banana over-preserves the input — big structural edits ("move/remove/shrink", add a mat border) are often ignored. Workarounds: reroll with a different `seed`, raise `thinking_level` to `high`, use forceful wording, do layout changes (padding/borders) externally, or use `gemini_interact` multi-turn.
- **`thinking_level`** (`minimal`/`high`, Gemini 3 models) controls reasoning depth — `high` can improve complex compositions/edits at higher latency/cost.
- **Model text.** When the model returns a caption/explanation (mostly Gemini 3 **Pro**), it's surfaced as `text` in the result metadata.
- **`google_search: true`** grounds the image in live Google Search (current events, weather, real data — great for infographics). The result metadata includes `grounding` with the `queries` run and the `sources` (`{uri, title}`) used. (`gemini_interact` surfaces `grounding.queries` — the Interactions API returns no clean source list.)
- **`search_types`** (`gemini_interact` only): `["web_search", "image_search"]` picks the grounding search types (setting it implies `google_search`). **`image_search`** (gemini-3.1-flash-image only) pulls web images via Google Image Search as *visual* references — useful for real-world subjects (a specific butterfly species, a landmark, a product). ⚠️ Two catches: Google ToS require **displaying the returned `grounding.search_suggestions` HTML chips** to the user, and image_search won't depict real people from web images.
- **`video_url`** (a public YouTube URL, on `gemini_image_generate` / `gemini_interact`) generates an image from a video reference — **requires a Flash model** (e.g. `model: "gemini-3.1-flash-image"`). For a **local video file**, use **`video_path`** instead: the file is uploaded to the Gemini Files API (streamed from disk, 2 GB max), waited to `ACTIVE`, and referenced by its `files/…` uri. The result metadata echoes `video_file` (`{uri, name, expires}`, ~48h retention) — reuse that uri as `video_url` in later calls to skip re-uploading.
- **`gemini_interact`** is the multi-turn path: it returns an `interaction_id`; thread it back via `previous_interaction_id` for conversational refinement. Output is **JPEG only**. (The Interactions API is GA as of 2026-07; it uses a different request shape than the `generate`/`edit`/`set` tools.)
- `output_dir` per-call overrides `$GEMINI_OUTPUT_DIR` overrides cwd. `inline: true` returns bytes (with a metadata text block) instead of writing.
- `count` and `scenes` are mutually exclusive in `gemini_image_set`; `reference_mode: "chain"` references the previous image instead of the master.
- Aspect ratios: `1:1`, `16:9`, `9:16`, `4:3`, `3:4`, `2:3`, `3:2`, … · Image sizes: `512` (0.5K, Flash only), `1K`, `2K`, `4K`. `4K` is the max native output — true 18×24 in @ 300 DPI (5400×7200) needs an external upscale step.
- All generated images carry a **SynthID** watermark (Google).
- The model can mis-render text/Roman numerals (e.g. years) — verify any text in the output; it's a model limitation, not a tool setting.
- **Best-performance languages:** EN, plus ar, de, es-MX, fr, hi, id, it, ja, ko, pt-BR, ru, ua, vi, zh-CN — prefer prompting in one of these.
- Asking the *model* for "N images" in one prompt is unreliable (documented limitation) — use the `count` parameter instead; it makes N independent calls with distinct seeds.
- Server logs to stderr only — stdout is reserved for JSON-RPC.
