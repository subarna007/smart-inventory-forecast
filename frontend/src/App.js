import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, registerables } from 'chart.js';
import {
  Box, Tabs, Tab, Typography, Button, CircularProgress, Grid, Card, CardContent, CardMedia,
  Select, MenuItem, InputLabel, FormControl
} from '@mui/material';
import { UploadFile } from '@mui/icons-material';
ChartJS.register(...registerables);

function TabPanel(props) {
  const { children, value, index } = props;
  return (
    <div hidden={value !== index} role="tabpanel" aria-labelledby={`tab-${index}`}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState(0);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [forecastDays, setForecastDays] = useState(30);

  const handleTabChange = (event, newValue) => setTab(newValue);

  const fetchDashboard = useCallback(async (filename, days) => {
    setLoading(true);
    try {
      const res = await axios.get('http://localhost:8000/dashboard_data', { params: { file_name: filename, forecast_days: days }});
      setDashboard(res.data);
    } catch (err) {
      console.error("fetchDashboard error:", err);
      alert("Failed to fetch dashboard data. See console.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleUpload = async () => {
    if (!file) { alert("Please select CSV file"); return; }
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const up = await axios.post('http://localhost:8000/upload', formData, { headers: {'Content-Type': 'multipart/form-data'} });
      await fetchDashboard(up.data.filename, forecastDays);
      setTab(0);
    } catch (err) {
      console.error("handleUpload error:", err);
      alert("Upload/analysis failed. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (dashboard && dashboard.file_name) {
      fetchDashboard(dashboard.file_name, forecastDays);
    }
  }, [forecastDays, dashboard, fetchDashboard]);

  const limitedSalesTrend = dashboard ? dashboard.sales_trend.slice(-30) : [];
  const limitedForecast = dashboard ? (dashboard.forecast || []).slice(0, forecastDays) : [];

  const overallLabels = [...limitedSalesTrend.map(s => s.date), ...limitedForecast.map(f => f.ds)];
  const overallSales = [...limitedSalesTrend.map(s => s.units_sold), ...new Array(limitedForecast.length).fill(null)];
  const overallForecastData = [...new Array(limitedSalesTrend.length).fill(null), ...limitedForecast.map(f => f.yhat)];

  const overallChartData = {
    labels: overallLabels,
    datasets: [
      { label: 'Historical Sales', data: overallSales, borderColor: '#1976d2', backgroundColor: 'rgba(25,118,210,0.08)', fill: true, tension: 0.2 },
      { label: 'Forecast', data: overallForecastData, borderColor: '#9c27b0', borderDash: [6,4], fill: false, tension: 0.2 }
    ]
  };

  const renderProductCard = (p) => {
    // Only render image if backend provided one. Hide on load error.
    const img = p.image_url || null;

    const trend = (p.trend || []).slice(-30); // last 30 points
    const productForecast = (p.forecast || []).slice(0, forecastDays); // respect forecastDays
    const labels = [...trend.map(t => t.date), ...productForecast.map(f => f.ds)];
    const trendData = [...trend.map(t => t.units_sold), ...new Array(productForecast.length).fill(null)];
    const forecastData = [...new Array(trend.length).fill(null), ...productForecast.map(f => f.yhat)];

    const chartData = { labels, datasets: [
      { data: trendData, borderColor: '#1976d2', fill: false, pointRadius: 0, tension: 0.3 },
      { data: forecastData, borderColor: '#9c27b0', borderDash: [5,5], fill: false, pointRadius: 0, tension: 0.3 }
    ]};

    const chartOptions = { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { display: false }}, plugins: { legend: { display: false }}, elements: { line: { borderWidth: 2 } } };

    return (
      <Card key={p.product} sx={{ maxWidth: 260, m: 1 }}>
        {img ? (
          <CardMedia
            component="img"
            height="140"
            image={img}
            alt={p.product}
            onError={(e) => { e.currentTarget.style.display = 'none'; }}
          />
        ) : null}
        <CardContent>
          <Typography variant="h6" noWrap>{p.product}</Typography>
          <Typography variant="body2" color="text.secondary">{(p.units_sold || 0).toLocaleString()} pcs</Typography>
          <Box sx={{ height: 80, mt: 1 }}>
            <Line data={chartData} options={chartOptions} />
          </Box>
        </CardContent>
      </Card>
    );
  };

  const statusColors = (status) => {
    if (status === 'Understocked') return { bg: '#ffebee', color: '#c62828' };
    if (status === 'Low Stock') return { bg: '#fff8e1', color: '#ef6c00' };
    return { bg: '#e8f5e9', color: '#2e7d32' }; // Healthy
  };

  return (
    <Box sx={{ width: '100%', typography: 'body1' }}>
      <Box sx={{ bgcolor: 'background.paper', p: 2, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>Smart Inventory Management</Typography>
        <Typography variant="subtitle1" gutterBottom>Upload CSV to analyze sales, forecasts and reorder recommendations.</Typography>

        <Box sx={{ my: 2 }}>
          <Button variant="contained" component="label" startIcon={<UploadFile />} disabled={loading}>
            {file ? file.name : "Select CSV File"}
            <input type="file" hidden accept=".csv" onChange={e => setFile(e.target.files[0])} />
          </Button>
          <Button variant="contained" color="primary" sx={{ ml: 2 }} onClick={handleUpload} disabled={loading || !file}>
            {loading ? <CircularProgress size={22} /> : "Analyze Data"}
          </Button>
        </Box>

        {dashboard && (
          <FormControl sx={{ minWidth: 160, mt: 2 }}>
            <InputLabel id="forecast-days-label">Forecast Length</InputLabel>
            <Select labelId="forecast-days-label" value={forecastDays} label="Forecast Length" onChange={e => setForecastDays(e.target.value)}>
              <MenuItem value={3}>Next 3 days</MenuItem>
              <MenuItem value={5}>Next 5 days</MenuItem>
              <MenuItem value={30}>Next 30 days</MenuItem>
              <MenuItem value={60}>Next 60 days</MenuItem>
            </Select>
          </FormControl>
        )}
      </Box>

      <Tabs value={tab} onChange={handleTabChange} centered>
        <Tab label="Sales Overview" />
        <Tab label="Inventory Health" />
        <Tab label="Reorder Recommendations" />
        <Tab label="Product Trends" />
      </Tabs>

      <TabPanel value={tab} index={0}>
        {dashboard ? (
          <>
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 2 }}>
                  <Typography variant="subtitle2">📦 Forecast ({forecastDays}d)</Typography>
                  <Typography variant="h5" fontWeight="bold">
                    {((dashboard.forecast || []).slice(0, forecastDays).reduce((s, f) => s + (f.yhat || 0), 0) || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })} units
                  </Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 2 }}>
                  <Typography variant="subtitle2">🧾 Current Stock (approx)</Typography>
                  <Typography variant="h5" fontWeight="bold">{(dashboard.current_stock_total || 0).toLocaleString()} units</Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Card sx={{ p: 2 }}>
                  <Typography variant="subtitle2">🔄 Recommended Reorder</Typography>
                  <Typography variant="h5" fontWeight="bold">{(dashboard.reorder_qty || 0).toLocaleString()} units</Typography>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                {(() => {
                  const sc = statusColors(dashboard.stock_status);
                  return (
                    <Card sx={{ p: 2, backgroundColor: sc.bg, color: sc.color }}>
                      <Typography variant="subtitle2">📉 Stock Status</Typography>
                      <Typography variant="h5" fontWeight="bold">{dashboard.stock_status}</Typography>
                    </Card>
                  );
                })()}
              </Grid>
            </Grid>

            <Box sx={{ maxWidth: 1000, mx: 'auto' }}>
              <Typography variant="h6" gutterBottom>📈 Sales Trend & Forecast (last 30 days)</Typography>
              <Line data={overallChartData} />
            </Box>
          </>
        ) : <Typography sx={{ mt: 4, textAlign: 'center' }}>Upload CSV to see overview.</Typography>}
      </TabPanel>

      <TabPanel value={tab} index={1}>
        {dashboard ? (
          <Box>
            <Typography variant="h6">🧾 Inventory Health</Typography>
            <Typography>Days to stockout: <strong>{dashboard.days_to_stockout ? dashboard.days_to_stockout.toFixed(1) : 'N/A'} days</strong></Typography>
            <Typography>Estimated stockout date: <strong>{dashboard.stockout_date}</strong></Typography>
          </Box>
        ) : <Typography sx={{ mt: 4, textAlign: 'center' }}>Upload CSV to see inventory health.</Typography>}
      </TabPanel>

      <TabPanel value={tab} index={2}>
        {dashboard ? (
          <Box>
            <Typography variant="h6">🔄 Reorder Recommendations</Typography>
            <Typography>Reorder by date: <strong>{dashboard.reorder_by_date}</strong></Typography>
            <Typography>Recommended reorder quantity: <strong>{(dashboard.reorder_qty || 0).toLocaleString()} units</strong></Typography>
          </Box>
        ) : <Typography sx={{ mt: 4, textAlign: 'center' }}>Upload CSV to see reorder recommendations.</Typography>}
      </TabPanel>

      <TabPanel value={tab} index={3}>
        {dashboard ? (
          <>
            <Typography variant="h6">📦 What is selling fast?</Typography>
            <Grid container spacing={2}>
              {dashboard.fast_selling.map(renderProductCard)}
            </Grid>

            <Typography variant="h6" sx={{ mt: 4 }}>🐢 What is not selling?</Typography>
            <Grid container spacing={2}>
              {dashboard.slow_selling.map(renderProductCard)}
            </Grid>
          </>
        ) : <Typography sx={{ mt: 4, textAlign: 'center' }}>Upload CSV to see product trends.</Typography>}
      </TabPanel>
    </Box>
  );
}