# AI语音转字幕

## 安装程序包

1. 安装 python
2. 安装模块 torch faster-whisper
3. 安装 cuda

## libcudnn_ops没找到

手动找一下，把路径填进配置

```bash
find / |grep libcudnn_ops 
```

## Cuda 安装

```
curl "https://developer.download.nvidia.com/compute/cuda/repos/ubuntu2204/x86_64/cuda-keyring_1.0-1_all.deb" -o cuda.deb
dpkg -i cuda.deb && rm cuda.deb

#Install CUDA 12 runtime and development packages along with libcudnn and libcublas
apt-get update -y
apt-get install -y --no-install-recommends cuda-cudart-12-0 cuda-nvcc-12-0 cuda-nvrtc-12-0 libcudnn8 libcublas-12-0 
```