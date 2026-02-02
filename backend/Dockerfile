
FROM python:3.10-slim

WORKDIR /app

COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose the port
EXPOSE 8000

# Command to run the application
# Use shell form to allow variable expansion for $PORT
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
