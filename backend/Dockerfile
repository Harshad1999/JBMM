FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Cloud Run injects $PORT; default to 8080 for local testing.
ENV PORT=8080
EXPOSE 8080

CMD exec gunicorn server:app -k uvicorn.workers.UvicornWorker -b 0.0.0.0:${PORT} --workers 2 --timeout 60
