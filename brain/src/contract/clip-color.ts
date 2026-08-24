/** Exact public clip colours and their measured Bitwig wire encodings. */
export interface ClipColorBytes {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export interface ExactClipColor {
  readonly name: string;
  readonly color: ClipColorBytes;
  readonly wireBytes: readonly [number, number, number];
}

export const EXACT_CLIP_COLORS: readonly ExactClipColor[] = [
  { name: 'Dark Gray', color: { red: 84, green: 84, blue: 84 }, wireBytes: [84, 84, 85] },
  { name: 'Gray', color: { red: 122, green: 122, blue: 122 }, wireBytes: [122, 122, 122] },
  { name: 'Gray half', color: { red: 128, green: 128, blue: 128 }, wireBytes: [128, 128, 129] },
  { name: 'Light Gray', color: { red: 201, green: 201, blue: 201 }, wireBytes: [201, 201, 201] },
  { name: 'Silver', color: { red: 134, green: 137, blue: 172 }, wireBytes: [134, 137, 173] },
  { name: 'Dark Brown', color: { red: 163, green: 121, blue: 67 }, wireBytes: [163, 121, 68] },
  { name: 'Brown', color: { red: 198, green: 159, blue: 112 }, wireBytes: [198, 159, 113] },
  { name: 'Dark Blue', color: { red: 87, green: 97, blue: 198 }, wireBytes: [87, 97, 198] },
  { name: 'Purplish Blue', color: { red: 132, green: 138, blue: 224 }, wireBytes: [132, 138, 224] },
  { name: 'Purple', color: { red: 149, green: 73, blue: 203 }, wireBytes: [149, 73, 203] },
  { name: 'Pink', color: { red: 217, green: 56, blue: 113 }, wireBytes: [217, 56, 114] },
  { name: 'Red', color: { red: 217, green: 46, blue: 36 }, wireBytes: [217, 46, 37] },
  { name: 'Orange', color: { red: 255, green: 87, blue: 6 }, wireBytes: [255, 87, 7] },
  { name: 'Light Orange', color: { red: 217, green: 157, blue: 16 }, wireBytes: [217, 157, 17] },
  { name: 'Moss Green', color: { red: 67, green: 210, blue: 185 }, wireBytes: [67, 210, 186] },
  { name: 'Green', color: { red: 115, green: 152, blue: 20 }, wireBytes: [115, 152, 21] },
  { name: 'Cold Green', color: { red: 0, green: 157, blue: 71 }, wireBytes: [0, 157, 72] },
  { name: 'Light Purple', color: { red: 188, green: 118, blue: 240 }, wireBytes: [188, 118, 240] },
  { name: 'Light Pink', color: { red: 225, green: 102, blue: 145 }, wireBytes: [225, 102, 146] },
  { name: 'Rose', color: { red: 236, green: 97, blue: 87 }, wireBytes: [236, 97, 88] },
  { name: 'Reddish Brown', color: { red: 255, green: 131, blue: 62 }, wireBytes: [255, 131, 63] },
  { name: 'Light Brown', color: { red: 228, green: 183, blue: 78 }, wireBytes: [228, 183, 79] },
  { name: 'Light Green', color: { red: 160, green: 192, blue: 76 }, wireBytes: [160, 192, 77] },
  { name: 'Bluish Green', color: { red: 0, green: 166, blue: 148 }, wireBytes: [0, 166, 149] },
  { name: 'Greenish Blue', color: { red: 62, green: 187, blue: 98 }, wireBytes: [62, 188, 99] },
  { name: 'Light Blue', color: { red: 0, green: 153, blue: 217 }, wireBytes: [0, 153, 218] },
  { name: 'Legacy Blue', color: { red: 31, green: 159, blue: 223 }, wireBytes: [31, 159, 223] },
] as const;

export function exactClipColor(
  color: ClipColorBytes,
): ExactClipColor | undefined {
  return EXACT_CLIP_COLORS.find((item) => item.color.red === color.red
    && item.color.green === color.green
    && item.color.blue === color.blue);
}

export const supportedClipColors = (): readonly Readonly<{
  name: string;
  red: number;
  green: number;
  blue: number;
}>[] => EXACT_CLIP_COLORS.map((item) => ({ name: item.name, ...item.color }));
