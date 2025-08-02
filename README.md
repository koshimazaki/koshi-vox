```bash
██╗  ██╗ ██████╗ ███████╗██╗  ██╗██╗    ██╗   ██╗ ██████╗ ██╗  ██╗
██║ ██╔╝██╔═══██╗██╔════╝██║  ██║██║    ██║   ██║██╔═══██╗╚██╗██╔╝
█████╔╝ ██║   ██║███████╗███████║██║    ██║   ██║██║   ██║ ╚███╔╝ 
██╔═██╗ ██║   ██║╚════██║██╔══██║██║    ╚██╗ ██╔╝██║   ██║ ██╔██╗ 
██║  ██╗╚██████╔╝███████║██║  ██║██║     ╚████╔╝ ╚██████╔╝██╔╝ ██╗
╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝      ╚═══╝   ╚═════╝ ╚═╝  ╚═╝
░░░█ Voice-To-Text Recorder for Terminal - optimized for MacOS █░░░
░░ v1.1.8
```
Voice-To-Text Recorder for Terminal - optimized for MacOS and M series Macs for Claude Code workflow. 
Record voice, get instant transcription, and paste directly into your coding sessions.

## Features

- **Instant Voice Recording**: Press SPACE or ENTER to stop
- **Fast M1-4 Transcription**: Optimized for Apple Silicon
- **Automatic Clipboard**: Text ready to paste with Cmd+V
- **Customizable Alias**: Choose your preferred command name
- **Premium UX**: Beautiful terminal interface with proper fonts

## Installation

`npx koshi-vox@latest`
 
### From Local Directory (Current Method)

```bash
# Clone/navigate to the vox directory
cd path/to/koshi-vox/

# Install globally from local directory
npm install -g .

# Set up your voice alias
setup-vox
```

### Future: From NPM Registry

```bash
# Once published (coming soon)
npm install -g @koshi-code/koshi-vox
setup-vox
```

## Requirements

- **Node.js** 14+ (for npm)
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
setup-vox my-new-alias
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

---

**Part of the Koshi-Code ecosystem** - Premium development tools for Claude Code workflows.
