
export async function playRawPcm(data: Uint8Array, sampleRate: number = 24000) {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate });
  const numChannels = 1;
  
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }

  const source = ctx.createBufferSource();
  source.buffer = buffer;
  source.connect(ctx.destination);
  source.start();
  
  return new Promise((resolve) => {
    source.onended = () => {
      ctx.close();
      resolve(true);
    };
  });
}
