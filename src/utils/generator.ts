import CryptoJS from 'crypto-js';

export const generateUUID = (): string => {
    const hex = CryptoJS.lib.WordArray.random(16).toString(
        CryptoJS.enc.Hex
    );

    const chars = hex.split('');

    chars[12] = '4';
    chars[16] = ['8', '9', 'a', 'b'][parseInt(chars[16], 16) % 4];

    return [
        chars.slice(0, 8).join(''),
        chars.slice(8, 12).join(''),
        chars.slice(12, 16).join(''),
        chars.slice(16, 20).join(''),
        chars.slice(20, 32).join(''),
    ].join('-');
};

export function getInitials(name: string): string {
    const words = name.trim().split(/\s+/).filter(Boolean);

    if (words.length === 0) return "";

    // Kalau cuma 1 kata, ambil 2 huruf pertama
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }

    // Kalau lebih dari 1 kata, ambil huruf pertama dari kata pertama dan kata terakhir
    const first = words[0][0];
    const last = words[words.length - 1][0];
    return (first + last).toUpperCase();
}