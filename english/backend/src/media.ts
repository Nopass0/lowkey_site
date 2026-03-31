import sharp from "sharp";

type OptimizeImageOptions = {
  width?: number;
  height?: number;
  fit?: "cover" | "contain" | "inside" | "outside" | "fill";
  quality?: number;
};

export async function optimizeImageUpload(
  source: ArrayBuffer | Uint8Array,
  options: OptimizeImageOptions = {},
) {
  const {
    width = 1024,
    height = 1024,
    fit = "inside",
    quality = 84,
  } = options;

  const buffer = source instanceof Uint8Array ? source : Buffer.from(source);
  const optimized = await sharp(buffer)
    .rotate()
    .resize({
      width,
      height,
      fit,
      withoutEnlargement: true,
    })
    .webp({ quality })
    .toBuffer();

  return {
    buffer: optimized,
    contentType: "image/webp",
    extension: "webp",
  };
}
