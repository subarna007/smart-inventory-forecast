import React from 'react';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

const SalesOverTimeChart = ({ data }) => {
  const sortedData = [...data].sort((a, b) => new Date(a.date) - new Date(b.date));

  const chartData = {
    labels: sortedData.map(d => d.date),
    datasets: [{
      label: 'Units Sold',
      data: sortedData.map(d => d.units_sold),
      borderColor: '#36A2EB',
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      fill: true,
      tension: 0.4,
    }],
  };

  return <Line data={chartData} />;
};

export default SalesOverTimeChart;