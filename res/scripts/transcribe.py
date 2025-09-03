#!/usr/bin/env python3
from faster_whisper import WhisperModel
import torch
import sys

model_size = "large-v3-turbo"

device = "cuda" if torch.cuda.is_available() else "cpu"
torch_dtype = "float16" if torch.cuda.is_available() else "int8"
print("Using device: %s, dtype: %s" % (device, torch_dtype))
# Run on GPU with FP16
model = WhisperModel(model_size, device=device, compute_type=torch_dtype)

# or run on GPU with INT8
# model = WhisperModel(model_size, device="cuda", compute_type="int8_float16")
# or run on CPU with INT8
# model = WhisperModel(model_size, device="cpu", compute_type="int8")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("使用方法: python transcribe.py <音频文件路径>")
        print("示例: python transcribe.py audio.wav")
        sys.exit(1)
    
    audio_file = sys.argv[1]
    
    segments, info = model.transcribe(audio_file, beam_size=5)
    
    print("Detected language '%s' with probability %f" % (info.language, info.language_probability))
    
    for segment in segments:
        print("[%.2fs -> %.2fs] %s" % (segment.start, segment.end, segment.text))