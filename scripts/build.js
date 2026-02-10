#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const SRC_DIR = path.join(__dirname, '../src');
const BUILD_DIR = path.join(__dirname, '../build');
const OUTPUT_FILE = path.join(BUILD_DIR, 'extension.js');

// Create build directory if it doesn't exist
if (!fs.existsSync(BUILD_DIR)) {
  fs.mkdirSync(BUILD_DIR, { recursive: true });
}

/**
 * Read manifest file if it exists
 */
function getManifest() {
  const manifestPath = path.join(SRC_DIR, 'manifest.json');
  if (fs.existsSync(manifestPath)) {
    try {
      return JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    } catch (err) {
      console.warn('Warning: Could not parse manifest.json');
      return {};
    }
  }
  return {};
}

/**
 * Generate Scratch extension header
 */
function generateHeader(manifest) {
  const metadata = {
    name: manifest.name || 'My Extension',
    id: manifest.id || 'myExtension',
    description: manifest.description || 'A TurboWarp extension',
    by: manifest.author || 'Anonymous',
    version: manifest.version || '1.0.0',
    license: manifest.license || 'MIT'
  };

  let header = '';
  header += `// Name: ${metadata.name}\n`;
  header += `// ID: ${metadata.id}\n`;
  header += `// Description: ${metadata.description}\n`;
  header += `// By: ${metadata.by}\n`;
  header += `// License: ${metadata.license}\n`;
  header += `\n`;
  header += `// Version ${metadata.version}\n`;
  header += `\n`;
  
  return header;
}

/**
 * Get all JS files from src directory in order
 */
function getSourceFiles() {
  const files = fs.readdirSync(SRC_DIR)
    .filter(file => file.endsWith('.js') && !file.startsWith('.'))
    .sort();
  
  return files.map(file => path.join(SRC_DIR, file));
}

/**
 * Build the extension by concatenating all JS files
 */
function buildExtension() {
  try {
    const manifest = getManifest();
    const header = generateHeader(manifest);
    const sourceFiles = getSourceFiles();
    
    let output = header;
    
    // Add IIFE wrapper that takes Scratch as parameter
    output += '(function (Scratch) {\n';
    output += '  "use strict";\n\n';
    
    // Concatenate all source files
    sourceFiles.forEach((file, index) => {
      const filename = path.basename(file);
      output += `  // ===== ${filename} =====\n`;
      const content = fs.readFileSync(file, 'utf8');
      // Indent the content
      const indentedContent = content.split('\n').map(line => {
        if (line.length === 0) return '';
        return '  ' + line;
      }).join('\n');
      output += indentedContent;
      output += '\n\n';
    });
    
    // Close IIFE
    output += '})(Scratch);\n';
    
    // Write output
    fs.writeFileSync(OUTPUT_FILE, output, 'utf8');
    
    const size = (output.length / 1024).toFixed(2);
    console.log(`[BUILD] Extension build successful: ${OUTPUT_FILE} (${size} KB)`);
    console.log(`        Bundled ${sourceFiles.length} source file(s)`);
    
    return true;
  } catch (err) {
    console.error('✗ Build failed:', err.message);
    return false;
  }
}

/**
 * Watch for file changes
 */
async function watchFiles() {
  let chokidar;
  try {
    chokidar = (await import('chokidar')).default;
  } catch (err) {
    console.error('Watch mode requires chokidar. Install it with: npm install --save-dev chokidar');
    process.exit(1);
  }
  
  console.log('Watching for changes in', SRC_DIR);
  
  const watcher = chokidar.watch(SRC_DIR, {
    ignored: /(^|[\/\\])\./,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 100
    }
  });
  
  watcher.on('change', (file) => {
    console.log(`Changed: ${path.basename(file)}`);
    buildExtension();
  });
  
  watcher.on('add', (file) => {
    console.log(`Added: ${path.basename(file)}`);
    buildExtension();
  });
  
  watcher.on('unlink', (file) => {
    console.log(`Removed: ${path.basename(file)}`);
    buildExtension();
  });
}

// Check for --watch flag
const watchMode = process.argv.includes('--watch');

// Initial build
buildExtension();

// Optional watch mode
if (watchMode) {
  watchFiles();
}
