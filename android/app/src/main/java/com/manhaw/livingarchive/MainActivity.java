package com.manhaw.livingarchive;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(ImmersiveModePlugin.class);
        registerPlugin(MangalikHtmlFetcherPlugin.class);
        registerPlugin(ParadiseChapterFetcherPlugin.class);
        registerPlugin(AnimeEpisodePlayerPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
