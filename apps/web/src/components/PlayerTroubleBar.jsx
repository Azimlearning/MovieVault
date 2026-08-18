import { useEffect, useState } from "react";
import {
  REACHABILITY,
  diagnosisMessage,
  probeReachable,
} from "../utils/sourceHealth";

// A recoverable failure path for embedded providers.
//
// The parent page cannot see whether a cross-origin provider actually started
// playing, so this never claims the video is broken. It waits out the normal
// start-up window and then offers a way forward — next source, new tab, or
// dismiss — alongside a probe-backed explanation of what went wrong. Doing
// nothing keeps watching; that is the point (teardown §6.9: a failed player
// must offer recovery, not a dead end).
//
// Callers pass `key={url}` so each new source or episode gets a fresh offer
// rather than this component resetting its own state on every prop change.
export default function PlayerTroubleBar({
  sourceLabel,
  url,
  canTryNext = true,
  onTryNext,
  delayMs = 11000,
}) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reachability, setReachability] = useState(REACHABILITY.UNKNOWN);

  useEffect(() => {
    if (!url) return undefined;
    const timer = setTimeout(() => setVisible(true), delayMs);
    return () => clearTimeout(timer);
  }, [url, delayMs]);

  // Probe only once the offer is on screen, so a working player costs nothing.
  useEffect(() => {
    if (!visible || dismissed || !url) return undefined;
    let active = true;
    probeReachable(url).then((result) => {
      if (active) setReachability(result);
    });
    return () => {
      active = false;
    };
  }, [visible, dismissed, url]);

  if (!visible || dismissed) return null;

  return (
    <div className={`player-trouble${expanded ? " player-trouble--open" : ""}`}>
      {!expanded ? (
        <button
          type="button"
          className="player-trouble__pill"
          onClick={() => setExpanded(true)}
        >
          Not playing?
        </button>
      ) : (
        <div className="player-trouble__card">
          <p className="player-trouble__text">
            {diagnosisMessage(reachability, sourceLabel)}
          </p>
          <div className="player-trouble__actions">
            {canTryNext && (
              <button
                type="button"
                className="player-trouble__btn player-trouble__btn--primary"
                onClick={() => {
                  setDismissed(true);
                  onTryNext?.();
                }}
              >
                Try another source
              </button>
            )}
            {url && (
              <a
                className="player-trouble__btn"
                href={url}
                target="_blank"
                rel="noreferrer noopener"
                onClick={() => setDismissed(true)}
              >
                Open in new tab
              </a>
            )}
            <button
              type="button"
              className="player-trouble__btn player-trouble__btn--ghost"
              onClick={() => setDismissed(true)}
            >
              It's fine
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
