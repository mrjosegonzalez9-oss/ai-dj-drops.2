
import type { Voice, EffectSettings } from './types';

export const AVAILABLE_VOICES: Voice[] = [
  { id: 'Kore', name: 'Voz Masculina Grave', promptPrefix: 'Con un claro acento de español mexicano, di con una voz masculina grave, con energía e impacto:' },
  { id: 'Puck', name: 'Voz Masculina Animador', promptPrefix: 'Con un claro acento de español mexicano, di como un animador de eventos, con un tono alegre y vibrante:' },
  { id: 'Charon', name: 'Voz Narrador', promptPrefix: 'Con un claro acento de español mexicano, di como un narrador de documentales, con una voz clara y profesional:' },
  { id: 'Fenrir', name: 'Voz Masculina Fuerte', promptPrefix: 'Con un claro acento de español mexicano, di con una voz masculina fuerte, potente y dominante:' },
  { id: 'Zephyr', name: 'Voz Femenina Suave', promptPrefix: 'Con un claro acento de español mexicano, di con una voz femenina suave, calmada y gentil:' },
  { id: 'Zephyr', name: 'Voz Femenina Sexy', promptPrefix: 'Con un claro acento de español mexicano, di con una voz femenina sexy, seductora y atractiva:' },
  { id: 'Zephyr', name: 'Voz Femenina Sensual', promptPrefix: 'Con un claro acento de español mexicano, di con una voz femenina sensual, susurrante y provocativa:' },
];

export const INITIAL_EFFECT_SETTINGS: EffectSettings = {
  eqLow: 0,
  eqMid: 0,
  eqHigh: 0,
  delayTime: 0,
  delayFeedback: 0,
  reverb: 0,
  playbackRate: 1.0,
};