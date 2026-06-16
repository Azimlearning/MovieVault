import { memo } from "react";
import Skeleton from "../Skeleton";
import CastRowSkeleton from "./CastRowSkeleton";
import CardGridSkeleton from "./CardGridSkeleton";

const TVDetailSkeleton = memo(function TVDetailSkeleton() {
  return (
    <div className="fade-in" style={{ pointerEvents: "none" }}>
      {/* Detail Hero Section */}
      <div className="detail-hero">
        <div className="detail-gradient" />
        <div className="detail-content">
          {/* Poster placeholder */}
          <div className="detail-poster">
            <Skeleton width="100%" height="100%" />
          </div>

          {/* Details Info placeholder */}
          <div className="detail-info">
            <Skeleton variant="text" width="60px" height="11px" style={{ marginBottom: 10 }} />
            <Skeleton variant="text" width="400px" height="56px" style={{ marginBottom: 16 }} />
            
            {/* Genres */}
            <div className="genres" style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              <Skeleton width="80px" height="24px" style={{ borderRadius: 12 }} />
              <Skeleton width="80px" height="24px" style={{ borderRadius: 12 }} />
              <Skeleton width="80px" height="24px" style={{ borderRadius: 12 }} />
            </div>

            {/* Meta */}
            <div className="detail-meta" style={{ display: "flex", gap: 16, marginBottom: 20 }}>
              <Skeleton variant="text" width="50px" height="13px" />
              <Skeleton variant="text" width="40px" height="13px" />
              <Skeleton variant="text" width="60px" height="13px" />
              <Skeleton variant="text" width="30px" height="13px" />
            </div>

            {/* Overview */}
            <Skeleton variant="text" width="100%" height="14px" style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="90%" height="14px" style={{ marginBottom: 8 }} />
            <Skeleton variant="text" width="75%" height="14px" style={{ marginBottom: 24 }} />

            {/* Actions */}
            <div className="detail-actions" style={{ display: "flex", gap: 12 }}>
              <Skeleton width="120px" height="40px" style={{ borderRadius: 6 }} />
              <Skeleton width="120px" height="40px" style={{ borderRadius: 6 }} />
              <Skeleton width="100px" height="40px" style={{ borderRadius: 6 }} />
            </div>
          </div>
        </div>
      </div>

      {/* Cast Row Section */}
      <div className="section" style={{ padding: "32px 48px 0" }}>
        <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Skeleton variant="text" width="100px" height="20px" />
        </div>
        <div style={{ marginTop: 16 }}>
          <CastRowSkeleton count={10} />
        </div>
      </div>

      {/* Season & Episodes Section */}
      <div className="section" style={{ padding: "32px 48px 0" }}>
        <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
          <Skeleton variant="text" width="150px" height="20px" />
          <Skeleton width="140px" height="34px" style={{ borderRadius: 6 }} />
        </div>
        
        {/* Episodes grid skeleton */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12, marginTop: 20 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="episode-card">
              <div className="episode-thumb">
                <Skeleton width="100%" height="100%" />
              </div>
              <div className="episode-info">
                <Skeleton variant="text" width="40px" height="10px" style={{ marginBottom: 4 }} />
                <Skeleton variant="text" width="120px" height="13px" style={{ marginBottom: 4 }} />
                <Skeleton variant="text" width="100%" height="11px" count={2} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* More Like This Grid Section */}
      <div className="section" style={{ padding: "32px 48px" }}>
        <div className="section-title" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Skeleton variant="text" width="150px" height="20px" />
        </div>
        <div style={{ marginTop: 16 }}>
          <CardGridSkeleton count={6} />
        </div>
      </div>
    </div>
  );
});

export default TVDetailSkeleton;
