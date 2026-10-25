function captureKumoVideoFrame(sourceId, platformId, descriptors = []) {
  let scope = document;
  if (platformId === 'x') {
    scope = [...document.querySelectorAll('article[data-testid="tweet"]')].find(article => [...article.querySelectorAll('time')].some(time => (time.closest('a')?.getAttribute('href') || '').match(/\/status\/(\d+)/)?.[1] === sourceId));
  } else if (platformId === 'xiaohongshu') scope = document.querySelector('#noteContainer');
  const video = [...(scope?.querySelectorAll('video') || [])].find(item => item.getBoundingClientRect().width > 0 && descriptors.some(descriptor => descriptor.url === (item.currentSrc || item.src) || (descriptor.poster && descriptor.poster === item.poster)));
  if (!video) return {frameStatus: 'unavailable', frameError: 'video_frame_not_loaded'};
  const context = {positionSeconds: Number(video.currentTime || 0), durationSeconds: Number.isFinite(video.duration) ? video.duration : null, capturedAt: new Date().toISOString()};
  if (!video.videoWidth || !video.videoHeight) return {...context, frameStatus: 'unavailable', frameError: 'video_frame_not_loaded'};
  try {
    const canvas = document.createElement('canvas');
    const ratio = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * ratio);
    canvas.height = Math.round(video.videoHeight * ratio);
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    return {...context, frameStatus: 'saved', dataUrl: canvas.toDataURL('image/jpeg', .82)};
  } catch (error) {
    return {...context, frameStatus: 'unavailable', frameError: error.name || 'frame_capture_failed'};
  }
}
