import onnxruntime as ort
import numpy as np
import time

def test_model():
    model_path = "models/behavior_autoencoder_v1.onnx"
    print(f"Loading ONNX Model from: {model_path} ...")
    
    # Initialize the ONNX Runtime session
    session = ort.InferenceSession(model_path)
    
    # Get the input name required by the ONNX model
    input_name = session.get_inputs()[0].name
    
    # Create a dummy tensor that matches the PyTorch trace: (Batch=1, Seq=60, Features=6)
    # Using float32 as that is the standard precision for ONNX ML outputs
    dummy_input = np.random.randn(1, 60, 6).astype(np.float32)
    
    print(f"Running Inference on tensor of shape {dummy_input.shape}...")
    
    start_time = time.time()
    
    # Run the session
    outputs = session.run(None, {input_name: dummy_input})
    
    end_time = time.time()
    
    reconstructed_output = outputs[0]
    
    print("=========================================")
    print("ONNX INFERENCE SUCCESSFUL! \u2705")
    print(f"Output Shape: {reconstructed_output.shape}")
    print(f"Inference Latency: {(end_time - start_time) * 1000:.2f} ms")
    print("=========================================")

if __name__ == '__main__':
    test_model()
