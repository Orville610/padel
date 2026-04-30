FROM php:8.2-cli

WORKDIR /var/www/html

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && docker-php-ext-install mysqli \
    && rm -rf /var/lib/apt/lists/*

COPY . /var/www/html

RUN <<'EOS'
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

$lastError = 'unknown';
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

    $lastError = $koneksi->connect_error;
    sleep(2);
} while (time() < $deadline);

fwrite(STDERR, 'Database tidak siap: ' . $lastError . PHP_EOL);
exit(1);
PHP

cat > /usr/local/bin/start-padel <<'SH'
#!/bin/sh
set -e
php /usr/local/bin/init-table.php
exec php -S 0.0.0.0:8000 -t /var/www/html
SH

chmod +x /usr/local/bin/start-padel
EOS

EXPOSE 8000

CMD ["start-padel"]
