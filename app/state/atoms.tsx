// src/state/atoms.ts

import { atom } from 'jotai';

// Atom to store the platform parameter
export const platformAtom = atom<string | null>(null);
