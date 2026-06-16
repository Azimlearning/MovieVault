import { memo } from "react";
import Skeleton from "../Skeleton";

const CastRowSkeleton = memo(function CastRowSkeleton({ count = 8 }) {
  return (
    <div style={{ display: "flex", gap: 16, overflowX: "hidden", padding: "8px 0" }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 80, flexShrink: 0 }}>
          <Skeleton variant="circle" width="70px" height="70px" style={{ marginBottom: 10, borderRadius: "50%" }} />
          <Skeleton variant="text" width="60px" height="12px" style={{ marginBottom: 4 }} />
          <Skeleton variant="text" width="50px" height="10px" />
        </div>
      ))}
    </div>
  );
});

export default CastRowSkeleton;
