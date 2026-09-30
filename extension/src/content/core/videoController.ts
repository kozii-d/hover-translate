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

  /**
   * The pointer entering and leaving a caption window. With a mouse button
   * held they neither pause nor resume: the viewer is dragging the captions,
   * or passing over them on the way somewhere else. Each step of a drag moves
   * the window from under the pointer, and resuming on that `pointerleave`
   * started the video for an instant on every step — or, in a drag and drop,
   * which sends no `pointerenter` until it ends, for the whole drag.
   */
  public handleCaptionPointerEnter = (event: Event): void => {
    if ((event as PointerEvent).buttons) return;
    this.pauseVideo(this.getVideoElement(event));
  };

  public handleCaptionPointerLeave = (event: Event): void => {
    if ((event as PointerEvent).buttons) return;
    this.handleVideoPlay();
  };

  /**
   * Auto-pause for our own interface outside the player — the rating card —
   * which cannot find the video from where it sits and is given it instead.
   * Resumed by `handleVideoPlay`, like a pause over the captions: it is the
   * same claim.
   */
  public pauseVideo(video: HTMLVideoElement | null): void {
    if (!state.settings.autoPause) return;
    if (!video || video.paused) return;

    video.pause();
    this.claimVideo(video);
  }

  /**
   * Pauses `video` and gives up the claim without resuming it: the viewer is
   * leaving for another tab on purpose and should find the video where it
   * was, not playing on in the background after the pointer "left".
   */
  public keepPaused(video: HTMLVideoElement): void {
    this.releaseClaim();
    video.pause();
  }

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
   *
   * The event comes a task after the `play()` that caused it. When the video
   * is paused again by then, it is not playing and the claim still stands —
   * the event is our own: a `pointerleave` resumed the video right before a
   * `pointerenter` paused and claimed it again, as when the pointer crosses
   * from one caption window straight into another. Dragging the captions
   * makes no such pair: with a button held, neither event touches the video
   * (see `handleCaptionPointerEnter`).
   */
  private handleExternalPlay = (): void => {
    if (this.claimedVideo?.paused) return;
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
