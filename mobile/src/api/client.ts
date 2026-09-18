import axios from 'axios';

import { config } from '../config';
import { authStore } from '../state/authStore';

export const api = axios.create({
  baseURL: config.apiBaseUrl,
  timeout: 15000,
});

api.interceptors.request.use((req) => {
  const token = authStore.getState().accessToken;
  if (token) {
    req.headers = req.headers ?? {};
    req.headers.Authorization = `Bearer ${token}`;
  }
  return req;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    // If we get 401, drop tokens and let UI redirect
    if (error?.response?.status === 401) {
      authStore.getState().signOut();
    }
    return Promise.reject(error);
  }
);

