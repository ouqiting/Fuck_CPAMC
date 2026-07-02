#!/usr/bin/env node
'use strict';

/**
 * Clean management.html Builder - cross-platform Node.js version.
 *
 * Clones upstream, patches out APIKEY.FUN entries, builds, outputs management.html.
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DEFAULTS = {
  outputDir: './output',
  upstreamUrl:
    'https://github.com/router-for-me/Cli-Proxy-API-Management-Center.git',
  branch: 'main',
  tag: null,
};

function printHelp() {
  console.log(`Clean management.html Builder

Usage: node build-local.cjs [options]

Options:
  --output-dir <dir>     Output directory (default: ./output)
  --upstream-url <url>   Upstream git URL
  --branch <name>        Upstream branch (default: main)
  --tag <name>           Upstream tag to clone (e.g. v1.17.8); overrides --branch
  -h, --help             Show this help
`);
}

function parseArgs(argv) {
  const opts = { ...DEFAULTS };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const eq = a.indexOf('=');
    let key = a;
    let inlineVal;
    if (eq !== -1) {
      key = a.slice(0, eq);
      inlineVal = a.slice(eq + 1);
    }
    const getVal = () => (inlineVal !== undefined ? inlineVal : argv[++i]);
    switch (key) {
      case '--output-dir':
        opts.outputDir = getVal();
        break;
      case '--upstream-url':
        opts.upstreamUrl = getVal();
        break;
      case '--branch':
        opts.branch = getVal();
        break;
      case '--tag':
        opts.tag = getVal();
        break;
      case '-h':
      case '--help':
        printHelp();
        process.exit(0);
      default:
        console.error(`Unknown argument: ${a}`);
        process.exit(2);
    }
  }
  return opts;
}

function shellQuote(arg) {
  if (arg === '') return '""';
  if (/^[\w./:=@~+-]+$/.test(arg)) return arg;
  if (process.platform === 'win32') {
    return '"' + arg.replace(/"/g, '\\"') + '"';
  }
  return "'" + arg.replace(/'/g, "'\\''") + "'";
}

function run(cmd, args, opts = {}) {
  console.log(`  $ ${[cmd, ...args].map(shellQuote).join(' ')}`);
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    ...opts,
  });
  const code = result.status;
  if (code !== 0) {
    console.error(`[ERROR] Command failed with exit code ${code ?? 1}`);
    process.exit(code ?? 1);
  }
  return result;
}

function checkCommand(cmd) {
  const checker = process.platform === 'win32' ? 'where.exe' : 'which';
  const result = spawnSync(checker, [cmd], { stdio: 'ignore' });
  if (result.error) return false;
  return result.status === 0;
}

function rmTree(target) {
  if (!fs.existsSync(target)) return;
  let entries = [];
  try {
    entries = fs.readdirSync(target, { withFileTypes: true });
  } catch {
    /* ignore */
  }
  for (const entry of entries) {
    const full = path.join(target, entry.name);
    if (entry.isDirectory() || entry.isSymbolicLink()) {
      rmTree(full);
    } else {
      try {
        fs.chmodSync(full, 0o777);
      } catch {
        /* ignore */
      }
      fs.rmSync(full, { force: true });
    }
  }
  try {
    fs.chmodSync(target, 0o777);
  } catch {
    /* ignore */
  }
  fs.rmSync(target, { recursive: true, force: true });
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  const scriptDir = __dirname;
  const outputPath = path.isAbsolute(args.outputDir)
    ? args.outputDir
    : path.join(scriptDir, args.outputDir);
  const workDir = path.join(scriptDir, '.build-tmp');
  const repoDir = path.join(workDir, 'repo');
  const patchScript = path.join(scriptDir, 'patch.cjs');

  console.log('========================================');
  console.log('  Clean management.html Builder');
  console.log('========================================');
  console.log(`Upstream : ${args.upstreamUrl}`);
  if (args.tag) {
    console.log(`Tag      : ${args.tag}`);
  } else {
    console.log(`Branch   : ${args.branch}`);
  }
  console.log(`WorkDir  : ${workDir}`);
  console.log(`Output   : ${outputPath}`);
  console.log();

  for (const cmd of ['git', 'node', 'bun']) {
    if (!checkCommand(cmd)) {
      console.error(`[ERROR] '${cmd}' not found in PATH. Please install it first.`);
      process.exit(1);
    }
  }

  console.log('[1/6] Cloning upstream...');
  rmTree(workDir);
  fs.mkdirSync(workDir, { recursive: true });
  const ref = args.tag || args.branch;
  run('git', ['clone', '--depth', '1', '--branch', ref, args.upstreamUrl, repoDir]);

  console.log('[2/6] Installing dependencies...');
  run('bun', ['install', '--frozen-lockfile'], { cwd: repoDir });

  console.log('[3/6] Applying patch (hiding APIKEY.FUN sidebar & dashboard entries)...');
  run('node', [patchScript, repoDir], { cwd: repoDir });

  console.log('[4/6] Building...');
  run('bun', ['run', 'build'], { cwd: repoDir });

  console.log('[5/6] Copying management.html...');
  const builtHtml = path.join(repoDir, 'dist', 'index.html');
  if (!fs.existsSync(builtHtml)) {
    console.error(`[ERROR] ${builtHtml} not found after build.`);
    process.exit(1);
  }
  fs.mkdirSync(outputPath, { recursive: true });
  const destFile = path.join(outputPath, 'management.html');
  fs.copyFileSync(builtHtml, destFile);
  const sizeMb = (fs.statSync(destFile).size / (1024 * 1024)).toFixed(2);
  console.log(`  -> ${destFile} (${sizeMb} MB)`);

  console.log('[6/6] Cleaning up temp files...');
  try {
    rmTree(workDir);
    console.log(`  Removed ${workDir}`);
  } catch (e) {
    console.error(`[WARN] Failed to remove ${workDir}: ${e.message}`);
    console.error('       You can delete it manually.');
  }

  console.log();
  console.log('========================================');
  console.log('  Done!');
  console.log('========================================');
  console.log(`management.html is at: ${destFile}`);
  console.log('Copy it to your CLI Proxy API backend folder.');
}

main();
