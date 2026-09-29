# Image locale MinIO (D-61). Docker Hub ne publie plus minio/minio ni minio/mc.
# Les binaires viennent des releases GitHub, vérifiés par SHA-256. linux-amd64 seulement.
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates curl \
  && rm -rf /var/lib/apt/lists/*

ARG MINIO_VERSION=RELEASE.2025-09-07T16-13-09Z
ARG MINIO_SHA256=7c5bd8512c6e966455b1d198209358b2d191c77a83ab377c4073281065fb855f
ARG MC_VERSION=RELEASE.2025-08-13T08-35-41Z
ARG MC_SHA256=01f866e9c5f9b87c2b09116fa5d7c06695b106242d829a8bb32990c00312e891

RUN curl -fsSL -o /usr/local/bin/minio \
      "https://github.com/minio/minio/releases/download/${MINIO_VERSION}/minio.linux-amd64.${MINIO_VERSION}" \
    && echo "${MINIO_SHA256}  /usr/local/bin/minio" | sha256sum -c - \
    && chmod +x /usr/local/bin/minio \
    && curl -fsSL -o /usr/local/bin/mc \
      "https://github.com/minio/mc/releases/download/${MC_VERSION}/mc.linux-amd64.${MC_VERSION}" \
    && echo "${MC_SHA256}  /usr/local/bin/mc" | sha256sum -c - \
    && chmod +x /usr/local/bin/mc

EXPOSE 9000 9001
ENTRYPOINT ["minio"]
CMD ["server", "/data"]
