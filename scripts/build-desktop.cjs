const { build } = require('electron-builder');

build({
  config: {
    files: [
      'dist/**/*',
      'electron-main.cjs',
      'preload.cjs'
    ],
    extraMetadata: {
      main: 'electron-main.cjs'
    },
    appId: 'com.marvelnexus.app',
    productName: 'Marvel Nexus',
    copyright: 'Marvel Nexus Fan Project',
    win: {
      target: ['portable'],
      signAndEditExecutable: false,
      icon: 'assets/icon.ico'
    },
    portable: {
      artifactName: 'MarvelNexus.exe'
    }
  }
}).then(() => {
  console.log('Desktop build complete!');
}).catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
