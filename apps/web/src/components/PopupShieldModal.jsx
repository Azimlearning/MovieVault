import { useEffect, useMemo, useState } from "react";
import { CloseIcon, ShieldBlockIcon } from "./Icons";
import {
  BLOCKER,
  blockerAdvice,
  detectContentBlocker,
} from "../utils/adBlockDetect";

/**
 * The browser build's answer to "why do I still get ads when I click the
 * player?".
 *
 * The desktop app blocks ad requests at the network layer, so there it shows a
 * count of what it stopped. A browser tab cannot do that, and the blocked-stats
 * modal it used to open always read zero — a promise the web build cannot keep.
 * This states the actual mechanism instead, and offers the one lever that
 * genuinely exists.
 */
export default function PopupShieldModal({
  sourceLabel = "This source",
  sourceProtected,
  shieldOn,
  onToggleShield,
  onClose,
}) {
  // Detection runs when the panel opens, never on page load: it costs one
  // request and nobody should pay it for a screen they did not ask for.
  const [blocker, setBlocker] = useState(BLOCKER.UNKNOWN);
  const advice = useMemo(() => blockerAdvice(), []);

  useEffect(() => {
    let active = true;
    detectContentBlocker().then((result) => {
      if (active) setBlocker(result);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="blocked-modal-overlay" onClick={onClose}>
      <div className="blocked-modal" onClick={(e) => e.stopPropagation()}>
        <div className="blocked-modal-header">
          <div className="blocked-modal-title">
            <ShieldBlockIcon size={15} />
            Pop-up ads
          </div>
          <button
            className="blocked-modal-close"
            onClick={onClose}
            title="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="shield-modal__body">
          <div
            className={`shield-status${sourceProtected ? " shield-status--on" : " shield-status--off"}`}
          >
            {sourceProtected
              ? `${sourceLabel} runs in a sandboxed frame, so the browser blocks its pop-ups.`
              : `${sourceLabel} refuses to run sandboxed, so its pop-ups are not blocked.`}
          </div>

          <p className="shield-modal__text">
            The play, seek and volume buttons at the bottom of the video are not
            MovieVault&apos;s — they belong to the provider, inside their own
            frame. A click there is a click on their page, and their page opens
            an ad tab with it. Pop-up blockers do not stop this: a window opened
            during a real click is allowed by every browser, which is exactly
            what the ad script is using.
          </p>

          <p className="shield-modal__text">
            The only lever a page has over another site&apos;s frame is the
            iframe sandbox, and a sandboxed frame cannot open windows at all.
            The catch is that the providers which allow sandboxing are the ones
            that most often fail to play.
          </p>

          <label className="shield-toggle">
            <input
              type="checkbox"
              checked={!!shieldOn}
              onChange={onToggleShield}
            />
            <span>
              <strong>Pop-up Shield</strong>
              <span className="shield-toggle__hint">
                Only use sources that accept a sandbox. Pop-ups stop; some
                titles will not play.
              </span>
            </span>
          </label>

          <div className="shield-blocker">
            <div className="shield-blocker__head">
              <span
                className={`shield-dot${blocker === BLOCKER.ACTIVE ? " shield-dot--on" : blocker === BLOCKER.ABSENT ? " shield-dot--off" : ""}`}
              />
              <strong>
                {blocker === BLOCKER.ACTIVE
                  ? "Content blocker detected"
                  : blocker === BLOCKER.ABSENT
                    ? "No content blocker detected"
                    : "Checking for a content blocker…"}
              </strong>
            </div>

            {blocker === BLOCKER.ACTIVE && (
              <p className="shield-modal__text">
                Requests are being blocked before they leave your browser, which
                is the strongest protection available here. Anything still
                getting through was opened by your own click inside the
                provider&apos;s frame — only the sandbox above stops those.
              </p>
            )}

            {blocker === BLOCKER.ABSENT && (
              <>
                <p className="shield-modal__text">
                  A blocker works at the network layer, which is the one place
                  these ads can be stopped without breaking playback. MovieVault
                  cannot do this for you: a web page has no say over requests
                  another site&apos;s frame makes.
                  {advice.note ? ` ${advice.note}` : ""}
                </p>
                <div className="shield-blocker__links">
                  {advice.links.map((link) => (
                    <a
                      key={link.url}
                      className="shield-blocker__link"
                      href={link.url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      {link.label}
                    </a>
                  ))}
                </div>
                <p className="shield-modal__fineprint">
                  Avoid DNS-level blockers for this: they can also blackhole the
                  streaming providers themselves, which shows up as
                  &ldquo;can&apos;t be reached&rdquo; on a black player.
                </p>
              </>
            )}
          </div>

          <ul className="shield-modal__list">
            <li>
              MovieVault&apos;s own buttons — the clusters in the top corners —
              are outside the provider&apos;s frame and never open ads.
            </li>
            <li>
              The desktop app blocks ad and tracker requests directly and
              reports what it stopped.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
