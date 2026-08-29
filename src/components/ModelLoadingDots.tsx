import { useEffect, useState } from "react";

const DOT_CYCLE_MS = 400;

export function ModelLoadingDots() {
  const [dotCount, setDotCount] = useState(1);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setDotCount((count) => (count >= 3 ? 1 : count + 1));
    }, DOT_CYCLE_MS);

    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <span className="inline-block w-[3ch] text-muted-foreground" aria-label="Loading">
      {".".repeat(dotCount)}
    </span>
  );
}

export default ModelLoadingDots;
