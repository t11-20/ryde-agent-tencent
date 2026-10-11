FROM node:22.23.3-bookworm
RUN npm install --global npm@10.9.9 @tencent-ai/codebuddy-code@2.153.0 \
    && apt-get update \
    && apt-get install --yes --no-install-recommends git openssh-server ca-certificates \
    && apt-get clean
ENV LANG=C.UTF-8
WORKDIR /workspace
