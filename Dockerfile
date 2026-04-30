FROM php:8.2-cli

WORKDIR /var/www/html

RUN docker-php-ext-install mysqli

COPY . /var/www/html

EXPOSE 8000

CMD ["php", "-S", "0.0.0.0:8000", "-t", "/var/www/html"]
