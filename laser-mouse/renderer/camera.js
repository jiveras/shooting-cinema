// Webcam in, frames out on a canvas.
//
// The camera is drawn onto the canvas every frame. Anything that wants to
// look at the pixels (the laser detection) registers an onFrame callback and
// gets the canvas 2D context, width and height.

(function () {
  class LaserCamera {
    constructor(video, canvas) {
      this.video = video;
      this.canvas = canvas;
      // willReadFrequently: we read the pixels on every frame.
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.stream = null;
      this.running = false;
      this.frameHandlers = [];
      this.fps = 0;
      this._frameCount = 0;
      this._fpsStamp = performance.now();
      this._loop = this._loop.bind(this);
    }

    /** Lists video inputs. The names only show once camera permission is granted. */
    static async listCameras() {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter((d) => d.kind === 'videoinput');
    }

    onFrame(handler) {
      this.frameHandlers.push(handler);
    }

    async start({ deviceId, width, height } = {}) {
      this.stop();

      const video = {
        width: { ideal: width || 1280 },
        height: { ideal: height || 720 },
        frameRate: { ideal: 60 },
      };
      if (deviceId) video.deviceId = { exact: deviceId };

      this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      this.video.srcObject = this.stream;
      await this.video.play();

      this.canvas.width = this.video.videoWidth;
      this.canvas.height = this.video.videoHeight;

      this.running = true;
      this._frameCount = 0;
      this._fpsStamp = performance.now();
      this._scheduleNext();

      const settings = this.stream.getVideoTracks()[0].getSettings();
      return {
        deviceId: settings.deviceId,
        width: this.video.videoWidth,
        height: this.video.videoHeight,
        frameRate: settings.frameRate,
      };
    }

    /** What the camera lets you adjust (exposure etc.). */
    capabilities() {
      const track = this.stream?.getVideoTracks()[0];
      return track && track.getCapabilities ? track.getCapabilities() : {};
    }

    settings() {
      const track = this.stream?.getVideoTracks()[0];
      return track ? track.getSettings() : {};
    }

    async apply(constraints) {
      const track = this.stream?.getVideoTracks()[0];
      if (!track) return;
      await track.applyConstraints({ advanced: [constraints] });
    }

    stop() {
      this.running = false;
      if (this.stream) {
        this.stream.getTracks().forEach((t) => t.stop());
        this.stream = null;
      }
      this.video.srcObject = null;
    }

    _scheduleNext() {
      if (!this.running) return;
      // requestVideoFrameCallback fires exactly when the camera has delivered a new
      // frame – better than requestAnimationFrame, which runs at the display rate.
      if ('requestVideoFrameCallback' in this.video) {
        this.video.requestVideoFrameCallback(this._loop);
      } else {
        requestAnimationFrame(this._loop);
      }
    }

    _loop() {
      if (!this.running) return;

      const { width, height } = this.canvas;
      this.ctx.drawImage(this.video, 0, 0, width, height);

      for (const handler of this.frameHandlers) {
        handler(this.ctx, width, height);
      }

      this._frameCount++;
      const now = performance.now();
      if (now - this._fpsStamp >= 1000) {
        this.fps = (this._frameCount * 1000) / (now - this._fpsStamp);
        this._frameCount = 0;
        this._fpsStamp = now;
      }

      this._scheduleNext();
    }
  }

  window.LaserCamera = LaserCamera;
})();
