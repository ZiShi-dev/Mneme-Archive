import { useCallback, useState } from "react";

/** Un seul panneau réglages ouvert à la fois (évite les sheets empilées). */
export function useSettingsPanel() {
  const [activePanel, setActivePanel] = useState(null);

  const isOpen = useCallback((id) => activePanel === id, [activePanel]);
  const open = useCallback((id) => setActivePanel(id), []);
  const close = useCallback(() => setActivePanel(null), []);

  return { activePanel, isOpen, open, close };
}
