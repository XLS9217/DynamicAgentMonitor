import axios from 'axios'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:7777'

export const request = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
})
