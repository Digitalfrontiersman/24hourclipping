FROM python:3.11-slim

WORKDIR /app

# Install core dependencies (fast, PyPI-only). To enable the AI concierge,
# build with: --build-arg REQUIREMENTS=requirements.txt
ARG REQUIREMENTS=requirements-core.txt
COPY requirements-core.txt requirements.txt* ./
RUN pip install --no-cache-dir -r ${REQUIREMENTS}

COPY . .

EXPOSE 8001
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001"]
