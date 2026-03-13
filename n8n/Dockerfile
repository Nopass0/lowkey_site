FROM n8nio/n8n:latest

USER root

# Make common libraries available inside n8n Code nodes.
RUN cd /usr/local/lib/node_modules/n8n && npm install --omit=dev axios lodash dayjs moment uuid zod cheerio

USER node
