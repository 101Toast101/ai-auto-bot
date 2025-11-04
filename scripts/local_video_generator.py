#!/usr/bin/env python3
"""
Local AI Video Generation Script
Supports: Zeroscope V2, ModelScope, Stable Video Diffusion
Usage: python local_video_generator.py --model <model> --prompt "<prompt>" --output <path>
"""

import argparse
import sys
import os
import json
from pathlib import Path

def check_dependencies():
    """Check if required packages are installed"""
    missing = []

    try:
        import torch
    except ImportError:
        missing.append('torch')

    try:
        import diffusers
    except ImportError:
        missing.append('diffusers')

    try:
        import transformers
    except ImportError:
        missing.append('transformers')

    try:
        import accelerate
    except ImportError:
        missing.append('accelerate')

    if missing:
        return False, missing

    return True, []

def get_gpu_settings():
    """Detect GPU and return optimal settings"""
    try:
        import torch

        if not torch.cuda.is_available():
            return {
                'device': 'cpu',
                'dtype': 'float32',
                'steps': 15,
                'vram_gb': 0,
                'quality': 'low',
                'est_time_min': 15
            }

        # Get GPU info
        vram_gb = torch.cuda.get_device_properties(0).total_memory / (1024**3)
        gpu_name = torch.cuda.get_device_name(0)

        print(f"Detected: {gpu_name} with {vram_gb:.1f}GB VRAM", file=sys.stderr, flush=True)

        # Preset configurations based on VRAM
        if vram_gb >= 12:  # RTX 3060 12GB, RTX 4070+
            return {
                'device': 'cuda',
                'dtype': 'float16',
                'steps': 50,
                'vram_gb': vram_gb,
                'quality': 'high',
                'est_time_min': 3,
                'enable_xformers': True
            }
        elif vram_gb >= 8:  # RTX 3070, RTX 4060
            return {
                'device': 'cuda',
                'dtype': 'float16',
                'steps': 30,
                'vram_gb': vram_gb,
                'quality': 'medium',
                'est_time_min': 5,
                'enable_xformers': False
            }
        else:  # RTX 2060, RTX 3050 (6GB or less)
            return {
                'device': 'cuda',
                'dtype': 'float16',
                'steps': 20,
                'vram_gb': vram_gb,
                'quality': 'fast',
                'est_time_min': 20,
                'enable_xformers': False
            }
    except Exception as e:
        print(f"Error detecting GPU: {e}", file=sys.stderr)
        return {
            'device': 'cpu',
            'dtype': 'float32',
            'steps': 15,
            'vram_gb': 0,
            'quality': 'low',
            'est_time_min': 15
        }

def generate_zeroscope(prompt, output_path, duration=3, width=576, height=320, quality_override=None, custom_steps=None):
    """Generate video using Zeroscope V2"""
    from diffusers import DiffusionPipeline
    import torch

    print(f"Loading Zeroscope V2 model...", file=sys.stderr)

    # Get optimal settings for detected GPU
    gpu_settings = get_gpu_settings()

    device = gpu_settings['device']
    dtype = torch.float16 if gpu_settings['dtype'] == 'float16' else torch.float32

    # Determine inference steps (priority: custom > quality preset > auto-detected)
    if custom_steps:
        inference_steps = custom_steps
        print(f"Using custom steps: {inference_steps}", file=sys.stderr, flush=True)
    elif quality_override:
        quality_map = {'potato': 2, 'ultra-low': 5, 'low': 10, 'fast': 20, 'medium': 30, 'high': 50}
        inference_steps = quality_map.get(quality_override, gpu_settings['steps'])
    else:
        inference_steps = gpu_settings['steps']

    pipe = DiffusionPipeline.from_pretrained(
        "cerspense/zeroscope_v2_576w",
        torch_dtype=dtype
    )
    pipe = pipe.to(device)

    # Enable memory optimizations for all GPUs
    if device == "cuda":
        pipe.enable_attention_slicing()
        pipe.enable_vae_slicing()

    # Calculate accurate time estimate based on actual steps (RTX 2060 ~65 sec/step)
    est_time_min = int((inference_steps * 65) / 60) + 1  # Add 1 min buffer for model loading

    print(f"Generating video (device: {device}, dtype: {dtype})...", file=sys.stderr, flush=True)
    print(f"Quality: {gpu_settings['quality'].upper()} ({inference_steps} steps, est. {est_time_min} min)", file=sys.stderr, flush=True)

    print(f"Progress: 0% | Step 0/{inference_steps} - Starting...", file=sys.stderr, flush=True)

    # Progress callback to show real-time updates
    def progress_callback(step, timestep, latents):
        percent = int(((step + 1) / inference_steps) * 100)
        print(f"Progress: {percent}% | Step {step + 1}/{inference_steps}", file=sys.stderr, flush=True)

    # Generate video frames
    video_frames = pipe(
        prompt,
        num_frames=duration * 8,  # 8 fps
        height=height,
        width=width,
        num_inference_steps=inference_steps,
        callback=progress_callback,
        callback_steps=1,
    ).frames

    # Export video
    print(f"Exporting video to {output_path}...", file=sys.stderr, flush=True)
    
    try:
        # Try using imageio backend first (preferred)
        from diffusers.utils import export_to_video
        export_to_video(video_frames[0], output_path, fps=8)
        print(f"Video saved successfully!", file=sys.stderr, flush=True)
    except Exception as export_error:
        # Fallback: Manual export using OpenCV
        print(f"Imageio export failed, trying OpenCV fallback: {export_error}", file=sys.stderr, flush=True)
        import cv2
        import numpy as np
        
        # Get frame dimensions
        first_frame = video_frames[0][0]
        height, width = first_frame.shape[:2]
        
        # Initialize video writer
        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, 8, (width, height))
        
        # Write frames
        for frame in video_frames[0]:
            # Convert from RGB to BGR for OpenCV
            frame_bgr = cv2.cvtColor(np.array(frame), cv2.COLOR_RGB2BGR)
            out.write(frame_bgr)
        
        out.release()
        print(f"Video saved successfully using OpenCV!", file=sys.stderr, flush=True)

    return output_path

def generate_modelscope(prompt, output_path, duration=2, width=256, height=256):
    """Generate video using ModelScope"""
    from diffusers import DiffusionPipeline
    import torch

    print(f"Loading ModelScope model...", file=sys.stderr)

    # Use GPU if available, otherwise CPU with float32
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    kwargs = {"torch_dtype": dtype}
    if torch.cuda.is_available():
        kwargs["variant"] = "fp16"

    pipe = DiffusionPipeline.from_pretrained(
        "damo-vilab/text-to-video-ms-1.7b",
        **kwargs
    )
    pipe = pipe.to(device)

    if device == "cuda":
        pipe.enable_model_cpu_offload()

    print(f"Generating video (device: {device}, dtype: {dtype})...", file=sys.stderr)

    video_frames = pipe(
        prompt,
        num_inference_steps=25,
        num_frames=duration * 8,
    ).frames

    from diffusers.utils import export_to_video
    export_to_video(video_frames, output_path, fps=8)

    return output_path

def generate_stable_video(prompt, output_path, duration=4, width=1024, height=576):
    """Generate video using Stable Video Diffusion"""
    from diffusers import StableVideoDiffusionPipeline
    from diffusers.utils import load_image, export_to_video
    import torch

    print(f"Loading Stable Video Diffusion model...", file=sys.stderr)

    # Use GPU if available, otherwise CPU with float32
    device = "cuda" if torch.cuda.is_available() else "cpu"
    dtype = torch.float16 if torch.cuda.is_available() else torch.float32

    # First generate an image with Stable Diffusion
    from diffusers import StableDiffusionPipeline

    image_pipe = StableDiffusionPipeline.from_pretrained(
        "stabilityai/stable-diffusion-2-1",
        torch_dtype=dtype
    )
    image_pipe = image_pipe.to(device)

    print(f"Generating initial image (device: {device}, dtype: {dtype})...", file=sys.stderr)
    image = image_pipe(prompt).images[0]
    image = image.resize((width, height))

    # Now convert to video
    print(f"Converting to video...", file=sys.stderr)

    kwargs = {"torch_dtype": dtype}
    if torch.cuda.is_available():
        kwargs["variant"] = "fp16"

    video_pipe = StableVideoDiffusionPipeline.from_pretrained(
        "stabilityai/stable-video-diffusion-img2vid-xt",
        **kwargs
    )
    video_pipe = video_pipe.to(device)

    if device == "cuda":
        video_pipe.enable_model_cpu_offload()

    frames = video_pipe(
        image,
        decode_chunk_size=8,
        num_frames=duration * 6,  # 6 fps
    ).frames[0]

    export_to_video(frames, output_path, fps=6)

    return output_path

def main():
    parser = argparse.ArgumentParser(description='Generate AI videos locally')
    parser.add_argument('--model', required=True, choices=['zeroscope', 'modelscope', 'stable-diffusion-video'])
    parser.add_argument('--prompt', required=True, help='Text prompt for video generation')
    parser.add_argument('--output', required=True, help='Output video file path')
    parser.add_argument('--duration', type=int, default=3, help='Video duration in seconds')
    parser.add_argument('--width', type=int, default=576, help='Video width')
    parser.add_argument('--height', type=int, default=320, help='Video height')
    parser.add_argument('--quality', choices=['potato', 'ultra-low', 'low', 'fast', 'medium', 'high', 'custom'],
                       help='Quality preset (overrides auto-detection): potato=2 steps, ultra-low=5, low=10, fast=20, medium=30, high=50')
    parser.add_argument('--steps', type=int,
                       help='Custom number of inference steps (2-100). Overrides quality preset.')

    args = parser.parse_args()

    # Check dependencies
    deps_ok, missing = check_dependencies()
    if not deps_ok:
        result = {
            'success': False,
            'error': f'Missing dependencies: {", ".join(missing)}. Install with: pip install {" ".join(missing)}'
        }
        print(json.dumps(result))
        sys.exit(1)

    try:
        # Create output directory if needed
        os.makedirs(os.path.dirname(args.output), exist_ok=True)

        # Generate based on model
        if args.model == 'zeroscope':
            output_path = generate_zeroscope(args.prompt, args.output, args.duration, args.width, args.height, args.quality, args.steps)
        elif args.model == 'modelscope':
            output_path = generate_modelscope(args.prompt, args.output, args.duration, args.width, args.height)
        elif args.model == 'stable-diffusion-video':
            output_path = generate_stable_video(args.prompt, args.output, args.duration, args.width, args.height)

        # Return success
        result = {
            'success': True,
            'videoPath': output_path
        }
        print(json.dumps(result))

    except Exception as e:
        result = {
            'success': False,
            'error': str(e)
        }
        print(json.dumps(result))
        sys.exit(1)

if __name__ == '__main__':
    main()
