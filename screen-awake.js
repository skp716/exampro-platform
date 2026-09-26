/* Screen Wake Lock
   Keeps the screen awake only while an examination is active.
*/

(function () {
  "use strict";

  let wanted = false;
  let wakeLock = null;
  let retryTimer = null;
  let pendingRequest = null;
  let generation = 0;

  async function acquire() {
    if (!wanted) return;

    if (document.visibilityState !== "visible") {
      return;
    }

    if (!("wakeLock" in navigator)) {
      console.warn("Screen Wake Lock API is not supported.");
      return;
    }

    if (wakeLock && !wakeLock.released) {
      return;
    }

    if (pendingRequest) {
      return pendingRequest;
    }

    const currentGeneration = generation;

    pendingRequest = (async () => {
      try {
        const lock = await navigator.wakeLock.request("screen");

        if (
          !wanted ||
          currentGeneration !== generation ||
          document.visibilityState !== "visible"
        ) {
          await lock.release().catch(() => {});
          return;
        }

        wakeLock = lock;

        lock.addEventListener("release", () => {
          if (wakeLock !== lock) return;

          wakeLock = null;

          if (!wanted) return;

          clearTimeout(retryTimer);

          retryTimer = setTimeout(() => {
            acquire();
          }, 1000);
        });

        console.log("Screen Wake Lock activated.");
      } catch (error) {
        console.warn(
          "Screen Wake Lock request failed:",
          error?.name || "",
          error?.message || error
        );

        if (wanted) {
          clearTimeout(retryTimer);

          retryTimer = setTimeout(() => {
            acquire();
          }, 5000);
        }
      } finally {
        pendingRequest = null;
      }
    })();

    return pendingRequest;
  }

  function start() {
    wanted = true;
    generation++;

    clearTimeout(retryTimer);

    return acquire();
  }

  function stop() {
    wanted = false;
    generation++;

    clearTimeout(retryTimer);

    const lock = wakeLock;
    wakeLock = null;

    if (lock && !lock.released) {
      lock.release().catch(() => {});
    }

    console.log("Screen Wake Lock released.");
  }

  document.addEventListener("visibilitychange", () => {
    if (wanted && document.visibilityState === "visible") {
      acquire();
    }
  });

  window.addEventListener("focus", () => {
    if (wanted) {
      acquire();
    }
  });

  window.ExamScreenAwake = {
    start,
    stop,
    ensure: acquire
  };
})();
