import type { Material } from './api';

export interface TrainerOption {
  id: string;
  text: string;
  nextStepId: string | null;
  score: number;
}

export interface TrainerStep {
  id: string;
  title: string;
  text: string;
  options: TrainerOption[];
}

export interface TrainerData {
  startStepId: string | null;
  steps: TrainerStep[];
}

export interface MaterialWithTrainer extends Material {
  trainer?: TrainerData;
}

export function createEmptyTrainer(): TrainerData {
  return { startStepId: null, steps: [] };
}

export function newStep(): TrainerStep {
  return {
    id: 'st_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: '',
    text: '',
    options: [],
  };
}

export function newOption(): TrainerOption {
  return {
    id: 'op_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    text: '',
    nextStepId: null,
    score: 0,
  };
}