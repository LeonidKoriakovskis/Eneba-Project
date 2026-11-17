import { HealthCheckResponse } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const api = {
  async getHealth(): Promise<HealthCheckResponse> {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok && res.status !== 503) {
      throw new Error(`Health check HTTP error! status: ${res.status}`);
    }
    return res.json();
  }
};
