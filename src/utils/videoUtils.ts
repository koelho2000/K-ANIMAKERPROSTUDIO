export const captureFrameAtTime = async (videoUrl: string, time: number): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.src = videoUrl;
    video.currentTime = time;
    video.muted = true;
    
    video.onseeked = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.9));
      } else {
        reject(new Error('Failed to get canvas context'));
      }
    };
    
    video.onerror = (e) => {
      reject(new Error('Error loading video for frame capture'));
    };
  });
};
