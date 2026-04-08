FROM n8nio/n8n:latest

USER root

# Make common libraries available inside n8n Code nodes.
RUN mkdir -p /opt/n8n-external && \
    cd /opt/n8n-external && \
    npm init -y && \
    npm install --omit=dev axios lodash dayjs moment uuid zod cheerio openai @voiddb/orm

# Install bundled private community nodes outside the mounted n8n home directory.
RUN mkdir -p /opt/n8n-custom/node_modules/@lowkey
COPY custom/n8n-nodes-lowkey /opt/n8n-custom/node_modules/@lowkey/n8n-nodes-lowkey
RUN cd /opt/n8n-custom/node_modules/@lowkey/n8n-nodes-lowkey && \
    npm install --omit=dev && \
    chown -R node:node /opt/n8n-external /opt/n8n-custom

ENV NODE_PATH=/opt/n8n-external/node_modules \
    N8N_CUSTOM_EXTENSIONS=/opt/n8n-custom/node_modules

USER node
