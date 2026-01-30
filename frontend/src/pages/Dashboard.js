import React, { useState, useEffect } from 'react';
import api from '../services/api';
import CategorySalesChart from '../components/CategorySalesChart';
import SalesOverTimeChart from '../components/SalesOverTimeChart';

const Dashboard = () => {
  const [filename, setFilename] = useState(localStorage.getItem('lastUploadedFile') || '');
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!filename) {
      setError('Please upload a CSV file first.');
      return;
    }
    setLoading(true);
    api.getSalesData(filename)
      .then(res => {
        setData(res.data);
        setError('');
      })
      .catch(() => setError('Failed to load data. Please check your CSV file.'))
      .finally(() => setLoading(false));
  }, [filename]);

  // Simple analysis text based on data
  const totalUnitsSold = data.reduce((sum, item) => sum + item.units_sold, 0);
  const categories = [...new Set(data.map(item => item.category))];
  const topCategory = categories.length > 0 ? categories[0] : 'N/A';

  if (error) return <p className="error-text">{error}</p>;
  if (loading) return <p>Loading data...</p>;

  return (
    <div className="dashboard-container">
      <h2>Dashboard for: {filename}</h2>
      <div className="charts-row">
        <div className="chart-card">
          <h3>Sales by Category</h3>
          <CategorySalesChart data={data} />
        </div>
        <div className="chart-card">
          <h3>Sales Over Time</h3>
          <SalesOverTimeChart data={data} />
        </div>
      </div>
      <div className="analysis-text">
        <h3>Key Insights</h3>
        <p>Total units sold: <strong>{totalUnitsSold}</strong></p>
        <p>Number of categories: <strong>{categories.length}</strong></p>
        <p>Top category: <strong>{topCategory}</strong></p>
      </div>
    </div>
  );
};

export default Dashboard;