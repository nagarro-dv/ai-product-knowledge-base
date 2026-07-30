import type { GenerateContentResponse } from '@google/genai';
import type { NormalizedEvent } from '../types.js';

export class GeminiStreamMapper {
  private sentRunning = false;

  map(chunk: GenerateContentResponse): NormalizedEvent[] {
    const events: NormalizedEvent[] = [];

    if (!this.sentRunning) {
      events.push({ kind: 'status', status: 'RUNNING', message: 'Gemini is responding…' });
      this.sentRunning = true;
    }

    const text = chunk.text;
    if (text) {
      events.push({ kind: 'text_delta', text });
    }

    return events;
  }
}
