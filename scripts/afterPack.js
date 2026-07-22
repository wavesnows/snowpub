const fs = require('fs');
const path = require('path');

// Fix node-pty spawn-helper permissions after pack (electron-builder strips execute bit)
module.exports = async ({ appOutDir, packager }) => {
  const platform = packager.platform.name;
  if (platform !== 'mac') return;

  const spawnHelper = path.join(
    appOutDir,
    'snowpub.app/Contents/Resources/app.asar.unpacked/node_modules/node-pty/prebuilds',
    process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64',
    'spawn-helper'
  );

  if (fs.existsSync(spawnHelper)) {
    fs.chmodSync(spawnHelper, 0o755);
    console.log('Fixed spawn-helper permissions:', spawnHelper);
  }
};
