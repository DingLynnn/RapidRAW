# Bundled AI Models

Place optional bundled AI model files in this directory to avoid first-run downloads.
At runtime, MonoRin first checks the user model cache, then this bundled resource
directory, and only downloads a model if neither location has a valid file.

Expected filenames:

- `sam_vit_b_01ec64_encoder.onnx`
- `sam_vit_b_01ec64_decoder.onnx`
- `u2net.onnx`
- `skyseg_u2net.onnx`
- `depth_anything_v2_vits.onnx`
- `lama_fp16.onnx`
- `nind_denoise_utnet_684.onnx`
- `clip_model.onnx`
- `clip_tokenizer.json`

These files are already included by the existing Tauri `resources` bundle entry.
