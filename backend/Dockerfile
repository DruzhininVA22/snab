FROM public.ecr.aws/docker/library/python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y build-essential libpq-dev && rm -rf /var/lib/apt/lists/*

# контекст сборки уже ./backend, поэтому копируем без префикса "backend/"
COPY requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# копируем весь код бэкенда в образ
COPY . /app
