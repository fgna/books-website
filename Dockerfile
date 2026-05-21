FROM nginx:alpine

COPY app.jsx          /usr/share/nginx/html/
COPY data.jsx         /usr/share/nginx/html/
COPY i18n.jsx         /usr/share/nginx/html/
COPY index.html       /usr/share/nginx/html/
COPY mobile-app.jsx   /usr/share/nginx/html/
COPY mobile.html      /usr/share/nginx/html/
COPY tweaks-panel.jsx /usr/share/nginx/html/
COPY views.jsx        /usr/share/nginx/html/

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80
ENTRYPOINT ["/entrypoint.sh"]
