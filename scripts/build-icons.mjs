import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const masterSvg = path.join(root, "public/brand/icon-master.svg");
const outDir = path.join(root, "public/brand");

const targets = [
  { file: "icon-1024.png", size: 1024 },
  { file: "icon-256.png", size: 256 },
];

async function main() {
  await mkdir(outDir, { recursive: true });
  for (const { file, size } of targets) {
    const outPath = path.join(outDir, file);
    await sharp(masterSvg, { density: 384 })
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`wrote ${path.relative(root, outPath)} (${size}x${size})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
