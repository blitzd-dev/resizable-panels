import { createContext, useContext } from "react";

/**
 * Scene components call this when the visitor takes the wheel — opening a
 * file, typing in the terminal, messaging the agent. HomeDemo provides it
 * and pauses autoplay so the script doesn't fight the user.
 */
export const SceneEngagementContext = createContext<() => void>(() => {});

export const useSceneEngage = () => useContext(SceneEngagementContext);
