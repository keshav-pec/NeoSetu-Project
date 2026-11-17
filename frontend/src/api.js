import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8080/api' });

// Send the login token with every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// If the token is no longer valid, log out and go to the login page
api.interceptors.response.use(null, (err) => {
  if (err.response?.status === 401 && localStorage.getItem('token')) {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.location.href = '/login';
  }
  return Promise.reject(err);
});

export const errorMessage = (err) => err.response?.data?.message || err.message || 'Something went wrong';

export const login = (mode, form) => api.post(`/auth/${mode}`, form).then((r) => r.data); // mode: login | register
export const createMeeting = (data) => api.post('/meetings', data).then((r) => r.data);
export const joinMeeting = (id, passcode) => api.post(`/meetings/${id}/join`, { passcode }).then((r) => r.data);
export const endMeeting = (id) => api.post(`/meetings/${id}/end`);
export const getCaptions = (id) => api.get(`/meetings/${id}/captions`).then((r) => r.data);
export const getHistory = () => api.get('/meetings/history').then((r) => r.data);
