import { VIDEO_PLAYER } from "../consts/consts.ts";
import { state } from "../state/stateManager.ts";

/**
 * Auto-pause while the pointer is over the captions.
 *
 * The only state kept between events is the claim below: "we paused this video
 * and still owe the viewer a resume". Settling it on `pointerleave` alone is not
 * enough, because that event is not guaranteed to arrive — YouTube replaces the
 * caption window under the cursor as the line changes, and going fullscreen
 * swallows the boundary events too. A claim left standing made the next
 * `pointerleave` resume a video the viewer had paused by hand.
 */
export class VideoController {
  private claimedVideo: HTMLVideoElement | null = null;

  public handleVideoPause = (event: Event): void => {
    if (!state.settings.autoPause) return;

    const video = this.getVideoElement(event);
    if (!video || video.paused) return;

    video.pause();
    this.claimVideo(video);
  };

  public handleVideoPlay = (): void => {
    // Deliberately not gated on `autoPause`: the claim can only exist because
    // the setting was on when we paused, and turning it off mid-hover must not
    // leave the viewer with a video we stopped and never handed back.
    const video = this.claimedVideo;
    if (!video) return;

    this.releaseClaim();

    // Autoplay policies can refuse this, and there is nothing to recover.
    video.play().catch(() => {
      /* the browser declined to resume */
    });
  };

  /**
   * Releases the listener this controller leaves on the video it paused.
   */
  public destroy(): void {
    this.releaseClaim();
  }

  private claimVideo(video: HTMLVideoElement): void {
    this.releaseClaim();
    this.claimedVideo = video;
    video.addEventListener("play", this.handleExternalPlay);
  }

  private releaseClaim(): void {
    this.claimedVideo?.removeEventListener("play", this.handleExternalPlay);
    this.claimedVideo = null;
  }

  /**
   * The video started playing again without us. Whoever did it — the viewer, the
   * player's own controls — the debt is settled, so a later `pointerleave` must
   * not resume a video they have since paused on purpose.
   */
  private handleExternalPlay = (): void => {
    this.releaseClaim();
  };

  /**
   * The video of the player these captions belong to.
   *
   * `document.querySelector("video")` returns the first video in the document,
   * which is not necessarily the one being watched: YouTube keeps the
   * miniplayer and the inline preview a hovered thumbnail starts alive at the
   * same time. The caption window sits inside its own player, so walking up from
   * the event target picks the right one; the document-wide lookup stays as a
   * fallback in case that markup changes.
   */
  private getVideoElement(event: Event): HTMLVideoElement | null {
    const target = event.currentTarget;
    const player =
      target instanceof Element ? target.closest(`.${VIDEO_PLAYER}`) : null;

    return player?.querySelector("video") ?? document.querySelector("video");
  }
}
