```bash
██╗  ██╗ ██████╗ ███████╗██╗  ██╗██╗    ██╗   ██╗ ██████╗ ██╗  ██╗
██║ ██╔╝██╔═══██╗██╔════╝██║  ██║██║    ██║   ██║██╔═══██╗╚██╗██╔╝
█████╔╝ ██║   ██║███████╗███████║██║    ██║   ██║██║   ██║ ╚███╔╝ 
██╔═██╗ ██║   ██║╚════██║██╔══██║██║    ╚██╗ ██╔╝██║   ██║ ██╔██╗ 
██║  ██╗╚██████╔╝███████║██║  ██║██║     ╚████╔╝ ╚██████╔╝██╔╝ ██╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝      ╚═══╝   ╚═════╝ ╚═╝  ╚═╝
░░░█ Voice-To-Text Recorder for Terminal - optimized for MacOS █░░░
░░ v1.2.6
```
Voice-To-Text Recorder for Terminal - optimized for MacOS and M series Macs for Claude Code workflow. 
Record voice, get instant transcription, and paste directly into your coding sessions.

## Features

- **Instant Voice Recording**: Press SPACE or ENTER to stop
- **Fast M1-4 Transcription**: Optimized for Apple Silicon
- **Automatic Clipboard**: Text ready to paste with Cmd+V
- **Isolated Python Environment**: Zero system dependencies conflicts
- **Smart Uninstaller**: Complete removal with installation tracking
- **Customizable Alias**: Choose your preferred command name
- **Auto-Cleanup**: Keeps only 5 most recent recordings

## Installation

`npx koshi-vox@latest`

## Dependencies 
Script Installs 
- faster-whisper
- soundfile
- librosa
- fastapi
- uvicorn
- nerdfonts
 
### From Local Directory (Current Method)

```bash
# Clone/navigate to the vox directory
cd path/to/koshi-vox/

# Install globally from local directory
npm install -g .

# Set up your voice alias
setup-vox

# To uninstall run

uninstall-vox
```


## Structure 
```
koshi-vox/
  ├── bin/              # Executables
  │   ├── koshi-vox
  │   ├── vox
  │   └── vox-debug
  ├── scripts/          # Setup tools
  │   ├── install.js
  │   ├── setup-vox-alias
  │   └── uninstall_koshi-vox
  ├── lib/              # Helpers
  │   ├── install-deps
  │   └── install-fonts
  └── sounds/           # Audio files
```
## Requirements

- **Node.js** 20+ (for npm)
- **Python 3** with packages:
  ```bash
  pip install faster-whisper soundfile
  ```
- **Audio Recording** (macOS: sox or ffmpeg, Linux: alsa-utils)
  ```bash
  # macOS
  brew install sox
  
  # Linux
  sudo apt install alsa-utils xclip
  ```

## Usage

```bash
# Use your custom alias (set during setup)
vox

# Or use any alias you configured
my-voice-cmd

# Debug mode for troubleshooting
vox-debug

# Check recording files (auto-cleanup keeps 5 most recent)
vox-cleanup

# Remove all recording files
vox-cleanup --all
```

### Recording Workflow
1. Type your voice command (`vox`)
2. Speak your message
3. Press **SPACE** or **ENTER** when done
4. Text appears and is copied to clipboard
5. Paste into Claude Code with **Cmd+V**

## Configuration

### Change Your Alias
```bash
# Default alias (vox)
setup-vox

# Custom alias
setup-vox myvoice
```

### Troubleshooting
```bash
# Check if installed correctly
npm list -g @koshi-code/koshi-vox

# Reinstall if needed
npm uninstall -g @koshi-code/koshi-vox
npm install -g .

# Debug recording issues
vox-debug
```

## System Requirements

- **macOS**: Monterey+ recommended (M1-4 optimized)
- **Linux**: Ubuntu 20.04+ or equivalent
- **Microphone**: System microphone permissions required

## Changelog

### v1.2.6
- **Fixed**: VS Code terminal support - now correctly uses virtual environment Python
- **Fixed**: Python dependency resolution in isolated environments
- **Added**: Version update script for maintaining version parity across files

### v1.2.5
- Initial public release

---

**Part of the Koshi-Code ecosystem** - Premium development tools for Claude Code workflows.
