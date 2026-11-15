# Browser VS Code (code-server) with everything the Jaiz lab needs:
# .NET 10 SDK, Docker CLI + Compose plugin, curl and socat.
FROM codercom/code-server:4.99.4

USER root

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl gnupg socat jq libicu72 \
 && install -m 0755 -d /etc/apt/keyrings \
 && curl -fsSL https://download.docker.com/linux/debian/gpg -o /etc/apt/keyrings/docker.asc \
 && echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/debian $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
      > /etc/apt/sources.list.d/docker.list \
 && apt-get update \
 && apt-get install -y --no-install-recommends docker-ce-cli docker-compose-plugin \
 && rm -rf /var/lib/apt/lists/*

# .NET 10 SDK
ENV DOTNET_ROOT=/usr/share/dotnet \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1
RUN curl -fsSL https://dot.net/v1/dotnet-install.sh -o /tmp/dotnet-install.sh \
 && bash /tmp/dotnet-install.sh --channel 10.0 --install-dir /usr/share/dotnet \
 && ln -s /usr/share/dotnet/dotnet /usr/local/bin/dotnet \
 && rm /tmp/dotnet-install.sh

COPY lab-ports /usr/local/bin/lab-ports
COPY code /usr/local/bin/code
COPY entrypoint.sh /usr/local/bin/lab-entrypoint.sh
COPY settings.json /home/coder/.local/share/code-server/User/settings.json
RUN chmod +x /usr/local/bin/lab-ports /usr/local/bin/code /usr/local/bin/lab-entrypoint.sh \
 && chown -R coder:coder /home/coder/.local

USER coder
ENTRYPOINT ["/usr/local/bin/lab-entrypoint.sh"]
