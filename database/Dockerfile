FROM python:3.12-slim

WORKDIR /app
COPY clickhouse_sink.py .

RUN pip install kafka-python clickhouse-driver

CMD ["python", "-u", "clickhouse_sink.py"]
