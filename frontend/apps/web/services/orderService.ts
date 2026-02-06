import axios from 'axios';

export const sendOrder = async (data: any) => {
  // Обратите внимание на порт 8765
  return axios.post('http://localhost:8765/api/v1/orders/create/', data);
};