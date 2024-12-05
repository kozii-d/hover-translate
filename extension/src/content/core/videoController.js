export class VideoController {
  constructor(state) {
    this.state = state;
    this.userPausedVideo = false;
    this.wasPausedByScript = false;
  }

  handleVideoPause = () => {
    if (this.state.settings.autoPause === false) return;

    const video = document.querySelector("video");

    if (!video) return;

    this.userPausedVideo = video.paused;
    if (!this.userPausedVideo) {
      video.pause();
      this.wasPausedByScript = true;
    }
  }

  handleVideoPlay = () => {
    if (this.state.settings.autoPause === false) return;

    const video = document.querySelector("video");

    if (!video) return;

    if (this.wasPausedByScript) {
      video.play();
      this.wasPausedByScript = false;
    }
  }
}