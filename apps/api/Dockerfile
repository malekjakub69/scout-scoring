# 1. Build fáze
FROM hexpm/elixir:1.16.2-erlang-26.2.3-debian-bookworm-20240130-slim AS build

RUN apt-get update -y && apt-get install -y build-essential git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN mix local.hex --force && mix local.rebar --force

ENV MIX_ENV="prod"

COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mix deps.compile

COPY config config
COPY lib lib
COPY priv priv

RUN mix compile
RUN mix release

# 2. Runtime fáze
FROM debian:bookworm-slim

RUN apt-get update -y && \
    apt-get install -y libstdc++6 openssl ca-certificates locales \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN sed -i '/en_US.UTF-8/s/^# //' /etc/locale.gen && locale-gen
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

WORKDIR /app
RUN chown nobody /app

# NAHRAĎ "api" názvem své aplikace, pokud se jmenuje jinak
COPY --from=build --chown=nobody:root /app/_build/prod/rel/api ./

USER nobody

# Příkaz pro spuštění (změň "api" na jméno aplikace)
CMD ["/app/bin/api", "start"]
