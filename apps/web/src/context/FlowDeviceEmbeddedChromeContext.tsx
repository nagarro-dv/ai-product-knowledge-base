import { createContext, useContext, type ReactNode, type RefObject } from "react";

type FlowDeviceEmbeddedChromeContextValue = {
  embedded: boolean;
  stageRef: RefObject<HTMLDivElement | null>;
};

const defaultRef: RefObject<HTMLDivElement | null> = { current: null };

const FlowDeviceEmbeddedChromeContext = createContext<FlowDeviceEmbeddedChromeContextValue>({
  embedded: false,
  stageRef: defaultRef,
});

export function FlowDeviceEmbeddedChromeProvider({
  children,
  stageRef,
}: {
  children: ReactNode;
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  return (
    <FlowDeviceEmbeddedChromeContext.Provider value={{ embedded: true, stageRef }}>
      {children}
    </FlowDeviceEmbeddedChromeContext.Provider>
  );
}

export function useFlowDeviceEmbeddedChrome(): boolean {
  return useContext(FlowDeviceEmbeddedChromeContext).embedded;
}

export function useFlowDeviceStageRef(): RefObject<HTMLDivElement | null> {
  return useContext(FlowDeviceEmbeddedChromeContext).stageRef;
}
