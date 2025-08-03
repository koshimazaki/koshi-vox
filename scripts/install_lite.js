#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const https = require('https');
const { exec, execSync, spawn } = require('child_process');
const os = require('os');
const { promisify } = require('util');
const execAsync = promisify(exec);

// Terminal colors (cross-platform)
const colors = {
  lime: '\x1b[38;5;154m',
  cyan: '\x1b[38;5;51m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[38;5;196m',
  white: '\x1b[38;5;255m',
  gray: '\x1b[38;5;240m',
  reset: '\x1b[0m'
};

// Unicode symbols - using standard emojis that work everywhere
const symbols = {
  check: process.platform === 'win32' ? '[OK]' : '✓',
  cross: process.platform === 'win32' ? '[X]' : '✗',
  package: process.platform === 'win32' ? '[PKG]' : '📦',
  sparkles: process.platform === 'win32' ? '*' : '🏁',
  gear: process.platform === 'win32' ? '[CFG]' : '🧪',
  python: process.platform === 'win32' ? '[PY]' : '🐍',
  voicemail: process.platform === 'win32' ? '[VOX]' : '📞',     // phone emoji as fallback
  brain: process.platform === 'win32' ? '[AI]' : '👾',
  api: process.platform === 'win32' ? '[API]' : '💻',           // computer emoji
  warning: process.platform === 'win32' ? '[!]' : '⚠️',
  bug: process.platform === 'win32' ? '[BUG]' : '🐛'
};

// Cache directory
const CACHE_DIR = path.join(os.homedir(), '.cache', 'koshi-code-fonts');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Progress bar for downloads
class ProgressBar {
  constructor(total, label) {
    this.total = total;
    this.current = 0;
    this.label = label;
    this.width = 40;
  }

  update(current) {
    this.current = current;
    const percentage = Math.floor((current / this.total) * 100);
    const filled = Math.floor((current / this.total) * this.width);
    const bar = '█'.repeat(filled) + '░'.repeat(this.width - filled);
    
    process.stdout.write(
      `\r${colors.cyan}${this.label} ${bar} ${percentage}%${colors.reset}`
    );
  }

  complete() {
    this.update(this.total);
    console.log('');
  }
}

// Download file with progress
async function downloadFile(url, dest, label) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    https.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest, label)
          .then(resolve)
          .catch(reject);
      }
      
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }
      
      const totalSize = parseInt(response.headers['content-length'], 10);
      const progressBar = new ProgressBar(totalSize, label);
      let downloaded = 0;
      
      response.on('data', (chunk) => {
        downloaded += chunk.length;
        progressBar.update(downloaded);
      });
      
      response.pipe(file);
      
      file.on('finish', () => {
        file.close();
        progressBar.complete();
        resolve();
      });
      
      file.on('error', (err) => {
        fs.unlinkSync(dest);
        reject(err);
      });
    }).on('error', reject);
  });
}

// Extract zip file (using built-in Node.js libraries)
async function extractZip(zipPath, destDir) {
  // For cross-platform compatibility, we'll use the appropriate system command
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      // Windows: Use PowerShell
      await execAsync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`
      );
    } else {
      // macOS/Linux: Use unzip
      await execAsync(`unzip -q -o "${zipPath}" -d "${destDir}"`);
    }
  } catch (error) {
    throw new Error(`Failed to extract zip: ${error.message}`);
  }
}

// Install fonts
async function installFonts() {
  console.log(`${colors.lime}╭─────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.lime}│${colors.reset} ${colors.lime}     KOSHI-CODE FONT INSTALLER                  ${colors.lime}│${colors.reset}`);
  console.log(`${colors.lime}╰─────────────────────────────────────────────────╯${colors.reset}`);
  console.log('');
  
  const fonts = [
    {
      name: '3270 Nerd Font',
      url: 'https://github.com/ryanoasis/nerd-fonts/releases/download/v3.1.1/3270.zip',
      file: '3270-NerdFont-Regular.ttf',
      pattern: '*Regular.ttf'
    },
    {
      name: 'Departure Mono',
      url: 'https://github.com/rektdeckard/departure-mono/releases/download/v1.500/DepartureMono-1.500.zip',
      file: 'DepartureMono-Regular.ttf',
      pattern: '*Regular.ttf'
    }
  ];
  
  for (const font of fonts) {
    const fontPath = path.join(CACHE_DIR, font.file);
    
    if (fs.existsSync(fontPath)) {
      console.log(`${colors.lime}${symbols.check} ${font.name} already cached${colors.reset}`);
      continue;
    }
    
    console.log(`${colors.cyan}${symbols.package} Installing ${font.name}...${colors.reset}`);
    
    try {
      if (font.isDirect) {
        // Direct TTF download
        await downloadFile(font.url, fontPath, font.name);
      } else {
        // Zip download and extraction
        const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-'));
        const zipPath = path.join(tempDir, 'font.zip');
        
        await downloadFile(font.url, zipPath, font.name);
        await extractZip(zipPath, tempDir);
        
        // Find the regular variant (TTF or OTF)
        const files = fs.readdirSync(tempDir, { recursive: true });
        const regularFont = files.find(f => 
          f.toLowerCase().includes('regular') && (f.endsWith('.ttf') || f.endsWith('.otf'))
        );
        
        if (regularFont) {
          fs.copyFileSync(path.join(tempDir, regularFont), fontPath);
          console.log(`${colors.lime}${symbols.check} ${font.name} installed${colors.reset}`);
        } else {
          console.log(`${colors.orange}${symbols.cross} Could not find regular variant${colors.reset}`);
        }
        
        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (error) {
      console.error(`${colors.red}${symbols.cross} Failed to install ${font.name}: ${error.message}${colors.reset}`);
    }
  }
  
  console.log('');
  console.log(`${colors.lime}${symbols.sparkles} Font installation complete!${colors.reset}`);
}

// Check Python and pip
async function checkPython() {
  try {
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const { stdout } = await execAsync(`${pythonCmd} --version`);
    const version = stdout.trim().split(' ')[1];
    
    console.log(`${colors.lime}${symbols.check} Found Python ${colors.white}${version}${colors.reset}`);
    
    // Check pip
    await execAsync(`${pythonCmd} -m pip --version`);
    return pythonCmd;
  } catch (error) {
    console.log(`${colors.red}${symbols.cross} Python 3.8+ not found${colors.reset}`);
    console.log(`${colors.gray}  Please install Python from https://python.org${colors.reset}`);
    return null;
  }
}

// Install Python dependencies
async function installPythonDeps(pythonCmd) {
  console.log('');
  console.log(`${colors.cyan}${symbols.gear} Installing Python dependencies...${colors.reset}`);
  console.log('');
  
  const packages = [
    { name: 'faster-whisper', icon: symbols.brain, desc: 'M-optimized speech recognition' },
    { name: 'soundfile', icon: symbols.voicemail, desc: 'Audio file handling' },
    { name: 'librosa', icon: symbols.voicemail, desc: 'Advanced audio processing' },
    { name: 'fastapi', icon: symbols.api, desc: 'Modern web API framework' },
    { name: 'uvicorn', icon: symbols.api, desc: 'ASGI server for FastAPI' }
  ];
  
  const failed = [];
  const installed = [];
  
  for (const pkg of packages) {
    console.log(`${colors.cyan}${pkg.icon} ${pkg.desc}${colors.reset}`);
    process.stdout.write(`  Installing ${pkg.name}...`);
    
    try {
      await execAsync(
        `${pythonCmd} -m pip install --user ${pkg.name} --quiet --disable-pip-version-check`,
        { stdio: 'pipe' }
      );
      
      process.stdout.write(`\r  ${colors.lime}${symbols.check} Successfully installed ${colors.white}${pkg.name}${colors.reset}\n`);
      installed.push(pkg.name);
    } catch (error) {
      process.stdout.write(`\r  ${colors.red}${symbols.cross} Failed to install ${colors.white}${pkg.name}${colors.reset}\n`);
      failed.push(pkg.name);
    }
  }
  
  // Summary
  console.log('');
  if (failed.length === 0) {
    console.log(`${colors.lime}╭─────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.lime}│${colors.reset} ${colors.lime}            ALL DEPENDENCIES INSTALLED!         ${colors.lime}│${colors.reset}`);
    console.log(`${colors.lime}╰─────────────────────────────────────────────────╯${colors.reset}`);
  } else {
    console.log(`${colors.cyan}╭─────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.cyan}│${colors.reset} ${symbols.gear}${colors.cyan}    PARTIAL INSTALLATION COMPLETE    ${symbols.gear} ${colors.cyan}│${colors.reset}`);
    console.log(`${colors.cyan}╰─────────────────────────────────────────────────╯${colors.reset}`);
    console.log('');
    console.log(`${colors.cyan}${symbols.cross} Failed packages:${colors.reset}`);
    failed.forEach(pkg => {
      console.log(`  ${colors.cyan}${symbols.cross}${colors.reset} ${pkg}`);
    });
    console.log('');
    console.log(`${colors.lime}Manual install: ${pythonCmd} -m pip install --user ${failed.join(' ')}${colors.reset}`);
  }
}

// Animated loading bar
function animatedLoadingBar(message, duration = 3000) {
  return new Promise((resolve) => {
    const width = 40;
    const frames = ['▱', '▰'];
    let progress = 0;
    
    const interval = setInterval(() => {
      const filled = Math.floor((progress / 100) * width);
      const bar = frames[1].repeat(filled) + frames[0].repeat(width - filled);
      
      process.stdout.write(`\r${colors.cyan}${message} ${bar} ${progress}%${colors.reset}`);
      
      progress += 2;
      if (progress > 100) {
        clearInterval(interval);
        console.log('');
        resolve();
      }
    }, duration / 50);
  });
}


// Launch setup-vox script automatically
async function launchSetupVox() {
  return new Promise((resolve, reject) => {
    console.log(``);
    console.log(`${colors.cyan}${symbols.gear} Launching interactive alias setup...${colors.reset}`);
    console.log(``);
    
    // Find the setup-vox-alias script
    const setupScript = path.join(__dirname, `setup-vox-alias`);
    
    // Check if setup script exists
    if (!fs.existsSync(setupScript)) {
      console.log(`${colors.orange}${symbols.cross} setup-vox-alias script not found at: ${setupScript}${colors.reset}`);
      console.log(`${colors.cyan}You can run setup manually with: ${colors.white}setup-vox${colors.reset}`);
      resolve();
      return;
    }
    
    // Make sure the script is executable
    try {
      fs.chmodSync(setupScript, `755`);
    } catch (error) {
      console.log(`${colors.orange}${symbols.cross} Could not make setup script executable${colors.reset}`);
    }
    
    // Check if we are in a TTY (interactive terminal)
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log(`${colors.orange}${symbols.gear} Non-interactive environment detected${colors.reset}`);
      console.log(`${colors.cyan}Please run setup manually with: ${colors.white}setup-vox${colors.reset}`);
      resolve();
      return;
    }
    
    // Launch the setup script using spawn for better interactive control
    const setupProcess = spawn(`bash`, [setupScript], {
      stdio: `inherit`, // Pass through stdin/stdout/stderr
      cwd: __dirname
    });
    
    setupProcess.on(`close`, (code) => {
      console.log(``);
      if (code === 0) {
        console.log(`${colors.lime}${symbols.sparkles} Alias setup completed successfully!${colors.reset}`);
      } else {
        console.log(`${colors.orange}${symbols.cross} Setup exited with code ${code}${colors.reset}`);
        console.log(`${colors.cyan}You can run setup again with: ${colors.white}setup-vox${colors.reset}`);
      }
      resolve();
    });
    
    setupProcess.on(`error`, (error) => {
      console.log(`${colors.red}${symbols.cross} Error launching setup: ${error.message}${colors.reset}`);
      console.log(`${colors.cyan}Please run setup manually with: ${colors.white}setup-vox${colors.reset}`);
      resolve(); // Do not reject, just continue
    });
  });
}
// Main installation flow
async function main() {
  console.clear();
  
  // KOSHI VOX ASCII Art
  console.log(`${colors.lime}
██╗  ██╗ ██████╗ ███████╗██╗  ██╗██╗    ██╗   ██╗ ██████╗ ██╗  ██╗
██║ ██╔╝██╔═══██╗██╔════╝██║  ██║██║    ██║   ██║██╔═══██╗╚██╗██╔╝
█████╔╝ ██║   ██║███████╗███████║██║    ██║   ██║██║   ██║ ╚███╔╝ 
██╔═██╗ ██║   ██║╚════██║██╔══██║██║    ╚██╗ ██╔╝██║   ██║ ██╔██╗ 
██║  ██╗╚██████╔╝███████║██║  ██║██║     ╚████╔╝ ╚██████╔╝██╔╝ ██╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝      ╚═══╝   ╚═════╝ ╚═╝  ╚═╝${colors.reset}`);
  
  console.log(`${colors.lime}░░░█ Voice-To-Text Recorder for Terminal - optimized for MacOS █░░░${colors.reset}`);
  console.log(`${colors.lime}░░░ v1.2.3${colors.reset}`);
  console.log(`${colors.lime}░░░░░░░░░░░ https://github.com/koshimazaki/koshi-vox${colors.reset}`);

  // Loading animation
  await animatedLoadingBar('⚡ Initializing installation', 2000);
  console.log('');
  
  try {
    // Install fonts with loading animation
    await animatedLoadingBar('📦 Preparing font installation', 1500);
    await installFonts();
    
    // Python setup with loading animation
    await animatedLoadingBar('🐍 Checking Python environment', 1000);
    const pythonCmd = await checkPython();
    
    if (pythonCmd) {
      await animatedLoadingBar('░░█ Preparing dependency installation', 1500);
      await installPythonDeps(pythonCmd);
    }
    
    // Final loading animation
    await animatedLoadingBar('░░░ Finalizing installation', 1000);
    
    // Final message
    console.log('');
    console.log(`${colors.lime}╭─────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.lime}│${colors.reset}                   ${symbols.sparkles} SUCCESS! ${symbols.sparkles}                ${colors.lime}│${colors.reset}`);
    console.log(`${colors.lime}╰─────────────────────────────────────────────────╯${colors.reset}`);
    console.log('');
    // Launch interactive setup automatically
    await launchSetupVox();
    
    console.log(`${colors.lime}░███ KOSHI VOX is ready to go! ███░${colors.reset}`);    
  } catch (error) {
    console.error(`${colors.cyan}${symbols.cross} Installation failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { installFonts, checkPython, installPythonDeps, launchSetupVox };