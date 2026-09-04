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