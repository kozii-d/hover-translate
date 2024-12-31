import { state } from "../state/stateManager.ts";

export class VideoController {
  private userPausedVideo = false;
  private wasPausedByScript = false;

  public handleVideoPause = () => {
    if (!state.settings.autoPause) return;

    const video = this.getVideoElement();

    if (!video) return;

    this.userPausedVideo = video.paused;
    if (!this.userPausedVideo) {
      video.pause();
      this.wasPausedByScript = true;
    }
  };

  public handleVideoPlay = () => {
    if (!state.settings.autoPause) return;

    const video = this.getVideoElement();

    if (!video) return;

    if (this.wasPausedByScript) {
      video.play();
      this.wasPausedByScript = false;
    }
  };

  private getVideoElement(): HTMLVideoElement | null {
    return document.querySelector("video");
  }
}