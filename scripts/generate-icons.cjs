const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const src = path.join(__dirname, '..', 'assets', 'apple-touch-icon.png');

const rootDir = path.join(__dirname, '..');
const androidIcons = [
  { size: 36, dir: 'android/app/src/main/res/mipmap-mdpi' },
  { size: 48, dir: 'android/app/src/main/res/mipmap-hdpi' },
  { size: 72, dir: 'android/app/src/main/res/mipmap-xhdpi' },
  { size: 96, dir: 'android/app/src/main/res/mipmap-xxhdpi' },
  { size: 144, dir: 'android/app/src/main/res/mipmap-xxxhdpi' },
  { size: 192, dir: 'android/app/src/main/res/mipmap-xxxhdpi' },
  { size: 512, dir: 'android/app/src/main/res/mipmap-xxxhdpi' },
];

const iosIcons = [
  { size: 20, name: 'AppIcon-20.png' },
  { size: 29, name: 'AppIcon-29.png' },
  { size: 40, name: 'AppIcon-40.png' },
  { size: 58, name: 'AppIcon-58.png' },
  { size: 60, name: 'AppIcon-60.png' },
  { size: 76, name: 'AppIcon-76.png' },
  { size: 80, name: 'AppIcon-80.png' },
  { size: 87, name: 'AppIcon-87.png' },
  { size: 120, name: 'AppIcon-120.png' },
  { size: 152, name: 'AppIcon-152.png' },
  { size: 167, name: 'AppIcon-167.png' },
  { size: 180, name: 'AppIcon-180.png' },
  { size: 1024, name: 'AppIcon-1024.png' },
];

async function generateIcons() {
  // Android icons
  for (const icon of androidIcons) {
    const dir = path.join(rootDir, icon.dir);
    fs.mkdirSync(dir, { recursive: true });
    await sharp(src)
      .resize(icon.size, icon.size)
      .png()
      .toFile(path.join(dir, 'ic_launcher.png'));
    await sharp(src)
      .resize(icon.size, icon.size)
      .png()
      .toFile(path.join(dir, 'ic_launcher_round.png'));
  }

  // iOS icons
  const iosDir = path.join(rootDir, 'ios', 'App', 'App', 'Assets.xcassets', 'AppIcon.appiconset');
  fs.mkdirSync(iosDir, { recursive: true });
  for (const icon of iosIcons) {
    await sharp(src)
      .resize(icon.size, icon.size)
      .png()
      .toFile(path.join(iosDir, icon.name));
  }

  // Generate Contents.json for iOS
  const contents = {
    images: iosIcons.map(icon => ({
      size: `${icon.size}x${icon.size}`,
      idiom: 'universal',
      filename: icon.name,
      scale: '1x'
    })).concat(iosIcons.map(icon => ({
      size: `${icon.size}x${icon.size}`,
      idiom: 'universal',
      filename: icon.name,
      scale: '2x'
    }))),
    info: { version: 1, author: 'Marvel Nexus' }
  };

  fs.writeFileSync(path.join(iosDir, 'Contents.json'), JSON.stringify(contents, null, 2));
  console.log(`Generated ${androidIcons.length * 2} Android icons + ${iosIcons.length} iOS icons`);
}

generateIcons().catch(console.error);
