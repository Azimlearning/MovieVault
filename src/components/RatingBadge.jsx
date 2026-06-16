import { RatingShieldIcon, RatingLockIcon } from "./Icons";

export default function RatingBadge({ cert, restricted }) {
  const displayCert = cert && cert.trim() !== "" ? cert : "NR";

  return (
    <div
      className={`age-rating-pill${restricted ? " age-rating-pill--restricted" : ""}`}
    >
      {restricted ? (
        <RatingLockIcon size={13} />
      ) : (
        <RatingShieldIcon size={13} />
      )}
      <span className="age-rating-pill-cert">{displayCert}</span>
      {restricted && (
        <span className="age-rating-pill-label">
          Inappropriate for your age setting
        </span>
      )}
    </div>
  );
}
