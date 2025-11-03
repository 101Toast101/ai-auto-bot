# Local AI Video Generation Setup

This guide explains how to set up free local AI video generation models in the app.

## Prerequisites

You need **Python 3.8+** installed on your system:
- Windows: Download from [python.org](https://www.python.org/downloads/)
- Mac: `brew install python3`
- Linux: `sudo apt install python3 python3-pip`

## Installation Steps

### 1. Install Python Dependencies

Open a terminal/command prompt and run:

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118
pip install diffusers transformers accelerate
```

**Note:** The above command installs PyTorch with CUDA 11.8 support (for NVIDIA GPUs). If you don't have an NVIDIA GPU or want CPU-only:

```bash
pip install torch torchvision torchaudio
pip install diffusers transformers accelerate
```

### 2. Disk Space Requirements

The models will be downloaded automatically on first use:

- **Zeroscope V2**: ~7 GB
- **ModelScope**: ~5 GB  
- **Stable Video Diffusion**: ~10 GB

Total: ~22 GB

Models are cached in:
- Windows: `C:\Users\YourName\.cache\huggingface\`
- Mac/Linux: `~/.cache/huggingface/`

### 3. Test Installation

Run the test script:

```bash
python scripts/local_video_generator.py --model zeroscope --prompt "A cat playing piano" --output test.mp4 --duration 3
```

If successful, you'll see a `test.mp4` file generated.

## Available Models

### Zeroscope V2 (Good Quality)
- **Resolution**: 576x320 (16:9)
- **Duration**: Up to 5 seconds
- **Speed**: ~3 minutes (GPU) / ~15 minutes (CPU)
- **Best for**: General purpose videos

### ModelScope (Fair Quality)
- **Resolution**: 256x256 (1:1)
- **Duration**: Up to 3 seconds
- **Speed**: ~2 minutes (GPU) / ~10 minutes (CPU)
- **Best for**: Quick tests, lower quality needs

### Stable Video Diffusion (High Quality)
- **Resolution**: 1024x576 (16:9)
- **Duration**: Up to 5 seconds
- **Speed**: ~4 minutes (GPU) / ~20 minutes (CPU)
- **Best for**: Best quality output

## GPU vs CPU

**With NVIDIA GPU (Recommended):**
- 10-20x faster generation
- Requires 8GB+ VRAM
- Install CUDA-enabled PyTorch (see step 1)

**CPU Only:**
- Slower but works on any computer
- Requires 16GB+ RAM
- No special setup needed

## Troubleshooting

### "Python not found"
Add Python to your system PATH:
- Windows: During install, check "Add Python to PATH"
- Mac/Linux: Should be automatic

### "CUDA out of memory"
- Close other applications
- Reduce video duration
- Use ModelScope (lower resolution)
- Switch to CPU mode

### "No module named 'diffusers'"
Run: `pip install diffusers transformers accelerate`

### Models downloading slowly
First run downloads models from Hugging Face:
- Zeroscope: 7 GB download
- Be patient, it's a one-time download

## Usage in App

1. Go to **Generate** tab
2. Select **Video Mode**
3. Choose one of the FREE providers:
   - Zeroscope V2 (Good Quality)
   - ModelScope (Fair Quality)
   - Stable Video Diffusion (High Quality)
4. Enter your prompt
5. Click **Generate Video**

**First generation will be slow** as models download. Subsequent generations are faster.

## Uninstalling

To remove models and free up disk space:

```bash
# Windows
rmdir /s "%USERPROFILE%\.cache\huggingface"

# Mac/Linux
rm -rf ~/.cache/huggingface
```

To uninstall Python packages:

```bash
pip uninstall torch torchvision torchaudio diffusers transformers accelerate
```

## Comparison: Free vs Paid

| Feature | Free Local Models | Paid APIs (Runway/Luma) |
|---------|-------------------|-------------------------|
| Cost | $0 (electricity only) | $0.30-$0.50 per video |
| Quality | Good to High | Professional |
| Speed | 2-4 minutes | 30-120 seconds |
| Setup | Requires Python install | Just API key |
| Internet | Only for first download | Required every time |
| Limits | None (unlimited) | Pay per video |

## Need Help?

- Check Python is installed: `python --version`
- Check pip is working: `pip --version`
- Check GPU available: `python -c "import torch; print(torch.cuda.is_available())"`

For more help, see the main README.md or open an issue on GitHub.
