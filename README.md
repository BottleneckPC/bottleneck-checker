# Bottleneck Checker

A free, open-source **CPU and GPU bottleneck checker**. Pick a processor and a graphics card and it tells you whether they hold each other back - as an **honest range**, weighted by resolution and game type, instead of a fake single percentage.

**Live demo:** [bottleneckpc.github.io/bottleneck-checker](https://bottleneckpc.github.io/bottleneck-checker)

> Built and maintained by [BottleneckPC](https://bottleneckpc.com/bottleneck-checker). The full [bottleneck calculator](https://bottleneckpc.com/bottleneck-checker) on the site adds build recommendations, live prices, and per-game FPS.

## Why another bottleneck calculator?

Most of them spit out one confident-looking number ("your PC has a 17.3% bottleneck"), which no real benchmark could ever back up. Hardware doesn't behave that way: the same CPU + GPU pairing looks CPU-limited in a competitive shooter and GPU-limited in a ray-traced single-player game, and different again at 1080p versus 4K.

So this tool does three honest things instead:

- **Reports a range, not a fake decimal.** "GPU-limited by 15-22%, depending on the game."
- **Weights by resolution and genre.** Esports and simulation lean on the CPU; AAA leans on the GPU; higher resolutions shift load to the GPU.
- **Models DLSS/FSR.** Upscaling renders internally lower, shifting work back to the CPU.

## Features

- 300+ CPUs and 140+ GPUs, calibrated on a 0-100 gaming scale
- Resolution (1080p / 1440p / 4K), game-type, and upscaling controls
- A signature CPU-to-GPU **balance meter** with confidence and load-share readouts
- Rough FPS estimate at the chosen settings (an honest range, not a benchmark table)
- Shareable results via URL (`?cpu=...&gpu=...&res=1440p`)
- No build step, no framework, no tracking

## Use it

It's plain HTML/CSS/JS. Clone and open `index.html`, or serve the folder:

```bash
git clone https://github.com/bottleneckpc/bottleneck-checker.git
cd bottleneck-checker
python3 -m http.server 8080   # then open http://localhost:8080
```

Deploy anywhere static (GitHub Pages, Netlify, Cloudflare Pages) - it's a folder of files.

### Embed / reuse the engine

The scoring model lives in [`engine.js`](engine.js) as dependency-free ES modules:

```js
import { scoreVerdict, estimateFPS } from './engine.js';

const v = scoreVerdict(97 /* cpu score */, 82 /* gpu score */, '1440p', 'aaa');
// => { type: 'balanced', pct, range: { low, high }, confidence, cpuPct, gpuPct }
```

## About the data

The hardware list in [`data.js`](data.js) is a **static snapshot** taken from [bottleneckpc.com](https://bottleneckpc.com). The app makes **no network calls** - it can't be used to hammer anyone's server, and it works fully offline. Scores are calibrated gaming ratings, not raw synthetic benchmarks. The snapshot date is noted at the top of the file; open an issue or PR to refresh it.

## Contributing

PRs welcome - new or corrected hardware entries, engine tuning, accessibility, and translations especially. Keep it dependency-free and framework-free.

## License

[MIT](LICENSE) - do what you like, just keep the notice. Built by [BottleneckPC](https://bottleneckpc.com).
