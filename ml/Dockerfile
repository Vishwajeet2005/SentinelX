FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY inference_engine.py .

# Expected ONNX models volume
RUN mkdir -p models

# Industry standard: run as non-root user
RUN useradd -m sentinx && chown -R sentinx:sentinx /app
USER sentinx

CMD ["python", "inference_engine.py"]
