
export interface Voice {
  id: string;
  name: string;
  promptPrefix: string;
}

export interface EffectSettings {
  eqLow: number;
  eqMid: number;
  eqHigh: number;
  delayTime: number;
  delayFeedback: number;
  reverb: number;
  playbackRate: number;
}