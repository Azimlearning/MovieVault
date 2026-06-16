import { memo } from "react";

const Skeleton = memo(function Skeleton({
  width,
  height,
  variant = "rect",
  count = 1,
  className = "",
  style = {},
}) {
  const isCircle = variant === "circle";
  const isText = variant === "text";
  const baseClass = `skeleton ${isCircle ? "skeleton-circle" : ""} ${isText ? "skeleton-text" : ""}`;

  const elements = Array.from({ length: count }).map((_, index) => (
    <div
      key={index}
      className={`${baseClass} ${className}`}
      style={{
        width,
        height,
        ...style,
      }}
    />
  ));

  if (count === 1) {
    return elements[0];
  }

  return <>{elements}</>;
});

export default Skeleton;
