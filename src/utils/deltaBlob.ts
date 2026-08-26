// src/lib/deltaBlob.ts
import { Delta } from 'quill';

export function deltaToBlob(delta: Delta): Blob {
    return new Blob([JSON.stringify(delta)], { type: 'application/json' });
}

export async function blobToDelta(blob: Blob): Promise<Delta> {
    const json = await blob.text();
    const parsed = JSON.parse(json); // bentuknya: { ops: Op[] }
    return new Delta(parsed); // constructor Delta menerima Op[] ATAU { ops: Op[] } — jadi ini valid
}