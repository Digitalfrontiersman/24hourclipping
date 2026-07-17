# Postgres backup sidecar: pg_dump on a schedule, gzip, ship off-host to S3.
# Uses the postgres image so pg_dump matches the server major version exactly.
FROM postgres:16

RUN apt-get update \
 && apt-get install -y --no-install-recommends awscli ca-certificates \
 && rm -rf /var/lib/apt/lists/*

COPY backup.sh /usr/local/bin/backup.sh
RUN chmod +x /usr/local/bin/backup.sh

# Never run as root - this container only needs to read the DB and write /backups.
USER postgres

CMD ["/usr/local/bin/backup.sh"]
