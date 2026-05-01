/**
 * Generates assets/icon.png — 20×20 Heineken corporate green (#205527)
 * Pure Node.js, zero external dependencies.
 */
"use strict";
const zlib = require("zlib");
const fs   = require("fs");
const path = require("path");

// CRC32 table lookup
function makeCrcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
}
const CRC_TABLE = makeCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len  = Buffer.alloc(4);  len.writeUInt32BE(data.length);
  const tb   = Buffer.from(type, "ascii");
  const cBuf = Buffer.concat([tb, data]);
  const crc  = Buffer.alloc(4);  crc.writeUInt32BE(crc32(cBuf));
  return Buffer.concat([len, tb, data, crc]);
}

function buildPng(width, height, r, g, b) {
  // Build raw scanlines: each row = filter_byte(0) + W*RGB
  const rows = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0; // None filter
    for (let x = 0; x < width; x++) {
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const raw        = Buffer.concat(rows);
  const compressed = zlib.deflateSync(raw, { level: 9 });

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width,  0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8]  = 8; // bit depth
  ihdr[9]  = 2; // color type: truecolor RGB
  ihdr[10] = 0; // compression: deflate
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace: none

  const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    PNG_SIG,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", compressed),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

// Heineken corporate green: #205527 → rgb(32, 85, 39)
const png = buildPng(20, 20, 32, 85, 39);

const outDir  = path.join(__dirname, "assets");
const outFile = path.join(outDir, "icon.png");
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, png);
console.log(`✓ Created ${outFile} (${png.length} bytes, 20×20 Heineken green)`);
