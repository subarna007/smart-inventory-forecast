import React, { useState } from 'react';
import api from '../services/api';

const FileUpload = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a CSV file first.');
      return;
    }
    setLoading(true);
    setMessage('');
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload', formData);
      localStorage.setItem('lastUploadedFile', res.data.filename);
      setMessage(`File "${res.data.filename}" uploaded successfully!`);
    } catch (err) {
      setMessage('Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="upload-container">
      <h2>Upload Your BigMart Nepal CSV</h2>
      <input type="file" accept=".csv" onChange={e => setFile(e.target.files[0])} />
      <button onClick={handleUpload} disabled={loading}>
        {loading ? 'Uploading...' : 'Upload'}
      </button>
      {message && <p className="upload-message">{message}</p>}
    </div>
  );
};

export default FileUpload;