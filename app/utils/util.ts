// app/utils/util.ts
export const getCardImage = (brand: string) => {
    // Assuming you have card images stored in the public/images/cards directory
    const brandLower = brand.toLowerCase();
    return `/images/cards/${brandLower}.png`; // e.g., /images/cards/visa.png
  };
  