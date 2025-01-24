// src/state/atoms.ts
import { atom } from 'jotai';

// Atom to store the access token
export const accessTokenAtom = atom<string | null>(null);
