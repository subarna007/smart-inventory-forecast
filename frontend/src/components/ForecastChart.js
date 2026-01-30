import React from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale,
} from "chart.js";
import { Line } from "react-chartjs-2";
import "chartjs-adapter-date-fns"; // This is the date adapter

// Register the components with Chart.js
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TimeScale
);

function ForecastChart({ forecastData }) {
  if (!forecastData || forecastData.length === 0) {
    return <p style={{ textAlign: "center", color: "#7f8c8d" }}>No forecast data available.</p>;
  }

  const data = {
    labels: forecastData.map((item) => new Date(item.ds)),
    datasets: [
      {
        label: "Predicted Sales",
        data: forecastData.map((item) => item.yhat),
        borderColor: "#3498db",
        backgroundColor: "rgba(52, 152, 219, 0.2)",
        fill: true,
        tension: 0.4,
      },
      {
        label: "Upper Bound",
        data: forecastData.map((item) => item.yhat_upper),
        borderColor: "rgba(52, 152, 219, 0.1)",
        pointRadius: 0,
        fill: false,
        borderDash: [5, 5],
      },
      {
        label: "Lower Bound",
        data: forecastData.map((item) => item.yhat_lower),
        borderColor: "rgba(52, 152, 219, 0.1)",
        pointRadius: 0,
        fill: false,
        borderDash: [5, 5],
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: "top",
      },
    },
    scales: {
      x: {
        type: "time",
        time: {
          unit: "day",
        },
        title: {
          display: true,
          text: "Date",
        },
      },
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: "Sales Units",
        },
      },
    },
  };

  return (
    <div style={{ height: "400px" }}>
      <Line data={data} options={options} />
    </div>
  );
}

export default ForecastChart;