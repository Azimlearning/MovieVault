import { memo } from "react";
import Skeleton from "../Skeleton";

const CardGridSkeleton = memo(function CardGridSkeleton({ count = 12 }) {
  return (
    <div className="cards-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ pointerEvents: "none" }}>
          <div className="card-poster" style={{ position: "relative" }}>
            <Skeleton width="100%" height="100%" />
          </div>
          <div className="card-info" style={{ padding: "10px 12px" }}>
            <Skeleton variant="text" width="80%" height="14px" style={{ marginBottom: 6 }} />
            <Skeleton variant="text" width="40%" height="12px" />
          </div>
        </div>
      ))}
    </div>
  );
});

export default CardGridSkeleton;
