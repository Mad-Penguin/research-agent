// src/utils/spinner.ts
let timer: ReturnType<typeof setInterval> | null = null;

export function startSpinner(label = "Working on it") {
  if (!process.stdout.isTTY) {
    process.stdout.write(`${label}...\n`);
    return () => {};
  }
  const frames = ["⠋","⠙","⠹","⠸","⠼","⠴","⠦","⠧","⠇","⠏"];
  let i = 0;
  process.stdout.write(" "); 
  timer = setInterval(() => {
    const frame = frames[i = (i + 1) % frames.length];
    process.stdout.write(`\r${frame} ${label}...`);
  }, 80);

  return (finalMsg = "Done.") => {
    if (timer) {
      clearInterval(timer);
      timer = null;
      process.stdout.write(`\r${finalMsg}\n`);
    }
  };
}
