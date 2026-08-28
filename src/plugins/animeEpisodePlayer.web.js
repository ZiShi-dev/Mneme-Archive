export class AnimeEpisodePlayerWeb {
  async open() {
    return { openedExternally: false, blocked: true };
  }

  async close() {
    return {};
  }

  async loadUrl() {
    return { blocked: true };
  }

  async isOpen() {
    return { open: false };
  }
}
