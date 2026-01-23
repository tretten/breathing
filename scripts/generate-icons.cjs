#!/usr/bin/env node
/**
 * Simple icon generator for PWA
 * Run: node scripts/generate-icons.js
 *
 * This creates minimal PNG icons for the PWA manifest.
 * For production, replace with proper branded icons.
 */

const fs = require('fs');
const path = require('path');

// Simple PNG encoder for solid color icons
function createPNG(size, bgColor, circleColor) {
  // PNG signature
  const signature = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

  // IHDR chunk
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0); // length
  ihdr.write('IHDR', 4);
  ihdr.writeUInt32BE(size, 8); // width
  ihdr.writeUInt32BE(size, 12); // height
  ihdr.writeUInt8(8, 16); // bit depth
  ihdr.writeUInt8(2, 17); // color type (RGB)
  ihdr.writeUInt8(0, 18); // compression
  ihdr.writeUInt8(0, 19); // filter
  ihdr.writeUInt8(0, 20); // interlace

  // Calculate CRC for IHDR
  const ihdrCrc = crc32(ihdr.slice(4, 21));
  ihdr.writeUInt32BE(ihdrCrc, 21);

  // Create image data (simple gradient circle)
  const rawData = [];
  const center = size / 2;
  const radius = size * 0.35;

  for (let y = 0; y < size; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < size; x++) {
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < radius) {
        // Circle color (blue)
        rawData.push(circleColor[0], circleColor[1], circleColor[2]);
      } else {
        // Background color
        rawData.push(bgColor[0], bgColor[1], bgColor[2]);
      }
    }
  }

  // Compress with zlib
  const zlib = require('zlib');
  const compressed = zlib.deflateSync(Buffer.from(rawData), { level: 9 });

  // IDAT chunk
  const idat = Buffer.alloc(compressed.length + 12);
  idat.writeUInt32BE(compressed.length, 0);
  idat.write('IDAT', 4);
  compressed.copy(idat, 8);
  const idatCrc = crc32(Buffer.concat([Buffer.from('IDAT'), compressed]));
  idat.writeUInt32BE(idatCrc, compressed.length + 8);

  // IEND chunk
  const iend = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);

  return Buffer.concat([signature, ihdr, idat, iend]);
}

// CRC32 calculation
function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = [];

  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }

  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Generate icons
const publicDir = path.join(__dirname, '..', 'public');

const bgColor = [26, 26, 26]; // #1a1a1a
const circleColor = [74, 158, 255]; // #4a9eff

// Generate 192x192 icon
const icon192 = createPNG(192, bgColor, circleColor);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
console.log('Created icon-192.png');

// Generate 512x512 icon
const icon512 = createPNG(512, bgColor, circleColor);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
console.log('Created icon-512.png');

console.log('Icons generated successfully!');
