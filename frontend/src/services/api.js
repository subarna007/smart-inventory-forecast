import axios from 'axios';

// When running in Docker, we often use environment variables.
// For now, we'll use localhost as the default for your browser to connect.
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_BASE_URL,
});

export const uploadFile = (formData) =>
  api.post('/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const forecastProduct = (fileName, storeId = null, productId = null) =>
  api.get('/forecast_product', {
    params: { file_name: fileName, store_id: storeId, product_id: productId },
  });

export const getInventoryRecommendations = (fileName) =>
  api.get('/inventory_recommendations', {
    params: { file_name: fileName },
  });

export const getSalesData = (fileName) =>
  api.get('/sales_data', {
    params: { file_name: fileName },
  });

export default {
  uploadFile,
  forecastProduct,
  getInventoryRecommendations,
  getSalesData,
};