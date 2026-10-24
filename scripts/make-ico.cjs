const s = require('sharp');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sizes = [16, 24, 32, 48, 64, 128, 256];
const src = path.join(root, 'assets', 'apple-touch-icon.png');

Promise.all(sizes.map(z => s(src).resize(z, z).png().toBuffer()))
  .then(buffers => {
    const ico = Buffer.alloc(6 + 16 * buffers.length);
    ico.writeUInt16LE(0, 0);
    ico.writeUInt16LE(1, 2);
    ico.writeUInt16LE(buffers.length, 4);
    let offset = 6 + 16 * buffers.length;
    buffers.forEach((buf, i) => {
      const z = sizes[i];
      const off = 6 + i * 16;
      ico.writeUInt8(z === 256 ? 0 : z, off);
      ico.writeUInt8(z === 256 ? 0 : z, off + 1);
      ico.writeUInt8(0, off + 2);
      ico.writeUInt8(0, off + 3);
      ico.writeUInt16LE(1, off + 4);
      ico.writeUInt16LE(32, off + 6);
      ico.writeUInt32LE(buf.length, off + 8);
      ico.writeUInt32LE(offset, off + 12);
      offset += buf.length;
    });
    const out = Buffer.concat([ico, ...buffers]);
    fs.writeFileSync(path.join(root, 'assets', 'icon.ico'), out);
    console.log('icon.ico created:', out.length, 'bytes');
  })
  .catch(e => console.error(e));
