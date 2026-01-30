import React from "react";

function InventoryCard({ recommendations }) {
  if (!recommendations) return null;

  return (
    <div className="card">
      <h3>Inventory Recommendations</h3>
      <div className="inventory-grid">
        <div className="metric-box">
          <div>Safety Stock</div>
          <div className="metric-value">{recommendations.safety_stock}</div>
        </div>
        <div className="metric-box">
          <div>Reorder Point</div>
          <div className="metric-value">{recommendations.reorder_point}</div>
        </div>
        <div className="metric-box">
          <div>Order Quantity</div>
          <div className="metric-value">{recommendations.recommended_order_quantity}</div>
        </div>
      </div>
    </div>
  );
}

export default InventoryCard;