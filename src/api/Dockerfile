FROM python:3.14-slim

WORKDIR /app

# Copia o uv do container oficial
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Instala dependências com cache de camada
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copia código-fonte
COPY . .

EXPOSE 8000

CMD ["uv", "run", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
