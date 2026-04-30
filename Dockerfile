# syntax=docker/dockerfile:1
FROM php:8.2-cli

ARG REPO_URL="https://github.com/Orville610/padel.git"
ARG REPO_BRANCH="main"

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends git ca-certificates \
    && docker-php-ext-install mysqli \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth=1 --branch "${REPO_BRANCH}" "${REPO_URL}" /tmp/padel \
    && cp -a /tmp/padel/. /var/www/html \
    && rm -rf /tmp/padel /var/www/html/.git

RUN <<'EOF'
set -eu
cat > /usr/local/bin/init-table.php <<'PHP'
<?php
$host = getenv('DB_HOST') ?: 'mysql';
$port = (int) (getenv('DB_PORT') ?: 3306);
$user = getenv('DB_USER') ?: 'padel';
$pass = getenv('DB_PASS') ?: (getenv('DB_PASSWORD') ?: 'padel_password');
$name = getenv('DB_NAME') ?: 'db_pemesanan';
$deadline = time() + 90;

mysqli_report(MYSQLI_REPORT_OFF);

do {
    $koneksi = @new mysqli($host, $user, $pass, $name, $port);
    if (!$koneksi->connect_error) {
        $sql = file_get_contents('/var/www/html/table.sql');
        if ($sql !== false && trim($sql) !== '') {
            if (!$koneksi->multi_query($sql)) {
                fwrite(STDERR, 'Gagal membuat tabel: ' . $koneksi->error . PHP_EOL);
                exit(1);
            }

            while ($koneksi->more_results() && $koneksi->next_result()) {
            }
        }

        echo 'Database siap.' . PHP_EOL;
        exit(0);
    }

    sleep(2);
} while (time() < $deadline);

fwrite(STDERR, 'Database tidak siap: ' . $koneksi->connect_error . PHP_EOL);
exit(1);
PHP

cat > /usr/local/bin/start-padel <<'SH'
#!/bin/sh
set -e
php /usr/local/bin/init-table.php
exec php -S 0.0.0.0:8000 -t /var/www/html
SH

chmod +x /usr/local/bin/start-padel
EOF

EXPOSE 8000

CMD ["start-padel"]
