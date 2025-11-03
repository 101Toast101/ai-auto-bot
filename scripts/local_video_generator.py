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

def generate_zeroscope(prompt, output_path, duration=3, width=576, height=320):
    """Generate video using Zeroscope V2"""
    from diffusers import DiffusionPipeline
    import torch

    print(f"Loading Zeroscope V2 model...", file=sys.stderr)

    pipe = DiffusionPipeline.from_pretrained(
        "cerspense/zeroscope_v2_576w",
        torch_dtype=torch.float16
    )

    # Use GPU if available
    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipe = pipe.to(device)

    print(f"Generating video (device: {device})...", file=sys.stderr)

    # Generate video frames
    video_frames = pipe(
        prompt,
        num_frames=duration * 8,  # 8 fps
        height=height,
        width=width,
        num_inference_steps=40,
    ).frames

    # Export video
    from diffusers.utils import export_to_video
    export_to_video(video_frames, output_path, fps=8)

    return output_path

def generate_modelscope(prompt, output_path, duration=2, width=256, height=256):
    """Generate video using ModelScope"""
    from diffusers import DiffusionPipeline
    import torch

    print(f"Loading ModelScope model...", file=sys.stderr)

    pipe = DiffusionPipeline.from_pretrained(
        "damo-vilab/text-to-video-ms-1.7b",
        torch_dtype=torch.float16,
        variant="fp16"
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pipe = pipe.to(device)
    pipe.enable_model_cpu_offload()

    print(f"Generating video (device: {device})...", file=sys.stderr)

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

    # First generate an image with Stable Diffusion
    from diffusers import StableDiffusionPipeline

    image_pipe = StableDiffusionPipeline.from_pretrained(
        "stabilityai/stable-diffusion-2-1",
        torch_dtype=torch.float16
    )

    device = "cuda" if torch.cuda.is_available() else "cpu"
    image_pipe = image_pipe.to(device)

    print(f"Generating initial image...", file=sys.stderr)
    image = image_pipe(prompt).images[0]
    image = image.resize((width, height))

    # Now convert to video
    print(f"Converting to video...", file=sys.stderr)

    video_pipe = StableVideoDiffusionPipeline.from_pretrained(
        "stabilityai/stable-video-diffusion-img2vid-xt",
        torch_dtype=torch.float16,
        variant="fp16"
    )
    video_pipe = video_pipe.to(device)
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
            output_path = generate_zeroscope(args.prompt, args.output, args.duration, args.width, args.height)
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
