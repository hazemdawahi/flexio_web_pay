import { atom } from "jotai";

export const accessTokenAtom = atom<string | null>(null);
export const refreshTokenAtom = atom<string | null>(null);
export const checkoutIdAtom = atom<string | null>(null);
