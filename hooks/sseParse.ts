export function parseSseChunks(onFrame: (f: { event: string; data: string }) => void) {
  let buf = "";
  return {
    feed(chunk: string) {
      buf += chunk;
      let idx: number;
      while ((idx = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        let event = "";
        const dataLines: string[] = [];
        for (const line of raw.split("\n")) {
          if (line.startsWith("event:")) event = line.slice(6).trim();
          else if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
        }
        if (event && dataLines.length) onFrame({ event, data: dataLines.join("\n") });
      }
    },
  };
}
