import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";

interface ProcessSample {
  at: number;
  ticks: number;
}

export interface ProcessLoad {
  cpu: number;
  memory: number;
}

export interface GpuLoad {
  at: number;
  available: boolean;
  decoder: number;
  encoder: number;
  gpu: number;
  memory: number;
  memoryTotal: number;
  provider: string;
}

const processSamples = new Map<number, ProcessSample>();
let systemSample: { idle: number; total: number } | undefined;
let gpuSample: GpuLoad | undefined;
let displaySample: { at: number; outputs: Array<{ fps: number; primary: boolean; x: number; y: number }> } | undefined;

export const readLinuxDisplayFps = (displayIndex: number, primary: boolean) => {
  if (process.platform !== 'linux') return 0;
  const now = Date.now();
  if (!displaySample || now - displaySample.at > 5000) {
    const outputs: Array<{ fps: number; primary: boolean; x: number; y: number }> = [];
    try {
      const result = execFileSync('xrandr', ['--current'], {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 1000,
      });
      let output: { fps: number; primary: boolean; x: number; y: number } | undefined;
      for (const line of result.split('\n')) {
        const connected = line.match(/^\S+ connected( primary)?(?: \d+x\d+\+(-?\d+)\+(-?\d+))?/);
        if (connected) {
          output = {
            fps: 0,
            primary: Boolean(connected[1]),
            x: Number(connected[2]) || 0,
            y: Number(connected[3]) || 0,
          };
          outputs.push(output);
          continue;
        }
        const activeRate = output ? line.match(/\s(\d+(?:\.\d+)?)\*\+?/) : undefined;
        if (activeRate && output) output.fps = Number(activeRate[1]) || 0;
      }
    } catch (_error) { /* XWayland may be unavailable on a pure Wayland session */ }
    displaySample = {
      at: now,
      outputs: outputs.filter(output => output.fps > 0).sort((left, right) => left.x - right.x || left.y - right.y),
    };
  }
  const outputs = displaySample.outputs;
  return (primary ? outputs.find(output => output.primary) : outputs[displayIndex])?.fps
    || outputs[displayIndex]?.fps
    || 0;
};

export const readProcessLoad = (pid?: number): ProcessLoad => {
  if (!pid || process.platform !== 'linux') return { cpu: 0, memory: 0 };
  try {
    const stat = fs.readFileSync(`/proc/${pid}/stat`, 'utf8');
    const fields = stat.slice(stat.lastIndexOf(')') + 2).split(' ');
    const ticks = Number(fields[11]) + Number(fields[12]);
    const memory = Number(fields[21]) * 4096 / 1048576;
    const at = Date.now();
    const previous = processSamples.get(pid);
    processSamples.set(pid, { at, ticks });
    const cpu = previous && at > previous.at
      ? Math.max(0, (ticks - previous.ticks) * 1000 / (at - previous.at))
      : 0;
    return { cpu, memory };
  } catch (_error) {
    processSamples.delete(pid);
    return { cpu: 0, memory: 0 };
  }
};

export const readSystemCpu = () => {
  const cpus = os.cpus();
  const idle = cpus.reduce((sum, cpu) => sum + cpu.times.idle, 0);
  const total = cpus.reduce((sum, cpu) => sum + Object.values(cpu.times).reduce((part, value) => part + value, 0), 0);
  const previous = systemSample;
  systemSample = { idle, total };
  if (!previous || total <= previous.total) return 0;
  return Math.max(0, Math.min(100, 100 * (1 - (idle - previous.idle) / (total - previous.total))));
};

export const readGpuLoad = (): GpuLoad => {
  const now = Date.now();
  if (gpuSample && now - gpuSample.at < 1500) return gpuSample;
  try {
    const output = execFileSync('nvidia-smi', [
      '--query-gpu=utilization.gpu,utilization.encoder,utilization.decoder,memory.used,memory.total',
      '--format=csv,noheader,nounits',
    ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 1000 });
    const [gpu, encoder, decoder, memory, memoryTotal] = output.trim().split('\n')[0].split(',').map(value => Number(value.trim()) || 0);
    gpuSample = { at: now, available: true, decoder, encoder, gpu, memory, memoryTotal, provider: 'NVIDIA' };
  } catch (_error) {
    gpuSample = { at: now, available: false, decoder: 0, encoder: 0, gpu: 0, memory: 0, memoryTotal: 0, provider: '' };
  }
  return gpuSample;
};
