import { memo } from "react";
import Skeleton from "../Skeleton";

const HomeSkeleton = memo(function HomeSkeleton() {
  return (
    <div className="fade-in" style={{ display: "flex", flexDirection: "column", gap: 32 }}>
      {/* Hero skeleton */}
      <div className="hero" style={{ height: 500, pointerEvents: "none" }}>
        <div className="hero-gradient" />
        <div className="hero-content" style={{ width: "100%", maxWidth: 600 }}>
          <Skeleton variant="text" width="100px" height="11px" style={{ marginBottom: 12 }} />
          <Skeleton variant="text" width="300px" height="48px" style={{ marginBottom: 16 }} />
          <Skeleton variant="text" width="150px" height="16px" style={{ marginBottom: 16 }} />
          <Skeleton variant="text" width="100%" height="14px" style={{ marginBottom: 8 }} />
          <Skeleton variant="text" width="90%" height="14px" style={{ marginBottom: 8 }} />
          <Skeleton variant="text" width="60%" height="14px" style={{ marginBottom: 24 }} />
          <div style={{ display: "flex", gap: 12 }}>
            <Skeleton width="120px" height="40px" style={{ borderRadius: 6 }} />
            <Skeleton width="120px" height="40px" style={{ borderRadius: 6 }} />
          </div>
        </div>
      </div>

      {/* 3 rows of 6 card skeletons */}
      {Array.from({ length: 3 }).map((_, rowIndex) => (
        <div key={rowIndex} className="section" style={{ padding: "0 48px", marginBottom: 24 }}>
          <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Skeleton variant="text" width="180px" height="20px" />
          </div>
          <div className="cards-grid" style={{ marginTop: 16 }}>
            {Array.from({ length: 6 }).map((_, cardIndex) => (
              <div key={cardIndex} className="card" style={{ pointerEvents: "none" }}>
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
        </div>
      ))}
    </div>
  );
});

export default HomeSkeleton;
