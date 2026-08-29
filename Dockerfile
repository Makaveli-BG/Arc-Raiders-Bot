FROM node:22-bullseye-slim

# Install system dependencies including Tesseract OCR & fonts for image scanning
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-eng \
    libtesseract-dev \
    libleptonica-dev \
    git \
    curl \
    ca-certificates \
    ffmpeg \
    build-essential \
    python3 \
    iproute2 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Add container user (standard Pterodactyl container user UID 988)
RUN useradd -d /home/container -m container

USER container
ENV USER=container HOME=/home/container
WORKDIR /home/container

COPY ./entrypoint.sh /entrypoint.sh

CMD [ "/bin/bash", "/entrypoint.sh" ]
