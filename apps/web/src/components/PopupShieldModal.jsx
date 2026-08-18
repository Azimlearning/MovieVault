import { useEffect } from "react";
import { CloseIcon, ShieldBlockIcon } from "./Icons";

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

          <ul className="shield-modal__list">
            <li>
              MovieVault&apos;s own buttons — the clusters in the top corners —
              are outside the provider&apos;s frame and never open ads.
            </li>
            <li>
              A content blocker in your browser stops these at the network
              layer, which a web page cannot do for itself.
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
