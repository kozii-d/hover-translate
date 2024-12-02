import { state } from "./variables.js";

let userPausedVideo = false;

export function handleVideoPause() {
  
  if (state.settings.autoPause === false) return;
  
  const video = document.querySelector("video");

  if (!video) return;

  userPausedVideo = video.paused;
  if (!userPausedVideo) {
    video.pause();
  }
}

export function handleVideoPlay() {
  if (state.settings.autoPause === false) return;
  
  const video = document.querySelector("video");

  if (!video) return;

  if (!userPausedVideo) {
    video.play();
  }
}