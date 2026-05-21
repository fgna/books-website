#!/bin/sh
set -e

LANG="${LIB_LANG:-en}"

if [ -z "${LIB_NAME}" ]; then
  if [ "$LANG" = "de" ]; then
    NAME="die Bibliothek"
  else
    NAME="the Library"
  fi
else
  NAME="${LIB_NAME}"
fi

cat > /usr/share/nginx/html/config.js <<CONFEOF
window.LIB_CONFIG = {
  lang: '${LANG}',
  name: '${NAME}',
};
CONFEOF

exec nginx -g 'daemon off;'
