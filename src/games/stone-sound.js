/** 使用短促的木质共振合成落子声，无需下载音频。 */
export function createStoneSound() {
  let context;
  return {
    unlock() {
      context ??= new AudioContext();
      if (context.state === "suspended")
        context
          .resume()
          .catch((error) => console.error("落子音效启动失败", error));
    },
    play() {
      if (!context || context.state !== "running") return;
      const now = context.currentTime;
      for (const [frequency, volume] of [
        [720, 0.16],
        [1180, 0.07],
        [1900, 0.025],
      ]) {
        const oscillator = context.createOscillator();
        const gain = context.createGain();
        oscillator.frequency.setValueAtTime(frequency, now);
        oscillator.frequency.exponentialRampToValueAtTime(
          frequency * 0.7,
          now + 0.08,
        );
        gain.gain.setValueAtTime(volume, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
        oscillator.connect(gain).connect(context.destination);
        oscillator.start(now);
        oscillator.stop(now + 0.1);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
    },
    destroy() {
      if (context)
        context.close().catch((error) => console.error("音频关闭失败", error));
    },
  };
}
