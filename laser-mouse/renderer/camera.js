// Etapp 1: webbkameran in, bildrutor ut på en canvas.
//
// Kameran ritas på canvasen varje bildruta. Den som vill titta på
// pixlarna (etapp 2: laserdetektering) registrerar en onFrame-callback
// och får canvasens 2D-kontext, bredd och höjd.

(function () {
  class LaserCamera {
    constructor(video, canvas) {
      this.video = video;
      this.canvas = canvas;
      // willReadFrequently: vi kommer läsa pixlar varje bildruta i etapp 2.
      this.ctx = canvas.getContext('2d', { willReadFrequently: true });
      this.stream = null;
      this.running = false;
      this.frameHandlers = [];
      this.fps = 0;
      this._frameCount = 0;
      this._fpsStamp = performance.now();
      this._loop = this._loop.bind(this);
    }

    /** Listar videoingångar. Namnen syns först när kameratillstånd givits. */
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

    /** Vad kameran tillåter att man ställer in (exponering m.m.). */
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
      // requestVideoFrameCallback triggar exakt när kameran levererat en ny
      // bildruta – bättre än requestAnimationFrame som kör i skärmens takt.
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
