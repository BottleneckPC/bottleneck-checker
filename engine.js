// Bottleneck engine - a faithful, dependency-free port of the model used on
// bottleneckpc.com. It reports an HONEST RANGE, never a fake single percentage,
// because the same CPU/GPU pairing swings from game to game.
//
// Scores are calibrated 0-100 gaming ratings (not raw benchmark numbers).

const RESOLUTION_WEIGHTS = {
  '1080p': { cpu: 0.6, gpu: 0.4 },
  '1440p': { cpu: 0.4, gpu: 0.6 },
  '4k': { cpu: 0.2, gpu: 0.8 },
};

// Genre shifts the CPU/GPU workload split. Esports/sim/MMO hammer the CPU
// (draw calls, tick rate, unit AI); AAA single-player leans on the GPU.
const GENRE_CPU_SHIFT = {
  mixed: 0,
  esports: 0.15,
  simulation: 0.2,
  mmo: 0.1,
  aaa: -0.1,
};

export const GENRE_LABELS = {
  mixed: 'a mix of games',
  esports: 'esports and competitive shooters',
  aaa: 'AAA single-player games',
  simulation: 'simulation and strategy games',
  mmo: 'MMOs',
};

const round2 = (n) => Math.round(n * 100) / 100;

function getEffectiveWeights(resolution, genre = 'mixed') {
  const base = RESOLUTION_WEIGHTS[resolution];
  const cpu = Math.min(0.9, Math.max(0.1, base.cpu + GENRE_CPU_SHIFT[genre]));
  return { cpu: round2(cpu), gpu: round2(1 - cpu) };
}

function scaledPercentage(absDiff, weight) {
  return Math.min(Math.round(absDiff * weight * 1.5), 50);
}

// DLSS/FSR renders internally at a lower resolution, shifting work to the CPU.
function upscaledInternalResolution(resolution) {
  return resolution === '4k' ? '1440p' : '1080p';
}

function getVerdictWeights(resolution, genre, upscaling) {
  if (!upscaling) return getEffectiveWeights(resolution, genre);
  const weights = getEffectiveWeights(upscaledInternalResolution(resolution), genre);
  if (resolution === '1080p') {
    const cpu = Math.min(0.9, weights.cpu + 0.1);
    return { cpu: round2(cpu), gpu: round2(1 - cpu) };
  }
  return weights;
}

const BALANCED_PCT = 10;

// Single source of truth for the verdict math.
export function scoreVerdict(cpuScore, gpuScore, resolution, genre = 'mixed', upscaling = false) {
  const weights = getVerdictWeights(resolution, genre, upscaling);
  const scoreDiff = cpuScore - gpuScore;
  const absDiff = Math.abs(scoreDiff);

  const cpuIsWeaker = scoreDiff < 0;
  const limitWeight = cpuIsWeaker ? weights.cpu : weights.gpu;
  const pct = scaledPercentage(absDiff, limitWeight);

  let type, range;
  if (pct <= BALANCED_PCT) {
    type = 'balanced';
    range = { low: 0, high: pct };
  } else if (cpuIsWeaker) {
    type = 'cpu';
    range = {
      low: scaledPercentage(absDiff, Math.max(0.1, weights.cpu - 0.1)),
      high: scaledPercentage(absDiff, Math.min(0.9, weights.cpu + 0.1)),
    };
  } else {
    type = 'gpu';
    range = {
      low: scaledPercentage(absDiff, Math.max(0.1, weights.gpu - 0.1)),
      high: scaledPercentage(absDiff, Math.min(0.9, weights.gpu + 0.1)),
    };
  }

  const boundaryDistance = Math.abs(pct - BALANCED_PCT);
  const confidence = boundaryDistance >= 8 ? 'high' : boundaryDistance >= 3 ? 'medium' : 'low';

  // Weighted utilisation split (how much of the "work" each part is doing here).
  const cpuWeighted = cpuScore * weights.cpu;
  const gpuWeighted = gpuScore * weights.gpu;
  const total = cpuWeighted + gpuWeighted || 1;
  const cpuPct = Math.round((cpuWeighted / total) * 100);
  const gpuPct = 100 - cpuPct;

  return { type, pct, range, confidence, weights, cpuPct, gpuPct };
}

export function formatRange(range) {
  if (range.high <= 0) return '0%';
  if (range.low >= range.high) return `~${range.high}%`;
  return `${range.low}-${range.high}%`;
}

/* Estimated FPS - a calibrated model, an honest range, not a benchmark table. */
const FPS_BASELINES = {
  '1080p': { performance: 210, balanced: 165, ultra: 125 },
  '1440p': { performance: 165, balanced: 120, ultra: 83 },
  '4k': { performance: 105, balanced: 72, ultra: 52 },
};
const CPU_CAP_BASELINES = { '1080p': 250, '1440p': 320, '4k': 450 };

export function estimateFPS(cpuScore, gpuScore, resolution, preset = 'balanced') {
  const gpuBaseFps = FPS_BASELINES[resolution][preset] * (gpuScore / 100);
  const cpuCapFps = CPU_CAP_BASELINES[resolution] * (cpuScore / 100);
  const fps = Math.round(Math.min(gpuBaseFps, cpuCapFps));
  return { fps, isCpuLimited: cpuCapFps < gpuBaseFps, low: Math.round(fps * 0.85), high: Math.round(fps * 1.15) };
}

export function explain(cpuName, gpuName, resolution, genre, upscaling, verdict) {
  const resLabel = resolution === '1080p' ? '1080p' : resolution === '1440p' ? '1440p' : '4K';
  const genreNote = genre === 'mixed' ? '' : ` Weighted for ${GENRE_LABELS[genre]}.`;
  const upNote = upscaling
    ? ' With DLSS/FSR on, the game renders internally lower, shifting more load to the CPU.'
    : '';
  const r = formatRange(verdict.range);

  if (verdict.type === 'balanced') {
    return `The ${cpuName} and ${gpuName} are well matched at ${resLabel}. Both parts stay busy with little wasted performance - a strong pairing for this resolution.${genreNote}${upNote}`;
  }
  if (verdict.type === 'cpu') {
    return `At ${resLabel}, the ${cpuName} holds the ${gpuName} back by roughly ${r}, depending on the game - CPU-heavy titles feel it most. A faster processor would unlock more of this GPU.${genreNote}${upNote}`;
  }
  return `At ${resLabel}, the ${gpuName} is the limiting part by roughly ${r}, depending on the game. At higher resolutions the GPU carries most of the load, so a stronger card is the biggest single upgrade here.${genreNote}${upNote}`;
}
