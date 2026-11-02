# Gradient Background Generator (Gradient Lab)

A high-performance, in-browser animated gradient background generator powered by **WebGL 2** shaders. Features 20+ live shader modes, 90+ curated presets, interactive on-canvas drag handles, precision color pipelines, and watermark-free exports in up to 8K PNG stills and 4K MP4/WebM video loops.

---

## 🚀 Quick Start

### Option 1: 1-Click Launch (Windows)
Double-click **`start.bat`**. This starts the local server and opens the application directly in your default browser.

### Option 2: Command Line (Node.js / npm / Bun)
```bash
# Using Node.js directly
node server.js

# Or using npm
npm start

# Or using Bun
bun start
```

Once running, navigate to **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## ✨ Features

- **20+ Animated WebGL 2 Shader Modes**:
  - **Modern Looks**: Draw mode, Light Beam, Edge Glow, Curtains, Flow Mesh, Eclipse, Burst, Spectral Arc, Contour, Bokeh Night, Mercury (Liquid Metal).
  - **Classic Looks**: Soft, Mesh, Bands, Glass, Concentric, Halftone, Smoke, Northern Lights (Aurora), Plasma, God Rays, Caustics, Marble, Waves, Voronoi, and more.
- **90+ Curated Presets**: Color-tuned palettes and animation presets ready to use or tweak (*Ember Beam*, *Cobalt Shaft*, *Amber Hour*, *Midnight Silk*, *Night Rise*, *Peony Curtains*, *Glacier Arcs*, etc.).
- **Interactive On-Canvas Drag Handles**: Directly manipulate band width, glow radius, rotation angles, and focus points directly on the live canvas.
- **Color Pipeline**:
  - Color models: **OKLab**, **OKLCH**, Linear light, and sRGB.
  - Multi-stop gradient palettes with custom bias, gamma, and sharpness controls.
- **Post-Processing & FX**:
  - Film grain & simplex noise (with chromatic and tonal adjustments).
  - ACES Tone Mapping & exposure adjustment.
  - Smooth vignette controls.
  - Retro ordered-dither art modes (Bayer 2x2, 4x4, 8x8 matrices).
- **High-Resolution Exports**:
  - **Still Images**: Export PNG or JPG images at 4K, 5K, 6K, 8K, custom pixel dimensions, or mobile device ratios.
  - **Video Loops**: Export seamless animated loops as H.264 MP4 or WebM video with embedded duration headers.
- **Controls & Performance**:
  - Play / Pause animation toggle.
  - Real-time FPS counter.
  - Fullscreen display mode.

---

## 📁 Project Structure

```
.
├── index.html                 # Clean, standalone application HTML
├── server.js                  # Zero-dependency local web server
├── start.bat                  # 1-click Windows launcher
├── package.json               # npm / bun project metadata
├── satoshi.css                # Typography stylesheet (Satoshi font)
├── 0hb3ae-78g0aw.css          # Core application styling
├── turbopack-05gaw1s7-.50z.js # Normalized Turbopack module runtime
├── 0bj70hloq.3_0.js           # WebGL shader engine & GLSL definitions
├── 0h5pkqh980u1z.js           # Presets, video muxer & UI modal logic
├── 08aw1k4i07fih.js           # React client runtime & navigation
├── 040bn2m930--8.js           # UI & React components
├── 0~morbt9ml1pj.js           # Canvas & interaction modules
├── 0d3tkj33oycf2.js           # Layout & control panels
├── 0qe6ouy17v.zt.js           # Auxiliary utilities & shader helpers
├── 0k9~-3~05jzlb.js           # Palette & gradient computation helpers
├── 0cje14_narrpx.js           # Client router helpers
├── 14225nknc2opm.js           # Client hydration entry
├── 142cbafb4ijr1.js           # Core runtime bundle
├── 03~yq9q893hmn.js           # Browser polyfills
└── README.md                  # Project documentation
```

---

## ⚙️ Technical Details

This project is built as a client-side WebGL application:
- **Zero External Dependencies Required**: The included `server.js` uses standard Node.js built-ins (`http`, `fs`, `path`, `child_process`). No `npm install` needed to run.
- **Local Asset Resolution**: All JavaScript chunks and stylesheets are resolved directly from the local directory.
- **Runtime Normalization**: Turbopack chunk promise lookups have been normalized to resolve by clean chunk basenames, ensuring reliable module registration and hydration across any port or host.
