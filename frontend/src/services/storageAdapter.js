// MOCK FILE STORAGE ADAPTER — simulates uploads with progress. Replace with S3/GCS later.
export const storageAdapter = {
  upload(file, onProgress) {
    return new Promise((resolve) => {
      let pct = 0;
      const tick = setInterval(() => {
        pct = Math.min(100, pct + 8 + Math.random() * 14);
        onProgress(Math.floor(pct));
        if (pct >= 100) {
          clearInterval(tick);
          resolve({ name: file.name, size: file.size, url: URL.createObjectURL(file) });
        }
      }, 180);
    });
  },
};
