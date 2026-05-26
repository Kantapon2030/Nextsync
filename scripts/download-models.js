// scripts/download-models.js
const fs = require('fs');
const path = require('path');
const https = require('https');

const MODELS_DIR = path.join(__dirname, '..', 'public', 'models');

const files = [
  'ssd_mobilenetv1_model-weights_manifest.json',
  'ssd_mobilenetv1_model-shard1',
  'ssd_mobilenetv1_model-shard2',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1',
  'face_recognition_model-shard2'
];

const BASE_URL = 'https://raw.githubusercontent.com/justadudewhohacks/face-api.js/master/weights/';

// Create directories if they don't exist
if (!fs.existsSync(path.join(__dirname, '..', 'public'))) {
  fs.mkdirSync(path.join(__dirname, '..', 'public'));
  console.log('Created public/ directory');
}
if (!fs.existsSync(MODELS_DIR)) {
  fs.mkdirSync(MODELS_DIR, { recursive: true });
  console.log('Created public/models/ directory');
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        downloadFile(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Downloaded: ${path.basename(dest)}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {}); // Delete temp file
      reject(err);
    });
  });
}

async function run() {
  console.log('Starting face-api.js models download...');
  for (const filename of files) {
    const fileUrl = `${BASE_URL}${filename}`;
    const destPath = path.join(MODELS_DIR, filename);
    
    try {
      if (fs.existsSync(destPath) && fs.statSync(destPath).size > 1000) {
        console.log(`File already exists, skipping: ${filename}`);
        continue;
      }
      await downloadFile(fileUrl, destPath);
    } catch (err) {
      console.error(`Error downloading ${filename}:`, err.message);
      process.exit(1);
    }
  }
  console.log('All face-api.js models downloaded successfully!');
}

run();
