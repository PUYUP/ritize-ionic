// src/lib/upload-client.ts
// Jalan di browser. Aman diimport dari komponen Svelte manapun.

import type {
    SignedUrlRequest,
    SignedUrlResponse,
    FileMetadata,
    UploadProgress
} from '../types/upload';

interface UploadOptions {
    onProgress?: (progress: UploadProgress) => void;
    signal?: AbortSignal; // opsional, untuk membatalkan upload di tengah jalan
}

/**
 * Alur lengkap upload file ke GCS tanpa membebani server:
 * 1. Minta signed URL ke server SvelteKit (server yang generate, bukan yang nerima file)
 * 2. PUT file langsung ke GCS pakai signed URL tsb (lewat XMLHttpRequest, supaya
 *    ada event progress — fetch() belum mendukung upload progress secara native)
 * 3. Setelah GCS konfirmasi sukses, minta server ambilkan metadata file
 */
export async function uploadFileToGCS(
    file: File,
    options: UploadOptions = {},
    entityMetadata?: Record<string, any>,
): Promise<FileMetadata> {
    const { onProgress, signal } = options;

    // 1. Minta signed URL
    const signedUrlPayload: SignedUrlRequest = {
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
        entityMetadata: entityMetadata,
    };

    const signedUrlRes = await fetch('https://auth.atlanize.com/api/gcs/signed-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signedUrlPayload)
    });

    if (!signedUrlRes.ok) {
        const body = await signedUrlRes.json().catch(() => ({}));
        throw new Error(body.message ?? 'Gagal mendapatkan signed URL');
    }

    const { signedUrl, objectPath }: SignedUrlResponse = await signedUrlRes.json();

    // 2. Upload langsung ke GCS, dengan progress
    await putFileWithProgress(signedUrl, file, onProgress, signal);

    // 3. Ambil metadata (size, contentType, dll) dari server
    const metadataRes = await fetch('https://auth.atlanize.com/api/gcs/metadata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ objectPath })
    });

    if (!metadataRes.ok) {
        const body = await metadataRes.json().catch(() => ({}));
        throw new Error(body.message ?? 'Gagal mengambil metadata file');
    }

    return metadataRes.json();
}

/**
 * PUT file ke signed URL pakai XMLHttpRequest.
 * fetch() belum punya cara standar untuk memantau progress UPLOAD (bukan download),
 * jadi untuk kasus ini XHR masih pilihan paling reliable & didukung semua browser.
 */
function putFileWithProgress(
    signedUrl: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
    signal?: AbortSignal
): Promise<void> {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();

        xhr.open('PUT', signedUrl, true);
        // Header ini WAJIB sama persis dengan contentType yang dipakai
        // saat generate signed URL di server, kalau tidak GCS balas 403.
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

        xhr.upload.onprogress = (event) => {
            if (!event.lengthComputable) return;
            const percentage = Math.round((event.loaded / event.total) * 100);
            onProgress?.({ loaded: event.loaded, total: event.total, percentage });
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                onProgress?.({ loaded: file.size, total: file.size, percentage: 100 });
                resolve();
            } else {
                reject(new Error(`Upload gagal, status ${xhr.status}: ${xhr.statusText}`));
            }
        };

        xhr.onerror = () => reject(new Error('Terjadi error jaringan saat upload ke GCS'));
        xhr.onabort = () => reject(new Error('Upload dibatalkan'));

        if (signal) {
            if (signal.aborted) {
                xhr.abort();
                return;
            }
            signal.addEventListener('abort', () => xhr.abort());
        }

        xhr.send(file);
    });
}

export function getFileTypePure(mimeType: string) {
    if (!mimeType) return 'unknown';

    const [mainType, subType] = mimeType.split('/');

    // Return kategori utama jika berupa gambar/audio/video
    if (['image', 'audio', 'video'].includes(mainType)) {
        return mainType;
    }

    // Bersihkan karakter tambahan seperti '; charset=utf-8' jika ada
    return subType ? subType.split(';')[0] : 'unknown';
}