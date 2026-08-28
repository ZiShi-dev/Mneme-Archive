# Image de build Android (Java 21 + SDK) — séparée de l'émulateur
FROM eclipse-temurin:21-jdk-jammy

ENV ANDROID_HOME=/opt/android-sdk
ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

RUN apt-get update -qq \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq wget unzip ca-certificates \
  && rm -rf /var/lib/apt/lists/*

RUN mkdir -p ${ANDROID_HOME}/cmdline-tools \
  && wget -q https://dl.google.com/android/repository/commandlinetools-linux-11076708_latest.zip -O /tmp/cmdline-tools.zip \
  && unzip -q /tmp/cmdline-tools.zip -d ${ANDROID_HOME}/cmdline-tools \
  && mv ${ANDROID_HOME}/cmdline-tools/cmdline-tools ${ANDROID_HOME}/cmdline-tools/latest \
  && rm /tmp/cmdline-tools.zip

RUN yes | sdkmanager --licenses >/dev/null \
  && sdkmanager \
    "platform-tools" \
    "platforms;android-36" \
    "build-tools;36.0.0" \
    "build-tools;35.0.0"

WORKDIR /workspace
