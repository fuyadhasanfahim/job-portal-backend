import { hash, compare } from 'bcryptjs';

export function hashToken(token: string) {
    return hash(token, 12);
}

export function verifyTokenHash(token: string, tokenHash: string) {
    return compare(token, tokenHash);
}
