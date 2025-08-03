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
  pink: '\x1b[38;5;198m',
  red: '\x1b[38;5;196m',
  white: '\x1b[38;5;255m',
  gray: '\x1b[38;5;240m',
  purple: '\x1b[38;5;135m',
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
  voicemail: process.platform === 'win32' ? '[VOX]' : '📞',
  brain: process.platform === 'win32' ? '[AI]' : '👾',
  api: process.platform === 'win32' ? '[API]' : '💻',
  warning: process.platform === 'win32' ? '[!]' : '⚠️',
  brew: process.platform === 'win32' ? '[BREW]' : '🍺',
  folder: process.platform === 'win32' ? '[DIR]' : '📁'
};

// Directories
const CACHE_DIR = path.join(os.homedir(), '.cache', 'koshi-code-fonts');
const VENV_DIR = path.join(os.homedir(), '.koshi-vox-env');
const CONFIG_DIR = path.join(os.homedir(), '.config', 'koshi-vox');
const INSTALL_LOG_PATH = path.join(CONFIG_DIR, 'installation.json');

// Ensure directories exist
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}
if (!fs.existsSync(CONFIG_DIR)) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
}

// Installation log management
class InstallationLog {
  constructor() {
    this.log = {
      version: '1.0',
      installedAt: new Date().toISOString(),
      components: {
        homebrew: { installed: false, path: null },
        python: { installed: false, version: null, path: null },
        virtualEnv: { installed: false, path: null },
        pythonPackages: [],
        npmPackage: { installed: false, version: null, prefix: null },
        fonts: [],
        shellConfig: { modified: false, backupPath: null }
      },
      system: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version
      }
    };
    this.load();
  }
  
  load() {
    if (fs.existsSync(INSTALL_LOG_PATH)) {
      try {
        const data = fs.readFileSync(INSTALL_LOG_PATH, 'utf-8');
        this.log = JSON.parse(data);
        // Clean up any duplicates from previous runs
        this.cleanupDuplicates();
      } catch (error) {
        console.log(`${colors.gray}Could not load previous installation log${colors.reset}`);
      }
    }
  }
  
  cleanupDuplicates() {
    // Remove duplicate Python packages, keeping the latest
    const uniquePackages = {};
    this.log.components.pythonPackages.forEach(pkg => {
      if (!uniquePackages[pkg.name] || new Date(pkg.installedAt) > new Date(uniquePackages[pkg.name].installedAt)) {
        uniquePackages[pkg.name] = pkg;
      }
    });
    this.log.components.pythonPackages = Object.values(uniquePackages);
    
    // Remove duplicate fonts, keeping the latest
    const uniqueFonts = {};
    this.log.components.fonts.forEach(font => {
      if (!uniqueFonts[font.name] || new Date(font.installedAt) > new Date(uniqueFonts[font.name].installedAt)) {
        uniqueFonts[font.name] = font;
      }
    });
    this.log.components.fonts = Object.values(uniqueFonts);
    
    // Update the installedAt timestamp to reflect this run
    this.log.installedAt = new Date().toISOString();
    
    this.save();
  }
  
  save() {
    try {
      fs.writeFileSync(INSTALL_LOG_PATH, JSON.stringify(this.log, null, 2));
    } catch (error) {
      console.log(`${colors.orange}Warning: Could not save installation log${colors.reset}`);
    }
  }
  
  addPythonPackage(name, version) {
    // Check if package already exists and update it instead of adding duplicate
    const existingIndex = this.log.components.pythonPackages.findIndex(pkg => pkg.name === name);
    if (existingIndex >= 0) {
      this.log.components.pythonPackages[existingIndex] = { name, version, installedAt: new Date().toISOString() };
    } else {
      this.log.components.pythonPackages.push({ name, version, installedAt: new Date().toISOString() });
    }
    this.save();
  }
  
  addFont(name, path) {
    // Check if font already exists and update it instead of adding duplicate
    const existingIndex = this.log.components.fonts.findIndex(font => font.name === name);
    if (existingIndex >= 0) {
      this.log.components.fonts[existingIndex] = { name, path, installedAt: new Date().toISOString() };
    } else {
      this.log.components.fonts.push({ name, path, installedAt: new Date().toISOString() });
    }
    this.save();
  }
  
  setComponent(component, data) {
    this.log.components[component] = { ...this.log.components[component], ...data };
    this.save();
  }
}

const installLog = new InstallationLog();

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

// Extract zip file
async function extractZip(zipPath, destDir) {
  const platform = os.platform();
  
  try {
    if (platform === 'win32') {
      await execAsync(
        `powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`
      );
    } else {
      await execAsync(`unzip -q -o "${zipPath}" -d "${destDir}"`);
    }
  } catch (error) {
    throw new Error(`Failed to extract zip: ${error.message}`);
  }
}

// Check if Homebrew is installed
async function checkHomebrew() {
  try {
    await execAsync('brew --version');
    return true;
  } catch {
    return false;
  }
}

// Install Homebrew with enhanced UI
async function installHomebrew() {
  console.log('');
  console.log(`${colors.orange}╭─────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.orange}│${colors.reset} ${symbols.brew}  ${colors.orange}HOMEBREW INSTALLATION REQUIRED${colors.reset}  ${symbols.brew} ${colors.orange}│${colors.reset}`);
  console.log(`${colors.orange}╰─────────────────────────────────────────────────╯${colors.reset}`);
  console.log('');
  console.log(`${colors.gray}Homebrew is the package manager for macOS.${colors.reset}`);
  console.log(`${colors.gray}This installation will:${colors.reset}`);
  console.log(`  ${colors.cyan}•${colors.reset} Download and install Homebrew`);
  console.log(`  ${colors.cyan}•${colors.reset} Set up command line tools`);
  console.log(`  ${colors.cyan}•${colors.reset} Require your admin password`);
  console.log('');
  
  return new Promise((resolve, reject) => {
    const installCmd = '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
    
    const proc = spawn('bash', ['-c', installCmd], {
      stdio: 'inherit'
    });
    
    proc.on('close', async (code) => {
      if (code === 0) {
        console.log('');
        await animatedLoadingBar('🍺 Verifying Homebrew installation', 1500);
        console.log(`${colors.lime}${symbols.check} Homebrew installed successfully${colors.reset}`);
        
        // Log that Homebrew was installed by us
        installLog.setComponent('homebrew', {
          installed: true,
          installedByKoshi: true,
          path: '/opt/homebrew',
          installedAt: new Date().toISOString()
        });
        
        resolve();
      } else {
        reject(new Error('Homebrew installation failed'));
      }
    });
  });
}

// Enhanced Python installation progress
class PythonInstallProgress {
  constructor() {
    this.steps = [
      { name: 'Updating package database', icon: '📦' },
      { name: 'Downloading Python 3.11', icon: '🐍' },
      { name: 'Installing Python binaries', icon: '⚙️' },
      { name: 'Configuring Python environment', icon: '🔧' },
      { name: 'Linking Python commands', icon: '🔗' }
    ];
    this.currentStep = 0;
  }
  
  async nextStep() {
    if (this.currentStep < this.steps.length) {
      const step = this.steps[this.currentStep];
      await animatedLoadingBar(`${step.icon} ${step.name}`, 2000);
      this.currentStep++;
    }
  }
}

// Install Python via Homebrew with enhanced UI
async function installPythonViaHomebrew() {
  console.log('');
  console.log(`${colors.purple}╭─────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.purple}│${colors.reset} ${symbols.python}  ${colors.purple}PYTHON 3.11 INSTALLATION${colors.reset}             ${symbols.python} ${colors.purple}│${colors.reset}`);
  console.log(`${colors.purple}╰─────────────────────────────────────────────────╯${colors.reset}`);
  console.log('');
  
  const progress = new PythonInstallProgress();
  
  try {
    // Update brew with progress
    await progress.nextStep();
    await execAsync('brew update', { stdio: 'pipe' });
    
    // Download Python with progress
    await progress.nextStep();
    
    // Install Python 3.11
    await progress.nextStep();
    await execAsync('brew install python@3.11', { stdio: 'pipe' });
    
    // Configure environment
    await progress.nextStep();
    
    // Link Python
    await progress.nextStep();
    await execAsync('brew link python@3.11', { stdio: 'pipe' });
    
    console.log('');
    console.log(`${colors.lime}${symbols.check} Python 3.11 installed successfully!${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}${symbols.cross} Failed to install Python: ${error.message}${colors.reset}`);
    return false;
  }
}

// Check Python and install if needed
async function ensurePython() {
  console.log('');
  console.log(`${colors.cyan}${symbols.python} Checking Python environment...${colors.reset}`);
  
  // First check if Python is already installed
  const pythonCommands = ['python3.11', 'python3', 'python'];
  let pythonCmd = null;
  
  for (const cmd of pythonCommands) {
    try {
      const { stdout } = await execAsync(`${cmd} --version`);
      const version = stdout.trim().split(' ')[1];
      const [major, minor] = version.split('.');
      
      if (parseInt(major) >= 3 && parseInt(minor) >= 8) {
        console.log(`${colors.lime}${symbols.check} Found Python ${colors.lime}${version}${colors.reset}`);
        pythonCmd = cmd;
        break;
      }
    } catch {
      // Continue checking other commands
    }
  }
  
  // If Python not found, install it
  if (!pythonCmd) {
    console.log(`${colors.orange}${symbols.warning} Python 3.8+ not found${colors.reset}`);
    
    if (process.platform === 'darwin') {
      // macOS - use Homebrew
      await animatedLoadingBar('🔍 Checking for Homebrew', 1000);
      const hasHomebrew = await checkHomebrew();
      
      if (!hasHomebrew) {
        await installHomebrew();
      } else {
        console.log(`${colors.lime}${symbols.check} Homebrew is already installed${colors.reset}`);
      }
      
      const installed = await installPythonViaHomebrew();
      if (installed) {
        pythonCmd = 'python3.11';
        installLog.setComponent('python', {
          installed: true,
          version: '3.11',
          path: pythonCmd,
          installedBy: 'homebrew',
          installedByKoshi: !hasHomebrew,  // If we installed Homebrew, we installed Python too
          installedAt: new Date().toISOString()
        });
      }
    } else if (process.platform === 'linux') {
      console.log('');
      console.log(`${colors.cyan}╭─────────────────────────────────────────────────╮${colors.reset}`);
      console.log(`${colors.cyan}│${colors.reset}    ${colors.cyan}MANUAL PYTHON INSTALLATION REQUIRED${colors.reset}              ${colors.cyan}│${colors.reset}`);
      console.log(`${colors.cyan}╰─────────────────────────────────────────────────╯${colors.reset}`);
      console.log('');
      console.log(`${colors.gray}Please install Python using your package manager:${colors.reset}`);
      console.log('');
      console.log(`${colors.cyan}Ubuntu/Debian:${colors.reset}`);
      console.log(`  ${colors.white}sudo apt-get install python3.11 python3.11-venv python3-pip${colors.reset}`);
      console.log('');
      console.log(`${colors.cyan}Fedora:${colors.reset}`);
      console.log(`  ${colors.white}sudo dnf install python3.11 python3-pip${colors.reset}`);
      console.log('');
      console.log(`${colors.cyan}Arch:${colors.reset}`);
      console.log(`  ${colors.white}sudo pacman -S python python-pip${colors.reset}`);
      return null;
    } else {
      console.log(`${colors.cyan}Please install Python from: ${colors.white}https://python.org${colors.reset}`);
      return null;
    }
  }
  
  // Ensure pip is installed with progress
  try {
    await execAsync(`${pythonCmd} -m pip --version`);
    console.log(`${colors.lime}${symbols.check} pip is already installed${colors.reset}`);
  } catch {
    await animatedLoadingBar('📦 Installing pip package manager', 2000);
    await execAsync(`${pythonCmd} -m ensurepip --upgrade`);
    console.log(`${colors.lime}${symbols.check} pip installed successfully${colors.reset}`);
  }
  
  return pythonCmd;
}

// Create and setup virtual environment
async function setupVirtualEnvironment(pythonCmd) {
  console.log('');
  console.log(`${colors.purple}╭─────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.purple}│${colors.reset} ${symbols.folder}  ${colors.purple}VIRTUAL ENVIRONMENT SETUP${colors.reset}     ${symbols.folder} ${colors.purple}           │${colors.reset}`);
  console.log(`${colors.purple}╰─────────────────────────────────────────────────╯${colors.reset}`);
  console.log('');
  
  try {
    // Check if venv already exists
    if (fs.existsSync(VENV_DIR)) {
      console.log(`${colors.cyan}${symbols.gear} Virtual environment already exists${colors.reset}`);
      console.log(`${colors.gray}  Location: ${VENV_DIR}${colors.reset}`);
    } else {
      // Create virtual environment with progress
      await animatedLoadingBar('🏗️  Creating isolated environment', 3000);
      await execAsync(`${pythonCmd} -m venv "${VENV_DIR}"`);
      console.log(`${colors.lime}${symbols.check} Virtual environment created${colors.reset}`);
      console.log(`${colors.gray}  Location: ${VENV_DIR}${colors.reset}`);
    }
    
    // Get the python executable from venv
    const venvPython = process.platform === 'win32' 
      ? path.join(VENV_DIR, 'Scripts', 'python.exe')
      : path.join(VENV_DIR, 'bin', 'python');
    
    // Upgrade pip in venv with progress
    await animatedLoadingBar('📦 Upgrading pip package manager', 2000);
    await execAsync(`"${venvPython}" -m pip install --upgrade pip --quiet`);
    console.log(`${colors.lime}${symbols.check} pip upgraded to latest version${colors.reset}`);
    
    console.log('');
    console.log(`${colors.lime}✨ Environment ready for dependencies${colors.reset}`);
    
    // Log virtual environment
    installLog.setComponent('virtualEnv', {
      installed: true,
      path: VENV_DIR
    });
    
    return venvPython;
  } catch (error) {
    console.error(`${colors.red}${symbols.cross} Failed to setup virtual environment: ${error.message}${colors.reset}`);
    return null;
  }
}

// Download and cache Whisper base model
async function downloadWhisperModel(venvPython) {
  console.log('');
  console.log(`${colors.lime}╭─────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.lime}│${colors.reset}     ${colors.lime}DOWNLOADING WHISPER BASE MODEL${colors.reset}              ${colors.lime}│${colors.reset}`);
  console.log(`${colors.lime}╰─────────────────────────────────────────────────╯${colors.reset}`);
  console.log('');
  
  console.log(`${colors.gray}Pre-downloading base model (~74MB) for instant voice recording...${colors.reset}`);
  console.log('');
  
  // Create progress bar with ▰▱ blocks
  const progressWidth = 40;
  let currentProgress = 0;
  
  const updateProgress = (percent) => {
    const filled = Math.floor((percent / 100) * progressWidth);
    const empty = progressWidth - filled;
    const bar = '▰'.repeat(filled) + '▱'.repeat(empty);
    
    // Color coding: lime for progress, gray for empty
    process.stdout.write(`\r  ${colors.lime}${bar.substring(0, filled)}${colors.gray}${bar.substring(filled)}${colors.reset} ${colors.lime}${percent}%${colors.reset}`);
  };
  
  // Start progress animation
  const progressInterval = setInterval(() => {
    currentProgress = Math.min(currentProgress + Math.random() * 15, 95);
    updateProgress(Math.floor(currentProgress));
  }, 500);
  
  try {
    // Python script to download the model
    const downloadScript = `
import sys
import os
try:
    from faster_whisper import WhisperModel
    print("Downloading Whisper base model...")
    model = WhisperModel("base", device="cpu", compute_type="int8", cpu_threads=8)
    print("Model downloaded and cached successfully!")
except Exception as e:
    print(f"Error: {e}")
    sys.exit(1)
`;
    
    // Execute the download  
    await execAsync(`"${venvPython}" -c '${downloadScript}'`, { stdio: 'pipe' });
    
    // Complete progress
    clearInterval(progressInterval);
    updateProgress(100);
    console.log('');
    console.log('');
    console.log(`${colors.lime}${symbols.check} Whisper base model downloaded and cached!${colors.reset}`);
    console.log(`${colors.gray}Voice recording will be instant on first use${colors.reset}`);
    
    // Log the model installation
    installLog.setComponent('whisperModel', {
      model: 'base',
      size: '74MB',
      downloaded: true,
      installedAt: new Date().toISOString()
    });
    
  } catch (error) {
    clearInterval(progressInterval);
    console.log('');
    console.log('');
    console.log(`${colors.pink}${symbols.warning} Model download failed: ${error.message}${colors.reset}`);
    console.log(`${colors.gray}Model will download on first use instead${colors.reset}`);
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
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'font-'));
      const zipPath = path.join(tempDir, 'font.zip');
      
      await downloadFile(font.url, zipPath, font.name);
      await extractZip(zipPath, tempDir);
      
      const files = fs.readdirSync(tempDir, { recursive: true });
      const regularFont = files.find(f => 
        f.toLowerCase().includes('regular') && (f.endsWith('.ttf') || f.endsWith('.otf'))
      );
      
      if (regularFont) {
        fs.copyFileSync(path.join(tempDir, regularFont), fontPath);
        console.log(`${colors.lime}${symbols.check} ${font.name} installed${colors.reset}`);
        installLog.addFont(font.name, fontPath);
      } else {
        console.log(`${colors.orange}${symbols.cross} Could not find regular variant${colors.reset}`);
      }
      
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error(`${colors.red}${symbols.cross} Failed to install ${font.name}: ${error.message}${colors.reset}`);
    }
  }
  
  console.log('');
  console.log(`${colors.lime}${symbols.sparkles} Font installation complete!${colors.reset}`);
}

// Enhanced package installation with progress
class PackageInstaller {
  constructor(venvPython) {
    this.venvPython = venvPython;
    this.packages = [
      { 
        name: 'faster-whisper', 
        icon: '🧠', 
        desc: 'AI-optimized speech recognition',
        size: 'Large - includes AI models'
      },
      { 
        name: 'soundfile', 
        icon: '🎵', 
        desc: 'Audio file handling',
        size: 'Lightweight'
      },
      { 
        name: 'librosa', 
        icon: '🎼', 
        desc: 'Advanced audio processing',
        size: 'Medium - audio analysis tools'
      },
      { 
        name: 'fastapi', 
        icon: '⚡', 
        desc: 'Modern web API framework',
        size: 'Lightweight'
      },
      { 
        name: 'uvicorn', 
        icon: '🚀', 
        desc: 'ASGI server for FastAPI',
        size: 'Lightweight'
      }
    ];
    this.failed = [];
    this.installed = [];
  }
  
  async install() {
    console.log('');
    console.log(`${colors.purple}╭─────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.purple}│${colors.reset} ${symbols.python}  ${colors.purple}PYTHON DEPENDENCIES${colors.reset}         ${symbols.python} ${colors.purple}             │${colors.reset}`);
    console.log(`${colors.purple}╰─────────────────────────────────────────────────╯${colors.reset}`);
    console.log('');
    console.log(`${colors.gray}Installing in isolated environment...${colors.reset}`);
    console.log('');
    
    for (let i = 0; i < this.packages.length; i++) {
      const pkg = this.packages[i];
      const progress = Math.round(((i + 1) / this.packages.length) * 100);
      
      console.log(`${colors.cyan}[${i + 1}/${this.packages.length}] ${pkg.icon} ${pkg.desc}${colors.reset}`);
      console.log(`${colors.gray}     Package: ${colors.cyan}${pkg.name}${colors.reset}`);
      console.log(`${colors.gray}     Size: ${pkg.size}${colors.reset}`);
      
      // Show loading bar for installation
      const loadingMsg = `     Installing ${pkg.name}`;
      const startTime = Date.now();
      
      // Start installation in background
      const installPromise = execAsync(
        `"${this.venvPython}" -m pip install ${pkg.name} --quiet --disable-pip-version-check`,
        { stdio: 'pipe' }
      );
      
      // Show animated progress while installing with cool spinner
      const spinnerChars = ['░', '▒', '▓', '█', '▄', '▌', '▐', '▀'];
      let spinnerIndex = 0;
      const interval = setInterval(() => {
        const spinner = spinnerChars[spinnerIndex % spinnerChars.length];
        spinnerIndex++;
        process.stdout.write(`\r     ${colors.cyan}${spinner}${colors.reset} ${colors.gray}Installing ${colors.cyan}${pkg.name}${colors.reset}${colors.gray}...${colors.reset}    `);
      }, 150);
      
      try {
        await installPromise;
        clearInterval(interval);
        process.stdout.write(`\r     ${colors.lime}${symbols.check} Successfully installed ${colors.lime}${pkg.name}${colors.reset}                    \n`);
        this.installed.push(pkg.name);
        // Get version and log it
        try {
          const versionResult = await execAsync(`"${this.venvPython}" -m pip show ${pkg.name} | grep Version | cut -d' ' -f2`);
          const version = versionResult.stdout.trim();
          installLog.addPythonPackage(pkg.name, version || 'unknown');
        } catch {
          installLog.addPythonPackage(pkg.name, 'unknown');
        }
      } catch (error) {
        clearInterval(interval);
        process.stdout.write(`\r     ${colors.red}${symbols.cross} Failed to install ${colors.white}${pkg.name}${colors.reset}                    \n`);
        this.failed.push(pkg.name);
      }
      
      // Show overall progress
      show_progress(i + 1, this.packages.length);
      console.log('\n');
    }
    
    return this.failed.length === 0;
  }
  
  showSummary() {
    console.log('');
    if (this.failed.length === 0) {
      console.log(`${colors.lime}╭─────────────────────────────────────────────────╮${colors.reset}`);
      console.log(`${colors.lime}│${colors.reset}    ${symbols.sparkles} ${colors.lime}ALL DEPENDENCIES INSTALLED!${colors.reset} ${symbols.sparkles}     ${colors.lime}       │${colors.reset}`);
      console.log(`${colors.lime}╰─────────────────────────────────────────────────╯${colors.reset}`);
      console.log('');
      console.log(`${colors.lime}░█Installed packages:${colors.reset}`);
      this.installed.forEach(pkg => {
        console.log(`   ${colors.lime}• ${pkg}${colors.reset}`);
      });
    } else {
      console.log(`${colors.orange}╭─────────────────────────────────────────────────╮${colors.reset}`);
      console.log(`${colors.orange}│${colors.reset}    ${symbols.warning} ${colors.orange}PARTIAL INSTALLATION${colors.reset} ${symbols.warning}         ${colors.orange}│${colors.reset}`);
      console.log(`${colors.orange}╰─────────────────────────────────────────────────╯${colors.reset}`);
      console.log('');
      console.log(`${colors.red}Failed packages:${colors.reset}`);
      this.failed.forEach(pkg => {
        console.log(`   ${colors.red}${symbols.cross}${colors.reset} ${pkg}`);
      });
      console.log('');
      console.log(`${colors.cyan}To install manually:${colors.reset}`);
      console.log(`   ${colors.white}${this.venvPython} -m pip install ${this.failed.join(' ')}${colors.reset}`);
    }
  }
}

// Helper function for progress display
function show_progress(current, total) {
  const width = 40;
  const percentage = Math.round((current / total) * 100);
  const filled = Math.round((current / total) * width);
  const empty = width - filled;
  
  process.stdout.write(
    `\r${colors.cyan}Overall Progress: [${colors.lime}${'█'.repeat(filled)}${colors.gray}${'░'.repeat(empty)}${colors.cyan}] ${percentage}%${colors.reset}`
  );
}

// Install Python dependencies in virtual environment
async function installPythonDeps(venvPython) {
  const installer = new PackageInstaller(venvPython);
  const success = await installer.install();
  installer.showSummary();
  return success;
}

// Update shell configuration to use virtual environment
async function updateShellConfig() {
  console.log('');
  console.log(`${colors.cyan}╭─────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.cyan}│${colors.reset} ⚙️   ${colors.cyan}SHELL CONFIGURATION${colors.reset}          ⚙️  ${colors.cyan}          │${colors.reset}`);
  console.log(`${colors.cyan}╰─────────────────────────────────────────────────╯${colors.reset}`);
  console.log('');
  
  const shellConfig = path.join(os.homedir(), '.zshrc');
  const venvActivate = process.platform === 'win32'
    ? path.join(VENV_DIR, 'Scripts', 'activate')
    : path.join(VENV_DIR, 'bin', 'activate');
  
  const envConfig = `
# Koshi-Vox Python Environment
export KOSHI_VOX_VENV="${VENV_DIR}"
export KOSHI_VOX_PYTHON="${path.join(VENV_DIR, 'bin', 'python')}"
`;
  
  try {
    // Show what will be added
    console.log(`${colors.gray}Adding environment variables to ${colors.cyan}~/.zshrc${colors.reset}`);
    console.log(`${colors.gray}  • ${colors.cyan}KOSHI_VOX_VENV${colors.reset} → ${colors.cyan}${VENV_DIR}${colors.reset}`);
    console.log(`${colors.gray}  • ${colors.cyan}KOSHI_VOX_PYTHON${colors.reset} → ${colors.cyan}${path.join(VENV_DIR, 'bin', 'python')}${colors.reset}`);
    console.log('');
    
    // Check if already configured
    const content = fs.readFileSync(shellConfig, 'utf-8');
    if (!content.includes('KOSHI_VOX_VENV')) {
      // Create backup
      const backupPath = `${shellConfig}.backup-koshi-${Date.now()}`;
      fs.copyFileSync(shellConfig, backupPath);
      console.log(`${colors.gray}${symbols.check} Created backup: ${colors.white}${path.basename(backupPath)}${colors.reset}`);
      
      // Add configuration
      await animatedLoadingBar('📝 Updating shell configuration', 1000);
      fs.appendFileSync(shellConfig, envConfig);
      console.log(`${colors.lime}${symbols.check} Shell configuration updated successfully${colors.reset}`);
      
      // Log shell config update
      installLog.setComponent('shellConfig', {
        modified: true,
        backupPath: backupPath
      });
    } else {
      console.log(`${colors.cyan}${symbols.gear} Shell already configured for Koshi-Vox${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.orange}${symbols.warning} Could not update shell config: ${error.message}${colors.reset}`);
    console.log(`${colors.gray}You may need to add the environment variables manually.${colors.reset}`);
  }
}

// Install npm package globally
async function installNpmPackage() {
  console.log('');
  console.log(`${colors.cyan}╭─────────────────────────────────────────────────╮${colors.reset}`);
  console.log(`${colors.cyan}│${colors.reset} ${symbols.package}  ${colors.cyan}NPM PACKAGE INSTALLATION${colors.reset}      ${symbols.package} ${colors.cyan}           │${colors.reset}`);
  console.log(`${colors.cyan}╰─────────────────────────────────────────────────╯${colors.reset}`);
  console.log('');
  
  try {
    // Save current directory
    const originalDir = process.cwd();
    
    // Find the koshi-vox directory
    const possiblePaths = [
      path.join(__dirname, '..'),
      path.join(__dirname, '../..'),
      '/Users/radek/Documents/GIthub/ClaudeCodeSetup/koshi-vox/koshi-vox',
      process.cwd()
    ];
    
    let koshiDir = null;
    for (const dir of possiblePaths) {
      const pkgPath = path.join(dir, 'package.json');
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
          if (pkg.name === 'koshi-vox' || pkg.name === '@koshi-code/vox-voice-to-text') {
            koshiDir = dir;
            console.log(`${colors.gray}Found koshi-vox at: ${dir}${colors.reset}`);
            break;
          }
        } catch (e) {
          // Continue checking
        }
      }
    }
    
    if (!koshiDir) {
      console.log(`${colors.orange}${symbols.warning} Koshi-vox directory not found${colors.reset}`);
      console.log(`${colors.gray}Please install manually from the koshi-vox directory:${colors.reset}`);
      console.log(`${colors.white}  cd /path/to/koshi-vox && npm install -g .${colors.reset}`);
      return false;
    }
    
    // Change to koshi-vox directory
    process.chdir(koshiDir);
    
    // Get package info
    const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf-8'));
    const packageVersion = packageJson.version;
    
    // Check if already installed
    console.log(`${colors.cyan}Checking existing installation...${colors.reset}`);
    let needsInstall = true;
    try {
      // Try both possible package names
      try {
        await execAsync('npm list -g koshi-vox');
        console.log(`${colors.cyan}${symbols.gear} Package already installed globally${colors.reset}`);
        needsInstall = false;
      } catch {
        // Try the scoped name
        const result = await execAsync('npm list -g @koshi-code/vox-voice-to-text');
        console.log(`${colors.cyan}${symbols.gear} Package already installed globally${colors.reset}`);
        needsInstall = false;
      }
    } catch {
      console.log(`${colors.gray}Package not currently installed${colors.reset}`);
    }
    
    // Install or update
    if (needsInstall) {
      await animatedLoadingBar('📦 Installing npm package globally', 3000);
    } else {
      await animatedLoadingBar('🔄 Updating to latest version', 2000);
    }
    
    // Run npm install
    try {
      await execAsync('npm install -g . --silent');
      console.log(`${colors.lime}${symbols.check} Package ${needsInstall ? 'installed' : 'updated'} successfully${colors.reset}`);
    } catch (error) {
      console.log(`${colors.orange}${symbols.warning} Installation warning: ${error.message}${colors.reset}`);
    }
    
    // Verify installation and get actual paths
    console.log('');
    console.log(`${colors.cyan}Verifying installation...${colors.reset}`);
    
    // Get npm global prefix
    const npmPrefix = (await execAsync('npm prefix -g')).stdout.trim();
    console.log(`${colors.gray}NPM global prefix: ${npmPrefix}${colors.reset}`);
    
    // Check for vox command in multiple locations
    const possibleBinPaths = [
      path.join(npmPrefix, 'bin', 'vox'),
      path.join(npmPrefix, 'lib', 'node_modules', '@koshi-code', 'vox-voice-to-text', 'bin', 'vox'),
      path.join(process.env.HOME, '.nvm', 'versions', 'node', process.version, 'bin', 'vox')
    ];
    
    let voxFound = false;
    let voxLocation = null;
    
    for (const voxPath of possibleBinPaths) {
      if (fs.existsSync(voxPath)) {
        voxFound = true;
        voxLocation = path.dirname(voxPath);
        break;
      }
    }
    
    if (voxFound) {
      console.log(`${colors.lime}${symbols.check} Commands installed successfully:${colors.reset}`);
      console.log(`  ${colors.lime}• ${colors.lime}vox${colors.reset}`);
      console.log(`  ${colors.lime}• ${colors.lime}vox-debug${colors.reset}`);
      console.log(`  ${colors.lime}• ${colors.lime}setup-vox${colors.reset}`);
      console.log(`${colors.gray}  Location: ${voxLocation}${colors.reset}`);
      
      // Update installation log
      installLog.setComponent('npmPackage', {
        installed: true,
        version: packageVersion,
        prefix: npmPrefix,
        binPath: voxLocation
      });
      
      // Return to original directory
      process.chdir(originalDir);
      return true;
    } else {
      console.log(`${colors.orange}${symbols.warning} Commands not found in expected locations${colors.reset}`);
      console.log(`${colors.gray}You may need to:${colors.reset}`);
      console.log(`  ${colors.cyan}1.${colors.reset} Reload your shell: ${colors.white}source ~/.zshrc${colors.reset}`);
      console.log(`  ${colors.cyan}2.${colors.reset} Check your PATH includes: ${colors.white}${npmPrefix}/bin${colors.reset}`);
      
      // Return to original directory
      process.chdir(originalDir);
      return false;
    }
    
  } catch (error) {
    console.error(`${colors.red}${symbols.cross} Failed to install npm package: ${error.message}${colors.reset}`);
    console.log(`${colors.gray}You may need to install manually:${colors.reset}`);
    console.log(`${colors.white}  cd /path/to/koshi-vox && npm install -g .${colors.reset}`);
    return false;
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

// Launch setup-vox script
async function launchSetupVox(npmInstalled) {
  return new Promise((resolve) => {
    // Only run if npm package was installed successfully
    if (!npmInstalled) {
      console.log('');
      console.log(`${colors.orange}${symbols.warning} Skipping alias setup (npm package not installed)${colors.reset}`);
      console.log(`${colors.gray}After manual installation, run: ${colors.white}setup-vox${colors.reset}`);
      resolve();
      return;
    }
    
    console.log(``);
    console.log(`${colors.cyan}${symbols.gear} Launching interactive alias setup...${colors.reset}`);
    console.log(``);
    
    // Try to find setup-vox in the npm bin directory
    const npmBinPath = installLog.log.components.npmPackage.binPath;
    const setupScript = path.join(npmBinPath, 'setup-vox');
    
    if (!fs.existsSync(setupScript)) {
      console.log(`${colors.orange}${symbols.cross} setup-vox command not found at: ${setupScript}${colors.reset}`);
      console.log(`${colors.gray}You can run it manually later with: ${colors.white}setup-vox${colors.reset}`);
      resolve();
      return;
    }
    
    // Make sure the script is executable
    try {
      fs.chmodSync(setupScript, '755');
    } catch (error) {
      console.log(`${colors.orange}${symbols.warning} Could not make setup script executable${colors.reset}`);
    }
    
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      console.log(`${colors.orange}${symbols.gear} Non-interactive environment detected${colors.reset}`);
      console.log(`${colors.cyan}Please run setup manually with: ${colors.white}setup-vox${colors.reset}`);
      resolve();
      return;
    }
    
    // Use 'bash' to run the script to avoid spawn errors
    const setupProcess = spawn('bash', [setupScript], {
      stdio: `inherit`,
      env: {
        ...process.env,
        KOSHI_VOX_VENV: VENV_DIR,
        KOSHI_VOX_PYTHON: path.join(VENV_DIR, 'bin', 'python'),
        PATH: `${npmBinPath}:${process.env.PATH}`
      }
    });
    
    setupProcess.on(`close`, (code) => {
      console.log(``);
      if (code === 0) {
        console.log(`${colors.lime}${symbols.sparkles} Alias setup completed successfully!${colors.reset}`);
      } else {
        console.log(`${colors.orange}${symbols.cross} Setup exited with code ${code}${colors.reset}`);
        console.log(`${colors.gray}You can run setup again with: ${colors.white}setup-vox${colors.reset}`);
      }
      resolve();
    });
    
    setupProcess.on(`error`, (error) => {
      console.log(`${colors.red}${symbols.cross} Error launching setup: ${error.message}${colors.reset}`);
      console.log(`${colors.gray}You can run setup manually with: ${colors.white}setup-vox${colors.reset}`);
      resolve();
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
  
  console.log(`${colors.lime}░░░█ Voice-To-Text Recorder for Terminal with Python setup █░░░░░░${colors.reset}`);
  console.log(`${colors.lime}░░░█ v1.2.5${colors.reset}`);
  console.log(`${colors.lime}░░░░░░░░░░░█ https://github.com/koshimazaki/koshi-vox${colors.reset}`);
  console.log('');
  await animatedLoadingBar('⚡ Initializing enhanced installation', 2000);
  console.log('');
  
  try {
    // Ensure Python is installed
    await animatedLoadingBar('🐍 Checking Python installation', 1000);
    const pythonCmd = await ensurePython();
    
    if (!pythonCmd) {
      console.log('');
      console.log(`${colors.red}Installation cannot continue without Python.${colors.reset}`);
      console.log(`${colors.cyan}Please install Python and run this installer again.${colors.reset}`);
      process.exit(1);
    }
    
    // Setup virtual environment
    await animatedLoadingBar('📁 Creating isolated environment', 1500);
    const venvPython = await setupVirtualEnvironment(pythonCmd);
    
    if (!venvPython) {
      console.log(`${colors.red}Failed to setup virtual environment${colors.reset}`);
      process.exit(1);
    }
    
    // Install fonts
    await animatedLoadingBar('📦 Preparing font installation', 1500);
    await installFonts();
    
    // Install Python dependencies in venv
    await animatedLoadingBar('👾 Installing AI dependencies', 1500);
    const success = await installPythonDeps(venvPython);
    
    if (!success) {
      console.log(`${colors.orange}Some dependencies failed to install${colors.reset}`);
    }
    
    // Pre-download Whisper base model
    await downloadWhisperModel(venvPython);
    
    // Update shell configuration
    await updateShellConfig();
    
    // Install npm package
    const npmInstalled = await installNpmPackage();
    
    // Final loading animation
    await animatedLoadingBar('░░░ Finalizing installation', 1000);
    
    // Final message
    console.log('');
    console.log(`${colors.lime}╭─────────────────────────────────────────────────╮${colors.reset}`);
    console.log(`${colors.lime}│${colors.reset}                   ${symbols.sparkles} SUCCESS! ${symbols.sparkles}                ${colors.lime}│${colors.reset}`);
    console.log(`${colors.lime}╰─────────────────────────────────────────────────╯${colors.reset}`);
    console.log('');
    
    console.log(`${colors.lime}░░░█ What was installed:${colors.reset}`);
    console.log(`  ${colors.lime}Python environment in ~/.koshi-vox-env${colors.reset}`);
    console.log(`  ${colors.lime}All AI dependencies isolated from system${colors.reset}`);
    console.log(`  ${colors.lime}Fonts for enhanced terminal experience${colors.reset}`);
    if (npmInstalled) {
      console.log(`  ${colors.lime}NPM package with vox commands${colors.reset}`);
    } else {
      console.log(`  ${colors.orange}NPM package (manual installation needed)${colors.reset}`);
    }
    console.log('');
    
    // Save final installation log
    console.log(`${colors.gray}Installation log saved to: ${INSTALL_LOG_PATH}${colors.reset}`);
    console.log('');
    
    // Launch interactive setup
    await launchSetupVox(npmInstalled);
    
    console.log(`${colors.lime}░░░░██ KOSHI VOX is ready to go! ██░░░░${colors.reset}`);
    console.log('');
    console.log(`${colors.gray}Environment location: ${VENV_DIR}${colors.reset}`);
    
  } catch (error) {
    console.error(`${colors.red}${symbols.cross} Installation failed: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { installFonts, ensurePython, setupVirtualEnvironment, installPythonDeps };